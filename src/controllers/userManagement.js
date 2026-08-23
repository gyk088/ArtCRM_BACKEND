import UserManagementService from '../bll/services/UserManagementService.js';

// "Forbidden" — отказ по правам (scope/диапазон ролей) -> 403.
// Всё остальное (не найден пользователь, невалидная роль и т.п.) -> 400.
function sendError(reply, error) {
    const code = error.message === 'Forbidden' ? 403 : 400;
    reply.code(code).send({ error: error.message });
}

export default class UserManagementController {
    static async listUsers(request, reply) {
        try {
            const users = await UserManagementService.listManagedUsers(request.user);
            return users;
        } catch (error) {
            sendError(reply, error);
        }
    }

    static async createManagedUser(request, reply) {
        try {
            const user = await UserManagementService.createManagedUser(request.user, request.body);
            return user;
        } catch (error) {
            sendError(reply, error);
        }
    }

    static async createGallery(request, reply) {
        try {
            const user = await UserManagementService.createGallery(request.user, request.body);
            return user;
        } catch (error) {
            sendError(reply, error);
        }
    }

    static async changeRole(request, reply) {
        try {
            const { id } = request.params;
            const { role } = request.body;
            const user = await UserManagementService.changeRole(request.user, id, role);
            return user;
        } catch (error) {
            sendError(reply, error);
        }
    }

    static async toggleBlock(request, reply) {
        try {
            const { id } = request.params;
            const { active } = request.body;
            const user = await UserManagementService.toggleBlock(request.user, id, active);
            return user;
        } catch (error) {
            sendError(reply, error);
        }
    }

    static async changePassword(request, reply) {
        try {
            const { id } = request.params;
            const { password } = request.body;
            const result = await UserManagementService.changePassword(request.user, id, password);
            return result;
        } catch (error) {
            sendError(reply, error);
        }
    }

    static async changeEmail(request, reply) {
        try {
            const { id } = request.params;
            const { email } = request.body;
            const user = await UserManagementService.changeEmail(request.user, id, email);
            return user;
        } catch (error) {
            sendError(reply, error);
        }
    }

    static async impersonate(request, reply) {
        try {
            const { id } = request.params;
            const result = await UserManagementService.impersonate(request.user, id, request.ip, request.headers['user-agent']);
            return result;
        } catch (error) {
            sendError(reply, error);
        }
    }

    static async stopImpersonation(request, reply) {
        try {
            const token = request.headers?.authorization?.replace('Bearer ', '');
            const result = await UserManagementService.stopImpersonation(token);
            return result;
        } catch (error) {
            sendError(reply, error);
        }
    }
}
