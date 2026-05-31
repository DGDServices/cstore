const winston = require('winston');
const path = require('path');

// Create dedicated audit logger
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'cryptons-audit' },
  transports: [
    // Audit logs file
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/audit.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 20, // Keep 20 files (200MB total)
    }),
    // Console output in development
    ...(process.env.NODE_ENV === 'development' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ]
});

/**
 * Audit event types
 */
const AUDIT_EVENTS = {
  // Authentication
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_REGISTER: 'user.register',
  PASSWORD_CHANGE: 'user.password_change',
  TOKEN_REVOKED: 'auth.token_revoked',
  
  // Authorization
  ACCESS_DENIED: 'auth.access_denied',
  UNAUTHORIZED_ATTEMPT: 'auth.unauthorized_attempt',
  
  // User Management
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_ROLE_CHANGED: 'user.role_changed',
  
  // Orders & Payments
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_CANCELLED: 'order.cancelled',
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_CONFIRMED: 'payment.confirmed',
  PAYMENT_FAILED: 'payment.failed',
  
  // Admin Actions
  ADMIN_ACTION: 'admin.action',
  CONFIG_CHANGED: 'admin.config_changed',
  PRODUCT_UPDATED: 'admin.product_updated',
  
  // Security
  SUSPICIOUS_ACTIVITY: 'security.suspicious_activity',
  RATE_LIMIT_EXCEEDED: 'security.rate_limit_exceeded',
  WEBHOOK_FAILED: 'security.webhook_failed',
  ENCRYPTION_ERROR: 'security.encryption_error',
  
  // Multi-sig Wallet
  MULTISIG_CREATED: 'multisig.created',
  MULTISIG_TRANSACTION: 'multisig.transaction',
  MULTISIG_APPROVAL: 'multisig.approval',
  MULTISIG_EXECUTION: 'multisig.execution'
};

/**
 * Log audit event
 * @param {string} event - Event type from AUDIT_EVENTS
 * @param {Object} data - Event data
 */
const logAuditEvent = (event, data) => {
  const auditEntry = {
    event,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  auditLogger.info(auditEntry);
};

/**
 * Log user authentication event
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @param {string} action - Action (login, logout, register)
 * @param {Object} metadata - Additional metadata (IP, user agent, etc.)
 */
const logAuthEvent = (userId, email, action, metadata = {}) => {
  logAuditEvent(AUDIT_EVENTS[`USER_${action.toUpperCase()}`], {
    userId,
    email,
    action,
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    success: metadata.success !== false
  });
};

/**
 * Log admin action
 * @param {string} adminId - Admin user ID
 * @param {string} action - Action performed
 * @param {Object} target - Target of the action
 * @param {Object} metadata - Additional metadata
 */
const logAdminAction = (adminId, action, target = {}, metadata = {}) => {
  logAuditEvent(AUDIT_EVENTS.ADMIN_ACTION, {
    adminId,
    action,
    target,
    ip: metadata.ip,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

/**
 * Log security event
 * @param {string} event - Event type
 * @param {Object} data - Event data
 */
const logSecurityEvent = (event, data) => {
  logAuditEvent(event, {
    severity: data.severity || 'medium',
    ...data
  });
};

/**
 * Log payment event
 * @param {string} orderId - Order ID
 * @param {string} paymentId - Payment ID
 * @param {string} action - Action (initiated, confirmed, failed)
 * @param {Object} metadata - Additional metadata
 */
const logPaymentEvent = (orderId, paymentId, action, metadata = {}) => {
  logAuditEvent(AUDIT_EVENTS[`PAYMENT_${action.toUpperCase()}`], {
    orderId,
    paymentId,
    action,
    amount: metadata.amount,
    currency: metadata.currency,
    status: metadata.status,
    ...metadata
  });
};

/**
 * Log multi-sig wallet event
 * @param {string} walletId - Wallet ID
 * @param {string} action - Action type
 * @param {Object} data - Event data
 */
const logMultiSigEvent = (walletId, action, data = {}) => {
  logAuditEvent(AUDIT_EVENTS[`MULTISIG_${action.toUpperCase()}`], {
    walletId,
    action,
    userId: data.userId,
    transactionId: data.transactionId,
    ...data
  });
};

/**
 * Log unauthorized access attempt
 * @param {Object} req - Express request object
 * @param {string} reason - Reason for denial
 */
const logUnauthorizedAttempt = (req, reason) => {
  logSecurityEvent(AUDIT_EVENTS.UNAUTHORIZED_ATTEMPT, {
    severity: 'high',
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    reason,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log rate limit exceeded
 * @param {Object} req - Express request object
 */
const logRateLimitExceeded = (req) => {
  logSecurityEvent(AUDIT_EVENTS.RATE_LIMIT_EXCEEDED, {
    severity: 'medium',
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  AUDIT_EVENTS,
  logAuditEvent,
  logAuthEvent,
  logAdminAction,
  logSecurityEvent,
  logPaymentEvent,
  logMultiSigEvent,
  logUnauthorizedAttempt,
  logRateLimitExceeded,
  auditLogger
};
