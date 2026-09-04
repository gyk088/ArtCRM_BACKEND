import { PgObject } from 'pgobject';
import { getFileBaseUrl } from '../utils/const.js';

export default class ExhibitionModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      user_id: {
        required: true
      },
      name: {},
      subtitle: {},
      description: {},
      artist_or_gallery: {},
      venue: {},
      start_date: {},
      end_date: {},
      avatar_id: {},
      show_technique: {
        default: true
      },
      show_year: {
        default: true
      },
      show_seria: {
        default: true
      },
      show_media: {
        default: true
      },
      show_location: {
        default: true
      },
      show_price: {
        default: true
      },
      show_price_sort: {
        default: true
      },
      show_artist_filter: {
        default: true
      },
      display_currency: {
        set(currency) {
          if (!currency) return null;
          const allowed = ['RUB', 'BYN', 'USD', 'EUR'];
          if (!allowed.includes(currency)) {
            throw new Error(`Invalid display_currency: must be one of ${allowed.join(', ')}`);
          }
          return currency;
        }
      },
      currency_rate: {
        default: 1,
        set(rate) {
          if (rate === null || rate === undefined) return null;
          const num = Number(rate);
          if (Number.isNaN(num) || num <= 0) {
            throw new Error('currency_rate must be a positive number');
          }
          return num;
        }
      },
      currency_rounding: {
        default: 1,
        set(step) {
          if (step === null || step === undefined) return null;
          const num = Number(step);
          if (Number.isNaN(num) || num <= 0) {
            throw new Error('currency_rounding must be a positive number');
          }
          return num;
        }
      },
      ctime: {
        default: new Date()
      },
      utime: {
        default: new Date()
      }
    }
  }

  static get table() {
    return 'my_exhibition';
  }

  static async getById(id) {
    const rows = await ExhibitionModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }

  static async getByUserId(userId) {
    const rows = await ExhibitionModel.select('WHERE user_id = $1 ORDER BY ctime DESC', [userId]);
    return rows;
  }

  /**
   * Получить все выставки пользователя с резолвленной обложкой (avatar)
   *
   * @param {string} userId - ID пользователя-владельца
   * @return {object[]} exhibitions - объекты с полем avatar: {id, ext, name, url} | null
   * @static
  */
  static async getAllWithAvatar(userId) {
    const query = `
      SELECT e.*, f.id as f_id, f.ext as f_ext, f.name as f_name
      FROM my_exhibition e
      LEFT JOIN my_file f ON e.avatar_id = f.id
      WHERE e.user_id = $1
      ORDER BY e.ctime DESC
    `;
    const result = await PgObject.query(query, [userId]);
    return result.rows.map(ExhibitionModel.__withAvatar);
  }

  /**
   * Получить выставку по ID с резолвленной обложкой (avatar)
   *
   * @param {string} id - ID выставки
   * @return {object|null} exhibition - объект с полем avatar: {id, ext, name, url} | null
   * @static
  */
  static async getByIdWithAvatar(id) {
    const query = `
      SELECT e.*, f.id as f_id, f.ext as f_ext, f.name as f_name
      FROM my_exhibition e
      LEFT JOIN my_file f ON e.avatar_id = f.id
      WHERE e.id = $1
      LIMIT 1
    `;
    const result = await PgObject.query(query, [id]);
    const row = result.rows[0];
    return row ? ExhibitionModel.__withAvatar(row) : null;
  }

  static __withAvatar(row) {
    const { f_id, f_ext, f_name, ...rest } = row;
    return {
      ...rest,
      avatar: f_id ? { id: f_id, ext: f_ext, name: f_name, url: `${getFileBaseUrl()}/${f_id}.${f_ext}` } : null
    };
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

  toJSON() {
    const objToJson = {};
    for (const key in this.f) {
      objToJson[key] = this.f[key];
    }
    return objToJson;
  }
}
