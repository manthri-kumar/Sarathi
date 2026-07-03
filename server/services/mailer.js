// services/mailer.js
"use strict";

/* ═══════════════════════════════════════════════════════════════════════════
   BREVO TRANSACTIONAL EMAIL — HTTP API (NOT SMTP)

   Why HTTP over SMTP on Render:
   - Render filters outbound SMTP ports (25/465/587). TCP SYN is dropped
     silently → ETIMEDOUT on CONN. No code fixes a firewalled port.
   - Brevo's REST API is a single HTTPS POST to api.brevo.com:443. Port 443
     is always open (same path as Places/Mongo/Groq, all working).
   - Eliminates the entire connection-timeout class: no port block, no IPv6
     routing, no STARTTLS. Errors return real HTTP status codes.

   Env required:
   - BREVO_API_KEY  → Brevo v3 API key (NOT the SMTP password)
   - SENDER_EMAIL   → verified sender in Brevo
═══════════════════════════════════════════════════════════════════════════ */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

if (!process.env.BREVO_API_KEY || !process.env.SENDER_EMAIL) {
  console.error(
    "❌ CRITICAL: Email configuration incomplete.\n" +
    "   Required environment variables:\n" +
    "   - BREVO_API_KEY (Brevo v3 API key — Dashboard → SMTP & API → API Keys)\n" +
    "   - SENDER_EMAIL (verified sender email in Brevo)"
  );
  // Do not crash — allow server to start for debugging.
}

/* ───────────────────────────────────────────────────────────────────────────
   STARTUP CHECK — HTTP reachability, not a TCP socket probe.
   A HEAD/GET to the account endpoint confirms key validity + 443 egress.
─────────────────────────────────────────────────────────────────────────── */
(async () => {
  if (!process.env.BREVO_API_KEY) return;
  try {
    const res = await fetch("https://api.brevo.com/v3/account", {
      method: "GET",
      headers: { "api-key": process.env.BREVO_API_KEY, "accept": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      console.log("✅ BREVO API VERIFIED — account:", data?.email || "ok", "| sender:", process.env.SENDER_EMAIL);
    } else {
      console.error(`❌ BREVO API check failed — HTTP ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("❌ BREVO API check error:", err.message);
  }
})();

/* ───────────────────────────────────────────────────────────────────────────
   EMAIL TEMPLATE BUILDER — Sarathi dark-green branding (unchanged)
─────────────────────────────────────────────────────────────────────────── */
const buildEmail = (otp, purpose) => {
  const isReset = purpose === "forgot-password";
  const subject = isReset ? "Reset Your Sarathi Password" : "Verify Your Sarathi Account";
  const actionLine = isReset
    ? "Your password reset verification code is:"
    : "Your email verification code is:";
  const closing = isReset
    ? "If you did not request a password reset, you can safely ignore this email — your password will not be changed."
    : "If you did not create a Sarathi account, you can safely ignore this email.";

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
    .otp-box { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25); border-radius: 12px; padding: 18px; text-align: center; margin: 0 0 20px 0; }
    .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #22c55e; font-family: 'Courier New', monospace; }
    .footer { border-top: 1px solid #1e293b; margin-top: 20px; padding-top: 20px; color: #64748b; font-size: 12px; }
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
      <div class="otp-box"><div class="otp-code">${otp}</div></div>
      <p>This code expires in <strong>5 minutes</strong>.</p>
      <p style="color:#94a3b8;">${closing}</p>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Sarathi · Your Journey, Our Guidance</p>
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = `SARATHI ${isReset ? "PASSWORD RESET" : "EMAIL VERIFICATION"}

${actionLine} ${otp}

This code expires in 5 minutes.

${closing}

© ${new Date().getFullYear()} Sarathi · Your Journey, Our Guidance
This is an automated message. Please do not reply to this email.`;

  return { subject, html, text };
};

/* ═══════════════════════════════════════════════════════════════════════════
   SEND OTP EMAIL — signature UNCHANGED so authController needs no edits.

   @param {string} to       recipient email
   @param {string} otp      6-digit code
   @param {string} purpose  "signup" | "forgot-password"
   @returns {Promise<{messageId:string}>}
   @throws  Error with actionable message on failure
═══════════════════════════════════════════════════════════════════════════ */
const sendOtpEmail = async (to, otp, purpose = "signup") => {
  console.log(`📧 OTP email request → ${to} (purpose: ${purpose})`);

  if (!process.env.BREVO_API_KEY || !process.env.SENDER_EMAIL) {
    const missing = [];
    if (!process.env.BREVO_API_KEY) missing.push("BREVO_API_KEY");
    if (!process.env.SENDER_EMAIL) missing.push("SENDER_EMAIL");
    const error = new Error(`Brevo API configuration incomplete: ${missing.join(", ")} not set`);
    console.error("❌", error.message);
    throw error;
  }

  const { subject, html, text } = buildEmail(otp, purpose);

  const payload = {
    sender: { name: "Sarathi", email: process.env.SENDER_EMAIL },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text,
    replyTo: { email: process.env.SENDER_EMAIL },
  };

  // Abort so a stalled request can't hang the OTP flow.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    console.log("   Attempting send via Brevo HTTP API...");
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const bodyText = await res.text();

    if (!res.ok) {
      // HTTP status codes are actionable — unlike a silent socket timeout.
      console.error(`❌ Brevo API responded HTTP ${res.status}: ${bodyText}`);
      if (res.status === 401) throw new Error("Brevo API key invalid or revoked. Check BREVO_API_KEY.");
      if (res.status === 400 && /sender/i.test(bodyText)) {
        throw new Error("Sender not verified in Brevo. Check SENDER_EMAIL.");
      }
      if (res.status === 429) throw new Error("Brevo rate limit reached. Try again shortly.");
      throw new Error("Email could not be sent. Please try again later.");
    }

    let messageId = "unknown";
    try { messageId = JSON.parse(bodyText)?.messageId || "unknown"; } catch { /* noop */ }

    console.log(
      `✅ Email sent successfully\n` +
      `   MessageID: ${messageId}\n` +
      `   To: ${to}\n` +
      `   Time: ${new Date().toISOString()}`
    );
    return { messageId };

  } catch (error) {
    clearTimeout(timeout);
    if (error.name === "AbortError") {
      console.error("❌ Brevo API request timed out (15s).");
      throw new Error("Email service timed out. Please try again later.");
    }
    // Re-throw already-descriptive errors; wrap anything unexpected.
    if (/Brevo|Sender|Email|rate limit/i.test(error.message)) throw error;
    console.error("❌ Brevo API unexpected error:", error.message);
    throw new Error("Email could not be sent. Please try again later.");
  }
};

module.exports = { sendOtpEmail };