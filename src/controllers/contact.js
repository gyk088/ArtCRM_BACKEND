import ContactService from '../bll/services/ContactService.js';

export default class ContactController {
    static async createContact(request, reply) {
        try {
            const contact = await ContactService.createContact(request.body, request.user.f.id);
            return contact;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getAllContacts(request, reply) {
        try {
            const contacts = await ContactService.getAllContacts(request.user.f.id);
            return contacts;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getContactById(request, reply) {
        try {
            const { id } = request.params;
            const contact = await ContactService.getContactById(id, request.user.f.id);
            return contact;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async updateContact(request, reply) {
        try {
            const { id } = request.params;
            const contact = await ContactService.updateContact(id, request.body, request.user.f.id);
            return contact;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async deleteContact(request, reply) {
        try {
            const { id } = request.params;
            const result = await ContactService.deleteContact(id, request.user.f.id);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }
}
