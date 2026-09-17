import { PgObject } from 'pgobject'; 

export default class FileModel extends PgObject {
    static get schema() {
        return {
            id: {
                pk: true,                
            },
            filename: {
                required: true
            },
            comment: {},
            name: {
                required: true
            },
            encoding: {},
            mimetype: {
                required: true
            },
            ext: {},
            size: {},
            ctime: {
               default: new Date()               
            },
            user_id: {
                required: true
            },
            folder_id: {},
            order_num: {}
        }
    }

    static get table() {
        return 'my_file';
    }

    /**
     * Получить все файлы пользователя с пагинацией
     *
     * @param {object} user - объект пользователя
     * @param {number} page - номер страницы
     * @param {number} limit - количество записей на странице
     * @return {object} result - объект с файлами и метаинформацией
     * @static
  */
  static async getAllByUserWithPagination(user, page = 1, limit = 10) {
      const offset = (page - 1) * limit;
      // order_num — ручной порядок (drag&drop), задаётся только при явной
      // пересортировке; NULLS FIRST — ещё не отсортированные вручную новые
      // файлы всегда показываются раньше уже упорядоченных (как раньше,
      // когда порядок определялся только датой создания).
      const files = await FileModel.select(
        'WHERE user_id = $1 ORDER BY order_num ASC NULLS FIRST, ctime DESC',
        [user.f.id]
      );
      
      // Получаем общее количество файлов
      const countResult = await FileModel.query(
        'SELECT COUNT(*) as total FROM my_file WHERE user_id = $1',
        [user.f.id]
      );
       
      const total = parseInt(countResult.rows[0].total, 10);
      
      return {
        files,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
  }

  /**
   * Отвязать все файлы от папки
   *
   * @param {string} folderId - ID папки
   * @static
  */
  static async clearFolderId(folderId) {
      await FileModel.query('UPDATE my_file SET folder_id = NULL WHERE folder_id = $1', [folderId]);
  }

  static async getByIdForUser(id, userId) {
      const files = await FileModel.select('WHERE id = $1 AND user_id = $2 LIMIT 1', [id, userId]);
      return files[0];
  }

  /**
   * Получить файл по id без проверки владельца — нужно при копировании
   * файла из чужой публичной ссылки/выставки (см. FileService.copyFile):
   * файлы и так отдаются публично по id без авторизации (см. GET /:fileId),
   * так что сам просмотр байтов уже не защищён владением.
   *
   * @param {string} id
   * @static
  */
  static async getById(id) {
      const files = await FileModel.select('WHERE id = $1 LIMIT 1', [id]);
      return files[0];
  }

  static async getByFolderId(folderId, userId) {
      const files = await FileModel.select(
        'WHERE folder_id = $1 AND user_id = $2 ORDER BY order_num ASC NULLS FIRST, ctime DESC',
        [folderId, userId]
      );
      return files;
  }

  /**
   * Проверить, что все переданные id файлов принадлежат пользователю, и
   * получить их модели — нужно перед пересортировкой (reorder), чтобы
   * нельзя было проставить order_num чужому файлу.
   *
   * @param {string[]} ids
   * @param {string} userId
   * @static
  */
  static async getByIdsForUser(ids, userId) {
      if (!ids.length) return [];
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
      return FileModel.select(`WHERE user_id = $1 AND id IN (${placeholders})`, [userId, ...ids]);
  }

  /**
   * Суммарный размер всех файлов пользователя в байтах — используется для
   * проверки лимита места на диске перед загрузкой нового файла.
   *
   * @param {string} userId
   * @return {number}
   * @static
  */
  static async getTotalSizeByUserId(userId) {
      const result = await FileModel.query('SELECT COALESCE(SUM(size), 0) as total FROM my_file WHERE user_id = $1', [userId]);
      return parseInt(result.rows[0].total, 10);
  }

  /**
   * То же самое, но сразу для нескольких пользователей одним запросом —
   * нужно для списка пользователей в Админ-панели (не делать N+1 запросов).
   *
   * @param {string[]} userIds
   * @return {Object<string, number>} map userId -> суммарный размер в байтах
   * @static
  */
  static async getTotalSizeByUserIds(userIds) {
      if (!userIds.length) return {};
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
      const result = await FileModel.query(
        `SELECT user_id, COALESCE(SUM(size), 0) as total FROM my_file WHERE user_id IN (${placeholders}) GROUP BY user_id`,
        userIds
      );

      const map = {};
      for (const row of result.rows) {
          map[row.user_id] = parseInt(row.total, 10);
      }
      return map;
  }
}