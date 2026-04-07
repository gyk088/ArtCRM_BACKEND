import { PgObject } from 'pgobject';

export default class MyLocation extends PgObject {
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
    return 'my_location';
  }

  static async getByUserId(userId) {
    const locationList = await MyLocation.select('user_id = $1', [userId]);
    return locationList;
  }

  static async getById(id) {
    const location = await MyLocation.select('id = $1 LIMIT 1', [id]);
    return location[0];
  }  
}