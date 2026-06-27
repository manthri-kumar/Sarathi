// services/mailer.js
"use strict";

const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// Until you verify your own domain in Resend, sender MUST be onboarding@resend.dev.
const FROM = process.env.EMAIL_FROM || "Sarathi <onboarding@resend.dev>";

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
    <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">${isReset ? "Password Reset" : "Email Verification"}</p>
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
 * purpose: "signup" | "forgot-password"
 */
const sendOtpEmail = async (to, otp, purpose = "signup") => {
  console.log("STEP 5a Calling Resend →", to, "purpose:", purpose);

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const { subject, html, text } = buildEmail(otp, purpose);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject,
    html,
    text,
  });

  if (error) {
    console.error("STEP 5b Resend API error:", error.name || "", error.message || error);
    throw new Error(error.message || "Resend API error");
  }

  console.log("STEP 6 Mail sent — id:", data?.id);
  return data;
};

module.exports = { sendOtpEmail };