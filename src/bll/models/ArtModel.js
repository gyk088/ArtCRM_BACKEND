import { PgObject } from 'pgobject';
import { getFileBaseUrl } from '../utils/const.js';

export default class MyArtObject extends PgObject {
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
      technique: {},
      description: {  // НОВОЕ ПОЛЕ
        required: false,
        set(description) {
          if (description && description.length > 1000) {
            throw new Error('Description too long (max 1000 characters)');
          }
          return description;
        }
      },
      media: {},
      seria: {},
      status: {},
      location: {},
      artist: {},
      size: {},
      avatar_id: {},
      price: {
        set(price) {
          if (price && price < 0) {
            throw new Error('Price cannot be negative');
          }
          return price;
        }
      },
      currency: {
        default: 'RUB',
        set(currency) {
          const allowed = ['RUB', 'BYN', 'USD', 'EUR'];
          if (currency && !allowed.includes(currency)) {
            throw new Error(`Invalid currency: must be one of ${allowed.join(', ')}`);
          }
          return currency;
        }
      },
      year: {
        set(year) {
          if (year && (year < 0 || year > new Date().getFullYear())) {
            throw new Error('Invalid year');
          }
          return year;
        }
      },
      imported: {
        default: false
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
    return 'my_art_object';
  }

  static async getById(id) {
    console.log('Getting art object by id...', id);
    const objects = await MyArtObject.select('WHERE id = $1 LIMIT 1', [id]);
    return objects[0];
  }

  static async getByUserId(userId) {
    console.log('Getting art objects by user id...', userId);
    const objects = await MyArtObject.select('WHERE user_id = $1', [userId]);
    return objects;
  }

  /**
   * Получить все объекты искусства пользователя с резолвленной обложкой (avatar)
   *
   * @param {string} userId - ID пользователя-владельца
   * @return {object[]} artObjects - объекты с полем avatar: {id, ext, name, url} | null
   * @static
  */
  static async getAllWithAvatar(userId) {
    const query = `
      SELECT ao.*, f.id as f_id, f.ext as f_ext, f.name as f_name
      FROM my_art_object ao
      LEFT JOIN my_file f ON ao.avatar_id = f.id
      WHERE ao.user_id = $1
      ORDER BY ao.ctime DESC
    `;
    const result = await PgObject.query(query, [userId]);
    return result.rows.map(MyArtObject.__withAvatar);
  }

  /**
   * Получить объект искусства по ID с резолвленной обложкой (avatar)
   *
   * @param {string} id - ID объекта
   * @return {object|null} artObject - объект с полем avatar: {id, ext, name, url} | null
   * @static
  */
  static async getByIdWithAvatar(id) {
    const query = `
      SELECT ao.*, f.id as f_id, f.ext as f_ext, f.name as f_name
      FROM my_art_object ao
      LEFT JOIN my_file f ON ao.avatar_id = f.id
      WHERE ao.id = $1
      LIMIT 1
    `;
    const result = await PgObject.query(query, [id]);
    const row = result.rows[0];
    return row ? MyArtObject.__withAvatar(row) : null;
  }

  static __withAvatar(row) {
    const { f_id, f_ext, f_name, ...rest } = row;
    return {
      ...rest,
      avatar: f_id ? { id: f_id, ext: f_ext, name: f_name, url: `${getFileBaseUrl()}/${f_id}.${f_ext}` } : null
    };
  }

  static async getWithDetails(id) {
    const query = `
      SELECT 
        ao.*,
        m.name as media_name,
        s.name as seria_name,
        st.name as status_name,
        l.name as location_name
      FROM my_art_object ao
      LEFT JOIN my_media m ON ao.media = m.id
      LEFT JOIN my_seria s ON ao.seria = s.id
      LEFT JOIN my_status st ON ao.status = st.id
      LEFT JOIN my_location l ON ao.location = l.id
      WHERE ao.id = $1
      LIMIT 1
    `;
    const objects = await PgObject.query(query, [id], MyArtObject);
    return objects[0];
  }

  static async getWithLinks(id) {
    const query = `
      SELECT 
        ao.*,
        json_agg(DISTINCT l.*) as links
      FROM my_art_object ao
      LEFT JOIN my_art_object_link aol ON ao.id = aol.art_id
      LEFT JOIN my_link l ON aol.link_id = l.id
      WHERE ao.id = $1
      GROUP BY ao.id
      LIMIT 1
    `;
    const objects = await PgObject.query(query, [id]);
    return objects[0];
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
    const keysToRemove = [];
    for (const key in this.f) {
      if (keysToRemove.includes(key)) continue;
      objToJson[key] = this.f[key];
    }
    return objToJson;
  }
}