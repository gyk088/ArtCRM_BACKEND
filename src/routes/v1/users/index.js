import UserController from '../../../controllers/user.js'
import auth from '../../../hooks/preHendler.js';
import { ROLES } from '../../../bll/utils/const.js';

export default async function userRoutes(fastify, _options) {
    fastify.get('/', {preHandler: [auth()]}, UserController.getAllUsers)
    fastify.get('/:id', {preHandler: [auth()]}, UserController.getUserById)
    // Раньше был без auth() вообще и принимал role из тела запроса напрямую —
    // любой анонимный запрос мог создать себе super_admin. Публичная
    // регистрация теперь идёт только через /auth/register (роль всегда
    // artist), а создание Manager/Artist/Gallery — через /admin/*
    // (см. UserManagementService). Этот роут оставлен для обратной
    // совместимости, но теперь доступен только Super Admin'у.
    fastify.post('/create', {preHandler: [auth([ROLES.SUPER_ADMIN])]}, UserController.createUser)
    fastify.patch('/update', {preHandler: [auth()]}, UserController.updateUser)
}
