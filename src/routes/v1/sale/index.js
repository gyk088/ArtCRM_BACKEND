import SaleController from '../../../controllers/sale.js'
import auth from '../../../hooks/preHendler.js';

export default async function saleRoutes(fastify) {
    // Продажа конкретной работы (null, если не продана)
    fastify.get('/art/:artId', {preHandler: [auth()]}, SaleController.getByArtId)
    fastify.post('/', {preHandler: [auth()]}, SaleController.create)
    fastify.put('/:id', {preHandler: [auth()]}, SaleController.update)
    // Отмена продажи — работа снова считается непроданной
    fastify.delete('/:id', {preHandler: [auth()]}, SaleController.cancel)
}
