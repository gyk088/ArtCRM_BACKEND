import ExhibitionController from '../../../controllers/exhibition.js'
import auth from '../../../hooks/preHendler.js';

export default async function exhibitionRoutes(fastify, _options) {
    // Публичная страница выставки — без авторизации
    fastify.get('/public/:id', ExhibitionController.getPublicExhibition)

    fastify.post('/', {preHandler: [auth()]}, ExhibitionController.createExhibition)
    fastify.get('/', {preHandler: [auth()]}, ExhibitionController.getAllExhibitions)
    fastify.get('/:id', {preHandler: [auth()]}, ExhibitionController.getExhibitionById)
    fastify.put('/:id', {preHandler: [auth()]}, ExhibitionController.updateExhibition)
    fastify.delete('/:id', {preHandler: [auth()]}, ExhibitionController.deleteExhibition)

    fastify.post('/:id/photos', {preHandler: [auth()]}, ExhibitionController.addPhoto)
    fastify.put('/:id/photos/:photoId', {preHandler: [auth()]}, ExhibitionController.updatePhoto)
    fastify.delete('/:id/photos/:photoId', {preHandler: [auth()]}, ExhibitionController.deletePhoto)
    fastify.patch('/:id/photos/reorder', {preHandler: [auth()]}, ExhibitionController.reorderPhotos)
}
