import { PgObject } from 'pgobject';
import LinkModel from './LinkModel.js';
import MyArtist from './ArtistModel.js';

export default class LinkArtistModel extends PgObject {
  static get schema() {
    return {
      link_id: {
        pk: true  // составной первичный ключ
      },
      artist_id: {
        pk: true  // составной первичный ключ
      }
    }
  }

  static get table() {
    return 'my_link_artist';
  }

  static async getByLinkId(linkId) {
    const relations = await LinkArtistModel.select('WHERE link_id = $1', [linkId]);
    return relations;
  }

  static async getByArtistId(artistId) {
    const relations = await LinkArtistModel.select('WHERE artist_id = $1', [artistId]);
    return relations;
  }

  static async addArtistToLink(linkId, artistId) {
    const existingRelations = await LinkArtistModel.select(
      'WHERE link_id = $1 AND artist_id = $2',
      [linkId, artistId]
    );

    if (existingRelations.length > 0) {
      throw new Error('Artist already connected to this link');
    }

    const relation = new LinkArtistModel({
      link_id: linkId,
      artist_id: artistId
    });

    await relation.save();
    return relation;
  }

  static async removeArtistFromLink(linkId, artistId) {
    const relations = await LinkArtistModel.select(
      'WHERE link_id = $1 AND artist_id = $2',
      [linkId, artistId]
    );

    if (relations.length === 0) {
      throw new Error('Relation not found');
    }

    await relations[0].delete();
    return { success: true, message: 'Artist removed from link successfully' };
  }

  static async removeAllArtistsFromLink(linkId) {
    // один запрос вместо загрузки и удаления строк по одной
    const result = await PgObject.query(`DELETE FROM ${LinkArtistModel.table} WHERE link_id = $1`, [linkId]);
    return { success: true, deleted: result.rowCount };
  }

  static async removeAllLinksFromArtist(artistId) {
    // один запрос вместо загрузки и удаления строк по одной
    const result = await PgObject.query(`DELETE FROM ${LinkArtistModel.table} WHERE artist_id = $1`, [artistId]);
    return { success: true, deleted: result.rowCount };
  }

  static async getCompleteArtistsForLink(linkId) {
    const relations = await LinkArtistModel.select('WHERE link_id = $1', [linkId]);

    if (relations.length === 0) {
      return [];
    }

    const artistIds = relations.map(r => r.f.artist_id);
    const placeholders = artistIds.map((_, i) => `$${i + 1}`).join(',');
    const query = `SELECT * FROM my_artist WHERE id IN (${placeholders})`;
    const artists = await PgObject.query(query, artistIds, MyArtist);

    return artists;
  }

  static async getCompleteLinksForArtist(artistId) {
    const relations = await LinkArtistModel.select('WHERE artist_id = $1', [artistId]);

    if (relations.length === 0) {
      return [];
    }

    const linkIds = relations.map(r => r.f.link_id);
    const placeholders = linkIds.map((_, i) => `$${i + 1}`).join(',');
    const query = `SELECT * FROM my_link WHERE id IN (${placeholders})`;
    const links = await PgObject.query(query, linkIds, LinkModel);

    return links;
  }

  toJSON() {
    const objToJson = {};
    for (const key in this.f) {
      objToJson[key] = this.f[key];
    }
    return objToJson;
  }
}
