import UserModel from '../models/UserModel.js';
import AuthorizationService from '../services/AuthorizationService.js';
import { PgObject } from 'pgobject';

export function toPerson(user) {
    return { id: user.f.id, role: user.f.role, managed_by_gallery_id: user.f.managed_by_gallery_id };
}

/**
 * Для роутов вида ".../user/:userId": проверить, что actorUser может
 * смотреть данные (работы, справочники, ссылки) пользователя targetUserId.
 * Свои — всегда; чужие — по тем же правилам, что и работы
 * (AuthorizationService.canAccessWorkOwner: только Gallery и её Manager'ы
 * внутри общей галереи).
 *
 * Как и везде в проекте, на отказ отвечаем "не найдено", а не "нет
 * доступа" — чтобы не подтверждать посторонним существование пользователя.
 *
 * @param {object} actorUser - request.user
 * @param {string} targetUserId - userId из параметров роута
 * @return {Promise<string>} id пользователя, чьи данные можно отдать
 */
export async function assertCanViewUserData(actorUser, targetUserId) {
    if (!targetUserId || targetUserId === actorUser.f.id) return actorUser.f.id;

    let target = null;
    try {
        target = await UserModel.getUserById(targetUserId);
    } catch {
        // невалидный uuid — Postgres бросает ошибку синтаксиса, для клиента это тоже "не найдено"
    }
    if (!target || !AuthorizationService.canAccessWorkOwner(toPerson(actorUser), toPerson(target))) {
        throw new Error('User not found');
    }
    return target.f.id;
}

/**
 * id пользователей, чьими данными (справочники, файлы) пользователь делится
 * внутри галереи: он сам, а у Gallery и Manager — ещё сама галерея и все её
 * менеджеры (см. AuthorizationService.gallerySharingScope). У остальных —
 * только он сам.
 *
 * @param {object} user - PgObject пользователя (request.user / UserModel)
 * @return {Promise<string[]>}
 */
export async function sharingScopeUserIds(user) {
    const userId = user.f.id;
    const scope = AuthorizationService.gallerySharingScope(toPerson(user));
    if (!scope) return [userId];

    const result = await PgObject.query(
        `SELECT id FROM my_user WHERE id = $1 OR (managed_by_gallery_id = $1 AND role = 'manager')`,
        [scope]
    );
    const ids = result.rows.map(r => r.id);
    if (!ids.includes(userId)) ids.push(userId);
    return ids;
}
