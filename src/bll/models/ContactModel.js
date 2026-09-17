import { PgObject } from 'pgobject';

export default class ContactModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      user_id: {
        required: true
      },
      name: {},
      phone: {},
      messenger: {},
      notes: {},
      ctime: {
        default: new Date()
      },
      utime: {
        default: new Date()
      }
    }
  }

  static get table() {
    return 'my_contact';
  }

  static async getByUserId(userId) {
    const contactList = await ContactModel.select('WHERE user_id = $1 ORDER BY ctime DESC', [userId]);
    return contactList;
  }

  static async getById(id) {
    const rows = await ContactModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }

  async update() {
    this.f.utime = new Date();
    return super.update();
  }

  async save() {
    if (this.f.id) {
      this.f.utime = new Date();
    }
    return super.save();
  }
}
