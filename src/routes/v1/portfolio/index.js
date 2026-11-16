import PortfolioController from '../../../controllers/portfolio.js'
import auth from '../../../hooks/preHendler.js';

export default async function portfolioRoutes(fastify, _options) {
    // Публичные данные портфолио — без авторизации (только открытые по ссылке)
    fastify.get('/public/:id', PortfolioController.getPublic)

    fastify.get('/', {preHandler: [auth()]}, PortfolioController.list)
    fastify.post('/', {preHandler: [auth()]}, PortfolioController.create)
    fastify.get('/:id', {preHandler: [auth()]}, PortfolioController.get)
    fastify.put('/:id', {preHandler: [auth()]}, PortfolioController.update)
    fastify.delete('/:id', {preHandler: [auth()]}, PortfolioController.remove)
}
