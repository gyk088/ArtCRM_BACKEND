import UserModel from '../models/UserModel.js'
import SessionModel from '../models/SessionModel.js';
import { getRandomInt, validateEmail } from '../utils/helpers.js' 
import bcrypt from 'bcrypt';
import { ROLES } from '../utils/const.js'

export default class AuthService {
  /**
   * Авторизация по email и паролю в админ панель
   *
   * @param {string} email - login
   * @param {string} password - password
   * @param {string} ip - см schema в UserModel
   * @param {string} user_agent - см schema в UserModel
   * @return { User, Session } user, session  - UserModel и Session
   * @static
  */
  static async loginByPassword(email, password, ip, user_agent) {
    email = email?.toLowerCase();
    password = password?.toLowerCase();
    let user = await UserModel.getUserByEmail(email);

    if (!user) throw new Error('email is invalid');
 
    if (!user.f.password) throw new Error('password is null');
    if (!bcrypt.compareSync(password, user.f.password)) throw new Error('password is invalid');

    const session = new SessionModel({
      user_id: user.f.id,
      ip,
      user_agent
    });
    await session.generateToken();
    await session.save();

    return {
      session,
      user
    }
  } 

  /**
   *  Получить пользователя по сессии
   *
   * @param {string} token - см schema в SessionModel
   * @param {string} ip - см schema в UserModel
   * @param {string} user_agent - см schema в UserModel
   * @return {User} user - UserModel и Session
   * @static
  */
  static async loginByToken(token, ip, user_agent, fcm_token) {
    const session = await SessionModel.getSessionByToken(token);
    if (!session) return;
    session.f.ip = ip;
    session.f.fcm_token = fcm_token;     
    session.f.user_agent = user_agent;
    session.f.utime = new Date();
    await session.save();

    const user = await UserModel.getUserById(session.f.user_id);
    return user;
  }
}