"use strict";

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  family: 4,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify SMTP connection on server startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP ERROR:", error);
  } else {
    console.log("✅ SMTP READY - Gmail connected");
  }
});

const sendOtpEmail = async (toEmail, otp) => {
  try {
    console.log(`📧 Sending OTP to ${toEmail}`);

    const mailOptions = {
      from: `"Sarathi" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Sarathi Email Verification Code",

      text: `
Welcome to Sarathi!

Your verification code is:

${otp}

This code will expire in 5 minutes.

If you did not request this code, please ignore this email.

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
        
        <h2 style="
          color:#22c55e;
          margin-bottom:20px;
        ">
          Sarathi Email Verification
        </h2>

        <p>Hello,</p>

        <p>
          Thank you for creating an account on <strong>Sarathi</strong>.
        </p>

        <p>Your verification code is:</p>

        <div style="
          margin:25px 0;
          text-align:center;
          padding:20px;
          border-radius:12px;
          background:rgba(34,197,94,0.08);
          border:1px solid rgba(34,197,94,0.25);
        ">
          <span style="
            font-size:38px;
            font-weight:800;
            letter-spacing:10px;
            color:#22c55e;
          ">
            ${otp}
          </span>
        </div>

        <p>
          This code will expire in
          <strong>5 minutes</strong>.
        </p>

        <p style="
          color:#94a3b8;
          font-size:13px;
          margin-top:25px;
        ">
          If you did not request this code,
          you can safely ignore this email.
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

    const info = await transporter.sendMail(mailOptions);

    console.log("✅ MAIL SENT");
    console.log("Message ID:", info.messageId);

    return info;

  } catch (error) {
    console.error("❌ MAIL SEND FAILED:", error);
    throw error;
  }
};

module.exports = {
  sendOtpEmail,
};