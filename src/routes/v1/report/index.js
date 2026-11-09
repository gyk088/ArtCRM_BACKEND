import ReportController from '../../../controllers/report.js'
import auth from '../../../hooks/preHendler.js';

export default async function reportRoutes(fastify) {
    fastify.get('/', {preHandler: [auth()]}, ReportController.list)
    fastify.post('/', {preHandler: [auth()]}, ReportController.create)
    // Курсы-подсказка из последнего отчёта (?currency=BYN&exclude=<reportId>)
    fastify.get('/suggested-rates', {preHandler: [auth()]}, ReportController.suggestedRates)
    fastify.get('/:id', {preHandler: [auth()]}, ReportController.get)
    fastify.put('/:id', {preHandler: [auth()]}, ReportController.update)
    fastify.delete('/:id', {preHandler: [auth()]}, ReportController.remove)
    // Рассчитанный отчёт: строки, сводка, разбивки
    fastify.get('/:id/data', {preHandler: [auth()]}, ReportController.data)
    fastify.get('/:id/export', {preHandler: [auth()]}, ReportController.exportXlsx)
}
