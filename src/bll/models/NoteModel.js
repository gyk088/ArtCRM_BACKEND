import { PgObject } from 'pgobject';

// Заметка (см. NoteService)
export default class NoteModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      user_id: {
        required: true
      },
      title: {
        required: true
      },
      artist_id: {},
      content: {},
      updated_by: {},
      ctime: {
        default: new Date()
      },
      utime: {
        default: new Date()
      }
    }
  }

  static get table() {
    return 'my_note';
  }

  static async getById(id) {
    const rows = await NoteModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }
}
