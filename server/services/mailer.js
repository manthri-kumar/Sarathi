"use strict";

const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// Until you verify your own domain in Resend, the sender MUST be
// onboarding@resend.dev. After domain verification, set EMAIL_FROM
// to e.g. "Sarathi <noreply@yourdomain.com>".
const FROM = process.env.EMAIL_FROM || "Sarathi <onboarding@resend.dev>";

const buildHtml = (otp) => `
  <div style="max-width:600px;margin:auto;padding:32px;background:#041108;border-radius:18px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
    <h2 style="color:#22c55e;margin:0 0 16px;">Sarathi Email Verification</h2>
    <p style="margin:0 0 8px;">Hello,</p>
    <p style="margin:0 0 16px;">Thank you for creating your Sarathi account. Your verification code is:</p>
    <div style="text-align:center;padding:18px;border-radius:12px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);margin:20px 0;">
      <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#22c55e;">${otp}</span>
    </div>
    <p style="margin:0 0 16px;">This code expires in <strong>5 minutes</strong>.</p>
    <p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">If you did not request this code, please ignore this email.</p>
    <hr style="border:none;border-top:1px solid #1e293b;margin:20px 0;">
    <p style="color:#94a3b8;font-size:13px;margin:0;">Team Sarathi 🚀</p>
  </div>`;

const buildText = (otp) =>
  `Welcome to Sarathi!

Your verification code is:

${otp}

This code expires in 5 minutes.

If you did not request this email, please ignore it.

Team Sarathi`;

/**
 * sendOtpEmail(toEmail, otp)
 * Sends the OTP via Resend HTTPS API (port 443 — not blocked on Render).
 * Throws on failure so the controller's try/catch returns a clean 500.
 */
const sendOtpEmail = async (toEmail, otp) => {
  console.log(`📧 [RESEND] Sending OTP to ${toEmail} from ${FROM}`);

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [toEmail],
      subject: "Sarathi Email Verification",
      html: buildHtml(otp),
      text: buildText(otp),
    });

    // Resend returns { data, error } rather than throwing on API errors.
    if (error) {
      console.error("❌ [RESEND] API error:", error.name || "", error.message || error);
      throw new Error(error.message || "Resend API error");
    }

    console.log("✅ [RESEND] Sent — id:", data?.id);
    return data;
  } catch (err) {
    console.error("❌ [RESEND] Send failed:", err.message);
    throw err;
  }
};

module.exports = { sendOtpEmail };