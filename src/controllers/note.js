import NoteService from '../bll/services/NoteService.js';

export default class NoteController {
    static async list(request, reply) {
        try {
            return await NoteService.list(request.user);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async get(request, reply) {
        try {
            return await NoteService.get(request.params.id, request.user);
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async create(request, reply) {
        try {
            return await NoteService.create(request.body || {}, request.user);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async update(request, reply) {
        try {
            return await NoteService.update(request.params.id, request.body || {}, request.user);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async delete(request, reply) {
        try {
            return await NoteService.delete(request.params.id, request.user);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }
}
