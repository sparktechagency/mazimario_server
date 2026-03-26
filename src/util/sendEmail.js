const nodemailer = require("nodemailer");
const config = require("../config");

const currentDate = new Date();

const formattedDate = currentDate.toLocaleDateString("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const sendEmail = async (options) => {
  // Build transport config — do NOT set both `service` and `host` at the same time.
  // If SMTP_SERVICE (e.g. "gmail") is set, Nodemailer uses it and ignores host/port.
  // Otherwise, use explicit host + port.
  const transportConfig = config.smtp.smtp_service
    ? {
        service: config.smtp.smtp_service, // e.g. "gmail"
        auth: {
          user: config.smtp.smtp_mail,
          pass: config.smtp.smtp_password,
        },
      }
    : {
        host: config.smtp.smtp_host,
        port: parseInt(config.smtp.smtp_port),
        secure: parseInt(config.smtp.smtp_port) === 465, // true for 465, false for 587
        auth: {
          user: config.smtp.smtp_mail,
          pass: config.smtp.smtp_password,
        },
      };

  const transporter = nodemailer.createTransport(transportConfig);

  const { email, subject, html } = options;

  const mailOptions = {
    from: `${config.smtp.NAME} <${config.smtp.smtp_mail}>`,
    to: email,
    date: formattedDate,
    signed_by: "bdCalling.com",
    subject,
    html,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendEmail };
