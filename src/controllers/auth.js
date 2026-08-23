import AuthService from '../bll/services/AuthService.js';

export default class AuthController {
    static async loginByPassword(request, reply) {
        try {
            const data = await AuthService.loginByPassword(request.body.email, request.body.password, request.ip, request.headers['user-agent']);
            if (data) {
                return data
            } else {
                reply.code(400).send(new Error('no such user'))
            }
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async register(request, reply) {
        try {
            const data = await AuthService.register(request.body, request.ip, request.headers['user-agent']);
            return data
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async requestPasswordReset(request, reply) {
        try {
            const data = await AuthService.requestPasswordReset(request.body.email);
            return data
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async resetPassword(request, reply) {
        try {
            const data = await AuthService.resetPassword(request.body.token, request.body.password);
            return data
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async changePassword(request, reply) {
        try {
            const data = await AuthService.changePassword(request.user.f.id, request.body.currentPassword, request.body.newPassword);
            return data
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async getSessions(request, reply) {
        try {
            const currentToken = request.headers?.authorization?.replace('Bearer ', '');
            const sessions = await AuthService.getSessions(request.user.f.id);
            return sessions.map(session => ({ ...session.toJSON(), isCurrent: session.f.token === currentToken }));
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async revokeSession(request, reply) {
        try {
            const data = await AuthService.revokeSession(request.user.f.id, request.body.token);
            return data
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async revokeOtherSessions(request, reply) {
        try {
            const currentToken = request.headers?.authorization?.replace('Bearer ', '');
            const data = await AuthService.revokeOtherSessions(request.user.f.id, currentToken);
            return data
        } catch (error) {
            reply.code(400).send(error)
        }
    }
}