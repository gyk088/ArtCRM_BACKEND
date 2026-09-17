import { PgObject } from 'pgobject';
import { getFileBaseUrl } from '../utils/const.js';

export default class CollectionModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      user_id: {
        required: true
      },
      name: {},
      // Короткая подпись под названием на публичной странице — между
      // заголовком и полным описанием (не то же самое, что description).
      subtitle: {},
      artist_or_gallery: {},
      description: {},
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
      // Инструменты публичной страницы ссылки (сортировка/фильтр) — можно
      // отключить, если владелец не хочет их показывать посетителям.
      show_price_sort: {
        default: true
      },
      show_artist_filter: {
        default: true
      },
      imported: {
        default: false
      },
      // Группировка ссылок по папкам (как в файловом менеджере) + ручной
      // порядок внутри папки/корня для drag&drop.
      folder_id: {},
      order_num: {},
      // Показ цен работ в ссылке в другой валюте, чем они заведены у
      // художника (например, работы в RUB, а ссылка — в EUR).
      // display_currency = null означает "без переопределения" — цены
      // показываются как есть, в исходной валюте работы.
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
    return 'my_collection';
  }

  static async getById(id) {
    const rows = await CollectionModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }

  static async getByUserId(userId) {
    const rows = await CollectionModel.select('WHERE user_id = $1 ORDER BY ctime DESC', [userId]);
    return rows;
  }

  /**
   * Получить все ссылки пользователя с резолвленной обложкой (avatar)
   *
   * @param {string} userId - ID пользователя-владельца
   * @return {object[]} collections - объекты с полем avatar: {id, ext, name, url} | null
   * @static
  */
  static async getAllWithAvatar(userId) {
    const query = `
      SELECT c.*, f.id as f_id, f.ext as f_ext, f.name as f_name
      FROM my_collection c
      LEFT JOIN my_file f ON c.avatar_id = f.id
      WHERE c.user_id = $1
      ORDER BY c.order_num ASC NULLS FIRST, c.ctime DESC
    `;
    const result = await PgObject.query(query, [userId]);
    return result.rows.map(CollectionModel.__withAvatar);
  }

  /**
   * Получить ссылку по ID с резолвленной обложкой (avatar)
   *
   * @param {string} id - ID ссылки
   * @return {object|null} collection - объект с полем avatar: {id, ext, name, url} | null
   * @static
  */
  static async getByIdWithAvatar(id) {
    const query = `
      SELECT c.*, f.id as f_id, f.ext as f_ext, f.name as f_name
      FROM my_collection c
      LEFT JOIN my_file f ON c.avatar_id = f.id
      WHERE c.id = $1
      LIMIT 1
    `;
    const result = await PgObject.query(query, [id]);
    const row = result.rows[0];
    return row ? CollectionModel.__withAvatar(row) : null;
  }

  /**
   * Отвязать все ссылки от папки — вызывается при каскадном удалении папки.
   *
   * @param {string} folderId
   * @static
  */
  static async clearFolderId(folderId) {
    await CollectionModel.query('UPDATE my_collection SET folder_id = NULL WHERE folder_id = $1', [folderId]);
  }

  /**
   * Проверить, что все переданные id ссылок принадлежат пользователю —
   * нужно перед пересортировкой (reorder).
   *
   * @param {string[]} ids
   * @param {string} userId
   * @static
  */
  static async getByIdsForUser(ids, userId) {
    if (!ids.length) return [];
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    return CollectionModel.select(`WHERE user_id = $1 AND id IN (${placeholders})`, [userId, ...ids]);
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
