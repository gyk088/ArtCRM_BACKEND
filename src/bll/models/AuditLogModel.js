import { PgObject } from 'pgobject';

export default class AuditLogModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      actor_id: {},
      target_user_id: {},
      action: {
        required: true
      },
      // JSONB-колонка: сохраняем как JSON-строку, чтобы не зависеть от того,
      // как драйвер сериализует произвольные JS-объекты в параметрах запроса —
      // Postgres сам распарсит валидный JSON-текст в jsonb при записи.
      // При чтении jsonb-колонки pg возвращает уже готовый объект.
      metadata: {
        set(value) {
          if (value === null || value === undefined) return null;
          return typeof value === 'string' ? value : JSON.stringify(value);
        }
      },
      ctime: {
        default: new Date()
      }
    }
  }

  static get table() {
    return 'my_audit_log';
  }

  static async log(actorId, targetUserId, action, metadata = {}) {
    const entry = new AuditLogModel({
      actor_id: actorId,
      target_user_id: targetUserId,
      action,
      metadata
    });
    await entry.save();
    return entry;
  }

  static async getForTarget(targetUserId) {
    return AuditLogModel.select('WHERE target_user_id = $1 ORDER BY ctime DESC', [targetUserId]);
  }

  toJSON() {
    const objToJson = {};
    for (const key in this.f) {
      objToJson[key] = this.f[key];
    }
    return objToJson;
  }
}
