import { PgObject } from 'pgobject';

export default class CollectionViewModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      collection_id: {
        required: true
      },
      visitor_key: {
        required: true
      },
      ctime: {
        default: new Date()
      }
    }
  }

  static get table() {
    return 'my_collection_view';
  }

  static async recordView(collectionId, visitorKey) {
    const view = new CollectionViewModel({ collection_id: collectionId, visitor_key: visitorKey });
    await view.save();
  }

  /**
   * Счётчики для одной ссылки: total — все открытия, unique — число
   * различных посетителей (по visitor_key).
   *
   * @param {string} collectionId
   * @return {{total: number, unique: number}}
   * @static
  */
  static async getStats(collectionId) {
    const query = `
      SELECT COUNT(*)::int AS total, COUNT(DISTINCT visitor_key)::int AS unique_count
      FROM my_collection_view
      WHERE collection_id = $1
    `;
    const result = await PgObject.query(query, [collectionId]);
    const row = result.rows[0] || {};
    return { total: row.total || 0, unique: row.unique_count || 0 };
  }

  /**
   * То же самое, но пачкой для списка ссылок — чтобы не делать по
   * отдельному запросу на каждую ссылку в списке.
   *
   * @param {string[]} collectionIds
   * @return {Object<string, {total: number, unique: number}>}
   * @static
  */
  static async getStatsForCollections(collectionIds) {
    if (!collectionIds.length) return {};

    const placeholders = collectionIds.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      SELECT collection_id, COUNT(*)::int AS total, COUNT(DISTINCT visitor_key)::int AS unique_count
      FROM my_collection_view
      WHERE collection_id IN (${placeholders})
      GROUP BY collection_id
    `;
    const result = await PgObject.query(query, collectionIds);

    const statsByCollectionId = {};
    for (const row of result.rows) {
      statsByCollectionId[row.collection_id] = { total: row.total, unique: row.unique_count };
    }
    return statsByCollectionId;
  }
}
