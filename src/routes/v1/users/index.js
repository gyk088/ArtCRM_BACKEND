import UserController from '../../../controllers/user.js'

export default async function userRoutes(fastify, _options) {    
    fastify.get('/', UserController.getAllUsers)
    fastify.get('/:id', UserController.getUserById)
    fastify.post('/create', UserController.createUser)
    fastify.patch('/update', UserController.updateUser)
}