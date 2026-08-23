import { PgObject } from 'pgobject';
import MyArtObject from './ArtModel.js';
import ArtImageModel from './ArtImageModel.js';

export default class CollectionWorkModel extends PgObject {
  static get schema() {
    return {
      collection_id: {
        pk: true
      },
      art_id: {
        pk: true
      },
      order_num: {}
    }
  }

  static get table() {
    return 'my_collection_work';
  }

  static async getByCollectionId(collectionId) {
    const relations = await CollectionWorkModel.select('WHERE collection_id = $1 ORDER BY order_num', [collectionId]);
    return relations;
  }

  static async getArtIdsByCollectionId(collectionId) {
    const relations = await CollectionWorkModel.getByCollectionId(collectionId);
    return relations.map(r => r.f.art_id);
  }

  static async removeAllWorksFromCollection(collectionId) {
    const relations = await CollectionWorkModel.select('WHERE collection_id = $1', [collectionId]);

    for (const relation of relations) {
      await relation.delete();
    }

    return { success: true, deleted: relations.length };
  }

  /**
   * Полностью заменяет список работ ссылки на переданный (в переданном порядке)
   *
   * @param {string} collectionId - ID ссылки
   * @param {string[]} artIds - ID арт-объектов в нужном порядке
   * @static
  */
  static async setWorksForCollection(collectionId, artIds) {
    await CollectionWorkModel.removeAllWorksFromCollection(collectionId);

    let orderNum = 0;
    for (const artId of artIds) {
      const relation = new CollectionWorkModel({ collection_id: collectionId, art_id: artId, order_num: orderNum });
      await relation.save();
      orderNum++;
    }
  }

  /**
   * Получить работы ссылки с резолвленными обложкой, доп. изображениями и
   * именами связанных справочников (медиа/серия/статус/локация/художник) —
   * ссылка открыта публично, поэтому имена нужно отдать сразу, без отдельных
   * авторизованных запросов от лица зрителя.
   *
   * @param {string} collectionId - ID ссылки
   * @return {object[]} works
   * @static
  */
  static async getResolvedWorksForCollection(collectionId) {
    const query = `
      SELECT
        ao.*,
        f.id as f_id, f.ext as f_ext, f.name as f_name,
        m.name as media_name,
        s.name as seria_name,
        st.name as status_name,
        l.name as location_name,
        ar.name as artist_name
      FROM my_collection_work cw
      INNER JOIN my_art_object ao ON cw.art_id = ao.id
      LEFT JOIN my_file f ON ao.avatar_id = f.id
      LEFT JOIN my_media m ON ao.media = m.id
      LEFT JOIN my_seria s ON ao.seria = s.id
      LEFT JOIN my_status st ON ao.status = st.id
      LEFT JOIN my_location l ON ao.location = l.id
      LEFT JOIN my_artist ar ON ao.artist = ar.id
      WHERE cw.collection_id = $1
      ORDER BY cw.order_num
    `;
    const result = await PgObject.query(query, [collectionId]);
    const works = result.rows.map(MyArtObject.__withAvatar);

    for (const work of works) {
      work.images = await ArtImageModel.getResolvedImagesForArt(work.id);
    }

    return works;
  }

  toJSON() {
    const objToJson = {};
    for (const key in this.f) {
      objToJson[key] = this.f[key];
    }
    return objToJson;
  }
}
