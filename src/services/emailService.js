const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const i18next = require('../config/i18n');

/**
 * Email Service for sending transactional emails
 * Supports multiple email providers via SMTP
 * Supports internationalization (i18n)
 */

// Create reusable transporter
let transporter = null;

/**
 * Initialize email transporter
 */
function initializeTransporter() {
  if (transporter) {
    return transporter;
  }

  // Check if email is configured
  if (!process.env.SMTP_HOST) {
    logger.warn('Email service not configured. SMTP_HOST is missing.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  });

  logger.info('Email transporter initialized');
  return transporter;
}

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 * @returns {Promise<Object>} - Send result
 */
async function sendEmail({ to, subject, html, text }) {
  try {
    const emailTransporter = initializeTransporter();
    
    if (!emailTransporter) {
      logger.warn('Email not sent - service not configured');
      return {
        success: false,
        message: 'Email service not configured'
      };
    }

    const mailOptions = {
      from: `${process.env.SMTP_FROM_NAME || 'CStore'} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || stripHtml(html)
    };

    const info = await emailTransporter.sendMail(mailOptions);
    
    logger.info(`Email sent: ${info.messageId} to ${to}`);
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    logger.error('Email send error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send welcome email to new users
 * @param {string} email - User email
 * @param {string} name - User name
 * @param {string} language - User's preferred language (default: 'en')
 */
async function sendWelcomeEmail(email, name, language = 'en') {
  const t = i18next.getFixedT(language, 'emails');
  const subject = t('welcome.subject');
  const html = getWelcomeEmailTemplate(name, language);
  
  return await sendEmail({ to: email, subject, html });
}

/**
 * Send email verification email
 * @param {string} email - User email
 * @param {string} name - User name
 * @param {string} verificationToken - Verification token
 * @param {string} language - User's preferred language (default: 'en')
 */
async function sendVerificationEmail(email, name, verificationToken, language = 'en') {
  const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${verificationToken}`;
  const t = i18next.getFixedT(language, 'emails');
  const subject = t('verification.subject');
  const html = getVerificationEmailTemplate(name, verificationUrl, language);
  
  return await sendEmail({ to: email, subject, html });
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} name - User name
 * @param {string} resetToken - Reset token
 * @param {string} language - User's preferred language (default: 'en')
 */
async function sendPasswordResetEmail(email, name, resetToken, language = 'en') {
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  const t = i18next.getFixedT(language, 'emails');
  const subject = t('passwordReset.subject');
  const html = getPasswordResetEmailTemplate(name, resetUrl, language);
  
  return await sendEmail({ to: email, subject, html });
}

/**
 * Send order confirmation email
 * @param {string} email - Customer email
 * @param {Object} order - Order details
 * @param {string} language - User's preferred language (default: 'en')
 */
async function sendOrderConfirmationEmail(email, order, language = 'en') {
  const t = i18next.getFixedT(language, 'emails');
  const subject = t('orderConfirmation.subject', { orderNumber: order.orderNumber || order._id });
  const html = getOrderConfirmationTemplate(order, language);
  
  return await sendEmail({ to: email, subject, html });
}

/**
 * Send payment confirmation email
 * @param {string} email - Customer email
 * @param {Object} order - Order details
 * @param {Object} payment - Payment details
 * @param {string} language - User's preferred language (default: 'en')
 */
async function sendPaymentConfirmationEmail(email, order, payment, language = 'en') {
  const t = i18next.getFixedT(language, 'emails');
  const subject = t('paymentConfirmation.subject', { orderNumber: order.orderNumber || order._id });
  const html = getPaymentConfirmationTemplate(order, payment, language);
  
  return await sendEmail({ to: email, subject, html });
}

/**
 * Send shipping notification email
 * @param {string} email - Customer email
 * @param {Object} order - Order details
 * @param {string} trackingNumber - Tracking number (optional)
 * @param {string} language - User's preferred language (default: 'en')
 */
async function sendShippingNotificationEmail(email, order, trackingNumber, language = 'en') {
  const t = i18next.getFixedT(language, 'emails');
  const subject = t('shippingNotification.subject', { orderNumber: order.orderNumber || order._id });
  const html = getShippingNotificationTemplate(order, trackingNumber, language);
  
  return await sendEmail({ to: email, subject, html });
}

/**
 * Send admin alert email
 * @param {string} subject - Alert subject
 * @param {string} message - Alert message
 * @param {Object} data - Additional data
 */
async function sendAdminAlert(subject, message, data = {}) {
  const adminEmail = process.env.ADMIN_EMAIL;
  
  if (!adminEmail) {
    logger.warn('Admin email not configured');
    return { success: false, message: 'Admin email not configured' };
  }

  const html = getAdminAlertTemplate(subject, message, data);
  
  return await sendEmail({ 
    to: adminEmail, 
    subject: `[CStore Alert] ${subject}`, 
    html 
  });
}

// Email Templates

function getWelcomeEmailTemplate(name, language = 'en') {
  const t = i18next.getFixedT(language, 'emails');
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f4f4f4; }
        .button { display: inline-block; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🪙 ${t('welcome.title')}</h1>
        </div>
        <div class="content">
          <h2>${t('welcome.greeting', { name })}</h2>
          <p>${t('welcome.body')}</p>
          <p>${t('welcome.description')}</p>
          <p>
            <a href="${appUrl}" class="button">${t('welcome.button')}</a>
          </p>
          <p>${t('welcome.footer')}</p>
          <p>${t('welcome.closing')}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getVerificationEmailTemplate(name, verificationUrl, language = 'en') {
  const t = i18next.getFixedT(language, 'emails');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f4f4f4; }
        .button { display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 ${t('verification.title')}</h1>
        </div>
        <div class="content">
          <h2>${t('verification.greeting', { name })}</h2>
          <p>${t('verification.body')}</p>
          <p>
            <a href="${verificationUrl}" class="button">${t('verification.button')}</a>
          </p>
          <p>${t('verification.linkText')}</p>
          <p><small>${verificationUrl}</small></p>
          <p>${t('verification.expiry')}</p>
          <p>${t('verification.ignore')}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getPasswordResetEmailTemplate(name, resetUrl, language = 'en') {
  const t = i18next.getFixedT(language, 'emails');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e74c3c; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f4f4f4; }
        .button { display: inline-block; padding: 10px 20px; background: #e74c3c; color: white; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔑 ${t('passwordReset.title')}</h1>
        </div>
        <div class="content">
          <h2>${t('passwordReset.greeting', { name })}</h2>
          <p>${t('passwordReset.body')}</p>
          <p>
            <a href="${resetUrl}" class="button">${t('passwordReset.button')}</a>
          </p>
          <p>${t('passwordReset.linkText')}</p>
          <p><small>${resetUrl}</small></p>
          <p>${t('passwordReset.expiry')}</p>
          <p>${t('passwordReset.ignore')}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getOrderConfirmationTemplate(order, language = 'en') {
  const t = i18next.getFixedT(language, 'emails');
  const productsList = order.items ? order.items.map(item => `
    <tr>
      <td>${item.product?.name || 'Product'}</td>
      <td>${item.quantity}</td>
      <td>$${(item.priceUSD * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('') : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f4f4f4; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #34495e; color: white; }
        .total { font-weight: bold; font-size: 1.2em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📦 ${t('orderConfirmation.title')}</h1>
        </div>
        <div class="content">
          <h2>${t('orderConfirmation.orderNumber', { orderNumber: order.orderNumber || order._id })}</h2>
          <p>${t('orderConfirmation.thankYou')}</p>
          
          <table>
            <thead>
              <tr>
                <th>${t('orderConfirmation.productHeader')}</th>
                <th>${t('orderConfirmation.quantityHeader')}</th>
                <th>${t('orderConfirmation.priceHeader')}</th>
              </tr>
            </thead>
            <tbody>
              ${productsList}
              <tr class="total">
                <td colspan="2">${t('orderConfirmation.totalLabel')}</td>
                <td>$${order.totalPriceUSD?.toFixed(2) || '0.00'}</td>
              </tr>
            </tbody>
          </table>

          <h3>${t('orderConfirmation.paymentDetailsTitle')}</h3>
          <p>
            <strong>${t('orderConfirmation.cryptocurrency')}:</strong> ${order.cryptocurrency}<br>
            <strong>${t('orderConfirmation.amount')}:</strong> ${order.totalPrice} ${order.cryptocurrency}<br>
            <strong>${t('orderConfirmation.paymentAddress')}:</strong> ${order.paymentAddress}
          </p>

          <p>${t('orderConfirmation.instruction')}</p>
          
          <p>${t('orderConfirmation.status')}: <strong>${order.status}</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getPaymentConfirmationTemplate(order, payment, language = 'en') {
  const t = i18next.getFixedT(language, 'emails');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #27ae60; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f4f4f4; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ ${t('paymentConfirmation.title')}</h1>
        </div>
        <div class="content">
          <h2>${t('paymentConfirmation.orderNumber', { orderNumber: order.orderNumber || order._id })}</h2>
          <p>${t('paymentConfirmation.body')}</p>
          
          <h3>${t('paymentConfirmation.paymentDetailsTitle')}</h3>
          <p>
            <strong>${t('paymentConfirmation.transactionHash')}:</strong> ${payment.transactionHash}<br>
            <strong>${t('paymentConfirmation.amount')}:</strong> ${payment.amount} ${payment.cryptocurrency}<br>
            <strong>${t('paymentConfirmation.status')}:</strong> ${payment.status}
          </p>

          <p>${t('paymentConfirmation.processing')}</p>
          <p>${t('paymentConfirmation.notification')}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getShippingNotificationTemplate(order, trackingNumber, language = 'en') {
  const t = i18next.getFixedT(language, 'emails');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3498db; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f4f4f4; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚚 ${t('shippingNotification.title')}</h1>
        </div>
        <div class="content">
          <h2>${t('shippingNotification.orderNumber', { orderNumber: order.orderNumber || order._id })}</h2>
          <p>${t('shippingNotification.body')}</p>
          
          ${trackingNumber ? `
            <h3>${t('shippingNotification.trackingTitle')}</h3>
            <p><strong>${t('shippingNotification.trackingNumber')}:</strong> ${trackingNumber}</p>
          ` : ''}

          <p>${t('shippingNotification.delivery')}</p>
          <p>${t('shippingNotification.closing')}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getAdminAlertTemplate(subject, message, data) {
  const t = i18next.getFixedT('en', 'emails'); // Admin emails always in English
  const dataHtml = Object.keys(data).length > 0 ? `
    <h3>${t('adminAlert.additionalData')}</h3>
    <pre>${JSON.stringify(data, null, 2)}</pre>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e74c3c; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f4f4f4; }
        pre { background: #fff; padding: 10px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ ${t('adminAlert.title')}</h1>
        </div>
        <div class="content">
          <h2>${subject}</h2>
          <p>${message}</p>
          ${dataHtml}
          <p><small>${t('adminAlert.timestamp', { timestamp: new Date().toISOString() })}</small></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Strip HTML tags from string
 * @param {string} html - HTML string
 * @returns {string} - Plain text
 */
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Verify email configuration
 * @returns {Promise<boolean>} - Configuration status
 */
async function verifyEmailConfig() {
  try {
    const emailTransporter = initializeTransporter();
    
    if (!emailTransporter) {
      return false;
    }

    await emailTransporter.verify();
    logger.info('Email configuration verified successfully');
    return true;
  } catch (error) {
    logger.error('Email configuration verification failed:', error);
    return false;
  }
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendPaymentConfirmationEmail,
  sendShippingNotificationEmail,
  sendAdminAlert,
  verifyEmailConfig
};
