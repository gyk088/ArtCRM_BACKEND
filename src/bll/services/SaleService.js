import { PgObject } from 'pgobject';
import SaleModel from '../models/SaleModel.js';
import MyArtObject from '../models/ArtModel.js';
import ContactModel from '../models/ContactModel.js';
import ContactWorkModel from '../models/ContactWorkModel.js';
import ArtService from './ArtService.js';
import { CURRENCIES } from '../utils/const.js';

const MAX_COMMENT_LENGTH = 2000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const DISCOUNT_TYPES = ['pct', 'amount'];

function toNumberOrNull(value) {
    return value === null || value === undefined ? null : Number(value);
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Цена продажи из цены работы и скидки. Скидка — в процентах ('pct') или
 * суммой в валюте работы ('amount'); цена не может уйти в минус.
 */
export function applyDiscount(basePrice, discountType, discountValue) {
    const value = discountValue ?? 0;
    if (discountType === 'pct') return round2(basePrice * (100 - value) / 100);
    return round2(basePrice - value);
}

/**
 * Продажи работ (my_sale). Одна работа продаётся один раз.
 *
 * Права на продажу = права на саму работу: оформить/изменить/отменить
 * продажу может тот, кто может редактировать работу (свою или общую
 * работу галереи — см. ArtService.__assertCanAccessWork).
 *
 * Покупатель — контакт из "Контактов" вызывающего пользователя. При
 * продаже он автоматически отмечается у работы как "купил"
 * (my_contact_work.status = 'purchased').
 */
export default class SaleService {
    /**
     * Наружная форма продажи. numeric из pg приходит строкой — приводим к
     * числам. list_price — цена работы на момент продажи (база для скидки);
     * discount_type/discount_value — как скидку ввели, discount_pct и
     * discount_amount — она же в процентах и в деньгах.
     */
    static toDto(row) {
        const listPrice = toNumberOrNull(row.list_price);
        const salePrice = toNumberOrNull(row.sale_price);
        const hasBase = listPrice !== null && listPrice > 0;
        const discountPct = hasBase ? round2(((listPrice - salePrice) / listPrice) * 100) : null;
        const discountAmount = listPrice !== null ? round2(listPrice - salePrice) : null;

        return {
            id: row.id,
            art_id: row.art_id,
            user_id: row.user_id,
            sale_date: row.sale_date,
            list_price: listPrice,
            sale_price: salePrice,
            discount_type: row.discount_type ?? null,
            discount_value: toNumberOrNull(row.discount_value),
            discount_pct: discountPct,
            discount_amount: discountAmount,
            currency: row.currency,
            contact: row.contact_id ? { id: row.contact_id, name: row.contact_name ?? null } : null,
            sold_by: row.sold_by
                ? { id: row.sold_by, name: row.sold_by_name ?? null, surname: row.sold_by_surname ?? null }
                : null,
            comment: row.comment,
            ctime: row.ctime,
            utime: row.utime,
        };
    }

    static async __getResolved(saleId) {
        const result = await PgObject.query(`
            SELECT s.*, c.name AS contact_name, u.name AS sold_by_name, u.surname AS sold_by_surname
            FROM my_sale s
            LEFT JOIN my_contact c ON c.id = s.contact_id
            LEFT JOIN my_user u ON u.id = s.sold_by
            WHERE s.id = $1
            LIMIT 1
        `, [saleId]);
        const row = result.rows[0];
        return row ? SaleService.toDto(row) : null;
    }

    /**
     * Проверить и нормализовать поля продажи из запроса. При обновлении
     * (partial = true) отсутствующие поля не трогаем.
     */
    static __normalize(data, { partial = false } = {}) {
        const out = {};
        const has = (key) => data[key] !== undefined;

        if (!partial || has('sale_date')) {
            const date = data.sale_date;
            if (typeof date !== 'string' || !DATE_RE.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
                throw new Error('sale_date is required (YYYY-MM-DD)');
            }
            out.sale_date = date;
        }

        // Либо скидка (цену продажи посчитает сервер от цены работы), либо
        // сама цена продажи — когда у работы нет цены. Скидка важнее.
        if (has('discount_type') && data.discount_type !== null && data.discount_type !== '') {
            if (!DISCOUNT_TYPES.includes(data.discount_type)) {
                throw new Error('discount_type must be pct or amount');
            }
            const raw = data.discount_value;
            const value = raw === null || raw === undefined || raw === '' ? 0 : Number(raw);
            if (!Number.isFinite(value) || value < 0) throw new Error('discount_value must be >= 0');
            if (data.discount_type === 'pct' && value > 100) throw new Error('Discount cannot exceed 100%');
            out.discount_type = data.discount_type;
            out.discount_value = round2(value);
        } else if (!partial || has('sale_price')) {
            const price = Number(data.sale_price);
            if (data.sale_price === null || data.sale_price === undefined || data.sale_price === ''
                || !Number.isFinite(price) || price < 0) {
                throw new Error('sale_price is required and must be >= 0');
            }
            out.sale_price = round2(price);
        }

        if (has('currency')) {
            if (!CURRENCIES.includes(data.currency)) {
                throw new Error(`Invalid currency: must be one of ${CURRENCIES.join(', ')}`);
            }
            out.currency = data.currency;
        }

        if (has('comment')) {
            if (data.comment !== null && typeof data.comment !== 'string') throw new Error('comment must be a string');
            if (data.comment && data.comment.length > MAX_COMMENT_LENGTH) {
                throw new Error(`comment too long (max ${MAX_COMMENT_LENGTH} characters)`);
            }
            out.comment = data.comment || null;
        }

        if (has('contact_id')) {
            out.contact_id = data.contact_id || null;
        }

        return out;
    }

    // Покупатель — только из своих контактов (контакты строго личные, см. ContactService)
    static async __assertOwnContact(contactId, actorUser) {
        if (!contactId) return;
        let contact = null;
        try {
            contact = await ContactModel.getById(contactId);
        } catch {
            // невалидный uuid
        }
        if (!contact || contact.f.user_id !== actorUser.f.id) {
            throw new Error('Contact not found');
        }
    }

    // Отметить покупателя у работы как "купил" (создать связь или обновить статус)
    static async __markContactPurchased(contactId, artId) {
        if (!contactId) return;
        const existing = await ContactWorkModel.getByContactIdAndArtId(contactId, artId);
        if (existing) {
            if (existing.f.status !== 'purchased') {
                existing.f.status = 'purchased';
                await existing.save();
            }
        } else {
            await new ContactWorkModel({ contact_id: contactId, art_id: artId, status: 'purchased' }).save();
        }
    }

    /**
     * Цена продажи и поля скидки для сохранения. Со скидкой цена считается
     * от цены работы; без скидки берётся введённая цена продажи.
     */
    static __resolvePrice(fields, listPrice) {
        if (!fields.discount_type) {
            return { sale_price: fields.sale_price, discount_type: null, discount_value: null };
        }
        if (listPrice === null || listPrice <= 0) {
            throw new Error('Work price is not set: enter the sale price instead of a discount');
        }
        if (fields.discount_type === 'amount' && fields.discount_value > listPrice) {
            throw new Error('Discount cannot exceed the work price');
        }
        return {
            sale_price: applyDiscount(listPrice, fields.discount_type, fields.discount_value),
            discount_type: fields.discount_type,
            discount_value: fields.discount_value,
        };
    }

    static async __getAccessibleSale(id, actorUser) {
        let sale = null;
        try {
            sale = await SaleModel.getById(id);
        } catch {
            // невалидный uuid
        }
        if (!sale) throw new Error('Sale not found');

        const artObject = await MyArtObject.getById(sale.f.art_id);
        try {
            await ArtService.__assertCanAccessWork(actorUser, artObject);
        } catch {
            throw new Error('Sale not found');
        }
        return sale;
    }

    /** Продажа работы или null, если работа не продана */
    static async getByArtId(artId, actorUser) {
        const artObject = await MyArtObject.getById(artId);
        await ArtService.__assertCanAccessWork(actorUser, artObject);

        const sale = await SaleModel.getByArtId(artId);
        return sale ? SaleService.__getResolved(sale.f.id) : null;
    }

    static async create(data, actorUser) {
        const artId = data?.art_id;
        if (!artId) throw new Error('art_id is required');

        let artObject = null;
        try {
            artObject = await MyArtObject.getById(artId);
        } catch {
            // невалидный uuid
        }
        await ArtService.__assertCanAccessWork(actorUser, artObject);

        if (await SaleModel.getByArtId(artId)) {
            throw new Error('Art object is already sold');
        }

        const fields = SaleService.__normalize(data);
        await SaleService.__assertOwnContact(fields.contact_id, actorUser);

        // При скидке валюта — валюта цены работы, иначе выбранная
        const currency = (fields.discount_type ? artObject.f.currency : fields.currency)
            || artObject.f.currency || fields.currency || 'RUB';
        // Цена работы на момент продажи — база для скидки (только если
        // продажа в той же валюте, иначе сравнивать не с чем)
        const listPrice = currency === (artObject.f.currency || currency) ? toNumberOrNull(artObject.f.price) : null;
        const price = SaleService.__resolvePrice(fields, listPrice);

        const sale = new SaleModel({
            art_id: artId,
            user_id: artObject.f.user_id,
            list_price: listPrice,
            currency,
            sale_date: fields.sale_date,
            ...price,
            contact_id: fields.contact_id || null,
            comment: fields.comment ?? null,
            sold_by: actorUser.f.id,
            ctime: new Date(),
            utime: new Date(),
        });

        try {
            await sale.save();
        } catch (e) {
            // гонка двух одновременных продаж — второй упрётся в my_sale_art_unique
            if (e?.code === '23505') throw new Error('Art object is already sold');
            throw e;
        }

        await SaleService.__markContactPurchased(sale.f.contact_id, artId);
        return SaleService.__getResolved(sale.f.id);
    }

    static async update(id, data, actorUser) {
        const sale = await SaleService.__getAccessibleSale(id, actorUser);
        const fields = SaleService.__normalize(data || {}, { partial: true });

        if (fields.contact_id && fields.contact_id !== sale.f.contact_id) {
            await SaleService.__assertOwnContact(fields.contact_id, actorUser);
        }

        if (fields.discount_type || fields.sale_price !== undefined) {
            // База — цена работы, зафиксированная при продаже; если её не
            // было (цену работе задали позже) — текущая цена работы
            let listPrice = toNumberOrNull(sale.f.list_price);
            if (listPrice === null && fields.discount_type) {
                const artObject = await MyArtObject.getById(sale.f.art_id);
                listPrice = toNumberOrNull(artObject?.f.price);
                if (listPrice !== null) {
                    sale.f.list_price = listPrice;
                    if (artObject.f.currency) sale.f.currency = artObject.f.currency;
                }
            }
            Object.assign(sale.f, SaleService.__resolvePrice(fields, listPrice));
        }

        for (const key of ['sale_date', 'contact_id', 'comment']) {
            if (fields[key] !== undefined) sale.f[key] = fields[key];
        }
        // валюту меняем только у продажи без скидки (со скидкой она — валюта цены работы)
        if (fields.currency && !sale.f.discount_type) sale.f.currency = fields.currency;
        sale.f.utime = new Date();
        await sale.save();

        if (fields.contact_id) {
            await SaleService.__markContactPurchased(fields.contact_id, sale.f.art_id);
        }
        return SaleService.__getResolved(sale.f.id);
    }

    /**
     * Отменить продажу — работа снова считается непроданной. Отметку
     * покупателя "купил" в контактах не трогаем: это история общения с
     * клиентом, пользователь при желании уберёт её сам.
     */
    static async cancel(id, actorUser) {
        const sale = await SaleService.__getAccessibleSale(id, actorUser);
        await sale.delete();
        return { success: true };
    }
}
