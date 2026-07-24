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
            folder_id: {}
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
      const files = await FileModel.select(
        'WHERE user_id = $1 ORDER BY ctime DESC', 
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

  static async getByFolderId(folderId, userId) {
      const files = await FileModel.select('WHERE folder_id = $1 AND user_id = $2 ORDER BY ctime DESC', [folderId, userId]);
      return files;
  }
}