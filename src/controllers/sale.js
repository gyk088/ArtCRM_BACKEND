import SaleService from '../bll/services/SaleService.js';

export default class SaleController {
    static async getByArtId(request, reply) {
        try {
            return await SaleService.getByArtId(request.params.artId, request.user);
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async create(request, reply) {
        try {
            return await SaleService.create(request.body || {}, request.user);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async update(request, reply) {
        try {
            return await SaleService.update(request.params.id, request.body || {}, request.user);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async cancel(request, reply) {
        try {
            return await SaleService.cancel(request.params.id, request.user);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }
}
