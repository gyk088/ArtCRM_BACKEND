import UserModel from '../models/UserModel.js';
import SessionModel from '../models/SessionModel.js';
import AuditLogModel from '../models/AuditLogModel.js';
import AuthorizationService from './AuthorizationService.js';
import FileModel from '../models/FileModel.js';
import QuotaService from './QuotaService.js';
import crypto from 'crypto';
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

    const users = AuthorizationService.isSuperAdmin(actor)
      ? await UserModel.select()
      : await UserModel.select('WHERE managed_by_gallery_id = $1', [actor.id]);

    return UserManagementService.__withStorageUsage(users);
  }

  /**
   * Подмешивает в список пользователей занятое место на диске
   * (storage_used_bytes) — одним batch-запросом, без N+1.
   */
  static async __withStorageUsage(users) {
    const usageByUserId = await FileModel.getTotalSizeByUserIds(users.map(u => u.f.id));

    return users.map(user => ({
      ...user.toJSON(),
      storage_used_bytes: usageByUserId[user.f.id] || 0
    }));
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

    // Квота — сколько мест галерея "купила" (см. QuotaService). Действует
    // независимо от того, кто создаёт пользователя (сама галерея, Super
    // Admin от её имени, или регистрация по инвайт-ссылке) — это лимит
    // самой галереи, а не права actor'а.
    if (managedByGalleryId) {
      if (role === ROLES.MANAGER) {
        await QuotaService.assertCanAddManager(managedByGalleryId);
      } else if (role === ROLES.ARTIST) {
        await QuotaService.assertCanAddArtistCabinet(managedByGalleryId);
      }
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
   * Переместить существующего менеджера/художника в другую галерею (или
   * убрать из галереи, передав null/galleryId не указан). Работы остаются
   * за тем же user_id, поэтому просто "переезжают" вместе с пользователем в
   * новую зону шаринга (см. AuthorizationService.gallerySharingScope) — сами
   * записи my_art_object не трогаем. Строго Super Admin — это перемещение
   * между "чужими" галереями, не обычное управление своими пользователями.
   * Квота новой галереи проверяется так же, как при создании пользователя.
   */
  static async assignUserToGallery(actorUser, targetUserId, galleryId) {
    const actor = toActor(actorUser);
    if (!AuthorizationService.isSuperAdmin(actor)) {
      throw new Error('Forbidden');
    }

    const target = await UserModel.getUserById(targetUserId);
    if (!target || !MANAGED_ROLES.includes(target.f.role)) {
      throw new Error('User not found');
    }

    if (galleryId) {
      const gallery = await UserModel.getUserById(galleryId);
      if (!gallery || gallery.f.role !== ROLES.GALLERY) {
        throw new Error('galleryId must reference an existing gallery user');
      }

      if (target.f.role === ROLES.MANAGER) {
        await QuotaService.assertCanAddManager(galleryId);
      } else if (target.f.role === ROLES.ARTIST) {
        await QuotaService.assertCanAddArtistCabinet(galleryId);
      }
    }

    const before = target.f.managed_by_gallery_id;
    target.f.managed_by_gallery_id = galleryId || null;
    await target.save();

    await AuditLogModel.log(actor.id, target.f.id, 'gallery_reassigned', { from: before, to: galleryId || null });

    return target;
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
   * Изменение лимита места на диске управляемого пользователя. Права те же,
   * что и у смены пароля/email (canManageUser) — Super Admin управляет
   * любым лимитом, Gallery — только своими Manager/Artist.
   */
  static async updateStorageLimit(actorUser, targetUserId, limitBytes) {
    const actor = toActor(actorUser);
    const targetUser = await UserModel.getUserById(targetUserId);
    if (!targetUser) throw new Error('User not found');

    const target = toTarget(targetUser);

    if (!AuthorizationService.canManageUser(actor, target)) {
      throw new Error('Forbidden');
    }

    const limit = Number(limitBytes);
    if (!Number.isFinite(limit) || limit < 0) {
      throw new Error('limit_bytes must be a non-negative number');
    }

    const oldLimit = targetUser.f.storage_limit_bytes;
    targetUser.f.storage_limit_bytes = limit;
    await targetUser.save();

    await AuditLogModel.log(actor.id, target.id, 'storage_limit_changed', { from: oldLimit, to: limit });

    const [withUsage] = await UserManagementService.__withStorageUsage([targetUser]);
    return withUsage;
  }

  // "Держатель квоты" — галерея (все 3 квоты) или менеджер без галереи
  // (только quota_catalog_artists — свой собственный справочник, см.
  // QuotaService.poolGalleryId). Менеджер ВНУТРИ галереи квоты не имеет —
  // его справочник пулится в квоту галереи, отдельного лимита у него нет.
  static __isQuotaHolder(user) {
    if (user.f.role === ROLES.GALLERY) return true;
    return user.f.role === ROLES.MANAGER && !user.f.managed_by_gallery_id;
  }

  /**
   * Текущие квоты держателя (галереи или менеджера без галереи) вместе с
   * фактическим использованием — для отображения перед редактированием
   * (см. updateQuotas).
   */
  static async getQuotaUsage(actorUser, holderId) {
    const actor = toActor(actorUser);
    if (!AuthorizationService.canViewQuotaHolder(actor, holderId)) {
      throw new Error('Forbidden');
    }

    const holder = await UserModel.getUserById(holderId);
    if (!holder || !UserManagementService.__isQuotaHolder(holder)) {
      throw new Error('Quota holder not found');
    }

    return QuotaService.getUsageSnapshot(holder);
  }

  /**
   * Изменение купленных квот держателя (галереи или менеджера без галереи)
   * — строго Super Admin, это "оплаченный" лимит, сам держатель увеличить
   * себе его не может (в отличие от storage_limit_bytes, который может
   * выставлять и Gallery своим управляемым пользователям — здесь target —
   * сам держатель квоты). Для менеджера без галереи доступна только
   * quota_catalog_artists — у него нет своих менеджеров/художников-кабинетов.
   */
  static async updateQuotas(actorUser, holderId, quotas) {
    const actor = toActor(actorUser);
    if (!AuthorizationService.isSuperAdmin(actor)) {
      throw new Error('Forbidden');
    }

    const holder = await UserModel.getUserById(holderId);
    if (!holder || !UserManagementService.__isQuotaHolder(holder)) {
      throw new Error('Quota holder not found');
    }

    const fields = holder.f.role === ROLES.GALLERY
      ? ['quota_managers', 'quota_artist_cabinets', 'quota_catalog_artists']
      : ['quota_catalog_artists'];
    const before = {};
    for (const field of fields) {
      if (quotas[field] === undefined) continue;

      const value = Number(quotas[field]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${field} must be a non-negative number`);
      }

      before[field] = holder.f[field];
      holder.f[field] = value;
    }

    await holder.save();
    await AuditLogModel.log(actor.id, holder.f.id, 'quotas_changed', { from: before, to: quotas });

    return QuotaService.getUsageSnapshot(holder);
  }

  /**
   * Пригласительные ссылки регистрации галереи — отдельная для менеджеров
   * и для художников. Токен создаётся лениво при первом запросе (а не при
   * создании галереи), чтобы не плодить неиспользуемые токены.
   */
  static async getInviteLinks(actorUser, galleryId) {
    const actor = toActor(actorUser);
    if (!AuthorizationService.canManageGallery(actor, galleryId)) {
      throw new Error('Forbidden');
    }

    const gallery = await UserModel.getUserById(galleryId);
    if (!gallery || gallery.f.role !== ROLES.GALLERY) {
      throw new Error('Gallery not found');
    }

    let changed = false;
    if (!gallery.f.manager_invite_token) {
      gallery.f.manager_invite_token = crypto.randomBytes(24).toString('hex');
      changed = true;
    }
    if (!gallery.f.artist_invite_token) {
      gallery.f.artist_invite_token = crypto.randomBytes(24).toString('hex');
      changed = true;
    }
    if (changed) await gallery.save();

    return {
      managerToken: gallery.f.manager_invite_token,
      artistToken: gallery.f.artist_invite_token,
    };
  }

  /**
   * Перевыпустить одну из двух ссылок — старая сразу перестаёт работать
   * (например, если она "утекла" не туда).
   */
  static async regenerateInviteLink(actorUser, galleryId, role) {
    const actor = toActor(actorUser);
    if (!AuthorizationService.canManageGallery(actor, galleryId)) {
      throw new Error('Forbidden');
    }

    if (!MANAGED_ROLES.includes(role)) {
      throw new Error(`Invalid role: must be one of ${MANAGED_ROLES.join(', ')}`);
    }

    const gallery = await UserModel.getUserById(galleryId);
    if (!gallery || gallery.f.role !== ROLES.GALLERY) {
      throw new Error('Gallery not found');
    }

    const field = role === ROLES.MANAGER ? 'manager_invite_token' : 'artist_invite_token';
    gallery.f[field] = crypto.randomBytes(24).toString('hex');
    await gallery.save();

    return {
      managerToken: gallery.f.manager_invite_token,
      artistToken: gallery.f.artist_invite_token,
    };
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
