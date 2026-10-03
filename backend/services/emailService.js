const nodemailer = require("nodemailer");

function clean(value) {
  return String(value || "").trim();
}

function getBooleanEnv(value) {
  return String(value || "").toLowerCase() === "true";
}

function requireMailConfig() {
  const host = clean(process.env.SMTP_HOST);
  const port = Number.parseInt(process.env.SMTP_PORT || "465", 10);
  const user = clean(process.env.SMTP_USER);
  const pass = clean(process.env.SMTP_PASS || process.env.SMTP_APP_PASSWORD);
  const fromName = clean(process.env.MAIL_FROM_NAME || "BSCCARS");
  const fromAddress = clean(process.env.MAIL_FROM_ADDRESS || user);

  if (!host || !port || !user || !pass || !fromAddress) {
    throw new Error("SMTP configuration is incomplete.");
  }

  return {
    host,
    port,
    secure: getBooleanEnv(process.env.SMTP_SECURE || "true"),
    user,
    pass,
    from: `"${fromName.replace(/"/g, "")}" <${fromAddress}>`,
  };
}

function getTransporter() {
  const config = requireMailConfig();
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

async function sendAdminActivationEmail(user, activationUrl) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "incoming administrator";
  await sendMail({
    to: user.email,
    subject: "Activate your BSCCARS administrator account",
    text: `Hello ${name},\n\nUse this one-time link to activate your BSCCARS administrator account and create your own password:\n${activationUrl}\n\nIf you did not expect this account, contact the Barangay Office.`,
    html: baseLayout(
      "Activate Administrator Account",
      `
        <p>Hello ${escapeHtml(name)},</p>
        <p>Use this one-time link to activate your BSCCARS administrator account and create your own password.</p>
        <p><a href="${escapeHtml(activationUrl)}" style="background:#0e5e67;color:#ffffff;padding:12px 18px;text-decoration:none;border-radius:6px;display:inline-block;">Activate Account</a></p>
        <p>If you did not expect this account, contact the Barangay Office.</p>
      `,
    ),
  });
}

async function sendEmailChangeVerificationEmail(user, verificationUrl, pendingEmail) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "BSCCARS user";
  await sendMail({
    to: pendingEmail,
    subject: "Verify your new BSCCARS email address",
    text: `Hello ${name},\n\nVerify this new BSCCARS email address using this link:\n${verificationUrl}\n\nIf you did not request this change, ignore this message.`,
    html: baseLayout(
      "Verify New Email Address",
      `
        <p>Hello ${escapeHtml(name)},</p>
        <p>Verify this new email address before BSCCARS replaces your current account email.</p>
        <p><a href="${escapeHtml(verificationUrl)}" style="background:#0e5e67;color:#ffffff;padding:12px 18px;text-decoration:none;border-radius:6px;display:inline-block;">Verify New Email</a></p>
        <p>If you did not request this change, ignore this message.</p>
      `,
    ),
  });
}

async function sendEmailChangeNoticeEmail(user, pendingEmail) {
  await sendMail({
    to: user.email,
    subject: "BSCCARS email change requested",
    text: `A request was made to change your BSCCARS email address to ${pendingEmail}. If this was not you, contact the Barangay Office immediately.`,
    html: baseLayout(
      "Email Change Requested",
      `<p>A request was made to change your BSCCARS email address.</p><p>If this was not you, contact the Barangay Office immediately.</p>`,
    ),
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function baseLayout(title, bodyHtml) {
  return `
    <div style="font-family:Arial,sans-serif;color:#173f4a;line-height:1.5;max-width:620px;margin:0 auto;">
      <h1 style="color:#0e5e67;font-size:24px;margin-bottom:8px;">BSCCARS</h1>
      <h2 style="font-size:20px;margin-top:0;">${escapeHtml(title)}</h2>
      ${bodyHtml}
      <p style="font-size:13px;color:#5c737b;margin-top:28px;">
        This email was sent by Barangay Sillon Community Complaint and Response System.
      </p>
    </div>
  `;
}

async function sendMail({ to, subject, html, text }) {
  const config = requireMailConfig();
  const transporter = getTransporter();
  await transporter.sendMail({
    from: config.from,
    to,
    subject,
    html,
    text,
  });
}

async function sendVerificationEmail(user, verificationUrl) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "BSCCARS user";
  await sendMail({
    to: user.email,
    subject: "Verify your BSCCARS email address",
    text: `Hello ${name},\n\nPlease verify your BSCCARS email address using this link:\n${verificationUrl}\n\nIf you did not create this account, you can ignore this message.`,
    html: baseLayout(
      "Verify Your Email Address",
      `
        <p>Hello ${escapeHtml(name)},</p>
        <p>Please verify your email address to complete your BSCCARS account setup.</p>
        <p><a href="${escapeHtml(verificationUrl)}" style="background:#0e5e67;color:#ffffff;padding:12px 18px;text-decoration:none;border-radius:6px;display:inline-block;">Verify Email</a></p>
        <p>If you did not create this account, you can ignore this message.</p>
      `,
    ),
  });
}

async function sendPasswordResetEmail(user, resetUrl) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "BSCCARS user";
  await sendMail({
    to: user.email,
    subject: "Reset your BSCCARS password",
    text: `Hello ${name},\n\nUse this secure link to reset your BSCCARS password:\n${resetUrl}\n\nIf you did not request this, you can ignore this message.`,
    html: baseLayout(
      "Reset Your Password",
      `
        <p>Hello ${escapeHtml(name)},</p>
        <p>Use the secure link below to create a new BSCCARS password.</p>
        <p><a href="${escapeHtml(resetUrl)}" style="background:#0e5e67;color:#ffffff;padding:12px 18px;text-decoration:none;border-radius:6px;display:inline-block;">Reset Password</a></p>
        <p>If you did not request this, you can ignore this message.</p>
      `,
    ),
  });
}

async function sendComplaintStatusUpdateEmail(user, complaint, statusText) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "BSCCARS user";
  const complaintTitle = complaint.title || "Untitled complaint";
  await sendMail({
    to: user.email,
    subject: `Complaint ${complaint.id} status updated`,
    text: `Hello ${name},\n\nYour complaint ${complaint.id} (${complaintTitle}) status is now ${statusText}.\n\nThank you for using BSCCARS.`,
    html: baseLayout(
      "Complaint Status Updated",
      `
        <p>Hello ${escapeHtml(name)},</p>
        <p>Your complaint <strong>${escapeHtml(complaint.id)}</strong> (${escapeHtml(complaintTitle)}) status is now <strong>${escapeHtml(statusText)}</strong>.</p>
        <p>Thank you for using BSCCARS.</p>
      `,
    ),
  });
}

async function sendAdminResponseEmail(user, complaint, responseText) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "BSCCARS user";
  const complaintTitle = complaint.title || "Untitled complaint";
  await sendMail({
    to: user.email,
    subject: `Barangay response to complaint ${complaint.id}`,
    text: `Hello ${name},\n\nBarangay staff responded to your complaint ${complaint.id} (${complaintTitle}):\n\n"${responseText}"\n\nThank you for using BSCCARS.`,
    html: baseLayout(
      "Barangay Response Received",
      `
        <p>Hello ${escapeHtml(name)},</p>
        <p>Barangay staff responded to your complaint <strong>${escapeHtml(complaint.id)}</strong> (${escapeHtml(complaintTitle)}).</p>
        <blockquote style="border-left:4px solid #0e5e67;margin:16px 0;padding:8px 14px;color:#173f4a;background:#f2f7f8;">${escapeHtml(responseText)}</blockquote>
        <p>Thank you for using BSCCARS.</p>
      `,
    ),
  });
}

async function sendPasswordResetConfirmationEmail(user) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "BSCCARS user";
  await sendMail({
    to: user.email,
    subject: "Your BSCCARS password was changed",
    text: `Hello ${name},\n\nYour BSCCARS password has been changed successfully. If you did not make this change, contact the Barangay Office immediately.`,
    html: baseLayout(
      "Password Changed",
      `
        <p>Hello ${escapeHtml(name)},</p>
        <p>Your BSCCARS password has been changed successfully.</p>
        <p>If you did not make this change, contact the Barangay Office immediately.</p>
      `,
    ),
  });
}

async function verifyEmailConfiguration() {
  const transporter = getTransporter();
  await transporter.verify();
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmationEmail,
  sendComplaintStatusUpdateEmail,
  sendAdminResponseEmail,
  sendAdminActivationEmail,
  sendEmailChangeVerificationEmail,
  sendEmailChangeNoticeEmail,
  verifyEmailConfiguration,
};
