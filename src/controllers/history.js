import ChangeLogService from '../bll/services/ChangeLogService.js';

export default class HistoryController {
    /** GET /:type/:id — история одной записи */
    static async entity(request, reply) {
        try {
            return await ChangeLogService.forEntity(request.params.type, request.params.id, request.user);
        } catch (error) {
            reply.code(error.message === 'Not found' ? 404 : 400).send({ error: error.message });
        }
    }

    /** GET / — журнал галереи (gallery / super_admin) */
    static async journal(request, reply) {
        try {
            return await ChangeLogService.journal(request.user, request.query || {});
        } catch (error) {
            reply.code(error.message === 'Forbidden' ? 403 : 400).send({ error: error.message });
        }
    }
}
