// Раздел «Мои художники»: список художников со сводкой и лимитом галереи,
// карточка художника — анкета, работы, продажи, покупатели, задачи,
// заметки, ссылки и выставки с его работами.
//
// Видимость — как у справочника и работ (ArtService.__refScopeUserIds):
// у Gallery и Manager — всё, что внутри галереи (галерея + её менеджеры),
// у остальных — только своё. Художнику с личным кабинетом раздел не нужен
// (у него нет каталога художников) — фронтенд его не показывает.
import { PgObject } from 'pgobject';
import MyArtist from '../models/ArtistModel.js';
import UserModel from '../models/UserModel.js';
import ArtService from './ArtService.js';
import QuotaService from './QuotaService.js';
import ReportService from './ReportService.js';
import TaskService from './TaskService.js';
import { toPerson } from '../utils/userAccess.js';
import { getFileBaseUrl, ROLES } from '../utils/const.js';
import { thumbUrl } from '../utils/thumbs.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toNum = (v) => (v === null || v === undefined ? null : Number(v));
const round2 = (n) => Math.round(n * 100) / 100;
const fileDto = (id, ext) => (id ? { id, ext, url: `${getFileBaseUrl()}/${id}.${ext}`, thumb_url: thumbUrl(id, ext) } : null);

/** Суммы по валютам: { EUR: 1200, USD: 300 } → [{ currency, amount }] по убыванию */
const byCurrency = (map) => Object.entries(map)
    .map(([currency, amount]) => ({ currency, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);

function artistDto(row) {
    return {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        phone: row.phone ?? null,
        email: row.email ?? null,
        messenger: row.messenger ?? null,
        city: row.city ?? null,
        birth_year: row.birth_year ?? null,
        bio: row.bio ?? null,
        commission_pct: toNum(row.commission_pct),
        avatar: fileDto(row.f_id, row.f_ext),
    };
}

export default class ArtistService {
    /**
     * Подсказки для поля «Художник/Галерея» в ссылках и выставках:
     * название галереи (для Gallery и менеджера галереи), иначе — имя самого
     * пользователя (художник, менеджер без галереи).
     */
    static async bylineOptions(actorUser) {
        const displayName = (u) => [u.f.name, u.f.surname].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || null;
        if (actorUser.f.role === ROLES.GALLERY) return { gallery: displayName(actorUser), own: null };
        if (actorUser.f.role === ROLES.MANAGER && actorUser.f.managed_by_gallery_id) {
            const gallery = await UserModel.getUserById(actorUser.f.managed_by_gallery_id);
            if (gallery) return { gallery: displayName(gallery), own: displayName(actorUser) };
        }
        return { gallery: null, own: displayName(actorUser) };
    }

    /**
     * Лимит справочника художников: «использовано X из Y». null — если у
     * пользователя лимита нет (без галереи и не менеджер, Super Admin).
     */
    static async quota(actorUser) {
        const holderId = QuotaService.poolGalleryId(toPerson(actorUser));
        if (!holderId) return null;
        const holder = holderId === actorUser.f.id ? actorUser : await UserModel.getUserById(holderId);
        if (!holder) return null;
        return {
            used: await QuotaService.countCatalogArtistsOf(holderId),
            limit: holder.f.quota_catalog_artists || 0,
        };
    }

    /** Список художников со сводкой по работам и продажам + лимит */
    static async summary(actorUser) {
        const scope = await ArtService.__refScopeUserIds(actorUser.f.id);
        const artists = (await PgObject.query(`
            SELECT a.*, f.id AS f_id, f.ext AS f_ext
            FROM my_artist a
            LEFT JOIN my_file f ON f.id = a.avatar_id
            WHERE a.user_id = ANY($1::uuid[])
            ORDER BY lower(a.name)
        `, [scope])).rows;

        const works = (await PgObject.query(`
            SELECT ao.artist, count(*)::int AS works, count(s.id)::int AS sold
            FROM my_art_object ao
            LEFT JOIN my_sale s ON s.art_id = ao.id
            WHERE ao.user_id = ANY($1::uuid[]) AND ao.artist IS NOT NULL
            GROUP BY ao.artist
        `, [scope])).rows;
        const worksBy = new Map(works.map(r => [r.artist, r]));

        const sales = (await PgObject.query(`
            SELECT ao.artist, s.currency, sum(s.sale_price) AS total,
                -- не выплачено художнику — за вычетом комиссии галереи
                -- (своя у продажи → из анкеты художника)
                sum(CASE WHEN s.artist_paid THEN 0
                    ELSE s.sale_price * (1 - COALESCE(s.commission_pct, a.commission_pct, 0) / 100) END) AS unpaid,
                count(*) FILTER (WHERE NOT s.artist_paid)::int AS unpaid_count
            FROM my_sale s
            JOIN my_art_object ao ON ao.id = s.art_id
            LEFT JOIN my_artist a ON a.id = ao.artist
            WHERE ao.user_id = ANY($1::uuid[]) AND ao.artist IS NOT NULL
            GROUP BY ao.artist, s.currency
        `, [scope])).rows;
        const salesBy = new Map();
        for (const r of sales) {
            if (!salesBy.has(r.artist)) salesBy.set(r.artist, { total: {}, unpaid: {}, unpaid_count: 0 });
            const agg = salesBy.get(r.artist);
            agg.total[r.currency] = Number(r.total);
            if (Number(r.unpaid) > 0) agg.unpaid[r.currency] = round2(Number(r.unpaid));
            agg.unpaid_count += r.unpaid_count;
        }

        const tasks = (await PgObject.query(`
            SELECT t.artist_id, count(*)::int AS open
            FROM my_task t
            JOIN my_task_board b ON b.id = t.board_id
            JOIN my_task_status st ON st.id = t.status_id
            WHERE b.user_id = ANY($1::uuid[]) AND t.artist_id IS NOT NULL AND NOT st.is_final
            GROUP BY t.artist_id
        `, [scope])).rows;
        const tasksBy = new Map(tasks.map(r => [r.artist_id, r.open]));

        return {
            quota: await ArtistService.quota(actorUser),
            artists: artists.map(row => {
                const w = worksBy.get(row.id);
                const s = salesBy.get(row.id);
                return {
                    ...artistDto(row),
                    works_count: w?.works || 0,
                    sold_count: w?.sold || 0,
                    sales_total: s ? byCurrency(s.total) : [],
                    unpaid_total: s ? byCurrency(s.unpaid) : [],
                    unpaid_count: s?.unpaid_count || 0,
                    open_tasks_count: tasksBy.get(row.id) || 0,
                };
            }),
        };
    }

    static async __loadArtist(id, actorUser) {
        let artist = null;
        if (UUID_RE.test(String(id))) artist = await MyArtist.getById(String(id));
        if (!(await ArtService.__canUseRef(artist, actorUser.f.id))) throw new Error('Artist not found');
        return artist;
    }

    /** Карточка художника — всё, что с ним связано, одним запросом */
    static async overview(id, actorUser) {
        const artist = await ArtistService.__loadArtist(id, actorUser);
        const artistId = artist.f.id;
        const scope = await ArtService.__refScopeUserIds(actorUser.f.id);
        const commissionPct = toNum(artist.f.commission_pct);

        const [artistRow] = (await PgObject.query(`
            SELECT a.*, f.id AS f_id, f.ext AS f_ext FROM my_artist a
            LEFT JOIN my_file f ON f.id = a.avatar_id WHERE a.id = $1
        `, [artistId])).rows;

        // Работы
        const works = (await PgObject.query(`
            SELECT ao.id, ao.name, ao.year, ao.technique, ao.size, ao.price, ao.currency, ao.ctime,
                st.name AS status_name, st.color AS status_color,
                se.name AS seria_name, m.name AS media_name,
                f.id AS f_id, f.ext AS f_ext,
                s.id AS sale_id, s.sale_date
            FROM my_art_object ao
            LEFT JOIN my_status st ON st.id = ao.status
            LEFT JOIN my_seria se ON se.id = ao.seria
            LEFT JOIN my_media m ON m.id = ao.media
            LEFT JOIN my_file f ON f.id = ao.avatar_id
            LEFT JOIN my_sale s ON s.art_id = ao.id
            WHERE ao.user_id = ANY($1::uuid[]) AND ao.artist = $2
            ORDER BY ao.ctime DESC
        `, [scope, artistId])).rows.map(r => ({
            id: r.id,
            name: r.name,
            year: r.year,
            technique: r.technique,
            size: r.size,
            price: toNum(r.price),
            currency: r.currency,
            status: r.status_name ? { name: r.status_name, color: r.status_color } : null,
            seria: r.seria_name,
            media: r.media_name,
            avatar: fileDto(r.f_id, r.f_ext),
            sold: !!r.sale_id,
            sale_date: r.sale_date ?? null,
            ctime: r.ctime,
        }));

        // Продажи — те же, что видны в отчётах (права, валюта, расчёт с художником)
        const filters = ReportService.__normalizeFilters({ artists: [artistId] });
        const saleRows = await ReportService.__querySales(filters, actorUser);
        const sales = saleRows.map(r => {
            const salePrice = toNum(r.sale_price);
            const listPrice = toNum(r.list_price);
            // Комиссия галереи: своя у продажи → из анкеты художника → не задана
            const salePct = toNum(r.sale_commission_pct);
            const pct = salePct !== null ? salePct : commissionPct;
            const commissionAmount = pct === null ? null : round2(salePrice * pct / 100);
            return {
                id: r.id,
                art: { id: r.art_id, name: r.art_name, avatar: fileDto(r.f_id, r.f_ext) },
                sale_date: r.sale_date,
                currency: r.currency,
                list_price: listPrice,
                sale_price: salePrice,
                discount_type: r.discount_type ?? null,
                discount_value: toNum(r.discount_value),
                discount_amount: listPrice !== null ? round2(listPrice - salePrice) : null,
                discount_pct: listPrice ? round2(((listPrice - salePrice) / listPrice) * 100) : null,
                art_year: r.art_year ?? null,
                art_technique: r.art_technique ?? null,
                art_size: r.art_size ?? null,
                seria: r.seria_name ?? null,
                media: r.media_name ?? null,
                contact: r.contact_id ? { id: r.contact_id, name: r.contact_name } : null,
                sold_by: r.sold_by ? { id: r.sold_by, name: r.sold_by_name, surname: r.sold_by_surname } : null,
                artist_paid: !!r.artist_paid,
                artist_paid_at: r.artist_paid_at ?? null,
                // художнику = продажа − комиссия галереи (если задана)
                commission_pct: pct,
                commission_source: salePct !== null ? 'sale' : (commissionPct !== null ? 'artist' : null),
                commission_amount: commissionAmount,
                net_amount: round2(salePrice - (commissionAmount || 0)),
                comment: r.comment,
            };
        });

        const totals = { sales: {}, unpaid: {}, unpaidNet: {}, net: {}, gallery: {}, paidNet: {} };
        const addTo = (map, cur, v) => { map[cur] = (map[cur] || 0) + v; };
        for (const s of sales) {
            addTo(totals.sales, s.currency, s.sale_price);
            addTo(totals.net, s.currency, s.net_amount);
            addTo(totals.gallery, s.currency, s.commission_amount || 0);
            if (s.artist_paid) {
                addTo(totals.paidNet, s.currency, s.net_amount);
            } else {
                addTo(totals.unpaid, s.currency, s.sale_price);
                addTo(totals.unpaidNet, s.currency, s.net_amount);
            }
        }
        const noCommission = sales.filter(s => s.commission_pct === null).length;

        // Покупатели — контакты из продаж + кто купил/интересуется (карточка контакта)
        const contactRows = (await PgObject.query(`
            SELECT c.id, c.name, c.company, c.phone, c.email, c.city,
                cw.status, ao.id AS art_id, ao.name AS art_name
            FROM my_contact_work cw
            JOIN my_contact c ON c.id = cw.contact_id
            JOIN my_art_object ao ON ao.id = cw.art_id
            WHERE ao.artist = $2 AND ao.user_id = ANY($1::uuid[]) AND c.user_id = ANY($1::uuid[])
        `, [scope, artistId])).rows;
        const contactInfo = new Map();
        if (saleRows.some(r => r.contact_id)) {
            const ids = [...new Set(saleRows.filter(r => r.contact_id).map(r => r.contact_id))];
            for (const c of (await PgObject.query(
                'SELECT id, name, company, phone, email, city FROM my_contact WHERE id = ANY($1::uuid[])', [ids]
            )).rows) contactInfo.set(c.id, c);
        }
        const buyers = new Map();
        const interested = new Map();
        const ensure = (map, c) => {
            if (!map.has(c.id)) {
                map.set(c.id, { id: c.id, name: c.name, company: c.company ?? null, phone: c.phone ?? null, email: c.email ?? null, city: c.city ?? null, works: [], totals: {} });
            }
            return map.get(c.id);
        };
        for (const s of sales) {
            if (!s.contact) continue;
            const b = ensure(buyers, contactInfo.get(s.contact.id) || { id: s.contact.id, name: s.contact.name });
            if (!b.works.some(w => w.id === s.art.id)) b.works.push({ id: s.art.id, name: s.art.name, sale_date: s.sale_date });
            b.totals[s.currency] = (b.totals[s.currency] || 0) + s.sale_price;
        }
        // сначала покупатели — кто купил, в «интересуется» уже не попадает
        for (const r of [...contactRows].sort((x, y) => (x.status === 'interested') - (y.status === 'interested'))) {
            const map = r.status === 'interested' && !buyers.has(r.id) ? interested : buyers;
            const entry = ensure(map, r);
            if (!entry.works.some(w => w.id === r.art_id)) entry.works.push({ id: r.art_id, name: r.art_name });
        }
        const finish = (map) => [...map.values()]
            .map(c => ({ ...c, totals: byCurrency(c.totals) }))
            .sort((a, b) => b.works.length - a.works.length || String(a.name).localeCompare(String(b.name), 'ru'));

        // Задачи, привязанные к художнику (на досках, видимых пользователю)
        const taskRows = (await PgObject.query(
            TaskService.__taskSelect('t.artist_id = $1 AND t.board_id IN (SELECT id FROM my_task_board WHERE user_id = ANY($2::uuid[]))')
            + ' ORDER BY s.is_final ASC, t.due_date ASC NULLS LAST, t.ctime DESC',
            [artistId, scope]
        )).rows;
        const boardNames = new Map((await PgObject.query(
            'SELECT id, name FROM my_task_board WHERE id = ANY($1::uuid[])', [[...new Set(taskRows.map(r => r.board_id))]]
        )).rows.map(b => [b.id, b.name]));
        const statusRows = new Map((await PgObject.query(
            'SELECT id, name, color FROM my_task_status WHERE id = ANY($1::uuid[])', [[...new Set(taskRows.map(r => r.status_id))]]
        )).rows.map(s => [s.id, s]));
        const tasks = taskRows.map(r => ({
            ...TaskService.__taskDto(r),
            board: { id: r.board_id, name: boardNames.get(r.board_id) || '' },
            status: statusRows.get(r.status_id) ? { name: statusRows.get(r.status_id).name, color: statusRows.get(r.status_id).color } : null,
        }));

        // Заметки о художнике
        const notes = (await PgObject.query(`
            SELECT n.id, n.title, n.content, n.utime, n.ctime
            FROM my_note n
            WHERE n.artist_id = $1 AND n.user_id = ANY($2::uuid[])
            ORDER BY n.utime DESC NULLS LAST
        `, [artistId, scope])).rows.map(n => ({
            id: n.id,
            title: n.title,
            preview: String(n.content || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
                .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
                .replace(/\s+/g, ' ').trim().slice(0, 200),
            utime: n.utime || n.ctime,
        }));

        // Ссылки и выставки, где есть его работы
        const collections = (await PgObject.query(`
            SELECT c.id, c.name, count(*)::int AS works
            FROM my_collection c
            JOIN my_collection_work cw ON cw.collection_id = c.id
            JOIN my_art_object ao ON ao.id = cw.art_id
            WHERE ao.artist = $1 AND c.user_id = ANY($2::uuid[])
            GROUP BY c.id, c.name ORDER BY max(c.utime) DESC NULLS LAST
        `, [artistId, scope])).rows;
        const exhibitions = (await PgObject.query(`
            SELECT e.id, e.name, e.venue, e.start_date, e.end_date, count(*)::int AS works
            FROM my_exhibition e
            JOIN my_exhibition_work ew ON ew.exhibition_id = e.id
            JOIN my_art_object ao ON ao.id = ew.art_id
            WHERE ao.artist = $1 AND e.user_id = ANY($2::uuid[])
            GROUP BY e.id ORDER BY e.start_date DESC NULLS LAST
        `, [artistId, scope])).rows;

        // Портфолио художника (вкладка «Портфолио»; таблица — step 47)
        const portfoliosCount = (await PgObject.query(
            'SELECT count(*)::int AS n FROM my_portfolio WHERE artist_id = $1 AND user_id = ANY($2::uuid[])', [artistId, scope]
        ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0]?.n || 0;

        return {
            artist: artistDto(artistRow),
            stats: {
                works_count: works.length,
                sold_count: works.filter(w => w.sold).length,
                available_count: works.filter(w => !w.sold).length,
                sales_count: sales.length,
                // Все суммы «художнику» — за вычетом комиссии галереи
                sales_total: byCurrency(totals.sales),
                artist_total: byCurrency(totals.net),
                gallery_total: byCurrency(totals.gallery),
                paid_net_total: byCurrency(totals.paidNet),
                unpaid_count: sales.filter(s => !s.artist_paid).length,
                unpaid_gross_total: byCurrency(totals.unpaid),
                unpaid_net_total: byCurrency(totals.unpaidNet),
                // для совместимости: прежнее поле — теперь тоже к выплате (с комиссией)
                unpaid_total: byCurrency(totals.unpaidNet),
                // продаж без комиссии (ни у продажи, ни в анкете) — подсказка в интерфейсе
                no_commission_count: noCommission,
                buyers_count: buyers.size,
                open_tasks_count: tasks.filter(t => !t.is_closed).length,
                portfolios_count: portfoliosCount,
            },
            works,
            sales,
            buyers: finish(buyers),
            interested: finish(interested),
            tasks,
            notes,
            collections,
            exhibitions,
        };
    }
}
