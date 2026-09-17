import CollectionController from '../../../controllers/collection.js'
import auth from '../../../hooks/preHendler.js';

export default async function collectionRoutes(fastify, _options) {
    // Публичная страница ссылки — без авторизации
    fastify.get('/public/:id', CollectionController.getPublicCollection)

    fastify.post('/', {preHandler: [auth()]}, CollectionController.createCollection)
    fastify.get('/', {preHandler: [auth()]}, CollectionController.getAllCollections)

    // Папки — регистрируются раньше '/:id', иначе find-my-way всё равно
    // сам отдаёт приоритет статичным сегментам, но порядок держим явным
    // для читаемости (как в остальных роутах этого проекта).
    fastify.post('/folder', {preHandler: [auth()]}, CollectionController.createFolder)
    fastify.get('/folder', {preHandler: [auth()]}, CollectionController.getFolders)
    fastify.put('/folder/:folderId', {preHandler: [auth()]}, CollectionController.updateFolder)
    fastify.delete('/folder/:folderId', {preHandler: [auth()]}, CollectionController.deleteFolder)
    fastify.patch('/folder/reorder', {preHandler: [auth()]}, CollectionController.reorderFolders)
    fastify.patch('/reorder', {preHandler: [auth()]}, CollectionController.reorderCollections)
    fastify.patch('/:id/folder', {preHandler: [auth()]}, CollectionController.moveCollectionToFolder)

    fastify.get('/:id', {preHandler: [auth()]}, CollectionController.getCollectionById)
    fastify.put('/:id', {preHandler: [auth()]}, CollectionController.updateCollection)
    fastify.delete('/:id', {preHandler: [auth()]}, CollectionController.deleteCollection)
}
