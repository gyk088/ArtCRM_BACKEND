import { PgObject } from 'pgobject';

export default class MyStatus extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      user_id: {},
      name: {}
    }
  }

  static get table() {
    return 'my_status';
  }

  static async getByUserId(userId) {
    const statusList = await MyStatus.select('user_id = $1', [userId]);
    return statusList;
  }

  static async getById(id) {
    const status = await MyStatus.select('id = $1 LIMIT 1', [id]);
    return status[0];
  }
}