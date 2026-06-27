// services/mailer.js
"use strict";

const nodemailer = require("nodemailer");

/* ── Gmail SMTP transporter ──────────────────────────────────────────
   family: 4 forces IPv4 — Render has no working IPv6 route, so without
   this Nodemailer's own resolver picks Gmail's IPv6 (AAAA) record and
   dies with ENETUNREACH before reaching Gmail. */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // 465 = implicit TLS
  family: 4,    // force IPv4
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});

/* ── Verify SMTP connection on startup ───────────────────────────────
   Logs readiness or the full error so you know at boot whether Gmail
   auth / connectivity works. Does NOT crash the server on failure. */
transporter.verify((error) => {
  if (error) {
    console.error("❌ Gmail SMTP verify FAILED:", error.message);
    console.error(error);
  } else {
    console.log("✅ Gmail SMTP initialized — ready to send");
  }
});

/* ── Email template (Sarathi branding, green theme, OTP box) ─────────── */
const buildEmail = (otp, purpose) => {
  const isReset = purpose === "forgot-password";
  const subject = isReset ? "Reset Your Sarathi Password" : "Verify Your Sarathi Account";
  const actionLine = isReset
    ? "Your password reset verification code is:"
    : "Your email verification code is:";
  const closing = isReset
    ? "If you did not request a password reset, you can safely ignore this email — your password will not be changed."
    : "If you did not create a Sarathi account, you can safely ignore this email.";

  const html = `
  <div style="max-width:480px;margin:auto;padding:32px;background:#041108;border-radius:18px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
    <h2 style="color:#22c55e;margin:0 0 8px;">Sarathi</h2>
    <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">
      ${isReset ? "Password Reset" : "Email Verification"}
    </p>
    <p style="margin:0 0 16px;">${actionLine}</p>
    <div style="text-align:center;padding:18px;border-radius:12px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);margin:0 0 20px;">
      <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#22c55e;">${otp}</span>
    </div>
    <p style="margin:0 0 16px;">This code expires in <strong>5 minutes</strong>.</p>
    <p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">${closing}</p>
    <hr style="border:none;border-top:1px solid #1e293b;margin:20px 0;">
    <p style="color:#64748b;font-size:12px;margin:0;">© ${new Date().getFullYear()} Sarathi · Your Journey, Our Guidance</p>
  </div>`;

  const text = `${subject}\n\n${actionLine} ${otp}\n\nThis code expires in 5 minutes.\n\n${closing}`;
  return { subject, html, text };
};

/**
 * sendOtpEmail(to, otp, purpose)
 * @param {string} to       recipient email
 * @param {string} otp      6-digit code
 * @param {string} purpose  "signup" | "forgot-password"
 * Throws on failure so the calling controller's try/catch returns a clean 500.
 */
const sendOtpEmail = async (to, otp, purpose = "signup") => {
  console.log(`📧 OTP email requested → ${to} (purpose: ${purpose})`);

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("EMAIL_USER / EMAIL_PASS not configured");
  }

  const { subject, html, text } = buildEmail(otp, purpose);

  try {
    const info = await transporter.sendMail({
      from: `"Sarathi" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log("✅ Email sent successfully — messageId:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Email send FAILED:", error.message);
    console.error(error); // full stack
    throw new Error("Email could not be sent");
  }
};

module.exports = { sendOtpEmail };