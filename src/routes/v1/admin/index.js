import UserManagementController from '../../../controllers/userManagement.js'
import auth from '../../../hooks/preHendler.js';
import { ROLES } from '../../../bll/utils/const.js';

export default async function adminRoutes(fastify, _options) {
    // Список управляемых пользователей — Super Admin видит всех, Gallery — только своих
    fastify.get('/users', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.listUsers)

    // Создание Manager/Artist
    fastify.post('/users', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.createManagedUser)

    // Создание Gallery — только Super Admin
    fastify.post('/galleries', {preHandler: [auth([ROLES.SUPER_ADMIN])]}, UserManagementController.createGallery)

    // Смена роли
    fastify.patch('/users/:id/role', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.changeRole)

    // Блокировка/разблокировка
    fastify.patch('/users/:id/block', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.toggleBlock)

    // Принудительная смена пароля (без знания текущего)
    fastify.patch('/users/:id/password', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.changePassword)

    // Смена email
    fastify.patch('/users/:id/email', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.changeEmail)

    // Имперсонация ("зайти под пользователем")
    fastify.post('/users/:id/impersonate', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.impersonate)

    // Выход из режима имперсонации обратно в свой аккаунт — доступен любому
    // авторизованному запросу с активной сессией имперсонации (проверяется
    // внутри сервиса по session.impersonated_by, а не по роли).
    fastify.post('/impersonate/stop', {preHandler: [auth()]}, UserManagementController.stopImpersonation)
}
