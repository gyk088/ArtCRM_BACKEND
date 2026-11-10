import { PgObject } from 'pgobject';
import ReportModel from '../models/ReportModel.js';
import UserModel from '../models/UserModel.js';
import AuthorizationService from './AuthorizationService.js';
import { toPerson } from '../utils/userAccess.js';
import { CURRENCIES, getFileBaseUrl } from '../utils/const.js';

const REPORT_TYPES = ['sales'];
const MAX_NAME_LENGTH = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DISCOUNT_MODES = ['any', 'none', 'with'];

const round2 = (n) => Math.round(n * 100) / 100;
const toNum = (v) => (v === null || v === undefined ? null : Number(v));

// Условие видимости по владельцу — то же, что у работ (MyArtObject.getAllWithAvatar):
// свои записи + (для Gallery и её Manager'ов) записи всей галереи.
// $1 — id вызывающего, $2 — gallerySharingScope или null.
function visibleOwnerSql(column) {
    return `(${column} = $1
        OR ($2::uuid IS NOT NULL AND (
            ${column} = $2
            OR ${column} IN (SELECT id FROM my_user WHERE managed_by_gallery_id = $2 AND role = 'manager')
        )))`;
}

/**
 * Сохраняемые отчёты (my_report) с собственной таблицей курсов
 * (my_report_rate). Сейчас один тип — отчёт о продажах (my_sale).
 *
 * Пересчёт: сумма в валюте отчёта = сумма × rate(валюта сделки), где rate —
 * сколько единиц валюты отчёта стоит 1 единица валюты сделки. Курс самой
 * валюты отчёта всегда 1. Продажи в валюте без курса не выбрасываются
 * молча: они остаются в таблице без пересчёта и перечислены в
 * summary.missing_rates, но в итоговые суммы не входят.
 *
 * Доступ к отчёту — по тем же правилам, что и к работам: свой; в галерее —
 * общий для галереи и её менеджеров (AuthorizationService.canAccessWorkOwner),
 * удалять — автор или сама галерея (canDeleteWorkOwner).
 */
export default class ReportService {
    // ============= ДОСТУП =============

    static async __getAccessible(id, actorUser, { forDelete = false } = {}) {
        if (!UUID_RE.test(String(id))) throw new Error('Report not found');
        const report = await ReportModel.getById(id);
        if (!report) throw new Error('Report not found');

        if (report.f.user_id !== actorUser.f.id) {
            const owner = await UserModel.getUserById(report.f.user_id);
            const actor = toPerson(actorUser);
            const allowed = owner && (forDelete
                ? AuthorizationService.canDeleteWorkOwner(actor, toPerson(owner))
                : AuthorizationService.canAccessWorkOwner(actor, toPerson(owner)));
            if (!allowed) throw new Error('Report not found');
        }
        return report;
    }

    // ============= НОРМАЛИЗАЦИЯ =============

    static __normalizeName(name) {
        if (typeof name !== 'string' || !name.trim()) throw new Error('Report name is required');
        if (name.length > MAX_NAME_LENGTH) throw new Error(`Report name too long (max ${MAX_NAME_LENGTH})`);
        return name.trim();
    }

    static __normalizeCurrency(currency) {
        if (!CURRENCIES.includes(currency)) {
            throw new Error(`Invalid currency: must be one of ${CURRENCIES.join(', ')}`);
        }
        return currency;
    }

    /**
     * Фильтры приходят с фронта как JSON — приводим к известной форме,
     * неизвестные ключи отбрасываем (в БД и SQL попадает только это).
     */
    static __normalizeFilters(raw) {
        const f = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        const date = (key) => {
            const v = f[key];
            if (v === undefined || v === null || v === '') return null;
            if (typeof v !== 'string' || !DATE_RE.test(v)) throw new Error(`Invalid filter ${key}: expected YYYY-MM-DD`);
            return v;
        };
        const uuids = (key) => {
            const v = f[key];
            if (v === undefined || v === null) return [];
            if (!Array.isArray(v) || v.some(x => !UUID_RE.test(String(x)))) throw new Error(`Invalid filter ${key}`);
            return [...new Set(v.map(String))];
        };
        const num = (key, { min = -Infinity, max = Infinity } = {}) => {
            const v = f[key];
            if (v === undefined || v === null || v === '') return null;
            const n = Number(v);
            if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Invalid filter ${key}`);
            return n;
        };

        const currencies = f.currencies === undefined || f.currencies === null ? [] : f.currencies;
        if (!Array.isArray(currencies) || currencies.some(c => !CURRENCIES.includes(c))) {
            throw new Error('Invalid filter currencies');
        }
        const discount = f.discount === undefined || f.discount === null || f.discount === '' ? 'any' : f.discount;
        if (!DISCOUNT_MODES.includes(discount)) throw new Error('Invalid filter discount');

        const out = {
            date_from: date('date_from'),
            date_to: date('date_to'),
            artists: uuids('artists'),
            series: uuids('series'),
            media: uuids('media'),
            contacts: uuids('contacts'),
            sold_by: uuids('sold_by'),
            currencies: [...new Set(currencies)],
            discount,
            discount_min: num('discount_min', { min: -1000, max: 100 }),
            discount_max: num('discount_max', { min: -1000, max: 100 }),
            price_min: num('price_min', { min: 0 }),
            price_max: num('price_max', { min: 0 }),
        };
        if (out.date_from && out.date_to && out.date_from > out.date_to) {
            throw new Error('date_from must be before date_to');
        }
        return out;
    }

    /** { USD: 3.25, EUR: 3.55 } — курс самой валюты отчёта не храним (он всегда 1) */
    static __normalizeRates(raw, reportCurrency) {
        if (raw === undefined || raw === null) return {};
        if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('rates must be an object');
        const out = {};
        for (const [currency, value] of Object.entries(raw)) {
            if (!CURRENCIES.includes(currency)) throw new Error(`Invalid rate currency: ${currency}`);
            if (currency === reportCurrency || value === null || value === '') continue;
            const n = Number(value);
            if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid rate for ${currency}: must be > 0`);
            out[currency] = n;
        }
        return out;
    }

    // ============= КУРСЫ =============

    static async __getRates(reportId) {
        const result = await PgObject.query('SELECT currency, rate FROM my_report_rate WHERE report_id = $1', [reportId]);
        const rates = {};
        for (const row of result.rows) rates[row.currency] = Number(row.rate);
        return rates;
    }

    static async __setRates(reportId, rates) {
        await PgObject.query('DELETE FROM my_report_rate WHERE report_id = $1', [reportId]);
        for (const [currency, rate] of Object.entries(rates)) {
            await PgObject.query(
                'INSERT INTO my_report_rate (report_id, currency, rate) VALUES ($1, $2, $3)',
                [reportId, currency, rate]
            );
        }
    }

    /**
     * Пересчитать таблицу курсов под другую валюту отчёта.
     * rates — курсы к oldCurrency; результат — курсы к newCurrency:
     * rate'(c) = rate(c) / rate(newCurrency), rate'(oldCurrency) = 1 / rate(newCurrency).
     * Если курса новой валюты в старой таблице нет — пересчитать нельзя, {}.
     */
    static convertRates(rates, oldCurrency, newCurrency) {
        if (oldCurrency === newCurrency) return { ...rates };
        const pivot = rates[newCurrency];
        if (!pivot) return {};
        const out = { [oldCurrency]: round6(1 / pivot) };
        for (const [currency, rate] of Object.entries(rates)) {
            if (currency === newCurrency) continue;
            out[currency] = round6(rate / pivot);
        }
        return out;
    }

    /**
     * Курсы-подсказка для нового/пустого отчёта: из последнего изменённого
     * отчёта пользователя, где курсы заданы, пересчитанные к нужной валюте.
     */
    static async getSuggestedRates(currency, actorUser, excludeReportId = null) {
        ReportService.__normalizeCurrency(currency);
        const result = await PgObject.query(`
            SELECT r.id, r.name, r.currency
            FROM my_report r
            WHERE r.user_id = $1
              AND ($2::uuid IS NULL OR r.id <> $2)
              AND EXISTS (SELECT 1 FROM my_report_rate rr WHERE rr.report_id = r.id)
            ORDER BY r.utime DESC
            LIMIT 1
        `, [actorUser.f.id, excludeReportId]);
        const source = result.rows[0];
        if (!source) return { rates: {}, from_report: null };

        const rates = ReportService.convertRates(await ReportService.__getRates(source.id), source.currency, currency);
        return { rates, from_report: { id: source.id, name: source.name } };
    }

    // ============= CRUD =============

    static toDto(report, rates, owner = null) {
        return {
            id: report.f.id,
            user_id: report.f.user_id,
            owner,
            name: report.f.name,
            type: report.f.type,
            currency: report.f.currency,
            filters: ReportService.__normalizeFilters(report.f.filters || {}),
            rates: rates || {},
            ctime: report.f.ctime,
            utime: report.f.utime,
        };
    }

    static async list(actorUser) {
        const scope = AuthorizationService.gallerySharingScope(toPerson(actorUser));
        const result = await PgObject.query(`
            SELECT r.id, r.user_id, r.name, r.type, r.currency, r.filters, r.ctime, r.utime,
                u.name AS owner_name, u.surname AS owner_surname
            FROM my_report r
            LEFT JOIN my_user u ON u.id = r.user_id
            WHERE ${visibleOwnerSql('r.user_id')}
            ORDER BY r.utime DESC
        `, [actorUser.f.id, scope]);
        return result.rows.map(row => ({
            id: row.id,
            user_id: row.user_id,
            owner: { id: row.user_id, name: row.owner_name, surname: row.owner_surname },
            name: row.name,
            type: row.type,
            currency: row.currency,
            filters: row.filters || {},
            ctime: row.ctime,
            utime: row.utime,
        }));
    }

    static async get(id, actorUser) {
        const report = await ReportService.__getAccessible(id, actorUser);
        return ReportService.toDto(report, await ReportService.__getRates(report.f.id));
    }

    /**
     * Создать отчёт. Если курсы не переданы — подставляем курсы из
     * последнего отчёта пользователя (их потом можно поправить).
     */
    static async create(data, actorUser) {
        const type = data?.type || 'sales';
        if (!REPORT_TYPES.includes(type)) throw new Error('Invalid report type');
        // Всё проверяем ДО сохранения — иначе при ошибке в курсах в базе
        // остался бы отчёт без курсов, хотя клиент получил 400
        const currency = ReportService.__normalizeCurrency(data?.currency);
        const name = ReportService.__normalizeName(data?.name);
        const filters = ReportService.__normalizeFilters(data?.filters);
        const rates = data?.rates !== undefined
            ? ReportService.__normalizeRates(data.rates, currency)
            : (await ReportService.getSuggestedRates(currency, actorUser)).rates;

        const report = new ReportModel({
            user_id: actorUser.f.id,
            name,
            type,
            currency,
            filters,
            ctime: new Date(),
            utime: new Date(),
        });
        await report.save();
        await ReportService.__setRates(report.f.id, rates);

        return ReportService.toDto(report, await ReportService.__getRates(report.f.id));
    }

    /**
     * Изменить отчёт: name, currency, filters, rates — любые из них.
     * При смене валюты без явно переданных курсов курсы пересчитываются
     * под новую валюту (convertRates).
     */
    static async update(id, data, actorUser) {
        const report = await ReportService.__getAccessible(id, actorUser);
        const oldCurrency = report.f.currency;

        // Сначала проверяем всё, потом сохраняем — без частичных обновлений
        const name = data.name !== undefined ? ReportService.__normalizeName(data.name) : report.f.name;
        const currency = data.currency !== undefined ? ReportService.__normalizeCurrency(data.currency) : oldCurrency;
        const filters = data.filters !== undefined ? ReportService.__normalizeFilters(data.filters) : report.f.filters;
        let rates = null;
        if (data.rates !== undefined) {
            rates = ReportService.__normalizeRates(data.rates, currency);
        } else if (currency !== oldCurrency) {
            const converted = ReportService.convertRates(await ReportService.__getRates(report.f.id), oldCurrency, currency);
            rates = ReportService.__normalizeRates(converted, currency);
        }

        report.f.name = name;
        report.f.currency = currency;
        report.f.filters = filters;
        report.f.utime = new Date();
        await report.save();
        if (rates !== null) await ReportService.__setRates(report.f.id, rates);

        return ReportService.toDto(report, await ReportService.__getRates(report.f.id));
    }

    static async delete(id, actorUser) {
        const report = await ReportService.__getAccessible(id, actorUser, { forDelete: true });
        await PgObject.query('DELETE FROM my_report_rate WHERE report_id = $1', [report.f.id]);
        await report.delete();
        return { success: true };
    }

    // ============= РАСЧЁТ =============

    /**
     * Продажи под фильтры отчёта (то, что можно отфильтровать в SQL).
     * Скидка и цена фильтруются уже после пересчёта валют — в compute().
     */
    static async __querySales(filters, actorUser) {
        const scope = AuthorizationService.gallerySharingScope(toPerson(actorUser));
        const params = [actorUser.f.id, scope];
        const where = [visibleOwnerSql('s.user_id')];
        const add = (value) => {
            params.push(value);
            return `$${params.length}`;
        };

        if (filters.date_from) where.push(`s.sale_date >= ${add(filters.date_from)}::date`);
        if (filters.date_to) where.push(`s.sale_date <= ${add(filters.date_to)}::date`);
        if (filters.artists.length) where.push(`ao.artist = ANY(${add(filters.artists)}::uuid[])`);
        if (filters.series.length) where.push(`ao.seria = ANY(${add(filters.series)}::uuid[])`);
        if (filters.media.length) where.push(`ao.media = ANY(${add(filters.media)}::uuid[])`);
        if (filters.contacts.length) where.push(`s.contact_id = ANY(${add(filters.contacts)}::uuid[])`);
        if (filters.sold_by.length) where.push(`s.sold_by = ANY(${add(filters.sold_by)}::uuid[])`);
        if (filters.currencies.length) where.push(`s.currency = ANY(${add(filters.currencies)}::text[])`);

        const result = await PgObject.query(`
            SELECT s.id, s.art_id, s.sale_date, s.list_price, s.sale_price, s.currency,
                s.discount_type, s.discount_value, s.comment, s.contact_id, s.sold_by,
                ao.name AS art_name, ao.year AS art_year, ao.technique AS art_technique, ao.size AS art_size,
                ao.artist AS artist_id, a.name AS artist_name,
                ao.seria AS seria_id, se.name AS seria_name,
                ao.media AS media_id, m.name AS media_name,
                f.id AS f_id, f.ext AS f_ext,
                c.name AS contact_name,
                u.name AS sold_by_name, u.surname AS sold_by_surname
            FROM my_sale s
            JOIN my_art_object ao ON ao.id = s.art_id
            LEFT JOIN my_artist a ON a.id = ao.artist
            LEFT JOIN my_seria se ON se.id = ao.seria
            LEFT JOIN my_media m ON m.id = ao.media
            LEFT JOIN my_file f ON f.id = ao.avatar_id
            LEFT JOIN my_contact c ON c.id = s.contact_id
            LEFT JOIN my_user u ON u.id = s.sold_by
            WHERE ${where.join(' AND ')}
            ORDER BY s.sale_date DESC, s.ctime DESC
        `, params);
        return result.rows;
    }

    /**
     * Рассчитать отчёт: строки с пересчётом в валюту отчёта, сводка,
     * разбивки по валютам, художникам и месяцам.
     */
    static async compute(id, actorUser) {
        const report = await ReportService.__getAccessible(id, actorUser);
        const rates = await ReportService.__getRates(report.f.id);
        const dto = ReportService.toDto(report, rates);
        const { filters, currency: reportCurrency } = dto;
        const rateFor = (cur) => (cur === reportCurrency ? 1 : rates[cur] ?? null);

        const salesRows = await ReportService.__querySales(filters, actorUser);
        const currenciesInData = [...new Set(salesRows.map(r => r.currency))].sort();

        let rows = salesRows.map(r => {
            const listPrice = toNum(r.list_price);
            const salePrice = toNum(r.sale_price);
            const rate = rateFor(r.currency);
            const discountPct = listPrice && listPrice > 0 ? round2(((listPrice - salePrice) / listPrice) * 100) : null;
            const converted = rate === null ? null : round2(salePrice * rate);
            return {
                sale_id: r.id,
                art_id: r.art_id,
                art_name: r.art_name,
                art_year: r.art_year,
                art_technique: r.art_technique,
                art_size: r.art_size,
                avatar_url: r.f_id ? `${getFileBaseUrl()}/${r.f_id}.${r.f_ext}` : null,
                artist: r.artist_id ? { id: r.artist_id, name: r.artist_name } : null,
                seria: r.seria_id ? { id: r.seria_id, name: r.seria_name } : null,
                media: r.media_id ? { id: r.media_id, name: r.media_name } : null,
                sale_date: r.sale_date,
                currency: r.currency,
                list_price: listPrice,
                sale_price: salePrice,
                discount_pct: discountPct,
                discount_amount: listPrice === null ? null : round2(listPrice - salePrice),
                discount_type: r.discount_type ?? null,
                discount_value: toNum(r.discount_value),
                rate,
                list_price_converted: rate === null || listPrice === null ? null : round2(listPrice * rate),
                sale_price_converted: converted,
                contact: r.contact_id ? { id: r.contact_id, name: r.contact_name } : null,
                sold_by: r.sold_by ? { id: r.sold_by, name: r.sold_by_name, surname: r.sold_by_surname } : null,
                comment: r.comment,
            };
        });

        // Фильтры по скидке и цене (цена — в валюте отчёта)
        if (filters.discount === 'none') rows = rows.filter(r => !(r.discount_pct > 0));
        if (filters.discount === 'with') rows = rows.filter(r => r.discount_pct > 0);
        if (filters.discount_min !== null) rows = rows.filter(r => r.discount_pct !== null && r.discount_pct >= filters.discount_min);
        if (filters.discount_max !== null) rows = rows.filter(r => r.discount_pct !== null && r.discount_pct <= filters.discount_max);
        const priceFilterActive = filters.price_min !== null || filters.price_max !== null;
        // Без курса цену в валюте отчёта не сравнить — такие строки при
        // фильтре по цене не показываем, но учитываем в missing_rates
        const excludedByPriceNoRate = priceFilterActive ? rows.filter(r => r.sale_price_converted === null) : [];
        if (filters.price_min !== null) rows = rows.filter(r => r.sale_price_converted !== null && r.sale_price_converted >= filters.price_min);
        if (filters.price_max !== null) rows = rows.filter(r => r.sale_price_converted !== null && r.sale_price_converted <= filters.price_max);

        return {
            report: dto,
            currencies_in_data: currenciesInData,
            rows,
            summary: ReportService.__summarize(rows, excludedByPriceNoRate, rateFor),
        };
    }

    static __summarize(rows, excludedNoRate, rateFor) {
        const converted = rows.filter(r => r.sale_price_converted !== null);
        const total = round2(converted.reduce((acc, r) => acc + r.sale_price_converted, 0));
        const withList = converted.filter(r => r.list_price_converted !== null);
        const totalList = round2(withList.reduce((acc, r) => acc + r.list_price_converted, 0));
        const totalListedSales = round2(withList.reduce((acc, r) => acc + r.sale_price_converted, 0));
        const withDiscount = rows.filter(r => r.discount_pct !== null);

        const group = (keyFn, labelFn) => {
            const map = new Map();
            for (const r of rows) {
                const key = keyFn(r);
                if (!map.has(key)) map.set(key, { ...labelFn(r), count: 0, count_without_rate: 0, total: 0 });
                const g = map.get(key);
                g.count++;
                if (r.sale_price_converted === null) g.count_without_rate++;
                else g.total = round2(g.total + r.sale_price_converted);
            }
            return [...map.values()];
        };

        const missing = new Map();
        for (const r of [...rows, ...excludedNoRate]) {
            if (r.rate === null) missing.set(r.currency, (missing.get(r.currency) || 0) + 1);
        }

        return {
            count: rows.length,
            converted_count: converted.length,
            total,
            avg_check: converted.length ? round2(total / converted.length) : null,
            // Средняя скидка — по строкам, где известна цена работы
            avg_discount_pct: withDiscount.length
                ? round2(withDiscount.reduce((acc, r) => acc + r.discount_pct, 0) / withDiscount.length)
                : null,
            // Сколько "отдали" скидками в деньгах (цена работы − продажа) по строкам с ценой работы
            discount_amount: round2(totalList - totalListedSales),
            missing_rates: [...missing.entries()].map(([currency, count]) => ({ currency, count })),
            by_currency: group(r => r.currency, r => ({ currency: r.currency, rate: rateFor(r.currency) }))
                .map(g => ({
                    ...g,
                    total_original: round2(rows.filter(r => r.currency === g.currency).reduce((acc, r) => acc + r.sale_price, 0)),
                }))
                .sort((a, b) => a.currency.localeCompare(b.currency)),
            by_artist: group(r => r.artist?.id || '', r => ({ artist: r.artist }))
                .sort((a, b) => b.total - a.total || b.count - a.count),
            by_month: group(r => r.sale_date.slice(0, 7), r => ({ month: r.sale_date.slice(0, 7) }))
                .sort((a, b) => a.month.localeCompare(b.month)),
        };
    }
}

function round6(n) {
    return Math.round(n * 1e6) / 1e6;
}
