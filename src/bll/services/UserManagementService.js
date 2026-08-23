import UserModel from '../models/UserModel.js';
import SessionModel from '../models/SessionModel.js';
import AuditLogModel from '../models/AuditLogModel.js';
import AuthorizationService from './AuthorizationService.js';
import { ROLES, MANAGED_ROLES } from '../utils/const.js';
import { getRandomPassword, validateEmail } from '../utils/helpers.js';

function toActor(user) {
  return { id: user.f.id, role: user.f.role };
}

function toTarget(user) {
  return { id: user.f.id, role: user.f.role, managed_by_gallery_id: user.f.managed_by_gallery_id };
}

export default class UserManagementService {
  /**
   * Список пользователей, которыми actor управляет:
   * - Super Admin видит всех пользователей системы;
   * - Gallery видит только тех, у кого managed_by_gallery_id === её id;
   * - остальным ролям список недоступен.
   */
  static async listManagedUsers(actorUser) {
    const actor = toActor(actorUser);

    if (!AuthorizationService.canListUsers(actor)) {
      throw new Error('Forbidden');
    }

    if (AuthorizationService.isSuperAdmin(actor)) {
      return UserModel.select();
    }

    return UserModel.select('WHERE managed_by_gallery_id = $1', [actor.id]);
  }

  /**
   * Создание Manager/Artist. Super Admin может явно указать владеющую
   * Галерею (managed_by_gallery_id) либо оставить пользователя без неё.
   * Gallery всегда привязывает нового пользователя к самой себе.
   */
  static async createManagedUser(actorUser, data) {
    const actor = toActor(actorUser);
    const role = data.role;

    if (!MANAGED_ROLES.includes(role)) {
      throw new Error(`Invalid role: must be one of ${MANAGED_ROLES.join(', ')}`);
    }

    if (!AuthorizationService.canCreateUser(actor, role)) {
      throw new Error('Forbidden');
    }

    let managedByGalleryId = null;

    if (AuthorizationService.isGallery(actor)) {
      managedByGalleryId = actor.id;
    } else if (data.managed_by_gallery_id) {
      const gallery = await UserModel.getUserById(data.managed_by_gallery_id);
      if (!gallery || gallery.f.role !== ROLES.GALLERY) {
        throw new Error('managed_by_gallery_id must reference an existing gallery user');
      }
      managedByGalleryId = gallery.f.id;
    }

    const password = data.password || getRandomPassword();
    const user = new UserModel({
      name: data.name,
      surname: data.surname,
      email: data.email,
      phone: data.phone,
      password,
      role,
      managed_by_gallery_id: managedByGalleryId,
      created_by: actor.id,
    });
    await user.save();

    await AuditLogModel.log(actor.id, user.f.id, 'user_created', { role, managed_by_gallery_id: managedByGalleryId });

    return user;
  }

  /**
   * Создание Gallery — привилегия только Super Admin. У Галереи нет
   * managed_by_gallery_id (она сама управляющая единица).
   */
  static async createGallery(actorUser, data) {
    const actor = toActor(actorUser);

    if (!AuthorizationService.canCreateGallery(actor)) {
      throw new Error('Forbidden: only super_admin can create gallery users');
    }

    const password = data.password || getRandomPassword();
    const user = new UserModel({
      name: data.name,
      surname: data.surname,
      email: data.email,
      phone: data.phone,
      password,
      role: ROLES.GALLERY,
      managed_by_gallery_id: null,
      created_by: actor.id,
    });
    await user.save();

    await AuditLogModel.log(actor.id, user.f.id, 'gallery_created', {});

    return user;
  }

  static async changeRole(actorUser, targetUserId, newRole) {
    const actor = toActor(actorUser);
    const targetUser = await UserModel.getUserById(targetUserId);
    if (!targetUser) throw new Error('User not found');

    const target = toTarget(targetUser);

    if (!Object.values(ROLES).includes(newRole)) {
      throw new Error('Invalid role');
    }

    if (!AuthorizationService.canChangeRole(actor, target, newRole)) {
      throw new Error('Forbidden');
    }

    const oldRole = targetUser.f.role;
    targetUser.f.role = newRole;
    await targetUser.save();

    await AuditLogModel.log(actor.id, target.id, 'role_changed', { from: oldRole, to: newRole });

    return targetUser;
  }

  /**
   * Блокировка/разблокировка. Данные пользователя не удаляются и не
   * теряются — при повторной активации всё остаётся на месте. При блокировке
   * все текущие сессии пользователя немедленно завершаются, чтобы уже
   * выданные токены сразу переставали работать.
   */
  static async toggleBlock(actorUser, targetUserId, active) {
    const actor = toActor(actorUser);
    const targetUser = await UserModel.getUserById(targetUserId);
    if (!targetUser) throw new Error('User not found');

    const target = toTarget(targetUser);

    if (!AuthorizationService.canToggleBlock(actor, target)) {
      throw new Error('Forbidden');
    }

    targetUser.f.active = !!active;
    await targetUser.save();

    if (!active) {
      await SessionModel.deleteAllForUser(targetUser.f.id);
    }

    await AuditLogModel.log(actor.id, target.id, active ? 'user_unblocked' : 'user_blocked', {});

    return targetUser;
  }

  /**
   * Принудительная смена пароля управляемого пользователя (без знания
   * текущего пароля — в отличие от AuthService.changePassword, которым
   * пользователь меняет пароль сам себе). Все текущие сессии пользователя
   * инвалидируются, чтобы новый пароль сразу стал единственным способом входа.
   */
  static async changePassword(actorUser, targetUserId, newPassword) {
    const actor = toActor(actorUser);
    const targetUser = await UserModel.getUserById(targetUserId);
    if (!targetUser) throw new Error('User not found');

    const target = toTarget(targetUser);

    if (!AuthorizationService.canManageUser(actor, target)) {
      throw new Error('Forbidden');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('password must be at least 6 characters');
    }

    targetUser.f.password = newPassword;
    await targetUser.save();

    await SessionModel.deleteAllForUser(targetUser.f.id);

    await AuditLogModel.log(actor.id, target.id, 'password_changed', {});

    return { success: true, message: 'Password updated successfully' };
  }

  /**
   * Смена email управляемого пользователя.
   */
  static async changeEmail(actorUser, targetUserId, newEmail) {
    const actor = toActor(actorUser);
    const targetUser = await UserModel.getUserById(targetUserId);
    if (!targetUser) throw new Error('User not found');

    const target = toTarget(targetUser);

    if (!AuthorizationService.canManageUser(actor, target)) {
      throw new Error('Forbidden');
    }

    const email = newEmail?.toLowerCase()?.trim();
    if (!email || !validateEmail(email)) {
      throw new Error('email is invalid');
    }

    const existing = await UserModel.getUserByEmail(email);
    if (existing && existing.f.id !== targetUser.f.id) {
      throw new Error('email is already registered');
    }

    const oldEmail = targetUser.f.email;
    targetUser.f.email = email;
    await targetUser.save();

    await AuditLogModel.log(actor.id, target.id, 'email_changed', { from: oldEmail, to: email });

    return targetUser;
  }

  /**
   * Имперсонация — отдельная сессия с пометкой impersonated_by, а не логин
   * по паролю. Действия под этой сессией логируются глобальным hook'ом
   * (см. onResponse в index.js) для каждого мутирующего запроса.
   */
  static async impersonate(actorUser, targetUserId, ip, userAgent) {
    const actor = toActor(actorUser);
    const targetUser = await UserModel.getUserById(targetUserId);
    if (!targetUser) throw new Error('User not found');

    const target = toTarget(targetUser);

    if (!AuthorizationService.canImpersonate(actor, target)) {
      throw new Error('Forbidden');
    }

    if (targetUser.f.active === false) {
      throw new Error('Cannot impersonate a blocked user');
    }

    const session = new SessionModel({
      user_id: targetUser.f.id,
      impersonated_by: actor.id,
      ip,
      user_agent: userAgent
    });
    await session.generateToken();
    await session.save();

    await AuditLogModel.log(actor.id, target.id, 'impersonation_started', {});

    return { session, user: targetUser };
  }

  static async stopImpersonation(token) {
    const session = await SessionModel.getSessionByToken(token);
    if (!session || !session.f.impersonated_by) {
      throw new Error('Not an impersonated session');
    }

    await AuditLogModel.log(session.f.impersonated_by, session.f.user_id, 'impersonation_stopped', {});
    await session.delete();

    return { success: true };
  }
}
