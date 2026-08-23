import AuthService from '../bll/services/AuthService.js';

export default function auth (rolesArray) {
  return async function(request, reply) {
    try {
      const token = request.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new Error('No token was sent');
      }

      const result = await AuthService.loginByToken(
        token,
        request.ip,
        request.headers['user-agent'],
        request.headers['x-fcm']
      );

      if (!result) {
        throw new Error('Authentication failed! No such user');
      }

      const { user, impersonatedBy } = result;

      if (rolesArray &&rolesArray?.length && !rolesArray.includes(user.f.role)) {
        // Аутентификация прошла успешно, но роли не хватает для этого роута —
        // это 403 (Forbidden), а не 401 (Unauthorized).
        reply.code(403).send(new Error(`No access! User: ${user.f.name}, ${user.f.role}`));
        return;
      }
      request.user = user;
      request.impersonatedBy = impersonatedBy;
    } catch (error) {
      reply.code(401).send(error);
    }
  }
}