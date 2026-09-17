import { PgObject } from 'pgobject';
import { getFileBaseUrl } from '../utils/const.js';

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
      // Обложка папки — своя картинка вместо стандартной иконки.
      avatar_id: {},
      ctime: {
        default: new Date()
      }
    }
  }

  static get table() {
    return 'my_file_folder';
  }

  static __withAvatar(row) {
    const { f_id, f_ext, f_name, ...rest } = row;
    return {
      ...rest,
      avatar: f_id ? { id: f_id, ext: f_ext, name: f_name, url: `${getFileBaseUrl()}/${f_id}.${f_ext}` } : null
    };
  }

  // order_num — ручной порядок (drag&drop); NULLS LAST — ещё не
  // отсортированные вручную новые папки всегда показываются последними
  // (как раньше, когда новая папка просто добавлялась в конец списка).
  // Обложка резолвится сразу (JOIN), т.к. список папок отдаётся фронтенду
  // единым списком для клиентской фильтрации по уровням вложенности.
  static async getByUserId(userId) {
    const query = `
      SELECT ff.*, f.id as f_id, f.ext as f_ext, f.name as f_name
      FROM my_file_folder ff
      LEFT JOIN my_file f ON ff.avatar_id = f.id
      WHERE ff.user_id = $1
      ORDER BY ff.order_num ASC NULLS LAST, ff.ctime ASC
    `;
    const result = await PgObject.query(query, [userId]);
    return result.rows.map(MyFileFolder.__withAvatar);
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

  /**
   * Одна папка с резолвленной обложкой — тот же формат, что и в списке
   * (getByUserId), нужен после create/update, чтобы фронтенд сразу увидел
   * .avatar.url новой/изменённой папки без повторного запроса всего списка.
   *
   * @param {string} id
   * @return {object|null}
   * @static
  */
  static async getByIdWithAvatar(id) {
    const query = `
      SELECT ff.*, f.id as f_id, f.ext as f_ext, f.name as f_name
      FROM my_file_folder ff
      LEFT JOIN my_file f ON ff.avatar_id = f.id
      WHERE ff.id = $1
      LIMIT 1
    `;
    const result = await PgObject.query(query, [id]);
    const row = result.rows[0];
    return row ? MyFileFolder.__withAvatar(row) : null;
  }
}
