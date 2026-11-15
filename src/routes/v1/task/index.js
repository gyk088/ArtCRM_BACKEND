import TaskController from '../../../controllers/task.js'
import auth from '../../../hooks/preHendler.js';

// Задачи в стиле Trello (см. TaskService)
export default async function taskRoutes(fastify) {
    const pre = { preHandler: [auth()] };

    fastify.get('/assignees', pre, TaskController.assignees)

    // Справочник статусов = колонки досок
    fastify.get('/statuses', pre, TaskController.listStatuses)
    fastify.post('/statuses', pre, TaskController.createStatus)
    fastify.put('/statuses/reorder', pre, TaskController.reorderStatuses)
    fastify.put('/statuses/:id', pre, TaskController.updateStatus)
    fastify.delete('/statuses/:id', pre, TaskController.deleteStatus)

    // Доски (проекты)
    fastify.get('/boards', pre, TaskController.listBoards)
    fastify.post('/boards', pre, TaskController.createBoard)
    fastify.get('/boards/:id', pre, TaskController.getBoard)
    fastify.put('/boards/:id', pre, TaskController.updateBoard)
    fastify.delete('/boards/:id', pre, TaskController.deleteBoard)

    // Задачи
    fastify.post('/', pre, TaskController.createTask)
    fastify.put('/:id', pre, TaskController.updateTask)
    fastify.put('/:id/move', pre, TaskController.moveTask)
    fastify.delete('/:id', pre, TaskController.deleteTask)
}
