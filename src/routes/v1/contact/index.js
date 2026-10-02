import ContactController from '../../../controllers/contact.js'
import auth from '../../../hooks/preHendler.js';

export default async function contactRoutes(fastify, _options) {
    fastify.post('/', {preHandler: [auth()]}, ContactController.createContact)
    fastify.get('/', {preHandler: [auth()]}, ContactController.getAllContacts)
    fastify.get('/:id', {preHandler: [auth()]}, ContactController.getContactById)
    fastify.put('/:id', {preHandler: [auth()]}, ContactController.updateContact)
    fastify.delete('/:id', {preHandler: [auth()]}, ContactController.deleteContact)

    // Связь контакта с работами — "уже купил" / "интересуется"
    fastify.post('/:id/works', {preHandler: [auth()]}, ContactController.addWorkToContact)
    fastify.patch('/:id/works/:artId', {preHandler: [auth()]}, ContactController.updateWorkStatus)
    fastify.delete('/:id/works/:artId', {preHandler: [auth()]}, ContactController.removeWorkFromContact)

    // Справочник "Источник" — как Медиа/Серия и т.п.
    fastify.post('/sources', {preHandler: [auth()]}, ContactController.createSource)
    fastify.get('/sources', {preHandler: [auth()]}, ContactController.getAllSources)
    fastify.put('/sources', {preHandler: [auth()]}, ContactController.updateSource)
    fastify.delete('/sources/:id', {preHandler: [auth()]}, ContactController.deleteSource)

    // Справочник "Категория"
    fastify.post('/categories', {preHandler: [auth()]}, ContactController.createCategory)
    fastify.get('/categories', {preHandler: [auth()]}, ContactController.getAllCategories)
    fastify.put('/categories', {preHandler: [auth()]}, ContactController.updateCategory)
    fastify.delete('/categories/:id', {preHandler: [auth()]}, ContactController.deleteCategory)
}
