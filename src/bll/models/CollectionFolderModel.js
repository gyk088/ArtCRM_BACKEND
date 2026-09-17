import { PgObject } from 'pgobject';

export default class CollectionFolderModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      user_id: {},
      name: {},
      parent_id: {},
      order_num: {},
      ctime: {
        default: new Date()
      }
    }
  }

  static get table() {
    return 'my_collection_folder';
  }

  // order_num — ручной порядок (drag&drop); NULLS LAST — ещё не
  // отсортированные вручную новые папки всегда показываются последними.
  static async getByUserId(userId) {
    const folderList = await CollectionFolderModel.select(
      'WHERE user_id = $1 ORDER BY order_num ASC NULLS LAST, ctime ASC',
      [userId]
    );
    return folderList;
  }

  static async getByParentId(parentId, userId) {
    if (parentId === null || parentId === undefined) {
      return CollectionFolderModel.select(
        'WHERE user_id = $1 AND parent_id IS NULL ORDER BY order_num ASC NULLS LAST, ctime ASC',
        [userId]
      );
    }
    return CollectionFolderModel.select(
      'WHERE user_id = $1 AND parent_id = $2 ORDER BY order_num ASC NULLS LAST, ctime ASC',
      [userId, parentId]
    );
  }

  /**
   * Проверить, что все переданные id папок принадлежат пользователю —
   * нужно перед пересортировкой (reorder).
   *
   * @param {string[]} ids
   * @param {string} userId
   * @static
  */
  static async getByIdsForUser(ids, userId) {
    if (!ids.length) return [];
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    return CollectionFolderModel.select(`WHERE user_id = $1 AND id IN (${placeholders})`, [userId, ...ids]);
  }

  static async getByIdForUser(id, userId) {
    const folder = await CollectionFolderModel.select('WHERE id = $1 AND user_id = $2 LIMIT 1', [id, userId]);
    return folder[0];
  }
}
