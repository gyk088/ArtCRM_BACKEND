import nodemailer from 'nodemailer';

export default class Mailer {
  static __transporter = null;

  /**
   * Ленивая инициализация transporter'а на основе SMTP_* переменных окружения
   *
   * @return {import('nodemailer').Transporter}
   * @static
  */
  static __getTransporter() {
    if (Mailer.__transporter) return Mailer.__transporter;

    const { SMTP_HOST, SMTP_PORT, SMTP_EMAIL, SMTP_PASS, SMTP_SECURE } = process.env;

    if (!SMTP_HOST || !SMTP_EMAIL || !SMTP_PASS) {
      throw new Error('SMTP is not configured: set SMTP_HOST, SMTP_EMAIL, SMTP_PASS in .env');
    }

    const port = Number(SMTP_PORT) || 587;
    const secure = SMTP_SECURE !== undefined ? SMTP_SECURE === 'true' : port === 465;

    Mailer.__transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure,
      auth: {
        user: SMTP_EMAIL,
        pass: SMTP_PASS
      }
    });

    return Mailer.__transporter;
  }

  /**
   * Отправить письмо
   *
   * @param {object} options
   * @param {string} options.to - email получателя
   * @param {string} options.subject - тема письма
   * @param {string} options.html - HTML-содержимое письма
   * @param {string} [options.text] - текстовая версия письма
   * @return {Promise<import('nodemailer').SentMessageInfo>}
   * @static
  */
  static async send({ to, subject, html, text }) {
    const transporter = Mailer.__getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_EMAIL;

    return transporter.sendMail({ from, to, subject, html, text });
  }

  /**
   * Отправить письмо для восстановления пароля
   *
   * @param {string} to - email получателя
   * @param {string} resetLink - ссылка для сброса пароля
   * @return {Promise<import('nodemailer').SentMessageInfo>}
   * @static
  */
  static async sendPasswordReset(to, resetLink) {
    return Mailer.send({
      to,
      subject: 'Восстановление пароля — ART CRM',
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 15px; color: #2c2a25;">
          <p>Вы запросили восстановление пароля.</p>
          <p><a href="${resetLink}" style="color: #8a6d2f;">Нажмите сюда, чтобы задать новый пароль</a></p>
          <p>Ссылка действительна в течение ограниченного времени. Если вы не запрашивали восстановление — просто проигнорируйте это письмо.</p>
        </div>
      `,
      text: `Восстановление пароля: ${resetLink}`
    });
  }
}
