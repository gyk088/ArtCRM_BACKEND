import { PgObject } from 'pgobject';

export default class SaleModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      art_id: {
        required: true
      },
      user_id: {
        required: true
      },
      sale_date: {
        required: true
      },
      list_price: {},
      sale_price: {
        required: true
      },
      currency: {
        required: true
      },
      contact_id: {},
      sold_by: {},
      comment: {},
      commission_pct: {},
      ctime: {
        default: new Date()
      },
      utime: {
        default: new Date()
      }
    }
  }

  static get table() {
    return 'my_sale';
  }

  static async getById(id) {
    const rows = await SaleModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }

  static async getByArtId(artId) {
    const rows = await SaleModel.select('WHERE art_id = $1 LIMIT 1', [artId]);
    return rows[0];
  }
}
