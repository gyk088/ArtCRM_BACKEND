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
      email: {},
      // Организация/компания, если контакт представляет юрлицо (галерея-
      // партнёр, музей, аукционный дом и т.п.)
      company: {},
      city: {},
      // Откуда пришёл контакт — ссылка на справочник my_contact_source
      // (управляется как Медиа/Серия и т.п. — раздел "Справочник")
      source: {},
      // Тип контакта — ссылка на справочник my_contact_category, та же логика
      category: {},
      birthday: {},
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
