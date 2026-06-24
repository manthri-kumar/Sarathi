// services/mailer.js
const nodemailer = require("nodemailer");

/**
 * Reusable transporter.
 * Reads credentials from environment variables — never hardcode secrets.
 */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password (not your login password)
  },
});

/**
 * sendOtpEmail
 *
 * @param {string} to       — recipient email
 * @param {string} otp      — 6-digit code
 * @param {string} purpose  — "signup" | "forgot-password"
 */
const sendOtpEmail = async (to, otp, purpose = "signup") => {
  const isReset = purpose === "forgot-password";

  const subject = isReset
    ? "Reset Your Sarathi Password"
    : "Verify Your Sarathi Account";

  const actionLine = isReset
    ? "Your password reset verification code is:"
    : "Your email verification code is:";

  const noteLines = isReset
    ? [
        "Enter this code in the Sarathi app to reset your password.",
        "This code expires in <strong>5 minutes</strong>.",
        "If you did not request a password reset, you can safely ignore this email — your password will not be changed.",
      ]
    : [
        "Enter this code in the Sarathi app to verify your email address.",
        "This code expires in <strong>5 minutes</strong>.",
        "If you did not create a Sarathi account, you can safely ignore this email.",
      ];

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#030712;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#030712;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="max-width:480px;background:#0b1329;border:1px solid rgba(255,255,255,0.07);
                      border-radius:20px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#063a18,#0a2410);
                       padding:32px 36px 24px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;
                        letter-spacing:-0.02em;">Sarathi</p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.5);
                        letter-spacing:0.04em;text-transform:uppercase;">
                ${isReset ? "Password Reset" : "Email Verification"}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 8px;font-size:15px;color:#94a3b8;line-height:1.6;">
                ${actionLine}
              </p>

              <!-- OTP Box -->
              <div style="margin:20px 0;text-align:center;">
                <div style="display:inline-block;
                            background:linear-gradient(135deg,#063a18,#0a2410);
                            border:2px solid rgba(34,197,94,0.35);
                            border-radius:16px;
                            padding:20px 40px;">
                  <span style="font-size:40px;font-weight:900;letter-spacing:14px;
                               color:#22c55e;font-family:'Courier New',monospace;">
                    ${otp}
                  </span>
                </div>
              </div>

              <!-- Notes -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:rgba(255,255,255,0.03);
                            border:1px solid rgba(255,255,255,0.06);
                            border-radius:12px;padding:16px 20px;margin-top:8px;">
                <tr>
                  <td>
                    ${noteLines
                      .map(
                        (line) => `
                      <p style="margin:0 0 8px;font-size:13px;color:#64748b;
                                 line-height:1.6;">• ${line}</p>`
                      )
                      .join("")}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 36px 28px;text-align:center;
                       border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0;font-size:12px;color:#334155;">
                © ${new Date().getFullYear()} Sarathi · Your Journey, Our Guidance
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // Plain-text fallback
  const text = `${subject}\n\n${actionLine} ${otp}\n\nThis code expires in 5 minutes.`;

  await transporter.sendMail({
    from:    `"Sarathi" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
};

module.exports = { sendOtpEmail };