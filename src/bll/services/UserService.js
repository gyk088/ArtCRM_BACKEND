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

    static async getUserById (id, requesterId) {
        if (id !== requesterId) {
            throw new Error('User not found');
        }
        const user = await UserModel.getUserById(id);
        return user;
    }

    static async getAllUsers(requesterId) {
        const user = await UserModel.getUserById(requesterId);
        return user ? [user] : [];
    }

    // Поля, которые пользователь может менять сам себе через профиль.
    // role/pin/email/password/active/client и прочие системные поля сюда
    // намеренно не входят — их подмена через этот эндпоинт была бы повышением прав.
    static get SELF_EDITABLE_FIELDS() {
        return ['name', 'surname', 'bdate', 'country', 'city', 'sex', 'phone', 'certificate_header_text'];
    }

    static async updateUser(userData, requesterId) {
        const user = await UserModel.getUserById(requesterId);
        if (!user) {
            throw new Error('User not found');
        }

        UserService.SELF_EDITABLE_FIELDS.forEach(key => {
            if (userData[key] !== undefined) {
                user.f[key] = userData[key];
            }
        });

        await user.save();
        return user;
    }
}