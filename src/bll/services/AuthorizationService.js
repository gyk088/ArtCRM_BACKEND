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

  // Может ли actor управлять самой галереей targetGalleryId (её квотами,
  // пригласительными ссылками) — сама галерея или Super Admin. Обычный
  // canManageUser сюда не подходит: target там — управляемый пользователь
  // (manager/artist), а не сама галерея.
  static canManageGallery(actor, targetGalleryId) {
    if (!actor) return false;
    if (AuthorizationService.isSuperAdmin(actor)) return true;
    return AuthorizationService.isGallery(actor) && actor.id === targetGalleryId;
  }

  // Может ли actor смотреть квоту "держателя квоты" (galleryOrManagerId) —
  // это либо галерея, либо менеджер без галереи (см. QuotaService.poolGalleryId
  // и UserManagementService.getQuotaUsage) — либо сам держатель, либо Super Admin.
  static canViewQuotaHolder(actor, holderId) {
    if (!actor) return false;
    if (AuthorizationService.isSuperAdmin(actor)) return true;
    return actor.id === holderId && (AuthorizationService.isGallery(actor) || AuthorizationService.isManager(actor));
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

  static isManager(actor) {
    return actor?.role === ROLES.MANAGER;
  }

  // ===== Совместный доступ к работам внутри галереи (my_art_object) =====
  // person: { id, role, managed_by_gallery_id } — и для actor, и для owner
  // работы используется одна и та же форма (см. toActor/toTarget в
  // UserManagementService).
  //
  // Художник — исключение из этой системы целиком: его работы видит только
  // он сам, даже если у него есть личный кабинет и он привязан к галерее.
  // Делятся работами друг с другом только Gallery и её Manager'ы — поэтому
  // "зона" (id галереи, в рамках которой действует шаринг) определяется
  // одинаково что для того, КТО смотрит, что для того, КОМУ принадлежит
  // работа — одна и та же функция на обе стороны.
  static gallerySharingScope(person) {
    if (!person) return null;
    if (AuthorizationService.isGallery(person)) return person.id;
    if (AuthorizationService.isManager(person)) return person.managed_by_gallery_id || null;
    return null;
  }

  // Может ли actor смотреть/редактировать работу, принадлежащую owner'у
  // (сам владелец — всегда может; иначе только в рамках общей галереи, и
  // только если оба — Gallery/Manager; если owner — Artist, шаринга нет).
  static canAccessWorkOwner(actor, owner) {
    if (!actor || !owner) return false;
    if (actor.id === owner.id) return true;

    const scope = AuthorizationService.gallerySharingScope(actor);
    if (!scope) return false;

    return AuthorizationService.gallerySharingScope(owner) === scope;
  }

  // Может ли actor удалить работу owner'а — строже, чем просмотр/правка:
  // только сам автор или сама галерея-владелец, но не менеджер-коллега.
  static canDeleteWorkOwner(actor, owner) {
    if (!actor || !owner) return false;
    if (actor.id === owner.id) return true;
    if (!AuthorizationService.isGallery(actor)) return false;

    return AuthorizationService.gallerySharingScope(owner) === actor.id;
  }
}
