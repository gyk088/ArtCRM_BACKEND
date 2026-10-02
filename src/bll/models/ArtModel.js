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
      // Кто последним редактировал работу — сохраняем отдельно от user_id
      // (это "кто создал"), т.к. в рамках галереи работу могут править и
      // другие менеджеры/сама галерея (см. AuthorizationService.gallerySharingScope).
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
   * Получить все объекты искусства, видимые пользователю, с резолвленной
   * обложкой (avatar) и автором/последним редактором.
   *
   * Помимо своих работ (user_id = userId) включает работы всей галереи,
   * если у вызывающего есть общая "зона видимости" (gallerySharingScopeId —
   * id самой галереи для Gallery, либо managed_by_gallery_id для Manager,
   * см. AuthorizationService.gallerySharingScope): тогда видны работы самой
   * галереи и всех её менеджеров. Художник — исключение: его работы не
   * попадают в общую видимость галереи, даже если он formально managed_by
   * этой же галереи (см. роль = 'manager' в подзапросе ниже).
   *
   * @param {string} userId - ID вызывающего пользователя
   * @param {string|null} gallerySharingScopeId - id зоны видимости галереи или null
   * @return {object[]} artObjects
   * @static
  */
  static async getAllWithAvatar(userId, gallerySharingScopeId = null) {
    const query = `
      SELECT ao.*, f.id as f_id, f.ext as f_ext, f.name as f_name,
        creator.name as creator_name, creator.surname as creator_surname,
        editor.name as editor_name, editor.surname as editor_surname
      FROM my_art_object ao
      LEFT JOIN my_file f ON ao.avatar_id = f.id
      LEFT JOIN my_user creator ON ao.user_id = creator.id
      LEFT JOIN my_user editor ON ao.updated_by = editor.id
      WHERE ao.user_id = $1
        OR ($2::uuid IS NOT NULL AND (
          ao.user_id = $2
          OR ao.user_id IN (SELECT id FROM my_user WHERE managed_by_gallery_id = $2 AND role = 'manager')
        ))
      ORDER BY ao.ctime DESC
    `;
    const result = await PgObject.query(query, [userId, gallerySharingScopeId]);
    return result.rows.map(MyArtObject.__withAvatarAndAuthors);
  }

  /**
   * Получить объект искусства по ID с резолвленной обложкой (avatar) и
   * автором/последним редактором.
   *
   * @param {string} id - ID объекта
   * @return {object|null} artObject
   * @static
  */
  static async getByIdWithAvatar(id) {
    const query = `
      SELECT ao.*, f.id as f_id, f.ext as f_ext, f.name as f_name,
        creator.name as creator_name, creator.surname as creator_surname,
        editor.name as editor_name, editor.surname as editor_surname
      FROM my_art_object ao
      LEFT JOIN my_file f ON ao.avatar_id = f.id
      LEFT JOIN my_user creator ON ao.user_id = creator.id
      LEFT JOIN my_user editor ON ao.updated_by = editor.id
      WHERE ao.id = $1
      LIMIT 1
    `;
    const result = await PgObject.query(query, [id]);
    const row = result.rows[0];
    return row ? MyArtObject.__withAvatarAndAuthors(row) : null;
  }

  static __withAvatar(row) {
    const { f_id, f_ext, f_name, ...rest } = row;
    return {
      ...rest,
      avatar: f_id ? { id: f_id, ext: f_ext, name: f_name, url: `${getFileBaseUrl()}/${f_id}.${f_ext}` } : null
    };
  }

  static __withAvatarAndAuthors(row) {
    const { creator_name, creator_surname, editor_name, editor_surname, ...rest } = row;
    const withAvatar = MyArtObject.__withAvatar(rest);
    return {
      ...withAvatar,
      createdBy: withAvatar.user_id
        ? { id: withAvatar.user_id, name: creator_name, surname: creator_surname }
        : null,
      updatedBy: withAvatar.updated_by
        ? { id: withAvatar.updated_by, name: editor_name, surname: editor_surname }
        : null,
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