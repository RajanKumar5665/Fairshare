import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

let transporter = null;

export const mailEnabled = () => Boolean(env.SMTP_USER && env.SMTP_PASS);

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: Number(env.SMTP_PORT) === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Send an email. Without SMTP settings:
 *  - development/test: the message is printed to the server log (so you can test locally)
 *  - production: fails with a clear message
 */
export async function sendMail({ to, subject, text, html }) {
  if (!mailEnabled()) {
    if (env.NODE_ENV !== 'production') {
      // Plain console output so the code is easy to read in the dev terminal
      console.log(`\n[mail] SMTP not set up — this email was NOT sent, printed here instead:\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
      return { simulated: true };
    }
    throw new AppError('Email is not set up on the server yet. Please contact support.', 503);
  }
  try {
    await getTransporter().sendMail({
      from: env.MAIL_FROM || `FairShare <${env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return { simulated: false };
  } catch (err) {
    logger.error({ err: err.message, to }, '[mail] sending failed');
    throw new AppError('Could not send the email right now. Please try again in a minute.', 502);
  }
}
