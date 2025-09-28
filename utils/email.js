// src/utils/email.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

export async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_HOST) return console.log('SMTP not configured, skipping email.');
  await transporter.sendMail({ from: 'no-reply@egov.example', to, subject, html });
}
