import { PgObject } from 'pgobject';

export default class MyStatus extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      user_id: {},
      name: {},
      color: {
        set(color) {
          if (!color) return null;
          if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
            throw new Error('Invalid color: must be a hex string like #8a6d2f');
          }
          return color.toLowerCase();
        }
      }
    }
  }

  static get table() {
    return 'my_status';
  }

  static async getByUserId(userId) {
    const statusList = await MyStatus.select('WHERE user_id = $1', [userId]);
    return statusList;
  }

  static async getById(id) {
    const status = await MyStatus.select('WHERE id = $1 LIMIT 1', [id]);
    return status[0];
  }
}