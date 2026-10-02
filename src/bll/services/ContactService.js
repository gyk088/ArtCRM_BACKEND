import ContactModel from '../models/ContactModel.js';
import ContactWorkModel from '../models/ContactWorkModel.js';
import ContactSourceModel from '../models/ContactSourceModel.js';
import ContactCategoryModel from '../models/ContactCategoryModel.js';

const WORK_STATUSES = ['purchased', 'interested'];

export default class ContactService {
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
        return { ...contact.toJSON(), works: [] };
    }

    static async getAllContacts(userId) {
        const contacts = await ContactModel.getByUserId(userId);
        const result = [];

        for (const contact of contacts) {
            const works = await ContactWorkModel.getResolvedWorksForContact(contact.f.id);
            result.push({ ...contact.toJSON(), works });
        }

        return result;
    }

    static async getContactById(id, userId) {
        const contact = await ContactService.__getOwnedContact(id, userId);
        const works = await ContactWorkModel.getResolvedWorksForContact(id);
        return { ...contact.toJSON(), works };
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
        return { ...contact.toJSON(), works };
    }

    static async deleteContact(id, userId) {
        const contact = await ContactService.__getOwnedContact(id, userId);

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

    static async __getOwnedContact(id, userId) {
        const contact = await ContactModel.getById(id);
        if (!contact || contact.f.user_id !== userId) {
            throw new Error('Contact not found');
        }
        return contact;
    }

    // ============= ИСТОЧНИК КОНТАКТА (справочник) =============

    static async createSource(sourceData, userId) {
        const source = new ContactSourceModel({ name: sourceData.name, user_id: userId });
        await source.save();
        return source;
    }

    static async getAllSources(userId) {
        return ContactSourceModel.getByUserId(userId);
    }

    static async updateSource(sourceData, userId) {
        const source = await ContactSourceModel.getById(sourceData.id);
        if (!source || source.f.user_id !== userId) {
            throw new Error('Source not found');
        }

        source.f.name = sourceData.name !== undefined ? sourceData.name : source.f.name;
        await source.save();
        return source;
    }

    static async deleteSource(id, userId) {
        const source = await ContactSourceModel.getById(id);
        if (!source || source.f.user_id !== userId) {
            throw new Error('Source not found');
        }

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
        return ContactCategoryModel.getByUserId(userId);
    }

    static async updateCategory(categoryData, userId) {
        const category = await ContactCategoryModel.getById(categoryData.id);
        if (!category || category.f.user_id !== userId) {
            throw new Error('Category not found');
        }

        category.f.name = categoryData.name !== undefined ? categoryData.name : category.f.name;
        await category.save();
        return category;
    }

    static async deleteCategory(id, userId) {
        const category = await ContactCategoryModel.getById(id);
        if (!category || category.f.user_id !== userId) {
            throw new Error('Category not found');
        }

        const usedBy = await ContactModel.select('WHERE category = $1', [id]);
        if (usedBy.length > 0) {
            throw new Error(`Cannot delete category: it is used by ${usedBy.length} contact(s)`);
        }

        await category.delete();
        return { success: true, message: 'Category deleted successfully' };
    }
}
