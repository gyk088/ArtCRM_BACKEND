import { PgObject } from 'pgobject';
import LinkModel from './LinkModel.js';

export default class ArtLinkModel extends PgObject {
  static get schema() {
    return {
      art_id: {
        pk: true  // составной первичный ключ
      },
      link_id: {
        pk: true  // составной первичный ключ
      }
    }
  }

  static get table() {
    return 'my_art_object_link';
  }

  static async getByArtId(artId) {
    console.log('Getting links for art object...', artId);
    const relations = await ArtLinkModel.select('art_id = $1', [artId]);
    return relations;
  }

  static async getByLinkId(linkId) {
    console.log('Getting art objects for link...', linkId);
    const relations = await ArtLinkModel.select('link_id = $1', [linkId]);
    return relations;
  }

  static async getArtIdsByLinkId(linkId) {
    const relations = await ArtLinkModel.select('link_id = $1', [linkId]);
    return relations.map(r => r.f.art_id);
  }

  static async getLinkIdsByArtId(artId) {
    const relations = await ArtLinkModel.select('art_id = $1', [artId]);
    return relations.map(r => r.f.link_id);
  }

  static async addLinkToArt(artId, linkId) {
    // Проверяем, существует ли уже такая связь
    const existingRelations = await ArtLinkModel.select(
      'art_id = $1 AND link_id = $2', 
      [artId, linkId]
    );
    
    if (existingRelations.length > 0) {
      throw new Error('Link already connected to this art object');
    }
    
    const relation = new ArtLinkModel({
      art_id: artId,
      link_id: linkId
    });
    
    await relation.save();
    return relation;
  }

  static async removeLinkFromArt(artId, linkId) {
    const relations = await ArtLinkModel.select(
      'art_id = $1 AND link_id = $2', 
      [artId, linkId]
    );
    
    if (relations.length === 0) {
      throw new Error('Relation not found');
    }
    
    await relations[0].delete();
    return { success: true, message: 'Link removed from art object successfully' };
  }

  static async removeAllLinksFromArt(artId) {
    const relations = await ArtLinkModel.select('art_id = $1', [artId]);
    
    for (const relation of relations) {
      await relation.delete();
    }
    
    return { success: true, deleted: relations.length };
  }

  static async removeAllArtsFromLink(linkId) {
    const relations = await ArtLinkModel.select('link_id = $1', [linkId]);
    
    for (const relation of relations) {
      await relation.delete();
    }
    
    return { success: true, deleted: relations.length };
  }

  static async getCompleteLinksForArt(artId) {
    // Получаем все связи для арт-объекта
    const relations = await ArtLinkModel.select('art_id = $1', [artId]);
    
    if (relations.length === 0) {
      return [];
    }
    
    // Получаем полную информацию о каждой ссылке
    const linkIds = relations.map(r => r.f.link_id);
    const placeholders = linkIds.map((_, i) => `$${i + 1}`).join(',');
    const query = `SELECT * FROM my_link WHERE id IN (${placeholders})`;
    const links = await PgObject.query(query, linkIds, LinkModel);
    
    return links;
  }

  static async getCompleteArtsForLink(linkId) {
    // Получаем все связи для ссылки
    const relations = await ArtLinkModel.select('link_id = $1', [linkId]);
    
    if (relations.length === 0) {
      return [];
    }
    
    // Получаем полную информацию о каждом объекте искусства
    const artIds = relations.map(r => r.f.art_id);
    const placeholders = artIds.map((_, i) => `$${i + 1}`).join(',');
    const query = `SELECT * FROM my_art_object WHERE id IN (${placeholders})`;
    const artObjects = await PgObject.query(query, artIds);
    
    return artObjects;
  }

  static async bulkAddLinksToArt(artId, linkIds) {
    const createdRelations = [];
    
    // Используем транзакцию для массового добавления
    await PgObject.createTransaction(async () => {
      for (const linkId of linkIds) {
        const relation = await ArtLinkModel.addLinkToArt(artId, linkId);
        createdRelations.push(relation);
      }
    });
    
    return createdRelations;
  }

  static async getArtObjectsCountByLink(linkId) {
    const relations = await ArtLinkModel.select('link_id = $1', [linkId]);
    return relations.length;
  }

  static async getLinksCountByArt(artId) {
    const relations = await ArtLinkModel.select('art_id = $1', [artId]);
    return relations.length;
  }

  toJSON() {
    const objToJson = {};
    for (const key in this.f) {
      objToJson[key] = this.f[key];
    }
    return objToJson;
  }
}