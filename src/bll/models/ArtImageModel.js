import { PgObject } from 'pgobject';
import { getFileBaseUrl } from '../utils/const.js';
import { thumbUrl } from '../utils/thumbs.js';

export default class ArtImageModel extends PgObject {
  static get schema() {
    return {
      art_id: {
        pk: true  // составной первичный ключ
      },
      file_id: {
        pk: true  // составной первичный ключ
      },
      order_num: {}
    }
  }

  static get table() {
    return 'my_art_object_image';
  }

  static async getByArtId(artId) {
    const relations = await ArtImageModel.select('WHERE art_id = $1 ORDER BY order_num', [artId]);
    return relations;
  }

  static async removeAllImagesFromArt(artId) {
    // один запрос вместо загрузки и удаления строк по одной
    const result = await PgObject.query(`DELETE FROM ${ArtImageModel.table} WHERE art_id = $1`, [artId]);
    return { success: true, deleted: result.rowCount };
  }

  /**
   * Полностью заменяет список доп. изображений арт-объекта на переданный (в переданном порядке)
   *
   * @param {string} artId - ID арт-объекта
   * @param {string[]} fileIds - ID файлов в нужном порядке
   * @static
  */
  static async setImagesForArt(artId, fileIds) {
    // Весь список меняется атомарно: при ошибке остаётся прежний состав,
    // а не половина. Вставка — одним запросом (insertMany).
    await PgObject.createTransaction(async () => {
      await ArtImageModel.removeAllImagesFromArt(artId);
      if (fileIds.length) {
        await ArtImageModel.insertMany(fileIds.map((fileId, orderNum) => ({ art_id: artId, file_id: fileId, order_num: orderNum })));
      }
    });
  }

  /**
   * Получить доп. изображения арт-объекта с резолвленным url файла
   *
   * @param {string} artId - ID арт-объекта
   * @return {object[]} images - [{id, ext, name, comment, url}]
   * @static
  */
  static async getResolvedImagesForArt(artId) {
    const query = `
      SELECT f.id, f.ext, f.name, f.comment
      FROM my_art_object_image aoi
      INNER JOIN my_file f ON aoi.file_id = f.id
      WHERE aoi.art_id = $1
      ORDER BY aoi.order_num
    `;
    const result = await PgObject.query(query, [artId]);
    return result.rows.map(row => ({
      id: row.id,
      ext: row.ext,
      name: row.name,
      comment: row.comment,
      url: `${getFileBaseUrl()}/${row.id}.${row.ext}`,
      thumb_url: thumbUrl(row.id, row.ext)
    }));
  }

  toJSON() {
    const objToJson = {};
    for (const key in this.f) {
      objToJson[key] = this.f[key];
    }
    return objToJson;
  }
}
