import { PgObject } from 'pgobject';

export default class ContactCategoryModel extends PgObject {
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
    return 'my_contact_category';
  }

  static async getByUserId(userId) {
    return ContactCategoryModel.select('WHERE user_id = $1', [userId]);
  }

  static async getById(id) {
    const rows = await ContactCategoryModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }
}
