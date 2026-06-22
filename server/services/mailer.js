"use strict";

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,

  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

  tls: {
    rejectUnauthorized: false,
    family: 4,
  },
});

// Verify SMTP connection when server starts
transporter.verify((error) => {
  if (error) {
    console.error("❌ SMTP VERIFY FAILED");
    console.error(error);
  } else {
    console.log("✅ SMTP READY - Gmail connected");
  }
});

const sendOtpEmail = async (toEmail, otp) => {
  try {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📧 Sending OTP to: ${toEmail}`);
    console.log(`📨 Sender: ${process.env.EMAIL_USER}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const mailOptions = {
      from: `"Sarathi" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Sarathi Email Verification",

      text: `
Welcome to Sarathi!

Your verification code is:

${otp}

This code expires in 5 minutes.

If you did not request this email, please ignore it.

Team Sarathi
      `,

      html: `
      <div style="
        max-width:600px;
        margin:auto;
        padding:30px;
        background:#041108;
        border-radius:18px;
        color:#ffffff;
        font-family:Arial,sans-serif;
      ">

        <h2 style="color:#22c55e;">
          Sarathi Email Verification
        </h2>

        <p>Hello,</p>

        <p>
          Thank you for creating your Sarathi account.
        </p>

        <p>Your verification code:</p>

        <div style="
          text-align:center;
          padding:18px;
          border-radius:12px;
          background:rgba(34,197,94,0.08);
          border:1px solid rgba(34,197,94,0.25);
          margin:20px 0;
        ">
          <span style="
            font-size:36px;
            font-weight:800;
            letter-spacing:8px;
            color:#22c55e;
          ">
            ${otp}
          </span>
        </div>

        <p>
          This code expires in
          <strong>5 minutes</strong>.
        </p>

        <p style="
          color:#94a3b8;
          font-size:13px;
        ">
          If you did not request this code,
          please ignore this email.
        </p>

        <hr style="
          border:none;
          border-top:1px solid #1e293b;
          margin:20px 0;
        ">

        <p style="
          color:#94a3b8;
          font-size:13px;
        ">
          Team Sarathi 🚀
        </p>

      </div>
      `,
    };

    console.log("🚀 Starting Gmail send...");

    const info = await Promise.race([
      transporter.sendMail(mailOptions),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("SMTP_TIMEOUT_AFTER_15_SECONDS")),
          15000
        )
      ),
    ]);

    console.log("✅ MAIL SENT SUCCESSFULLY");
    console.log("📩 Message ID:", info.messageId);

    return info;
  } catch (error) {
    console.error("❌ MAIL SEND FAILED");
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);

    if (error.response) {
      console.error("SMTP Response:", error.response);
    }

    if (error.code) {
      console.error("Error Code:", error.code);
    }

    throw error;
  }
};

module.exports = {
  sendOtpEmail,
};