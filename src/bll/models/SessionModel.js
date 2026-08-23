import { PgObject } from 'pgobject';
import bcrypt from 'bcrypt';
// h2xws91g
// ivan2@example.com

export default class SessionModel extends PgObject {
    static get schema() {
        return {
            user_id: {
                pk: true
            },
            token: {
                pk: true,
            },
            fcm_token: {},
            user_agent: {},
            type: {},
            ip: {},
            // ID реального инициатора (Super Admin/Gallery), если сессия создана
            // через имперсонацию, а не обычным логином.
            impersonated_by: {},
            ctime: {
                default: new Date()
            },
            utime: {}
        }
    }

    static get table() {
        return 'my_session';
    }

    static async getSessionByToken(token) {
        const session = await SessionModel.select("WHERE token = $1 LIMIT 1", [token]);
        return session[0];
    }

    static async getSessionByUserId(userId) {
        const session = await SessionModel.select("WHERE user_id = $1 AND type = 'mobile' ORDER BY ctime DESC LIMIT 1", [userId]);
        return session[0];
    }

    static async getSessionsByUserId(userId) {
        const sessions = await SessionModel.select("WHERE user_id = $1 ORDER BY ctime DESC", [userId]);
        return sessions;
    }

    static async getSessionByUserIdAndToken(userId, token) {
        const session = await SessionModel.select("WHERE user_id = $1 AND token = $2 LIMIT 1", [userId, token]);
        return session[0];
    }

    // Немедленно инвалидирует все активные сессии пользователя — используется
    // при блокировке, чтобы уже выданные токены сразу переставали работать.
    static async deleteAllForUser(userId) {
        const sessions = await SessionModel.select('WHERE user_id = $1', [userId]);
        for (const session of sessions) {
            await session.delete();
        }
        return { success: true, deleted: sessions.length };
    }

    async generateToken() {
        // ✅ Асинхронная версия с 10 раундами соли
        const hash = await bcrypt.hash(this.f.user_id + Date.now(), 10);
        const token = `${this.f.user_id}_${hash}`;
        this.f.token = token;
    } 
}

