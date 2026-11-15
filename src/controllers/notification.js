import NotificationService from '../bll/services/NotificationService.js';

const handle = (fn) => async (request, reply) => {
    try {
        return await fn(request);
    } catch (error) {
        reply.code(400).send({ error: error.message });
    }
};

export default class NotificationController {
    static list = handle((r) => NotificationService.list(r.user));
    static unread = handle((r) => NotificationService.unread(r.user));
    static markRead = handle((r) => NotificationService.markRead(r.body || {}, r.user));
    static remove = handle((r) => NotificationService.remove(r.params.id, r.user));
}
