import { PgObject } from 'pgobject';

const FILE_BASE_URL = 'https://dev.myoffer.life/files';

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
      ORDER BY c.ctime DESC
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

  static __withAvatar(row) {
    const { f_id, f_ext, f_name, ...rest } = row;
    return {
      ...rest,
      avatar: f_id ? { id: f_id, ext: f_ext, name: f_name, url: `${FILE_BASE_URL}/${f_id}.${f_ext}` } : null
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
