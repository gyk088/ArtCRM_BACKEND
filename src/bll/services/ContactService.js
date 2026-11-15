import ContactModel from '../models/ContactModel.js';
import ContactWorkModel from '../models/ContactWorkModel.js';
import ContactSourceModel from '../models/ContactSourceModel.js';
import ContactCategoryModel from '../models/ContactCategoryModel.js';
import ArtService from './ArtService.js';
import { PgObject } from 'pgobject';

const WORK_STATUSES = ['purchased', 'interested'];

/**
 * Контакты (и их справочники «Источник», «Категория») внутри галереи общие —
 * по тем же правилам, что работы и справочники работ: галерея и все её
 * менеджеры видят и правят контакты друг друга, удалить может автор или сама
 * галерея (ArtService.__canUseRef / __refScopeUserIds). У остальных ролей
 * контакты по-прежнему личные.
 */
export default class ContactService {
    // Кто добавил контакт — для списка (в галерее контакты общие)
    static async __ownersMap(userIds) {
        const ids = [...new Set(userIds.filter(Boolean))];
        if (!ids.length) return new Map();
        const result = await PgObject.query('SELECT id, name, surname FROM my_user WHERE id = ANY($1::uuid[])', [ids]);
        return new Map(result.rows.map(u => [u.id, { id: u.id, name: u.name, surname: u.surname }]));
    }

    static async createContact(data, userId) {
        const contact = new ContactModel({
            user_id: userId,
            name: data.name,
            phone: data.phone,
            messenger: data.messenger,
            email: data.email,
            company: data.company,
            city: data.city,
            source: data.source,
            category: data.category,
            birthday: data.birthday || null,
            notes: data.notes,
        });

        await contact.save();
        const owners = await ContactService.__ownersMap([userId]);
        return { ...contact.toJSON(), owner: owners.get(userId) || null, works: [] };
    }

    static async getAllContacts(userId) {
        const scope = await ArtService.__refScopeUserIds(userId);
        const contacts = await ContactModel.select('WHERE user_id = ANY($1::uuid[]) ORDER BY ctime DESC', [scope]);
        const owners = await ContactService.__ownersMap(contacts.map(c => c.f.user_id));
        const result = [];

        for (const contact of contacts) {
            const works = await ContactWorkModel.getResolvedWorksForContact(contact.f.id);
            result.push({ ...contact.toJSON(), owner: owners.get(contact.f.user_id) || null, works });
        }

        return result;
    }

    static async getContactById(id, userId) {
        const contact = await ContactService.__getOwnedContact(id, userId);
        const works = await ContactWorkModel.getResolvedWorksForContact(id);
        const owners = await ContactService.__ownersMap([contact.f.user_id]);
        return { ...contact.toJSON(), owner: owners.get(contact.f.user_id) || null, works };
    }

    static async updateContact(id, data, userId) {
        const contact = await ContactService.__getOwnedContact(id, userId);

        if (data.name !== undefined) contact.f.name = data.name;
        if (data.phone !== undefined) contact.f.phone = data.phone;
        if (data.messenger !== undefined) contact.f.messenger = data.messenger;
        if (data.email !== undefined) contact.f.email = data.email;
        if (data.company !== undefined) contact.f.company = data.company;
        if (data.city !== undefined) contact.f.city = data.city;
        if (data.source !== undefined) contact.f.source = data.source;
        if (data.category !== undefined) contact.f.category = data.category;
        if (data.birthday !== undefined) contact.f.birthday = data.birthday || null;
        if (data.notes !== undefined) contact.f.notes = data.notes;

        await contact.save();

        const works = await ContactWorkModel.getResolvedWorksForContact(id);
        const owners = await ContactService.__ownersMap([contact.f.user_id]);
        return { ...contact.toJSON(), owner: owners.get(contact.f.user_id) || null, works };
    }

    static async deleteContact(id, userId) {
        const contact = await ContactService.__getOwnedContact(id, userId, { forDelete: true });

        await ContactWorkModel.removeAllWorksFromContact(id);
        await contact.delete();

        return { success: true, message: 'Contact deleted successfully' };
    }

    // ============= СВЯЗЬ С РАБОТАМИ =============
    // "Куплено" / "Интересуется" — статус хранится на самой связи
    // (my_contact_work.status), см. ContactWorkModel.

    static async addWorkToContact(contactId, artId, status, userId) {
        await ContactService.__getOwnedContact(contactId, userId);

        if (!WORK_STATUSES.includes(status)) {
            throw new Error(`Invalid status: must be one of ${WORK_STATUSES.join(', ')}`);
        }

        const existing = await ContactWorkModel.getByContactIdAndArtId(contactId, artId);
        if (existing) {
            existing.f.status = status;
            await existing.save();
        } else {
            const link = new ContactWorkModel({ contact_id: contactId, art_id: artId, status });
            await link.save();
        }

        return ContactWorkModel.getResolvedWorksForContact(contactId);
    }

    static async updateWorkStatus(contactId, artId, status, userId) {
        return ContactService.addWorkToContact(contactId, artId, status, userId);
    }

    static async removeWorkFromContact(contactId, artId, userId) {
        await ContactService.__getOwnedContact(contactId, userId);

        const existing = await ContactWorkModel.getByContactIdAndArtId(contactId, artId);
        if (existing) await existing.delete();

        return ContactWorkModel.getResolvedWorksForContact(contactId);
    }

    // Свой контакт или контакт галереи (forDelete — автор или сама галерея)
    static async __getOwnedContact(id, userId, { forDelete = false } = {}) {
        let contact = null;
        try {
            contact = await ContactModel.getById(id);
        } catch {
            // невалидный uuid
        }
        if (!(await ArtService.__canUseRef(contact, userId, { forDelete }))) {
            throw new Error('Contact not found');
        }
        return contact;
    }

    static async __getRef(Model, id, userId, notFound, { forDelete = false } = {}) {
        let entity = null;
        try {
            entity = await Model.getById(id);
        } catch {
            // невалидный uuid
        }
        if (!(await ArtService.__canUseRef(entity, userId, { forDelete }))) throw new Error(notFound);
        return entity;
    }

    // ============= ИСТОЧНИК КОНТАКТА (справочник) =============

    static async createSource(sourceData, userId) {
        const source = new ContactSourceModel({ name: sourceData.name, user_id: userId });
        await source.save();
        return source;
    }

    static async getAllSources(userId) {
        return ArtService.__getRefList(ContactSourceModel, userId);
    }

    static async updateSource(sourceData, userId) {
        const source = await ContactService.__getRef(ContactSourceModel, sourceData.id, userId, 'Source not found');

        source.f.name = sourceData.name !== undefined ? sourceData.name : source.f.name;
        await source.save();
        return source;
    }

    static async deleteSource(id, userId) {
        const source = await ContactService.__getRef(ContactSourceModel, id, userId, 'Source not found', { forDelete: true });

        const usedBy = await ContactModel.select('WHERE source = $1', [id]);
        if (usedBy.length > 0) {
            throw new Error(`Cannot delete source: it is used by ${usedBy.length} contact(s)`);
        }

        await source.delete();
        return { success: true, message: 'Source deleted successfully' };
    }

    // ============= КАТЕГОРИЯ КОНТАКТА (справочник) =============

    static async createCategory(categoryData, userId) {
        const category = new ContactCategoryModel({ name: categoryData.name, user_id: userId });
        await category.save();
        return category;
    }

    static async getAllCategories(userId) {
        return ArtService.__getRefList(ContactCategoryModel, userId);
    }

    static async updateCategory(categoryData, userId) {
        const category = await ContactService.__getRef(ContactCategoryModel, categoryData.id, userId, 'Category not found');

        category.f.name = categoryData.name !== undefined ? categoryData.name : category.f.name;
        await category.save();
        return category;
    }

    static async deleteCategory(id, userId) {
        const category = await ContactService.__getRef(ContactCategoryModel, id, userId, 'Category not found', { forDelete: true });

        const usedBy = await ContactModel.select('WHERE category = $1', [id]);
        if (usedBy.length > 0) {
            throw new Error(`Cannot delete category: it is used by ${usedBy.length} contact(s)`);
        }

        await category.delete();
        return { success: true, message: 'Category deleted successfully' };
    }
}
