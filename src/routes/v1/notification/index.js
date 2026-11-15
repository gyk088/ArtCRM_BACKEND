import NotificationController from '../../../controllers/notification.js'
import auth from '../../../hooks/preHendler.js';

// Уведомления текущего пользователя (см. NotificationService)
export default async function notificationRoutes(fastify) {
    const pre = { preHandler: [auth()] };
    fastify.get('/', pre, NotificationController.list)
    fastify.get('/unread', pre, NotificationController.unread)
    fastify.post('/read', pre, NotificationController.markRead)
    fastify.delete('/:id', pre, NotificationController.remove)
}
