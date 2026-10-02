import { PgObject } from 'pgobject'
import bcrypt from 'bcrypt';

export default class UserModel extends PgObject {
  static get schema() {
    return {
      id: {
        pk: true
      },
      name: {},
      surname: {},
      bdate: {},
      avatar: {},
      country: {},
      password: {
        set(password) {
          if (password) {          
            const saltRounds = 10;
            const hash = bcrypt.hashSync(password, saltRounds);
            return hash;
          }
          return password
        }
      },
      city: {},
      sex: {},
      email: {},
      phone: {},
      pin: {},
      role: {},
      ctime: {
        default: new Date()
      },
      utime: {},
      lat: {},
      lng: {},
      client: {},
      active: {
        default: true
      },
      online: {},
      reset_token: {},
      reset_token_expires: {},
      certificate_header_text: {},
      // Владеющая Галерея (только для role IN ('manager','artist')) — см. CHECK
      // my_user_gallery_scope_check. NULL означает "управляется напрямую Super Admin'ом".
      managed_by_gallery_id: {},
      created_by: {},
      // Лимит места на диске в байтах. По умолчанию 5 ГБ — управляется из
      // Админ-панели (см. UserManagementService.updateStorageLimit).
      storage_limit_bytes: {
        default: 5368709120
      },
      // Квоты "проданных мест" — только для role='gallery', управляются из
      // Админ-панели (см. UserManagementService.updateQuotas). По умолчанию
      // 0 — у только что созданной галереи ничего не куплено.
      quota_catalog_artists: {
        default: 0
      },
      quota_artist_cabinets: {
        default: 0
      },
      quota_managers: {
        default: 0
      },
      // Токены персональных пригласительных ссылок регистрации галереи —
      // отдельно для менеджеров и для художников (см. AuthService.registerViaInvite).
      manager_invite_token: {},
      artist_invite_token: {}
    }
  }

  static get table() {
    return 'my_user';
  }

  static async getUserById(id) {
    console.log('Getting user by id...', id);
    const users = await UserModel.select("WHERE id = $1 LIMIT 1", [id]);
    return users[0];
  }

  static async getUserByEmail(email) {
    console.log('Getting user by email...', email);
    const users = await UserModel.select("WHERE email = $1 LIMIT 1", [email]);
    return users[0];
  }

  static async getUserByResetToken(token) {
    const users = await UserModel.select("WHERE reset_token = $1 LIMIT 1", [token]);
    return users[0];
  }

  /**
   * Найти галерею по токену пригласительной ссылки регистрации — у галереи
   * их две (для менеджеров и для художников отдельно), роль определяется
   * тем, в какую из колонок токен попал, вызывающему знать её заранее не нужно.
   *
   * @param {string} token
   * @return {{gallery: object, role: 'manager'|'artist'}|null}
   * @static
  */
  static async getGalleryByInviteToken(token) {
    const users = await UserModel.select(
      "WHERE (manager_invite_token = $1 OR artist_invite_token = $1) AND role = 'gallery' LIMIT 1",
      [token]
    );
    const gallery = users[0];
    if (!gallery) return null;

    const role = gallery.f.manager_invite_token === token ? 'manager' : 'artist';
    return { gallery, role };
  }

  toJSON() {
    const objToJson = {};
    const keysToRemove = ['password', 'reset_token', 'reset_token_expires'];
    for (const key in this.f) {
      if (keysToRemove.includes(key)) continue;
      objToJson[key] = this.f[key];
    }
    return objToJson;
  }
}