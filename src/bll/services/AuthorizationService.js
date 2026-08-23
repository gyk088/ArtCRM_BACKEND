import { ROLES, MANAGED_ROLES } from '../utils/const.js';

/**
 * Чистые (без обращения к БД) проверки прав для системы ролей
 * Super Admin / Gallery / Manager / Artist.
 *
 * actor:  { id, role }
 * target: { id, role, managed_by_gallery_id }
 *
 * Держим эти функции чистыми и не зависящими от ORM/схемы БД специально —
 * их легко покрыть юнит-тестами без поднятия базы.
 */
export default class AuthorizationService {
  static isSuperAdmin(actor) {
    return actor?.role === ROLES.SUPER_ADMIN;
  }

  static isGallery(actor) {
    return actor?.role === ROLES.GALLERY;
  }

  // Может ли actor вообще запрашивать список управляемых пользователей
  static canListUsers(actor) {
    return AuthorizationService.isSuperAdmin(actor) || AuthorizationService.isGallery(actor);
  }

  // Находится ли target в зоне управления actor'а (владение/scope)
  static canManageUser(actor, target) {
    if (!actor || !target) return false;

    if (AuthorizationService.isSuperAdmin(actor)) return true;

    if (AuthorizationService.isGallery(actor)) {
      return (
        MANAGED_ROLES.includes(target.role) &&
        target.managed_by_gallery_id != null &&
        target.managed_by_gallery_id === actor.id
      );
    }

    return false;
  }

  // Может ли actor создать нового пользователя с ролью newRole
  static canCreateUser(actor, newRole) {
    if (!actor) return false;

    if (AuthorizationService.isSuperAdmin(actor)) return true;

    if (AuthorizationService.isGallery(actor)) {
      return MANAGED_ROLES.includes(newRole);
    }

    return false;
  }

  // Может ли actor создать пользователя с ролью gallery — только super_admin
  static canCreateGallery(actor) {
    return AuthorizationService.isSuperAdmin(actor);
  }

  // Может ли actor сменить роль target'а на newRole
  static canChangeRole(actor, target, newRole) {
    if (!AuthorizationService.canManageUser(actor, target)) return false;

    if (AuthorizationService.isSuperAdmin(actor)) return true;

    if (AuthorizationService.isGallery(actor)) {
      // Галерея не может выдать роль super_admin/gallery никому — только
      // переключать своих управляемых пользователей между manager/artist.
      return MANAGED_ROLES.includes(newRole);
    }

    return false;
  }

  // Может ли actor заблокировать/разблокировать target'а.
  // Решение (см. открытый вопрос в ТЗ): Gallery может блокировать/
  // разблокировать только своих управляемых пользователей — по аналогии
  // со сменой роли. Явного запрета в ТЗ не было, отказ был бы асимметричен
  // с остальными правами Gallery над своими пользователями.
  static canToggleBlock(actor, target) {
    return AuthorizationService.canManageUser(actor, target);
  }

  // Может ли actor зайти под target'ом (impersonate)
  static canImpersonate(actor, target) {
    return AuthorizationService.canManageUser(actor, target);
  }
}
