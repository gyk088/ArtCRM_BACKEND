import { PgObject } from 'pgobject';

export default class MySeria extends PgObject {
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
    return 'my_seria';
  }

  static async getByUserId(userId) {
    const seriaList = await MySeria.select('user_id = $1', [userId]);
    return seriaList;
  }

  static async getById(id) {
    const seria = await MySeria.select('id = $1 LIMIT 1', [id]);
    return seria[0];
  } 
}