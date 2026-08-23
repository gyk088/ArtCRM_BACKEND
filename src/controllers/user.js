import UserService from '../bll/services/UserService.js';

export default class UserController {
    static async createUser(request, reply) {
      try {
        const user = await UserService.createUser(request.body);
        return user
      } catch (error) {
        reply.code(400).send(error)
      }
    }

    static async getUserById(request, reply) {
      try {
        const { id } = request.params
        const user = await UserService.getUserById(id, request.user.f.id);
        return user
      } catch (error) {
        reply.code(400).send(error)
      }
    }

    static async getAllUsers(request, reply) {
      try {
        const users = await UserService.getAllUsers(request.user.f.id);
        return users
      } catch (error) {
        reply.code(400).send(error)
      }
    }

    static async updateUser(request, reply) {
      try {
        const user = await UserService.updateUser(request.body, request.user.f.id);
        return user
      } catch (error) {
        reply.code(400).send(error)
      }
    }
}
