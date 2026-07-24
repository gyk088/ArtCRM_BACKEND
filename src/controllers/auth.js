import AuthService from '../bll/services/AuthService.js';

export default class AuthController {
    static async loginByPassword(request, reply) {
        try {
            const data = await AuthService.loginByPassword(request.body.email, request.body.password, request.ip, request.headers['user-agent']);
            if (data) {
                return data
            } else {
                reply.code(400).send(new Error('no such user'))
            }
        } catch (error) {
            reply.code(400).send(error)
        }
    }    
}