const nodemailer = require('nodemailer');
const config = require('../config');
const db = require('../config/db');
const { renderEmail } = require('../templates/notificationTemplates');

class EmailProvider {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.mailpit.host,
      port: config.mailpit.port,
      ignoreTLS: true,
    });
  }

  /**
   * Sends an email via Mailpit.
   */
  async send({ userId, type, payload = {}, recipient = {} }) {
    let email = recipient.email;
    let name = recipient.name;

    // Fallback: look up user email and name from DB if not passed in job
    if (!email && userId) {
      const userRes = await db.query('SELECT name, email FROM users WHERE id = $1', [userId]);
      if (userRes.rows[0]) {
        email = userRes.rows[0].email;
        name = name || userRes.rows[0].name;
      }
    }

    if (!email) {
      // Cannot send email without email address
      return { skipped: true, reason: 'No email address found for recipient' };
    }

    const { subject, text, html } = renderEmail(type, payload, { ...recipient, name, email });

    const mailOptions = {
      from: config.mailpit.from,
      to: `"${name || 'User'}" <${email}>`,
      subject,
      text,
      html,
    };

    const info = await this.transporter.sendMail(mailOptions);

    if (userId) {
      // Optionally record email notification in notifications table for auditing
      try {
        await db.query(
          `INSERT INTO notifications (user_id, channel, type, payload, status, created_at)
           VALUES ($1, 'email', $2, $3, 'sent', NOW())`,
          [userId, type, JSON.stringify({ subject, to: email, messageId: info.messageId })]
        );
      } catch (err) {
        console.error('[EmailProvider] Failed to log email delivery:', err.message);
      }
    }

    return {
      messageId: info.messageId,
      accepted: info.accepted,
      to: email,
      subject,
    };
  }
}

module.exports = new EmailProvider();
