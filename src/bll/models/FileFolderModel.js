import { PgObject } from 'pgobject';

export default class MyFileFolder extends PgObject {
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
    return 'my_file_folder';
  }

  // order_num — ручной порядок (drag&drop); NULLS LAST — ещё не
  // отсортированные вручную новые папки всегда показываются последними
  // (как раньше, когда новая папка просто добавлялась в конец списка).
  static async getByUserId(userId) {
    const folderList = await MyFileFolder.select(
      'WHERE user_id = $1 ORDER BY order_num ASC NULLS LAST, ctime ASC',
      [userId]
    );
    return folderList;
  }

  static async getByParentId(parentId, userId) {
    if (parentId === null || parentId === undefined) {
      return MyFileFolder.select(
        'WHERE user_id = $1 AND parent_id IS NULL ORDER BY order_num ASC NULLS LAST, ctime ASC',
        [userId]
      );
    }
    return MyFileFolder.select(
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
    return MyFileFolder.select(`WHERE user_id = $1 AND id IN (${placeholders})`, [userId, ...ids]);
  }

  static async getById(id) {
    const folder = await MyFileFolder.select('WHERE id = $1 LIMIT 1', [id]);
    return folder[0];
  }

  static async getByIdForUser(id, userId) {
    const folder = await MyFileFolder.select('WHERE id = $1 AND user_id = $2 LIMIT 1', [id, userId]);
    return folder[0];
  }
}
