import UserModel from '../models/UserModel.js';
import MyArtist from '../models/ArtistModel.js';
import { ROLES } from '../utils/const.js';

/**
 * Квоты "проданных мест" в галерее — сколько менеджеров, художников с
 * личным кабинетом и художников-справочника (без кабинета) может завести
 * галерея. Выставляются вручную из Админ-панели (см. UserManagementService.
 * updateQuotas), платёжного шлюза нет — это просто числовой лимит, как
 * storage_limit_bytes у файлов.
 */
export default class QuotaService {
  /**
   * id "держателя квоты" справочника художников — сама галерея для роли
   * gallery, managed_by_gallery_id для manager внутри галереи. Менеджер
   * БЕЗ галереи — держатель квоты сам для себя (свой собственный
   * quota_catalog_artists, не пулится ни с кем, см. countCatalogArtistsOf —
   * подзапрос по managed_by_gallery_id просто ничего не найдёт). Художник в
   * пул не включается вообще: у него нет своей квоты и он не "тратит" чужую
   * при создании записей в своём личном каталоге.
   *
   * @param {object} person - { id, role, managed_by_gallery_id }
   * @return {string|null}
   * @static
  */
  static poolGalleryId(person) {
    if (!person) return null;
    if (person.role === ROLES.GALLERY) return person.id;
    if (person.role === ROLES.MANAGER) return person.managed_by_gallery_id || person.id;
    return null;
  }

  static async countManagersOf(galleryId) {
    const rows = await UserModel.select('WHERE managed_by_gallery_id = $1 AND role = $2', [galleryId, ROLES.MANAGER]);
    return rows.length;
  }

  static async countArtistCabinetsOf(galleryId) {
    const rows = await UserModel.select('WHERE managed_by_gallery_id = $1 AND role = $2', [galleryId, ROLES.ARTIST]);
    return rows.length;
  }

  /**
   * Пул справочника художников (my_artist, без кабинета) считается по
   * всем, кто "внутри" галереи: сама галерея + все её менеджеры — общий
   * шаринг-контур для работ (см. AuthorizationService.gallerySharingScope).
   * Личные my_artist записи художников-с-кабинетом сюда не входят — это их
   * собственный каталог, а не купленный галереей пул.
   *
   * @param {string} galleryId
   * @return {number}
   * @static
  */
  static async countCatalogArtistsOf(galleryId) {
    const query = `
      SELECT COUNT(*) as total FROM my_artist
      WHERE user_id = $1
         OR user_id IN (SELECT id FROM my_user WHERE managed_by_gallery_id = $1 AND role = $2)
    `;
    const result = await MyArtist.query(query, [galleryId, ROLES.MANAGER]);
    return parseInt(result.rows[0].total, 10);
  }

  static async __assertQuota(galleryId, quotaField, usedCount, message) {
    const gallery = await UserModel.getUserById(galleryId);
    if (!gallery) throw new Error('Gallery not found');

    const quota = gallery.f[quotaField] || 0;
    if (usedCount >= quota) {
      throw new Error(message);
    }
  }

  static async assertCanAddManager(galleryId) {
    const used = await QuotaService.countManagersOf(galleryId);
    await QuotaService.__assertQuota(
      galleryId, 'quota_managers', used,
      'Достигнут лимит менеджеров для этой галереи — обратитесь к администратору, чтобы увеличить квоту'
    );
  }

  static async assertCanAddArtistCabinet(galleryId) {
    const used = await QuotaService.countArtistCabinetsOf(galleryId);
    await QuotaService.__assertQuota(
      galleryId, 'quota_artist_cabinets', used,
      'Достигнут лимит художников с личным кабинетом для этой галереи — обратитесь к администратору, чтобы увеличить квоту'
    );
  }

  static async assertCanAddCatalogArtist(galleryId) {
    const used = await QuotaService.countCatalogArtistsOf(galleryId);
    await QuotaService.__assertQuota(
      galleryId, 'quota_catalog_artists', used,
      'Достигнут лимит художников в справочнике для этой галереи — обратитесь к администратору, чтобы увеличить квоту'
    );
  }

  /**
   * Снимок квот галереи вместе с текущим использованием — для Админ-панели.
   *
   * @param {object} galleryUser - UserModel галереи
   * @return {object}
   * @static
  */
  static async getUsageSnapshot(galleryUser) {
    const galleryId = galleryUser.f.id;
    const [managers, artistCabinets, catalogArtists] = await Promise.all([
      QuotaService.countManagersOf(galleryId),
      QuotaService.countArtistCabinetsOf(galleryId),
      QuotaService.countCatalogArtistsOf(galleryId),
    ]);

    return {
      managers: { used: managers, quota: galleryUser.f.quota_managers || 0 },
      artistCabinets: { used: artistCabinets, quota: galleryUser.f.quota_artist_cabinets || 0 },
      catalogArtists: { used: catalogArtists, quota: galleryUser.f.quota_catalog_artists || 0 },
    };
  }
}
