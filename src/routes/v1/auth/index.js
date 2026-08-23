import AuthController from '../../../controllers/auth.js'
import auth from '../../../hooks/preHendler.js';

export default async function authRoutes(fastify, _options) {
    fastify.post('/login', AuthController.loginByPassword)
    fastify.post('/register', AuthController.register)
    fastify.post('/forgot-password', AuthController.requestPasswordReset)
    fastify.post('/reset-password', AuthController.resetPassword)
    fastify.post('/change-password', {preHandler: [auth()]}, AuthController.changePassword)
    fastify.get('/sessions', {preHandler: [auth()]}, AuthController.getSessions)
    fastify.post('/sessions/revoke', {preHandler: [auth()]}, AuthController.revokeSession)
    fastify.post('/sessions/revoke-others', {preHandler: [auth()]}, AuthController.revokeOtherSessions)
}