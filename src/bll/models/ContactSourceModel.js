import { PgObject } from 'pgobject';

export default class ContactSourceModel extends PgObject {
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
    return 'my_contact_source';
  }

  static async getByUserId(userId) {
    return ContactSourceModel.select('WHERE user_id = $1', [userId]);
  }

  static async getById(id) {
    const rows = await ContactSourceModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }
}
