import { PgObject } from 'pgobject';

export default class MyArtObjectUser extends PgObject {
  static get schema() {
    return {
      art_id: {
        pk: true
      },
      user_id: {
        pk: true
      }
    }
  }

  static get table() {
    return 'my_art_object_user';
  }

  static async getUsersForArt(artId) {
    console.log('Getting users for art object...', artId);
    const relations = await MyArtObjectUser.select('art_id = $1', [artId]);
    return relations.map(r => r.f.user_id);
  }

  static async getArtsForUser(userId) {
    console.log('Getting art objects for user...', userId);
    const relations = await MyArtObjectUser.select('user_id = $1', [userId]);
    return relations.map(r => r.f.art_id);
  }

  static async addUserToArt(artId, userId) {
    const relation = new MyArtObjectUser({
      art_id: artId,
      user_id: userId
    });
    await relation.save();
    return relation;
  }

  static async removeUserFromArt(artId, userId) {
    const relations = await MyArtObjectUser.select('art_id = $1 AND user_id = $2', [artId, userId]);
    if (relations[0]) {
      await relations[0].delete();
      return true;
    }
    return false;
  }

  toJSON() {
    const objToJson = {};
    for (const key in this.f) {
      objToJson[key] = this.f[key];
    }
    return objToJson;
  }
}