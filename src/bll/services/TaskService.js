import { PgObject } from 'pgobject';
import { TaskStatusModel, TaskBoardModel, TaskModel } from '../models/TaskModels.js';
import ArtService from './ArtService.js';
import NotificationService from './NotificationService.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES = ['low', 'normal', 'high'];
const MAX_TITLE = 300;
const MAX_DESCRIPTION = 20000;

// Статусы, которые создаются, когда в галерее (или у пользователя) их ещё нет
const DEFAULT_STATUSES = [
    { name: 'К выполнению', color: '#7f8c8d', is_final: false },
    { name: 'В работе', color: '#2e86de', is_final: false },
    { name: 'На проверке', color: '#d35400', is_final: false },
    { name: 'Готово', color: '#27ae60', is_final: true },
];

const personRow = (id, name, surname) => (id ? { id, name: name ?? null, surname: surname ?? null } : null);

/**
 * Задачи в стиле Trello.
 *
 * Доска (проект) — набор задач. Колонки доски — статусы задач из
 * справочника (my_task_status, общий для всех досок), перемещение карточки
 * между колонками меняет её статус. Статус с флагом is_final закрывает
 * задачу: такая не считается просроченной, а время закрытия запоминается.
 *
 * Внутри галереи доски, задачи и статусы общие — как работы и справочники:
 * галерея и все её менеджеры видят и правят всё, удалить доску/задачу/
 * статус может автор или сама галерея (ArtService.__canUseRef). Исполнитель
 * задачи — галерея или любой из её менеджеров.
 */
export default class TaskService {
    // ============= ОБЩЕЕ =============

    static async __load(Model, id, actorUser, notFound, { forDelete = false } = {}) {
        let entity = null;
        if (UUID_RE.test(String(id))) entity = await Model.getById(String(id));
        if (!(await ArtService.__canUseRef(entity, actorUser.f.id, { forDelete }))) throw new Error(notFound);
        return entity;
    }

    static __text(value, { field, max, required = false }) {
        if (value === undefined || value === null) {
            if (required) throw new Error(`${field} is required`);
            return null;
        }
        if (typeof value !== 'string') throw new Error(`${field} must be a string`);
        const v = value.trim();
        if (required && !v) throw new Error(`${field} is required`);
        if (v.length > max) throw new Error(`${field} too long (max ${max})`);
        return v || null;
    }

    /** Кого можно назначить исполнителем: галерея и её менеджеры (или только сам) */
    static async assignees(actorUser) {
        const scope = await ArtService.__refScopeUserIds(actorUser.f.id);
        const result = await PgObject.query(
            'SELECT id, name, surname, role FROM my_user WHERE id = ANY($1::uuid[]) ORDER BY name, surname',
            [scope]
        );
        return result.rows;
    }

    // ============= СТАТУСЫ (справочник) =============

    static __statusDto(s) {
        return {
            id: s.f.id, user_id: s.f.user_id, name: s.f.name, color: s.f.color,
            is_final: !!s.f.is_final, order_num: s.f.order_num,
        };
    }

    static async listStatuses(actorUser, { seed = true } = {}) {
        const scope = await ArtService.__refScopeUserIds(actorUser.f.id);
        let statuses = await TaskStatusModel.select(
            'WHERE user_id = ANY($1::uuid[]) ORDER BY order_num ASC NULLS LAST, ctime ASC', [scope]
        );
        if (!statuses.length && seed) {
            // первый вход в задачи — создаём стандартный набор колонок
            for (const [i, s] of DEFAULT_STATUSES.entries()) {
                await new TaskStatusModel({ ...s, user_id: actorUser.f.id, order_num: i, ctime: new Date() }).save();
            }
            return TaskService.listStatuses(actorUser, { seed: false });
        }
        return statuses.map(TaskService.__statusDto);
    }

    static async createStatus(data, actorUser) {
        const statuses = await TaskService.listStatuses(actorUser);
        const status = new TaskStatusModel({
            user_id: actorUser.f.id,
            name: data?.name,
            color: data?.color ?? null,
            is_final: !!data?.is_final,
            order_num: statuses.length,
            ctime: new Date(),
        });
        await status.save();
        return TaskService.__statusDto(status);
    }

    static async updateStatus(id, data, actorUser) {
        const status = await TaskService.__load(TaskStatusModel, id, actorUser, 'Task status not found');
        if (data.name !== undefined) status.f.name = data.name;
        if (data.color !== undefined) status.f.color = data.color;
        if (data.is_final !== undefined) status.f.is_final = !!data.is_final;
        await status.save();
        return TaskService.__statusDto(status);
    }

    static async deleteStatus(id, actorUser) {
        const status = await TaskService.__load(TaskStatusModel, id, actorUser, 'Task status not found', { forDelete: true });
        const used = await PgObject.query('SELECT COUNT(*)::int AS n FROM my_task WHERE status_id = $1', [status.f.id]);
        if (used.rows[0].n > 0) {
            throw new Error(`Cannot delete status: it is used by ${used.rows[0].n} task(s)`);
        }
        await status.delete();
        return { success: true };
    }

    /** Порядок колонок: ids статусов в нужном порядке */
    static async reorderStatuses(ids, actorUser) {
        if (!Array.isArray(ids) || !ids.length) throw new Error('ids array is required');
        const statuses = [];
        for (const id of ids) statuses.push(await TaskService.__load(TaskStatusModel, id, actorUser, 'Task status not found'));
        statuses.forEach((s, i) => { s.f.order_num = i; });
        await TaskStatusModel.updateMany(statuses); // один UPDATE на все
        return TaskService.listStatuses(actorUser);
    }

    // ============= СТАТУСЫ ДОСКИ =============
    // У доски может быть свой набор колонок (my_task_board_status). Нет
    // строк — доступны все статусы (так работают доски, созданные раньше).

    static async __boardStatusIds(boardId) {
        const result = await PgObject.query('SELECT status_id::text AS id FROM my_task_board_status WHERE board_id = $1', [boardId]);
        return result.rows.length ? result.rows.map(r => r.id) : null;
    }

    /** Статусы доски в общем порядке справочника */
    static async __boardStatuses(boardId, actorUser) {
        const all = await TaskService.listStatuses(actorUser);
        const ids = await TaskService.__boardStatusIds(boardId);
        return ids ? all.filter(st => ids.includes(st.id)) : all;
    }

    static async __normalizeStatusIds(ids, actorUser) {
        if (!Array.isArray(ids) || !ids.length) throw new Error('Choose at least one status for the board');
        const unique = [...new Set(ids.map(String))];
        for (const id of unique) await TaskService.__load(TaskStatusModel, id, actorUser, 'Task status not found');
        return unique;
    }

    static async __setBoardStatuses(boardId, ids) {
        await PgObject.query('DELETE FROM my_task_board_status WHERE board_id = $1', [boardId]);
        for (const id of ids) {
            await PgObject.query('INSERT INTO my_task_board_status (board_id, status_id) VALUES ($1, $2)', [boardId, id]);
        }
    }

    // статус задачи должен быть колонкой её доски
    static async __assertStatusOnBoard(boardId, statusId) {
        const ids = await TaskService.__boardStatusIds(boardId);
        if (ids && !ids.includes(statusId)) throw new Error('Task status is not used on this board');
    }

    // ============= ДОСКИ =============

    static async listBoards(actorUser) {
        const scope = await ArtService.__refScopeUserIds(actorUser.f.id);
        const result = await PgObject.query(`
            SELECT b.*, c.name AS creator_name, c.surname AS creator_surname,
                (SELECT COUNT(*)::int FROM my_task t WHERE t.board_id = b.id) AS tasks_total,
                (SELECT COUNT(*)::int FROM my_task t JOIN my_task_status s ON s.id = t.status_id
                    WHERE t.board_id = b.id AND NOT s.is_final) AS tasks_open,
                (SELECT COUNT(*)::int FROM my_task t JOIN my_task_status s ON s.id = t.status_id
                    WHERE t.board_id = b.id AND NOT s.is_final AND t.due_date < CURRENT_DATE) AS tasks_overdue,
                (SELECT COUNT(*)::int FROM my_task t JOIN my_task_status s ON s.id = t.status_id
                    WHERE t.board_id = b.id AND NOT s.is_final AND t.assignee_id = $2) AS tasks_mine
            FROM my_task_board b
            LEFT JOIN my_user c ON c.id = b.user_id
            WHERE b.user_id = ANY($1::uuid[])
            ORDER BY b.utime DESC
        `, [scope, actorUser.f.id]);
        return result.rows.map(r => ({
            id: r.id, name: r.name, description: r.description,
            createdBy: personRow(r.user_id, r.creator_name, r.creator_surname),
            ctime: r.ctime, utime: r.utime,
            counts: { total: r.tasks_total, open: r.tasks_open, overdue: r.tasks_overdue, mine: r.tasks_mine },
        }));
    }

    static async createBoard(data, actorUser) {
        // набор колонок (необязательно): проверяем до создания доски
        const statusIds = data?.status_ids !== undefined && data?.status_ids !== null
            ? await TaskService.__normalizeStatusIds(data.status_ids, actorUser)
            : null;
        const board = new TaskBoardModel({
            user_id: actorUser.f.id,
            name: TaskService.__text(data?.name, { field: 'Board name', max: 200, required: true }),
            description: TaskService.__text(data?.description, { field: 'Board description', max: 2000 }),
            ctime: new Date(),
            utime: new Date(),
        });
        await board.save();
        if (statusIds) await TaskService.__setBoardStatuses(board.f.id, statusIds);
        return TaskService.getBoard(board.f.id, actorUser);
    }

    static async updateBoard(id, data, actorUser) {
        const board = await TaskService.__load(TaskBoardModel, id, actorUser, 'Board not found');
        // смена колонок: убрать колонку, в которой есть задачи этой доски, нельзя
        let statusIds = null;
        if (data.status_ids !== undefined) {
            statusIds = await TaskService.__normalizeStatusIds(data.status_ids, actorUser);
            const busy = await PgObject.query(`
                SELECT s.name, COUNT(*)::int AS n FROM my_task t JOIN my_task_status s ON s.id = t.status_id
                WHERE t.board_id = $1 AND NOT (t.status_id = ANY($2::uuid[]))
                GROUP BY s.name
            `, [board.f.id, statusIds]);
            if (busy.rows.length) {
                const list = busy.rows.map(r => `${r.name} (${r.n})`).join(', ');
                throw new Error(`Cannot remove statuses with tasks: ${list}`);
            }
        }
        if (data.name !== undefined) board.f.name = TaskService.__text(data.name, { field: 'Board name', max: 200, required: true });
        if (data.description !== undefined) board.f.description = TaskService.__text(data.description, { field: 'Board description', max: 2000 });
        board.f.updated_by = actorUser.f.id;
        board.f.utime = new Date();
        await board.save();
        if (statusIds) await TaskService.__setBoardStatuses(board.f.id, statusIds);
        return TaskService.getBoard(board.f.id, actorUser);
    }

    static async deleteBoard(id, actorUser) {
        const board = await TaskService.__load(TaskBoardModel, id, actorUser, 'Board not found', { forDelete: true });
        await board.delete(); // задачи удаляются каскадом
        return { success: true };
    }

    /** Доска со всеми задачами, статусами (колонками) и списком исполнителей */
    static async getBoard(id, actorUser) {
        const board = await TaskService.__load(TaskBoardModel, id, actorUser, 'Board not found');
        const result = await PgObject.query(TaskService.__taskSelect('t.board_id = $1')
            + ' ORDER BY t.order_num ASC NULLS LAST, t.ctime ASC', [board.f.id]);
        const creator = (await PgObject.query('SELECT name, surname FROM my_user WHERE id = $1', [board.f.user_id])).rows[0];
        return {
            id: board.f.id,
            name: board.f.name,
            description: board.f.description,
            createdBy: personRow(board.f.user_id, creator?.name, creator?.surname),
            ctime: board.f.ctime,
            utime: board.f.utime,
            // колонки этой доски и весь справочник (для настройки колонок)
            statuses: await TaskService.__boardStatuses(board.f.id, actorUser),
            all_statuses: await TaskService.listStatuses(actorUser),
            assignees: await TaskService.assignees(actorUser),
            tasks: result.rows.map(TaskService.__taskDto),
        };
    }

    // ============= ЗАДАЧИ =============

    static __taskSelect(where) {
        return `
            SELECT t.*, s.is_final AS status_is_final,
                c.name AS creator_name, c.surname AS creator_surname,
                e.name AS editor_name, e.surname AS editor_surname,
                a.name AS assignee_name, a.surname AS assignee_surname
            FROM my_task t
            JOIN my_task_status s ON s.id = t.status_id
            LEFT JOIN my_user c ON c.id = t.user_id
            LEFT JOIN my_user e ON e.id = t.updated_by
            LEFT JOIN my_user a ON a.id = t.assignee_id
            WHERE ${where}
        `;
    }

    static __taskDto(r) {
        return {
            id: r.id,
            board_id: r.board_id,
            title: r.title,
            description: r.description,
            status_id: r.status_id,
            is_closed: !!r.status_is_final,
            assignee: personRow(r.assignee_id, r.assignee_name, r.assignee_surname),
            due_date: r.due_date,
            priority: r.priority,
            order_num: r.order_num,
            completed_at: r.completed_at,
            createdBy: personRow(r.user_id, r.creator_name, r.creator_surname),
            updatedBy: personRow(r.updated_by, r.editor_name, r.editor_surname),
            ctime: r.ctime,
            utime: r.utime,
        };
    }

    static async __getTaskDto(id) {
        const result = await PgObject.query(TaskService.__taskSelect('t.id = $1') + ' LIMIT 1', [id]);
        return result.rows[0] ? TaskService.__taskDto(result.rows[0]) : null;
    }

    /** Задача доступна, если доступна её доска */
    static async __loadTask(id, actorUser, { forDelete = false } = {}) {
        let task = null;
        if (UUID_RE.test(String(id))) task = await TaskModel.getById(String(id));
        if (!task) throw new Error('Task not found');
        try {
            await TaskService.__load(TaskBoardModel, task.f.board_id, actorUser, 'Task not found');
        } catch {
            throw new Error('Task not found');
        }
        // удалить задачу — её автор или сама галерея (как работы)
        if (forDelete && !(await ArtService.__canUseRef(task, actorUser.f.id, { forDelete: true }))) {
            throw new Error('Task not found');
        }
        return task;
    }

    /** Проверка и нормализация полей задачи (partial — только переданные) */
    static async __normalizeTask(data, actorUser, { partial = false } = {}) {
        const out = {};
        const has = (k) => data[k] !== undefined;

        if (!partial || has('title')) out.title = TaskService.__text(data.title, { field: 'Task title', max: MAX_TITLE, required: true });
        if (has('description')) out.description = TaskService.__text(data.description, { field: 'Task description', max: MAX_DESCRIPTION });
        if (has('status_id')) {
            out.status = await TaskService.__load(TaskStatusModel, data.status_id, actorUser, 'Task status not found');
        }
        if (has('assignee_id')) {
            if (data.assignee_id === null || data.assignee_id === '') {
                out.assignee_id = null;
            } else {
                const scope = await ArtService.__refScopeUserIds(actorUser.f.id);
                if (!scope.includes(String(data.assignee_id))) throw new Error('Assignee not found');
                out.assignee_id = String(data.assignee_id);
            }
        }
        if (has('due_date')) {
            if (data.due_date === null || data.due_date === '') out.due_date = null;
            else if (typeof data.due_date !== 'string' || !DATE_RE.test(data.due_date)
                || Number.isNaN(new Date(`${data.due_date}T00:00:00Z`).getTime())) {
                throw new Error('due_date must be YYYY-MM-DD');
            } else out.due_date = data.due_date;
        }
        if (has('priority')) {
            if (!PRIORITIES.includes(data.priority)) throw new Error(`priority must be one of ${PRIORITIES.join(', ')}`);
            out.priority = data.priority;
        }
        return out;
    }

    // статус меняется — запоминаем/сбрасываем момент закрытия задачи
    static __applyStatus(task, status) {
        const wasClosed = task.f.status_id && task.f.completed_at;
        task.f.status_id = status.f.id;
        if (status.f.is_final) {
            if (!wasClosed) task.f.completed_at = new Date();
        } else {
            task.f.completed_at = null;
        }
    }

    static async createTask(data, actorUser) {
        const board = await TaskService.__load(TaskBoardModel, data?.board_id, actorUser, 'Board not found');
        const fields = await TaskService.__normalizeTask(data || {}, actorUser);
        // без статуса — в первую колонку доски
        const status = fields.status || await TaskService.__load(
            TaskStatusModel, (await TaskService.__boardStatuses(board.f.id, actorUser))[0].id, actorUser, 'Task status not found'
        );
        await TaskService.__assertStatusOnBoard(board.f.id, status.f.id);
        const maxOrder = (await PgObject.query(
            'SELECT COALESCE(MAX(order_num), -1)::int AS m FROM my_task WHERE board_id = $1 AND status_id = $2',
            [board.f.id, status.f.id]
        )).rows[0].m;

        const task = new TaskModel({
            board_id: board.f.id,
            user_id: actorUser.f.id,
            title: fields.title,
            description: fields.description ?? null,
            assignee_id: fields.assignee_id ?? null,
            due_date: fields.due_date ?? null,
            priority: fields.priority || 'normal',
            order_num: maxOrder + 1,
            ctime: new Date(),
            utime: new Date(),
        });
        TaskService.__applyStatus(task, status);
        await task.save();
        await TaskService.__touchBoard(board.f.id, actorUser);
        if (task.f.assignee_id) await TaskService.__notifyAssigned(task, board, actorUser);
        return TaskService.__getTaskDto(task.f.id);
    }

    /** Уведомить исполнителя, что ему назначили задачу (себе — не уведомляем) */
    static async __notifyAssigned(task, board, actorUser) {
        if (!task.f.assignee_id || task.f.assignee_id === actorUser.f.id) return;
        const boardRow = board || await TaskBoardModel.getById(task.f.board_id);
        const actorName = [actorUser.f.name, actorUser.f.surname].map(v => (v || '').trim()).filter(Boolean).join(' ') || 'Коллега';
        const due = task.f.due_date ? `, срок ${String(task.f.due_date).split('-').reverse().join('.')}` : '';
        await NotificationService.notify({
            userId: task.f.assignee_id,
            type: 'task_assigned',
            title: `Новая задача: ${task.f.title}`,
            body: `${actorName} назначил(а) вам задачу на доске «${boardRow?.f.name || ''}»${due}`,
            link: `/home/tasks/${task.f.board_id}?task=${task.f.id}`,
            actorId: actorUser.f.id,
        });
    }

    static async updateTask(id, data, actorUser) {
        const task = await TaskService.__loadTask(id, actorUser);
        const fields = await TaskService.__normalizeTask(data || {}, actorUser, { partial: true });
        if (fields.status) await TaskService.__assertStatusOnBoard(task.f.board_id, fields.status.f.id);
        const prevAssignee = task.f.assignee_id;

        for (const key of ['title', 'description', 'assignee_id', 'due_date', 'priority']) {
            if (fields[key] !== undefined) task.f[key] = fields[key];
        }
        if (fields.status && fields.status.f.id !== task.f.status_id) {
            TaskService.__applyStatus(task, fields.status);
            // в новой колонке — в конец
            const maxOrder = (await PgObject.query(
                'SELECT COALESCE(MAX(order_num), -1)::int AS m FROM my_task WHERE board_id = $1 AND status_id = $2',
                [task.f.board_id, fields.status.f.id]
            )).rows[0].m;
            task.f.order_num = maxOrder + 1;
        }
        task.f.updated_by = actorUser.f.id;
        task.f.utime = new Date();
        await task.save();
        await TaskService.__touchBoard(task.f.board_id, actorUser);
        // исполнитель сменился — новому приходит уведомление
        if (task.f.assignee_id && task.f.assignee_id !== prevAssignee) {
            await TaskService.__notifyAssigned(task, null, actorUser);
        }
        return TaskService.__getTaskDto(task.f.id);
    }

    /**
     * Перетаскивание карточки: задача уходит в колонку status_id, а порядок
     * карточек этой колонки становится order (массив id задач колонки).
     */
    static async moveTask(id, data, actorUser) {
        const task = await TaskService.__loadTask(id, actorUser);
        const status = await TaskService.__load(TaskStatusModel, data?.status_id, actorUser, 'Task status not found');
        await TaskService.__assertStatusOnBoard(task.f.board_id, status.f.id);
        const order = Array.isArray(data?.order) ? data.order.map(String) : [task.f.id];
        if (!order.includes(task.f.id)) throw new Error('order must contain the moved task');

        // все задачи порядка — с той же доски
        const tasks = (await TaskModel.select('WHERE board_id = $1 AND id = ANY($2::uuid[])', [task.f.board_id, order]));
        if (tasks.length !== new Set(order).size) throw new Error('Task not found');

        if (status.f.id !== task.f.status_id) {
            TaskService.__applyStatus(task, status);
            task.f.updated_by = actorUser.f.id;
            task.f.utime = new Date();
        }
        const byId = new Map(tasks.map(t => [t.f.id, t]));
        byId.set(task.f.id, task);
        const changed = [];
        for (const [i, tid] of order.entries()) {
            const t = byId.get(tid);
            if (t.f.id !== task.f.id && t.f.status_id !== status.f.id) continue; // чужая колонка — не трогаем
            t.f.order_num = i;
            changed.push(t);
        }
        // переставленные карточки и сама задача (статус) — одна транзакция,
        // по запросу на каждый набор изменённых полей (pgobject updateMany)
        await TaskModel.updateMany([...new Set(changed)]);
        await TaskService.__touchBoard(task.f.board_id, actorUser);
        return TaskService.__getTaskDto(task.f.id);
    }

    static async deleteTask(id, actorUser) {
        const task = await TaskService.__loadTask(id, actorUser, { forDelete: true });
        await task.delete();
        return { success: true };
    }

    static async __touchBoard(boardId, actorUser) {
        await PgObject.query('UPDATE my_task_board SET utime = NOW(), updated_by = $2 WHERE id = $1', [boardId, actorUser.f.id]);
    }
}
