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
      created_by: {}
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