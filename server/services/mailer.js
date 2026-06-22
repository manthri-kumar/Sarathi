"use strict";

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOtpEmail = async (toEmail, otp) => {
  const mailOptions = {
    from: `"Sarathi" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Sarathi Email Verification",
    text: `Hello,

Your verification code is:

${otp}

This code expires in 5 minutes.

Welcome to Sarathi.`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#020402;border-radius:16px;color:#e2e8f0;">
        <h2 style="color:#22c55e;margin:0 0 16px;">Sarathi Email Verification</h2>
        <p style="margin:0 0 8px;">Hello,</p>
        <p style="margin:0 0 16px;">Your verification code is:</p>
        <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#22c55e;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:12px;padding:16px;text-align:center;">${otp}</div>
        <p style="margin:16px 0 0;color:#94a3b8;font-size:13px;">This code expires in 5 minutes.</p>
        <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;">Welcome to Sarathi.</p>
      </div>`,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOtpEmail };