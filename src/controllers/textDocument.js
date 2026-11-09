/**
 * Контроллер для биографий и резюме — оба работают через экземпляр
 * TextDocumentService, поэтому контроллер создаётся фабрикой на сервис.
 */
export default function createTextDocumentController(service) {
    return {
        async getAll(request, reply) {
            try {
                return await service.getAll(request.user.f.id);
            } catch (error) {
                reply.code(400).send({ error: error.message });
            }
        },

        async getById(request, reply) {
            try {
                return await service.getById(request.params.id, request.user.f.id);
            } catch (error) {
                reply.code(404).send({ error: error.message });
            }
        },

        async create(request, reply) {
            try {
                return await service.create(request.body || {}, request.user.f.id);
            } catch (error) {
                reply.code(400).send({ error: error.message });
            }
        },

        async update(request, reply) {
            try {
                return await service.update(request.params.id, request.body || {}, request.user.f.id);
            } catch (error) {
                reply.code(400).send({ error: error.message });
            }
        },

        async remove(request, reply) {
            try {
                return await service.delete(request.params.id, request.user.f.id);
            } catch (error) {
                reply.code(400).send({ error: error.message });
            }
        },

        async importMany(request, reply) {
            try {
                return await service.importMany(request.body?.items, request.user.f.id);
            } catch (error) {
                reply.code(400).send({ error: error.message });
            }
        },
    };
}
