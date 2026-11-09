import { PgObject } from 'pgobject';

export default class ReportModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      user_id: {
        required: true
      },
      name: {
        required: true
      },
      type: {
        default: 'sales'
      },
      currency: {
        required: true
      },
      filters: {},
      ctime: {
        default: new Date()
      },
      utime: {
        default: new Date()
      }
    }
  }

  static get table() {
    return 'my_report';
  }

  static async getById(id) {
    const rows = await ReportModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }
}
