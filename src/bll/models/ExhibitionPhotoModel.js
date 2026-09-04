import { PgObject } from 'pgobject';
import { getFileBaseUrl } from '../utils/const.js';

export default class ExhibitionPhotoModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      exhibition_id: {
        required: true
      },
      file_id: {
        required: true
      },
      caption: {},
      order_num: {},
      ctime: {
        default: new Date()
      }
    }
  }

  static get table() {
    return 'my_exhibition_photo';
  }

  static async getById(id) {
    const rows = await ExhibitionPhotoModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }

  /**
   * Проверить, что все переданные id фото принадлежат данной выставке —
   * нужно перед пересортировкой (reorder), чтобы нельзя было проставить
   * order_num чужому фото.
   *
   * @param {string[]} ids
   * @param {string} exhibitionId
   * @static
  */
  static async getByIdsForExhibition(ids, exhibitionId) {
    if (!ids.length) return [];
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    return ExhibitionPhotoModel.select(`WHERE exhibition_id = $1 AND id IN (${placeholders})`, [exhibitionId, ...ids]);
  }

  /**
   * Резолвленная (с URL файла) галерея фото выставки, в текущем порядке —
   * для публичной страницы и для CRM.
   *
   * @param {string} exhibitionId
   * @return {object[]} photos - [{id, caption, order_num, file: {id, ext, name, url}}]
   * @static
  */
  static async getResolvedByExhibitionId(exhibitionId) {
    const query = `
      SELECT ep.id, ep.caption, ep.order_num, f.id as f_id, f.ext as f_ext, f.name as f_name
      FROM my_exhibition_photo ep
      INNER JOIN my_file f ON ep.file_id = f.id
      WHERE ep.exhibition_id = $1
      ORDER BY ep.order_num ASC NULLS LAST, ep.ctime ASC
    `;
    const result = await PgObject.query(query, [exhibitionId]);
    return result.rows.map(row => ({
      id: row.id,
      caption: row.caption,
      file: { id: row.f_id, ext: row.f_ext, name: row.f_name, url: `${getFileBaseUrl()}/${row.f_id}.${row.f_ext}` }
    }));
  }

  static async removeAllForExhibition(exhibitionId) {
    const rows = await ExhibitionPhotoModel.select('WHERE exhibition_id = $1', [exhibitionId]);
    for (const row of rows) {
      await row.delete();
    }
    return { success: true, deleted: rows.length };
  }
}
