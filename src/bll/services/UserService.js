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

    static async updateUser(userData) {
        const user = await UserModel.getUserById(userData.id); 
        if (!user) {
            throw new Error('User not found');
        }
        user.f.name = userData.name || user.f.name;
        user.f.surname = userData.surname || user.f.surname;
        
        await user.save();
        return user;
    }
}