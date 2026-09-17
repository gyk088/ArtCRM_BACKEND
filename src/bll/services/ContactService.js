import ContactModel from '../models/ContactModel.js';

export default class ContactService {
    static async createContact(data, userId) {
        const contact = new ContactModel({
            user_id: userId,
            name: data.name,
            phone: data.phone,
            messenger: data.messenger,
            notes: data.notes,
        });

        await contact.save();
        return contact;
    }

    static async getAllContacts(userId) {
        return ContactModel.getByUserId(userId);
    }

    static async getContactById(id, userId) {
        const contact = await ContactModel.getById(id);
        if (!contact || contact.f.user_id !== userId) {
            throw new Error('Contact not found');
        }
        return contact;
    }

    static async updateContact(id, data, userId) {
        const contact = await ContactModel.getById(id);
        if (!contact || contact.f.user_id !== userId) {
            throw new Error('Contact not found');
        }

        if (data.name !== undefined) contact.f.name = data.name;
        if (data.phone !== undefined) contact.f.phone = data.phone;
        if (data.messenger !== undefined) contact.f.messenger = data.messenger;
        if (data.notes !== undefined) contact.f.notes = data.notes;

        await contact.save();
        return contact;
    }

    static async deleteContact(id, userId) {
        const contact = await ContactModel.getById(id);
        if (!contact || contact.f.user_id !== userId) {
            throw new Error('Contact not found');
        }

        await contact.delete();
        return { success: true, message: 'Contact deleted successfully' };
    }
}
