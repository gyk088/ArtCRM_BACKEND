// История изменений («кто и когда»): работы, ссылки, выставки, отчёты,
// продажи, контакты, художники, портфолио, заметки, задачи и доски.
//
// Пишется ОДНИМ общим хуком (register) по таблице правил ниже — после
// каждого успешного изменяющего запроса, без логирования в каждом сервисе.
// Удаление описывается ДО выполнения запроса (иначе название уже не узнать).
// Частые правки одного человека в одной записи (автосохранение, порядок
// работ) схлопываются в одну строку: обновляется время последней.
import { PgObject } from 'pgobject';
import { sharingScopeUserIds } from '../utils/userAccess.js';
import { ROLES } from '../utils/const.js';

const COLLAPSE_MINUTES = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => UUID_RE.test(String(v || ''));

export const ENTITY_TYPES = ['art', 'collection', 'exhibition', 'report', 'contact', 'artist', 'portfolio', 'note', 'task', 'board'];

// Откуда брать название и владельца записи
const DESCRIBE = {
    art: 'SELECT id, name, user_id FROM my_art_object WHERE id = ANY($1::uuid[])',
    artist: 'SELECT id, name, user_id FROM my_artist WHERE id = ANY($1::uuid[])',
    collection: 'SELECT id, name, user_id FROM my_collection WHERE id = ANY($1::uuid[])',
    exhibition: 'SELECT id, name, user_id FROM my_exhibition WHERE id = ANY($1::uuid[])',
    report: 'SELECT id, name, user_id FROM my_report WHERE id = ANY($1::uuid[])',
    contact: 'SELECT id, name, user_id FROM my_contact WHERE id = ANY($1::uuid[])',
    note: 'SELECT id, title AS name, user_id FROM my_note WHERE id = ANY($1::uuid[])',
    task: 'SELECT id, title AS name, user_id, board_id FROM my_task WHERE id = ANY($1::uuid[])',
    board: 'SELECT id, name, user_id FROM my_task_board WHERE id = ANY($1::uuid[])',
    portfolio: 'SELECT id, title AS name, user_id, artist_id FROM my_portfolio WHERE id = ANY($1::uuid[])',
};

// id записи: из параметра URL, тела запроса или ответа
const fromParam = (key = 'id') => ({ request }) => [request.params?.[key]];
const fromBody = (key = 'id') => ({ request }) => [request.body?.[key]];
const fromBodyList = (key = 'ids') => ({ request }) => (Array.isArray(request.body?.[key]) ? request.body[key] : []);
const fromResponse = ({ response }) => (Array.isArray(response) ? response.map(r => r?.id) : [response?.id]);
// продажа → работа (история продаж — в истории работы)
const saleArt = async ({ request }) => {
    const id = request.params?.id;
    if (!isUuid(id)) return [];
    const row = (await PgObject.query('SELECT art_id FROM my_sale WHERE id = $1', [id])).rows[0];
    return row ? [row.art_id] : [];
};

const rule = (type, action, ids, { pre = false, needsResponse = false } = {}) => ({ type, action, ids, pre, needsResponse });
const created = (type) => rule(type, 'create', fromResponse, { needsResponse: true });
const updated = (type, ids = fromParam()) => rule(type, 'update', ids);
const deleted = (type, ids = fromParam()) => rule(type, 'delete', ids, { pre: true });

const A = '/api/v1/art';
const RULES = {
    [`POST ${A}/art-objects`]: created('art'),
    [`POST ${A}/art-objects/bulk`]: created('art'),
    [`PUT ${A}/art-objects/:id`]: updated('art'),
    [`PUT ${A}/art-objects`]: updated('art', fromBody()),
    [`POST ${A}/art-objects/bulk-update`]: updated('art', fromBodyList()),
    [`DELETE ${A}/art-objects/:id`]: deleted('art'),
    [`POST ${A}/art-objects/bulk-delete`]: deleted('art', fromBodyList()),

    [`POST ${A}/artists`]: created('artist'),
    [`PUT ${A}/artists`]: updated('artist', fromBody()),
    [`DELETE ${A}/artists/:id`]: deleted('artist'),

    'POST /api/v1/collections': created('collection'),
    'PUT /api/v1/collections/:id': updated('collection'),
    'PATCH /api/v1/collections/:id/folder': updated('collection'),
    'DELETE /api/v1/collections/:id': deleted('collection'),

    'POST /api/v1/exhibitions': created('exhibition'),
    'PUT /api/v1/exhibitions/:id': updated('exhibition'),
    'POST /api/v1/exhibitions/:id/photos': updated('exhibition'),
    'PUT /api/v1/exhibitions/:id/photos/:photoId': updated('exhibition'),
    'DELETE /api/v1/exhibitions/:id/photos/:photoId': updated('exhibition'),
    'PATCH /api/v1/exhibitions/:id/photos/reorder': updated('exhibition'),
    'DELETE /api/v1/exhibitions/:id': deleted('exhibition'),

    'POST /api/v1/reports': created('report'),
    'PUT /api/v1/reports/:id': updated('report'),
    'DELETE /api/v1/reports/:id': deleted('report'),

    // Продажи — в истории работы
    'POST /api/v1/sales': rule('art', 'sale_create', fromBody('art_id')),
    'PUT /api/v1/sales/:id': rule('art', ({ request }) => {
        const keys = Object.keys(request.body || {});
        if (keys.length === 1 && keys[0] === 'artist_paid') return request.body.artist_paid ? 'sale_paid' : 'sale_unpaid';
        return 'sale_update';
    }, saleArt, { pre: true }),
    'DELETE /api/v1/sales/:id': rule('art', 'sale_cancel', saleArt, { pre: true }),

    'POST /api/v1/contacts': created('contact'),
    'PUT /api/v1/contacts/:id': updated('contact'),
    'POST /api/v1/contacts/:id/works': updated('contact'),
    'PATCH /api/v1/contacts/:id/works/:artId': updated('contact'),
    'DELETE /api/v1/contacts/:id/works/:artId': updated('contact'),
    'DELETE /api/v1/contacts/:id': deleted('contact'),

    'POST /api/v1/notes': created('note'),
    'PUT /api/v1/notes/:id': updated('note'),
    'DELETE /api/v1/notes/:id': deleted('note'),

    'POST /api/v1/tasks': created('task'),
    'PUT /api/v1/tasks/:id': updated('task'),
    'PUT /api/v1/tasks/:id/move': rule('task', 'move', fromParam()),
    'DELETE /api/v1/tasks/:id': deleted('task'),
    'POST /api/v1/tasks/boards': created('board'),
    'PUT /api/v1/tasks/boards/:id': updated('board'),
    'DELETE /api/v1/tasks/boards/:id': deleted('board'),

    'POST /api/v1/portfolios': created('portfolio'),
    'PUT /api/v1/portfolios/:id': updated('portfolio'),
    'DELETE /api/v1/portfolios/:id': deleted('portfolio'),
};

function ruleFor(request) {
    const url = String(request.routeOptions?.url || '').replace(/\/+$/, '');
    return RULES[`${request.method} ${url}`] || null;
}

async function describe(type, ids) {
    const list = [...new Set(ids.filter(isUuid).map(String))];
    if (!list.length || !DESCRIBE[type]) return new Map();
    const rows = (await PgObject.query(DESCRIBE[type], [list])).rows;
    return new Map(rows.map(r => [r.id, {
        name: r.name ?? null,
        owner_id: r.user_id ?? null,
        meta: r.board_id ? { board_id: r.board_id } : r.artist_id ? { artist_id: r.artist_id } : null,
    }]));
}

export default class ChangeLogService {
    /** Подключает запись истории ко всем изменяющим запросам из RULES */
    static register(fastify) {
        // До выполнения: для удаления (и продаж) запоминаем, что именно меняем
        fastify.addHook('preHandler', async (request) => {
            const r = ruleFor(request);
            if (!r) return;
            request.changeLogRule = r;
            if (!r.pre) return;
            try {
                const ids = await r.ids({ request });
                request.changeLogIds = ids;
                request.changeLogPre = await describe(r.type, ids);
            } catch (e) {
                request.log.error(e, 'change log: pre-describe failed');
            }
        });

        // Ответ нужен, чтобы узнать id созданной записи
        fastify.addHook('onSend', async (request, reply, payload) => {
            if (request.changeLogRule?.needsResponse && reply.statusCode < 300 && typeof payload === 'string') {
                try { request.changeLogResponse = JSON.parse(payload); } catch { /* не JSON — пропускаем */ }
            }
            return payload;
        });

        fastify.addHook('onResponse', async (request, reply) => {
            const r = request.changeLogRule;
            if (!r || reply.statusCode >= 300 || !request.user?.f?.id) return;
            try {
                const ids = request.changeLogIds || await r.ids({ request, response: request.changeLogResponse });
                const action = typeof r.action === 'function' ? r.action({ request }) : r.action;
                // описание до запроса (удаление, продажи) или после (создание, правка)
                const info = r.pre ? request.changeLogPre : await describe(r.type, ids);
                for (const id of ids.filter(isUuid)) {
                    const d = info?.get(String(id));
                    if (!d) continue;
                    await ChangeLogService.write({
                        type: r.type,
                        id: String(id),
                        name: d.name,
                        action,
                        actorId: request.user.f.id,
                        ownerId: d.owner_id,
                        meta: request.impersonatedBy ? { ...(d.meta || {}), impersonated_by: request.impersonatedBy } : d.meta,
                    });
                }
            } catch (e) {
                request.log.error(e, 'change log: write failed');
            }
        });
    }

    static async write({ type, id, name, action, actorId, ownerId, meta }) {
        // Повторная правка того же человека подряд — обновляем время последней строки
        if (action === 'update' || action === 'move') {
            const last = (await PgObject.query(`
                SELECT id, action, actor_id FROM my_change_log
                WHERE entity_type = $1 AND entity_id = $2
                ORDER BY ctime DESC LIMIT 1
            `, [type, id])).rows[0];
            if (last && last.actor_id === actorId && last.action === action) {
                const res = await PgObject.query(`
                    UPDATE my_change_log SET ctime = now(), entity_name = $2
                    WHERE id = $1 AND ctime > now() - ($3 || ' minutes')::interval
                `, [last.id, name, String(COLLAPSE_MINUTES)]);
                if (res.rowCount) return;
            }
        }
        await PgObject.query(`
            INSERT INTO my_change_log (entity_type, entity_id, entity_name, action, actor_id, owner_id, meta)
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        `, [type, id, name, action, actorId, ownerId, meta ? JSON.stringify(meta) : null]);
    }

    static __row(r) {
        return {
            id: r.id,
            entity_type: r.entity_type,
            entity_id: r.entity_id,
            entity_name: r.entity_name,
            action: r.action,
            meta: r.meta || null,
            // запись позже удалили — ссылку на неё не показываем
            entity_deleted: !!r.entity_deleted,
            ctime: r.ctime,
            actor: r.actor_id ? { id: r.actor_id, name: r.actor_name, surname: r.actor_surname, email: r.actor_email } : null,
        };
    }

    /** История одной записи — только если запись в пространстве пользователя */
    static async forEntity(type, id, actorUser) {
        if (!ENTITY_TYPES.includes(type) || !isUuid(id)) throw new Error('Not found');
        const scope = await sharingScopeUserIds(actorUser);
        const rows = (await PgObject.query(`
            SELECT l.*, u.name AS actor_name, u.surname AS actor_surname, u.email AS actor_email,
                EXISTS (SELECT 1 FROM my_change_log d WHERE d.entity_type = l.entity_type
                    AND d.entity_id = l.entity_id AND d.action = 'delete') AS entity_deleted
            FROM my_change_log l
            LEFT JOIN my_user u ON u.id = l.actor_id
            WHERE l.entity_type = $1 AND l.entity_id = $2 AND l.owner_id = ANY($3::uuid[])
            ORDER BY l.ctime DESC
            LIMIT 300
        `, [type, id, scope])).rows;
        return rows.map(ChangeLogService.__row);
    }

    /**
     * Журнал галереи: все действия с данными галереи и её менеджеров.
     * Доступен галерее и Super Admin (ему — по всем пользователям).
     * filters: { type, actor, from, to, before, limit }
     */
    static async journal(actorUser, filters = {}) {
        const role = actorUser.f.role;
        if (![ROLES.GALLERY, ROLES.SUPER_ADMIN].includes(role)) throw new Error('Forbidden');
        const params = [];
        const add = (v) => { params.push(v); return `$${params.length}`; };
        const where = [];
        let scope = null;
        if (role !== ROLES.SUPER_ADMIN) {
            scope = await sharingScopeUserIds(actorUser);
            where.push(`l.owner_id = ANY(${add(scope)}::uuid[])`);
        }
        if (filters.type && ENTITY_TYPES.includes(filters.type)) where.push(`l.entity_type = ${add(filters.type)}`);
        if (isUuid(filters.actor)) where.push(`l.actor_id = ${add(filters.actor)}::uuid`);
        if (/^\d{4}-\d{2}-\d{2}$/.test(filters.from || '')) where.push(`l.ctime >= ${add(filters.from)}::date`);
        if (/^\d{4}-\d{2}-\d{2}$/.test(filters.to || '')) where.push(`l.ctime < (${add(filters.to)}::date + 1)`);
        if (filters.before && !Number.isNaN(Date.parse(filters.before))) where.push(`l.ctime < ${add(filters.before)}::timestamptz`);
        const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 50, 1), 200);

        const rows = (await PgObject.query(`
            SELECT l.*, u.name AS actor_name, u.surname AS actor_surname, u.email AS actor_email,
                EXISTS (SELECT 1 FROM my_change_log d WHERE d.entity_type = l.entity_type
                    AND d.entity_id = l.entity_id AND d.action = 'delete') AS entity_deleted
            FROM my_change_log l
            LEFT JOIN my_user u ON u.id = l.actor_id
            ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
            ORDER BY l.ctime DESC
            LIMIT ${limit + 1}
        `, params)).rows;

        // Для фильтра «сотрудник» — люди галереи (у Super Admin — те, кто есть в журнале)
        const actors = scope
            ? (await PgObject.query(
                'SELECT id, name, surname, email, role FROM my_user WHERE id = ANY($1::uuid[]) ORDER BY name', [scope]
            )).rows
            : (await PgObject.query(`
                SELECT DISTINCT u.id, u.name, u.surname, u.email, u.role
                FROM my_change_log l JOIN my_user u ON u.id = l.actor_id
                ORDER BY u.name LIMIT 500
            `)).rows;

        return {
            items: rows.slice(0, limit).map(ChangeLogService.__row),
            has_more: rows.length > limit,
            actors,
        };
    }
}
