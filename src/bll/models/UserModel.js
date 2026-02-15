import PgObject from 'pgobject'
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
      online: {}
    }
  }

  static get table() {
    return 'my_user';
  }

  static async getUserById(id) {
    const users = await UserModel.select("WHERE id = $1 OR email = $2 LIMIT 1", [id]);
    return users[0];
  }

  toJSON() {
    const objToJson = {};
    const keysToRemove = ['password'];
    for (const key in this.f) {
      if (keysToRemove.includes(key)) continue;
      objToJson[key] = this.f[key];
    }
    return objToJson;
  }
}