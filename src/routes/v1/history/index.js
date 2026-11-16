import HistoryController from '../../../controllers/history.js'
import auth from '../../../hooks/preHendler.js';

export default async function historyRoutes(fastify, _options) {
    fastify.get('/', {preHandler: [auth()]}, HistoryController.journal)
    fastify.get('/:type/:id', {preHandler: [auth()]}, HistoryController.entity)
}
