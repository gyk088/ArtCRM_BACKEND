import  UserModel from '../models/UserModel.js'
import { ROLES } from '../utils/const.js'
import { getRandomPassword } from '../utils/helpers.js'


export default class UserService {
    static async createUser (userData) {
        const password = getRandomPassword();
        const user = new UserModel({
            ...userData,
            password,
        });

        await user.save();
        return user;
    }

    static async getUserById (id) {
        const user = await UserModel.getUserById(id);
        return user;
    }

    static async getAllUsers() {
        const users = await UserModel.select();
        return users;
    }
}