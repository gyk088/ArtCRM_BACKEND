import CollectionController from '../../../controllers/collection.js'
import auth from '../../../hooks/preHendler.js';

export default async function collectionRoutes(fastify, _options) {
    // Публичная страница ссылки — без авторизации
    fastify.get('/public/:id', CollectionController.getPublicCollection)

    fastify.post('/', {preHandler: [auth()]}, CollectionController.createCollection)
    fastify.get('/', {preHandler: [auth()]}, CollectionController.getAllCollections)
    fastify.get('/:id', {preHandler: [auth()]}, CollectionController.getCollectionById)
    fastify.put('/:id', {preHandler: [auth()]}, CollectionController.updateCollection)
    fastify.delete('/:id', {preHandler: [auth()]}, CollectionController.deleteCollection)
}
