import TaskService from '../bll/services/TaskService.js';

// Обёртка: ошибки «не найдено» -> 404, остальные -> 400
const handle = (fn) => async (request, reply) => {
    try {
        return await fn(request);
    } catch (error) {
        const notFound = / not found$/.test(error.message);
        reply.code(notFound && request.method === 'GET' ? 404 : 400).send({ error: error.message });
    }
};

export default class TaskController {
    static assignees = handle((r) => TaskService.assignees(r.user));

    static listStatuses = handle((r) => TaskService.listStatuses(r.user));
    static createStatus = handle((r) => TaskService.createStatus(r.body || {}, r.user));
    static updateStatus = handle((r) => TaskService.updateStatus(r.params.id, r.body || {}, r.user));
    static deleteStatus = handle((r) => TaskService.deleteStatus(r.params.id, r.user));
    static reorderStatuses = handle((r) => TaskService.reorderStatuses(r.body?.ids, r.user));

    static listBoards = handle((r) => TaskService.listBoards(r.user));
    static getBoard = handle((r) => TaskService.getBoard(r.params.id, r.user));
    static createBoard = handle((r) => TaskService.createBoard(r.body || {}, r.user));
    static updateBoard = handle((r) => TaskService.updateBoard(r.params.id, r.body || {}, r.user));
    static deleteBoard = handle((r) => TaskService.deleteBoard(r.params.id, r.user));

    static createTask = handle((r) => TaskService.createTask(r.body || {}, r.user));
    static updateTask = handle((r) => TaskService.updateTask(r.params.id, r.body || {}, r.user));
    static moveTask = handle((r) => TaskService.moveTask(r.params.id, r.body || {}, r.user));
    static deleteTask = handle((r) => TaskService.deleteTask(r.params.id, r.user));
}
