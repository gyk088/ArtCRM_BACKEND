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
        const user = await UserService.getUserById(id);
        return user
      } catch (error) {
        reply.code(400).send(error)
      }
    }

    static async getAllUsers(_, reply) {
      try {
        const users = await UserService.getAllUsers();
        return users
      } catch (error) {
        reply.code(400).send(error)
      }
    }
}