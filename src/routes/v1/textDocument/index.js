import createTextDocumentController from '../../../controllers/textDocument.js'
import auth from '../../../hooks/preHendler.js';

// Роуты биографий (/api/v1/bio) и резюме (/api/v1/cv) — одинаковые,
// различается только сервис (см. src/index.js и TextDocumentService)
export default async function textDocumentRoutes(fastify, options) {
    const controller = createTextDocumentController(options.service)

    fastify.get('/', {preHandler: [auth()]}, controller.getAll)
    fastify.post('/', {preHandler: [auth()]}, controller.create)
    // Разовый перенос документов из localStorage браузера
    fastify.post('/import', {preHandler: [auth()]}, controller.importMany)
    fastify.get('/:id', {preHandler: [auth()]}, controller.getById)
    fastify.put('/:id', {preHandler: [auth()]}, controller.update)
    fastify.delete('/:id', {preHandler: [auth()]}, controller.remove)
}
