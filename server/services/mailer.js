// services/mailer.js
"use strict";

const nodemailer = require("nodemailer");

/* ═══════════════════════════════════════════════════════════════════════════
   BREVO SMTP TRANSPORTER
   
   Configuration for Brevo's SMTP relay service
   - Host: smtp-relay.brevo.com (Brevo's official SMTP server)
   - Port: 587 (TLS with STARTTLS — standard, Render-compatible)
   - Secure: false (STARTTLS is initiated after connection)
   - From: SENDER_EMAIL (must be verified in Brevo dashboard)
   
   Why Brevo over Gmail:
   - Reliable for transactional email (300+ per day on free tier)
   - No IP whitelisting issues
   - No "Less Secure Apps" restrictions
   - Render-compatible (no IPv6 routing conflicts)
═══════════════════════════════════════════════════════════════════════════ */

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.SENDER_EMAIL) {
  console.error(
    "❌ CRITICAL: Email configuration incomplete.\n" +
    "   Required environment variables:\n" +
    "   - EMAIL_USER (Brevo SMTP login)\n" +
    "   - EMAIL_PASS (Brevo SMTP password)\n" +
    "   - SENDER_EMAIL (verified sender email in Brevo)\n" +
    "   See .env.example for setup instructions."
  );
  // Do not crash — allow server to start for debugging
}

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",           // Brevo's SMTP host
  port: 587,                               // TLS port (standard)
  secure: false,                           // false = use STARTTLS (not implicit SSL)
  auth: {
    user: process.env.EMAIL_USER,          // Brevo SMTP login (from dashboard)
    pass: process.env.EMAIL_PASS,          // Brevo SMTP password (from dashboard)
  },
  connectionTimeout: 15000,                // Max 15s to connect
  greetingTimeout: 15000,                  // Max 15s for SMTP greeting
  socketTimeout: 20000,                    // Max 20s for socket operations
  logger: false,                           // Set to true for SMTP protocol debugging
  debug: false,                            // Set to true for verbose output
});

/* ───────────────────────────────────────────────────────────────────────────
   STARTUP VERIFICATION
   
   Attempt SMTP connection on app startup to catch credential issues early.
   Logs result but does NOT crash server (allows for debugging).
   ─────────────────────────────────────────────────────────────────────────── */
/* ───────────────────────────────────────────────────────────────────────────
   VERIFY SMTP CONNECTION ON STARTUP
   Logs the COMPLETE error object for debugging.
─────────────────────────────────────────────────────────────────────────── */

transporter.verify((error, success) => {
  if (error) {
    console.error("\n========================================");
    console.error("❌ BREVO SMTP VERIFICATION FAILED");
    console.error("========================================");

    console.error("Message:", error.message);
    console.error("Code:", error.code);
    console.error("Command:", error.command);
    console.error("Response:", error.response);
    console.error("Response Code:", error.responseCode);
    console.error("Stack:\n", error.stack);

    console.error("\nCurrent SMTP Configuration:");
    console.error("Host:", "smtp-relay.brevo.com");
    console.error("Port:", 587);
    console.error("Secure:", false);
    console.error("EMAIL_USER:", process.env.EMAIL_USER ? "✅ Set" : "❌ Missing");
    console.error("EMAIL_PASS:", process.env.EMAIL_PASS ? "✅ Set" : "❌ Missing");
    console.error("SENDER_EMAIL:", process.env.SENDER_EMAIL || "❌ Missing");

    console.error("\nFull Error Object:");
    console.dir(error, { depth: null });

    console.error("\nTroubleshooting Checklist:");
    console.error("1. Verify EMAIL_USER is the SMTP login from Brevo.");
    console.error("2. Verify EMAIL_PASS is the SMTP password, NOT your Brevo account password.");
    console.error("3. Verify SENDER_EMAIL is a verified sender in Brevo.");
    console.error("4. Verify SMTP is enabled in your Brevo account.");
    console.error("5. Verify Render environment variables are saved.");
    console.error("========================================\n");
  } else {
    console.log("\n========================================");
    console.log("✅ BREVO SMTP VERIFIED SUCCESSFULLY");
    console.log("========================================");
    console.log("Host:", "smtp-relay.brevo.com");
    console.log("Port:", 587);
    console.log("Secure:", false);
    console.log("Sender:", process.env.SENDER_EMAIL);
    console.log("Success:", success);
    console.log("========================================\n");
  }
});
/* ───────────────────────────────────────────────────────────────────────────
   EMAIL TEMPLATE BUILDER
   
   Creates professional HTML + plain-text versions of OTP emails.
   Branding: Sarathi (dark green theme, matching app design)
   ─────────────────────────────────────────────────────────────────────────── */
const buildEmail = (otp, purpose) => {
  const isReset = purpose === "forgot-password";
  const subject = isReset 
    ? "Reset Your Sarathi Password" 
    : "Verify Your Sarathi Account";
  const actionLine = isReset
    ? "Your password reset verification code is:"
    : "Your email verification code is:";
  const closing = isReset
    ? "If you did not request a password reset, you can safely ignore this email — your password will not be changed."
    : "If you did not create a Sarathi account, you can safely ignore this email.";

  /* HTML Email Template
     - Dark theme (Sarathi branding)
     - Accessible color contrast
     - Mobile-responsive
     - OTP in prominent box for easy copying
  */
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
    .container { max-width: 480px; margin: 0 auto; }
    .card { background: #041108; border-radius: 18px; padding: 32px; color: #ffffff; }
    .header h2 { color: #22c55e; margin: 0 0 8px 0; font-size: 24px; font-weight: 600; }
    .header-sub { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0; }
    .content p { margin: 0 0 16px 0; line-height: 1.6; color: #e2e8f0; }
    .otp-box {
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.25);
      border-radius: 12px;
      padding: 18px;
      text-align: center;
      margin: 0 0 20px 0;
    }
    .otp-code {
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #22c55e;
      font-family: 'Courier New', monospace;
    }
    .footer {
      border-top: 1px solid #1e293b;
      margin-top: 20px;
      padding-top: 20px;
      color: #64748b;
      font-size: 12px;
    }
    .footer p { margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h2>Sarathi</h2>
        <p class="header-sub">${isReset ? "Password Reset" : "Email Verification"}</p>
      </div>
      
      <p>${actionLine}</p>
      
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      
      <p>This code expires in <strong>5 minutes</strong>.</p>
      <p style="color: #94a3b8;">${closing}</p>
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} Sarathi · Your Journey, Our Guidance</p>
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  /* Plain-text fallback (for email clients that don't support HTML) */
  const text = `SARATHI ${isReset ? "PASSWORD RESET" : "EMAIL VERIFICATION"}

${actionLine} ${otp}

This code expires in 5 minutes.

${closing}

© ${new Date().getFullYear()} Sarathi · Your Journey, Our Guidance
This is an automated message. Please do not reply to this email.`;

  return { subject, html, text };
};

/* ═══════════════════════════════════════════════════════════════════════════
   SEND OTP EMAIL FUNCTION
   
   Called by authController when user signs up or requests password reset.
   
   @param {string} to       recipient email address
   @param {string} otp      6-digit verification code
   @param {string} purpose  "signup" | "forgot-password"
   
   Returns: nodemailer response (messageId, etc.)
   Throws: Error with descriptive message on failure
═══════════════════════════════════════════════════════════════════════════ */
const sendOtpEmail = async (to, otp, purpose = "signup") => {
  console.log(`📧 OTP email request → ${to} (purpose: ${purpose})`);

  /* ─────────────────────────────────────────────────────────────────────────
     VALIDATION: Environment variables must be set
  ───────────────────────────────────────────────────────────────────────────── */
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.SENDER_EMAIL) {
    const missingVars = [];
    if (!process.env.EMAIL_USER) missingVars.push("EMAIL_USER");
    if (!process.env.EMAIL_PASS) missingVars.push("EMAIL_PASS");
    if (!process.env.SENDER_EMAIL) missingVars.push("SENDER_EMAIL");
    
    const error = new Error(
      `Brevo SMTP configuration incomplete: ${missingVars.join(", ")} not set`
    );
    console.error("❌", error.message);
    throw error;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     BUILD EMAIL
  ───────────────────────────────────────────────────────────────────────────── */
  const { subject, html, text } = buildEmail(otp, purpose);
  console.log(`   Subject: ${subject}`);
  console.log(`   Sender: ${process.env.SENDER_EMAIL}`);

  try {
    /* ───────────────────────────────────────────────────────────────────────
       SEND via BREVO SMTP
       
       The transporter queues the email and attempts delivery.
       On success: returns messageId (unique identifier)
       On failure: throws error with SMTP response code
    ─────────────────────────────────────────────────────────────────────────── */
    console.log(`   Attempting send via Brevo SMTP...`);
    const info = await transporter.sendMail({
      from: `Sarathi <${process.env.SENDER_EMAIL}>`,  // Display name + verified email
      to,                                             // Recipient
      subject,                                        // Email subject
      text,                                           // Plain text fallback
      html,                                           // HTML version
      replyTo: process.env.SENDER_EMAIL,              // Reply-to address
    });

    console.log(
      `✅ Email sent successfully\n` +
      `   MessageID: ${info.messageId}\n` +
      `   To: ${to}\n` +
      `   Time: ${new Date().toISOString()}`
    );

    return info;

  } catch (error) {
    /* ───────────────────────────────────────────────────────────────────────
       ERROR HANDLING
       
       Different error types indicate different problems:
       - 550: Sender not verified
       - 535: Authentication failed
       - ECONNREFUSED: Network unreachable
       - ETIMEDOUT: Connection timeout
    ─────────────────────────────────────────────────────────────────────────── */
    const errorMsg = error.message || "Unknown error";
    const statusCode = error.response?.status || error.code || "N/A";

    console.error(
      `❌ Email send FAILED\n` +
      `   Error: ${errorMsg}\n` +
      `   Code: ${statusCode}\n` +
      `   Recipient: ${to}`
    );

    /* Log full error for debugging */
    if (process.env.NODE_ENV === "development") {
      console.error("Full error object:", error);
    }

    /* Throw descriptive error for controller to catch */
    if (errorMsg.includes("550")) {
      throw new Error("Sender email not verified in Brevo. Check SENDER_EMAIL configuration.");
    } else if (errorMsg.includes("535")) {
      throw new Error("Brevo SMTP authentication failed. Check EMAIL_USER and EMAIL_PASS.");
    } else if (errorMsg.includes("ECONNREFUSED") || errorMsg.includes("ETIMEDOUT")) {
      throw new Error("Cannot reach Brevo SMTP server. Check network connectivity.");
    } else {
      throw new Error("Email could not be sent. Please try again later.");
    }
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORTS
   
   Only export sendOtpEmail function.
   Transporter is internal (verified on startup).
═══════════════════════════════════════════════════════════════════════════ */
module.exports = { sendOtpEmail };