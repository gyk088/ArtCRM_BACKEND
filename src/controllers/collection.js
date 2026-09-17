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

    // ============= FOLDERS =============

    static async createFolder(request, reply) {
        try {
            const folder = await CollectionService.createFolder(request.body, request.user);
            return folder;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getFolders(request, reply) {
        try {
            const folders = await CollectionService.getFoldersByUser(request.user);
            return folders;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async updateFolder(request, reply) {
        try {
            const { folderId } = request.params;
            const folder = await CollectionService.updateFolder(folderId, request.body, request.user);
            return folder;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async deleteFolder(request, reply) {
        try {
            const { folderId } = request.params;
            const result = await CollectionService.deleteFolder(folderId, request.user);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async moveCollectionToFolder(request, reply) {
        try {
            const { id } = request.params;
            const { folderId } = request.body;
            const collection = await CollectionService.moveCollectionToFolder(id, folderId || null, request.user);
            return collection;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async reorderCollections(request, reply) {
        try {
            const collections = await CollectionService.reorderCollections(request.body.ids || [], request.user);
            return collections;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async reorderFolders(request, reply) {
        try {
            const folders = await CollectionService.reorderFolders(request.body.ids || [], request.user);
            return folders;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }
}
