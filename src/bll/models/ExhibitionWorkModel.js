import { PgObject } from 'pgobject';
import MyArtObject from './ArtModel.js';
import ArtImageModel from './ArtImageModel.js';

export default class ExhibitionWorkModel extends PgObject {
  static get schema() {
    return {
      exhibition_id: {
        pk: true
      },
      art_id: {
        pk: true
      },
      order_num: {}
    }
  }

  static get table() {
    return 'my_exhibition_work';
  }

  static async getByExhibitionId(exhibitionId) {
    const relations = await ExhibitionWorkModel.select('WHERE exhibition_id = $1 ORDER BY order_num', [exhibitionId]);
    return relations;
  }

  static async getArtIdsByExhibitionId(exhibitionId) {
    const relations = await ExhibitionWorkModel.getByExhibitionId(exhibitionId);
    return relations.map(r => r.f.art_id);
  }

  static async removeAllWorksFromExhibition(exhibitionId) {
    const relations = await ExhibitionWorkModel.select('WHERE exhibition_id = $1', [exhibitionId]);

    for (const relation of relations) {
      await relation.delete();
    }

    return { success: true, deleted: relations.length };
  }

  /**
   * Полностью заменяет список работ выставки на переданный (в переданном порядке)
   *
   * @param {string} exhibitionId - ID выставки
   * @param {string[]} artIds - ID арт-объектов в нужном порядке
   * @static
  */
  static async setWorksForExhibition(exhibitionId, artIds) {
    await ExhibitionWorkModel.removeAllWorksFromExhibition(exhibitionId);

    let orderNum = 0;
    for (const artId of artIds) {
      const relation = new ExhibitionWorkModel({ exhibition_id: exhibitionId, art_id: artId, order_num: orderNum });
      await relation.save();
      orderNum++;
    }
  }

  /**
   * Получить работы выставки с резолвленными обложкой, доп. изображениями и
   * именами связанных справочников (медиа/серия/статус/локация/художник) —
   * страница выставки открыта публично, поэтому имена нужно отдать сразу,
   * без отдельных авторизованных запросов от лица зрителя.
   *
   * @param {string} exhibitionId - ID выставки
   * @return {object[]} works
   * @static
  */
  static async getResolvedWorksForExhibition(exhibitionId) {
    const query = `
      SELECT
        ao.*,
        f.id as f_id, f.ext as f_ext, f.name as f_name,
        m.name as media_name,
        s.name as seria_name,
        st.name as status_name,
        st.color as status_color,
        l.name as location_name,
        ar.name as artist_name
      FROM my_exhibition_work ew
      INNER JOIN my_art_object ao ON ew.art_id = ao.id
      LEFT JOIN my_file f ON ao.avatar_id = f.id
      LEFT JOIN my_media m ON ao.media = m.id
      LEFT JOIN my_seria s ON ao.seria = s.id
      LEFT JOIN my_status st ON ao.status = st.id
      LEFT JOIN my_location l ON ao.location = l.id
      LEFT JOIN my_artist ar ON ao.artist = ar.id
      WHERE ew.exhibition_id = $1
      ORDER BY ew.order_num
    `;
    const result = await PgObject.query(query, [exhibitionId]);
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
