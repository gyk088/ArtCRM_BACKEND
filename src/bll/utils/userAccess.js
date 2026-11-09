import UserModel from '../models/UserModel.js';
import AuthorizationService from '../services/AuthorizationService.js';

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
