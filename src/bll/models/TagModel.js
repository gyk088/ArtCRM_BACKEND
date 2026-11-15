import { PgObject } from 'pgobject';

// Тег работы (справочник): название + цвет. Связь с работами — многие ко
// многим через my_art_object_tag (см. ArtService.__setTagsForArt).
export default class MyTag extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      user_id: {},
      name: {
        required: true,
        set(name) {
          if (typeof name !== 'string' || !name.trim()) throw new Error('Tag name is required');
          if (name.length > 100) throw new Error('Tag name too long (max 100 characters)');
          return name.trim();
        }
      },
      color: {
        set(color) {
          if (!color) return null;
          if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
            throw new Error('Invalid color: must be a hex string like #8a6d2f');
          }
          return color.toLowerCase();
        }
      },
      ctime: {
        default: new Date()
      }
    }
  }

  static get table() {
    return 'my_tag';
  }

  static async getByUserId(userId) {
    return MyTag.select('WHERE user_id = $1 ORDER BY name', [userId]);
  }

  static async getById(id) {
    const tags = await MyTag.select('WHERE id = $1 LIMIT 1', [id]);
    return tags[0];
  }
}
