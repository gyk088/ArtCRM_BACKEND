import { PgObject } from 'pgobject';

export default class MyArtist extends PgObject {
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
    return 'my_artist';
  }

  static async getByUserId(userId) {
    const artistList = await MyArtist.select('WHERE user_id = $1', [userId]);
    return artistList;
  }

  static async getById(id) {
    const artist = await MyArtist.select('WHERE id = $1 LIMIT 1', [id]);
    return artist[0];
  }
}
