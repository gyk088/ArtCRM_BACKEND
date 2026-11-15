import { PgObject } from 'pgobject';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_LIMIT = 100;

/**
 * Уведомления внутри приложения (my_notification). Пользователь видит
 * только свои; фронтенд опрашивает количество непрочитанных раз в минуту.
 */
export default class NotificationService {
    /**
     * Создать уведомление. Ошибка уведомления не должна ломать основное
     * действие (например, создание задачи) — поэтому только логируем.
     */
    static async notify({ userId, type, title, body = null, link = null, actorId = null }) {
        if (!userId || userId === actorId) return null; // себе не уведомляем
        try {
            const result = await PgObject.query(`
                INSERT INTO my_notification (user_id, type, title, body, link, actor_id)
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
            `, [userId, type, String(title).slice(0, 300), body ? String(body).slice(0, 2000) : null, link, actorId]);
            return result.rows[0]?.id || null;
        } catch (e) {
            console.error('Failed to create notification:', e);
            return null;
        }
    }

    static async list(actorUser) {
        const result = await PgObject.query(`
            SELECT n.id, n.type, n.title, n.body, n.link, n.is_read, n.ctime,
                n.actor_id, a.name AS actor_name, a.surname AS actor_surname
            FROM my_notification n
            LEFT JOIN my_user a ON a.id = n.actor_id
            WHERE n.user_id = $1
            ORDER BY n.ctime DESC
            LIMIT ${LIST_LIMIT}
        `, [actorUser.f.id]);
        return result.rows.map(r => ({
            id: r.id, type: r.type, title: r.title, body: r.body, link: r.link,
            is_read: r.is_read, ctime: r.ctime,
            actor: r.actor_id ? { id: r.actor_id, name: r.actor_name, surname: r.actor_surname } : null,
        }));
    }

    /** Непрочитанные: количество и самые свежие (для всплывающих уведомлений) */
    static async unread(actorUser) {
        const count = await PgObject.query(
            'SELECT COUNT(*)::int AS n FROM my_notification WHERE user_id = $1 AND NOT is_read', [actorUser.f.id]
        );
        const latest = await PgObject.query(`
            SELECT id, type, title, body, link, ctime FROM my_notification
            WHERE user_id = $1 AND NOT is_read ORDER BY ctime DESC LIMIT 5
        `, [actorUser.f.id]);
        return { count: count.rows[0].n, latest: latest.rows };
    }

    /** Отметить прочитанными: ids — список, либо all: true — все */
    static async markRead(data, actorUser) {
        if (data?.all) {
            await PgObject.query('UPDATE my_notification SET is_read = true WHERE user_id = $1 AND NOT is_read', [actorUser.f.id]);
        } else {
            const ids = Array.isArray(data?.ids) ? data.ids.map(String).filter(id => UUID_RE.test(id)) : [];
            if (!ids.length) throw new Error('ids array or all: true is required');
            await PgObject.query(
                'UPDATE my_notification SET is_read = true WHERE user_id = $1 AND id = ANY($2::uuid[])',
                [actorUser.f.id, ids]
            );
        }
        return NotificationService.unread(actorUser);
    }

    static async remove(id, actorUser) {
        if (!UUID_RE.test(String(id))) throw new Error('Notification not found');
        await PgObject.query('DELETE FROM my_notification WHERE id = $1 AND user_id = $2', [id, actorUser.f.id]);
        return { success: true };
    }
}
