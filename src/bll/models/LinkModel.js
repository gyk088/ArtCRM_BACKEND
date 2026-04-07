import { PgObject } from 'pgobject';

export default class LinkModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      user_id: {
        required: true
      },
      link: {
        required: true
      },
      ctime: {
        default: new Date()
      },
      description: {}
    }
  }

  static get table() {
    return 'my_link';
  }

  static async getById(id) {
    console.log('Getting link by id...', id);
    const links = await LinkModel.select('id = $1 LIMIT 1', [id]);
    return links[0];
  }

  static async getByUserId(userId) {
    console.log('Getting links by user id...', userId);
    const links = await LinkModel.select('user_id = $1', [userId]);
    return links;
  }

  static async getByLinkUrl(linkUrl) {
    console.log('Getting link by URL...', linkUrl);
    const links = await LinkModel.select('link = $1', [linkUrl]);
    return links;
  }

  static async searchByDescription(searchTerm) {
    const query = `
      SELECT * FROM my_link 
      WHERE description ILIKE $1 
         OR link ILIKE $1
      ORDER BY ctime DESC
    `;
    const links = await PgObject.query(query, [`%${searchTerm}%`], LinkModel);
    return links;
  }

  static async getUserLinksWithArtObjects(userId) {
    const query = `
      SELECT DISTINCT l.*, COUNT(aol.art_id) as art_objects_count
      FROM my_link l
      LEFT JOIN my_art_object_link aol ON l.id = aol.link_id
      WHERE l.user_id = $1
      GROUP BY l.id
      ORDER BY l.ctime DESC
    `;
    const links = await PgObject.query(query, [userId], LinkModel);
    return links;
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