import PortfolioService from '../bll/services/PortfolioService.js';

const NOT_FOUND = ['Portfolio not found', 'Artist not found'];
const fail = (reply, error) => reply.code(NOT_FOUND.includes(error.message) ? 404 : 400).send({ error: error.message });

export default class PortfolioController {
    /** GET /?artist=<id> — портфолио художника */
    static async list(request, reply) {
        try {
            return await PortfolioService.listByArtist(request.query.artist, request.user);
        } catch (error) {
            fail(reply, error);
        }
    }

    static async get(request, reply) {
        try {
            return await PortfolioService.get(request.params.id, request.user);
        } catch (error) {
            fail(reply, error);
        }
    }

    static async create(request, reply) {
        try {
            return await PortfolioService.create(request.body || {}, request.user);
        } catch (error) {
            fail(reply, error);
        }
    }

    static async update(request, reply) {
        try {
            return await PortfolioService.update(request.params.id, request.body || {}, request.user);
        } catch (error) {
            fail(reply, error);
        }
    }

    static async remove(request, reply) {
        try {
            return await PortfolioService.remove(request.params.id, request.user);
        } catch (error) {
            fail(reply, error);
        }
    }

    /** GET /public/:id — без авторизации, только открытые по ссылке */
    static async getPublic(request, reply) {
        const portfolio = await PortfolioService.getPublic(request.params.id, { countView: false }).catch(() => null);
        if (!portfolio) return reply.code(404).send({ error: 'Portfolio not found' });
        return portfolio;
    }
}
