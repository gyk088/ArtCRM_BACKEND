import UserController from '../../../controllers/user.js'

export default async function userRoutes(fastify, _options) {
    // GET /users
    fastify.get('/', UserController.getAllUsers)
    fastify.get('/:id', UserController.getUserById)
    fastify.post('/create', UserController.createUser)
    fastify.patch('/update', UserController.updateUser)

    // GET /users/:id
    // fastify.get('/:id', async (request) => {
    //     const { id } = request.params
    //     return { id, name: `User ${id}` }
    // })

    // POST /users

}