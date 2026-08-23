import CollectionService from '../bll/services/CollectionService.js';

export default class CollectionController {
    static async createCollection(request, reply) {
        try {
            const collection = await CollectionService.createCollection(request.body, request.user.f.id);
            return collection;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getAllCollections(request, reply) {
        try {
            const collections = await CollectionService.getAllCollections(request.user.f.id);
            return collections;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getCollectionById(request, reply) {
        try {
            const { id } = request.params;
            const collection = await CollectionService.getCollectionById(id, request.user.f.id);
            return collection;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async updateCollection(request, reply) {
        try {
            const { id } = request.params;
            const collection = await CollectionService.updateCollection(id, request.body, request.user.f.id);
            return collection;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async deleteCollection(request, reply) {
        try {
            const { id } = request.params;
            const result = await CollectionService.deleteCollection(id, request.user.f.id);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getPublicCollection(request, reply) {
        try {
            const { id } = request.params;
            const collection = await CollectionService.getPublicCollection(id);
            return collection;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }
}
