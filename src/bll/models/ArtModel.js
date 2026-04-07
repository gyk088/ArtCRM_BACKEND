import { PgObject } from 'pgobject';

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
      price: {
        set(price) {
          if (price && price < 0) {
            throw new Error('Price cannot be negative');
          }
          return price;
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
    const objects = await MyArtObject.select('id = $1 LIMIT 1', [id]);
    return objects[0];
  }

  static async getByUserId(userId) {
    console.log('Getting art objects by user id...', userId);
    const objects = await MyArtObject.select('user_id = $1', [userId]);
    return objects;
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