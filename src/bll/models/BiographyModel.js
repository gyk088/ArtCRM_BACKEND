import { PgObject } from 'pgobject';

export default class BiographyModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      user_id: {
        required: true
      },
      title: {},
      biography: {},
      active: {},
      ctime: {
        default: new Date()
      },
      utime: {}
    }
  }

  static get table() {
    return 'my_biography';
  }

  // Имя колонки с текстом документа — у my_biography и my_cv они разные
  // (см. TextDocumentService)
  static get textColumn() {
    return 'biography';
  }

  static async getByUserId(userId) {
    return BiographyModel.select('WHERE user_id = $1 ORDER BY ctime ASC', [userId]);
  }

  static async getById(id) {
    const rows = await BiographyModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }
}
