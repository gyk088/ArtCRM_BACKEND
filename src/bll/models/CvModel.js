import { PgObject } from 'pgobject';

export default class CvModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      user_id: {
        required: true
      },
      title: {},
      cv: {},
      ctime: {
        default: new Date()
      },
      utime: {}
    }
  }

  static get table() {
    return 'my_cv';
  }

  // Имя колонки с текстом документа — у my_biography и my_cv они разные
  // (см. TextDocumentService)
  static get textColumn() {
    return 'cv';
  }

  static async getByUserId(userId) {
    return CvModel.select('WHERE user_id = $1 ORDER BY ctime ASC', [userId]);
  }

  static async getById(id) {
    const rows = await CvModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }
}
