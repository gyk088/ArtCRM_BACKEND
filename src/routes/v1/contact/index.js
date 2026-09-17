import ContactController from '../../../controllers/contact.js'
import auth from '../../../hooks/preHendler.js';

export default async function contactRoutes(fastify, _options) {
    fastify.post('/', {preHandler: [auth()]}, ContactController.createContact)
    fastify.get('/', {preHandler: [auth()]}, ContactController.getAllContacts)
    fastify.get('/:id', {preHandler: [auth()]}, ContactController.getContactById)
    fastify.put('/:id', {preHandler: [auth()]}, ContactController.updateContact)
    fastify.delete('/:id', {preHandler: [auth()]}, ContactController.deleteContact)
}
