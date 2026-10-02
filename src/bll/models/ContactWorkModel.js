import { PgObject } from 'pgobject';
import MyArtObject from './ArtModel.js';

export default class ContactWorkModel extends PgObject {
  static get schema() {
    return {
      contact_id: {
        pk: true
      },
      art_id: {
        pk: true
      },
      // 'purchased' — уже купил, 'interested' — интересуется/хочет купить
      status: {},
      ctime: {
        default: new Date()
      }
    }
  }

  static get table() {
    return 'my_contact_work';
  }

  static async getByContactId(contactId) {
    return ContactWorkModel.select('WHERE contact_id = $1 ORDER BY ctime DESC', [contactId]);
  }

  static async getByContactIdAndArtId(contactId, artId) {
    const rows = await ContactWorkModel.select(
      'WHERE contact_id = $1 AND art_id = $2 LIMIT 1',
      [contactId, artId]
    );
    return rows[0];
  }

  static async removeAllWorksFromContact(contactId) {
    const relations = await ContactWorkModel.select('WHERE contact_id = $1', [contactId]);
    for (const relation of relations) {
      await relation.delete();
    }
    return { success: true, deleted: relations.length };
  }

  /**
   * Отвязать работу от всех контактов, у которых она отмечена (куплена
   * или в интересах) — вызывается перед удалением самой работы, иначе
   * упадёт на внешнем ключе (см. ArtService.deleteArtObject).
   *
   * @param {string} artId
   * @static
  */
  static async removeArtFromAllContacts(artId) {
    const relations = await ContactWorkModel.select('WHERE art_id = $1', [artId]);
    for (const relation of relations) {
      await relation.delete();
    }
    return { success: true, deleted: relations.length };
  }

  /**
   * Работы контакта с резолвленной обложкой и именем — для отображения
   * в карточке контакта (сгруппировано на фронтенде по .status).
   *
   * @param {string} contactId
   * @return {object[]} работы с полями avatar, status, linkedAt
   * @static
  */
  static async getResolvedWorksForContact(contactId) {
    const query = `
      SELECT
        ao.*,
        cw.status as link_status,
        cw.ctime as link_ctime,
        f.id as f_id, f.ext as f_ext, f.name as f_name,
        ar.name as artist_name
      FROM my_contact_work cw
      INNER JOIN my_art_object ao ON cw.art_id = ao.id
      LEFT JOIN my_file f ON ao.avatar_id = f.id
      LEFT JOIN my_artist ar ON ao.artist = ar.id
      WHERE cw.contact_id = $1
      ORDER BY cw.ctime DESC
    `;
    const result = await PgObject.query(query, [contactId]);

    return result.rows.map(row => {
      const { link_status, link_ctime, f_id, f_ext, f_name, ...rest } = row;
      return {
        ...MyArtObject.__withAvatar({ ...rest, f_id, f_ext, f_name }),
        status: link_status,
        linkedAt: link_ctime,
      };
    });
  }
}
