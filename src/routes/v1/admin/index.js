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

    // Перемещение менеджера/художника в другую галерею (или убрать из галереи) —
    // строго Super Admin, см. UserManagementService.assignUserToGallery.
    fastify.patch('/users/:id/gallery', {preHandler: [auth([ROLES.SUPER_ADMIN])]}, UserManagementController.assignUserToGallery)

    // Блокировка/разблокировка
    fastify.patch('/users/:id/block', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.toggleBlock)

    // Принудительная смена пароля (без знания текущего)
    fastify.patch('/users/:id/password', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.changePassword)

    // Смена email
    fastify.patch('/users/:id/email', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.changeEmail)

    // Изменение лимита места на диске (Manager/Artist/Super Admin)
    fastify.patch('/users/:id/storage-limit', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.updateStorageLimit)

    // Квоты "проданных мест" галереи (менеджеры/художники-с-кабинетом/
    // художники-справочника) — смотреть может сама галерея и Super Admin,
    // менять (это оплаченный лимит) — только Super Admin
    fastify.get('/galleries/:id/quotas', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.getQuotaUsage)
    fastify.patch('/galleries/:id/quotas', {preHandler: [auth([ROLES.SUPER_ADMIN])]}, UserManagementController.updateQuotas)

    // Пригласительные ссылки регистрации галереи — сама галерея и Super Admin
    fastify.get('/galleries/:id/invites', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.getInviteLinks)
    fastify.patch('/galleries/:id/invites/regenerate', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.regenerateInviteLink)

    // Имперсонация ("зайти под пользователем")
    fastify.post('/users/:id/impersonate', {preHandler: [auth([ROLES.SUPER_ADMIN, ROLES.GALLERY])]}, UserManagementController.impersonate)

    // Выход из режима имперсонации обратно в свой аккаунт — доступен любому
    // авторизованному запросу с активной сессией имперсонации (проверяется
    // внутри сервиса по session.impersonated_by, а не по роли).
    fastify.post('/impersonate/stop', {preHandler: [auth()]}, UserManagementController.stopImpersonation)
}
