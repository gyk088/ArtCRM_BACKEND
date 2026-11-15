import NoteController from '../../../controllers/note.js'
import auth from '../../../hooks/preHendler.js';

// Заметки (см. NoteService): внутри галереи общие, как работы
export default async function noteRoutes(fastify) {
    fastify.get('/', {preHandler: [auth()]}, NoteController.list)
    fastify.post('/', {preHandler: [auth()]}, NoteController.create)
    fastify.get('/:id', {preHandler: [auth()]}, NoteController.get)
    fastify.put('/:id', {preHandler: [auth()]}, NoteController.update)
    fastify.delete('/:id', {preHandler: [auth()]}, NoteController.delete)
}
