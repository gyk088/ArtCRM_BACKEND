import AuthController from '../../../controllers/auth.js'

export default async function authRoutes(fastify, _options) {    
    fastify.post('/login', AuthController.loginByPassword)
}