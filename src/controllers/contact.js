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

    static async addWorkToContact(request, reply) {
        try {
            const { id } = request.params;
            const { artId, status } = request.body;
            const works = await ContactService.addWorkToContact(id, artId, status, request.user.f.id);
            return works;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async updateWorkStatus(request, reply) {
        try {
            const { id, artId } = request.params;
            const { status } = request.body;
            const works = await ContactService.updateWorkStatus(id, artId, status, request.user.f.id);
            return works;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async removeWorkFromContact(request, reply) {
        try {
            const { id, artId } = request.params;
            const works = await ContactService.removeWorkFromContact(id, artId, request.user.f.id);
            return works;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    // ============= ИСТОЧНИК (справочник) =============

    static async createSource(request, reply) {
        try {
            return await ContactService.createSource(request.body, request.user.f.id);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getAllSources(request, reply) {
        try {
            return await ContactService.getAllSources(request.user.f.id);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async updateSource(request, reply) {
        try {
            return await ContactService.updateSource(request.body, request.user.f.id);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async deleteSource(request, reply) {
        try {
            return await ContactService.deleteSource(request.params.id, request.user.f.id);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    // ============= КАТЕГОРИЯ (справочник) =============

    static async createCategory(request, reply) {
        try {
            return await ContactService.createCategory(request.body, request.user.f.id);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getAllCategories(request, reply) {
        try {
            return await ContactService.getAllCategories(request.user.f.id);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async updateCategory(request, reply) {
        try {
            return await ContactService.updateCategory(request.body, request.user.f.id);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async deleteCategory(request, reply) {
        try {
            return await ContactService.deleteCategory(request.params.id, request.user.f.id);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }
}
