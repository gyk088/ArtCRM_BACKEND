import { PgObject } from 'pgobject';

export default class MyMedia extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      user_id: {},
      name: {}
    }
  }

  static get table() {
    return 'my_media';
  }

  static async getByUserId(userId) {
    const mediaList = await MyMedia.select('user_id = $1', [userId]);
    return mediaList;
  }

  static async getById(id) {
    const media = await MyMedia.select('id = $1 LIMIT 1', [id]);
    return media[0];
  } 
}