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
      ctime: {
        default: new Date()
      }
    }
  }

  static get table() {
    return 'my_file_folder';
  }

  static async getByUserId(userId) {
    const folderList = await MyFileFolder.select('WHERE user_id = $1', [userId]);
    return folderList;
  }

  static async getByParentId(parentId, userId) {
    if (parentId === null || parentId === undefined) {
      return MyFileFolder.select('WHERE user_id = $1 AND parent_id IS NULL', [userId]);
    }
    return MyFileFolder.select('WHERE user_id = $1 AND parent_id = $2', [userId, parentId]);
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
