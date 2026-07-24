import AuthService from '../bll/services/AuthService.js';

export default function auth (rolesArray) {
  return async function(request, reply) {
    try {
      const token = request.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new Error('No token was sent');
      }

      const user = await AuthService.loginByToken(
        token,
        request.ip,
        request.headers['user-agent'],
        request.headers['x-fcm']     
      );

      if (!user) {
        throw new Error('Authentication failed! No such user');
      }

      if (rolesArray &&rolesArray?.length && !rolesArray.includes(user.f.role)) {
        throw new Error(`No access! User: ${user.f.name}, ${user.f.role}`);
      }
      request.user = user;
    } catch (error) {
      reply.code(401).send(error);
    }
  }
}