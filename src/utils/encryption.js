const crypto = require('crypto');
const logger = require('./logger');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Get encryption key from environment
 * In production, this should come from a secure key management system
 */
const getEncryptionKey = () => {
  const key = process.env.FIELD_ENCRYPTION_KEY;
  
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FIELD_ENCRYPTION_KEY must be set in production');
    }
    // Use a default key for development (NOT FOR PRODUCTION!)
    logger.warn('Using default encryption key - DO NOT USE IN PRODUCTION');
    return crypto.scryptSync('development-key-not-for-production', 'salt', 32);
  }
  
  // Convert hex key to buffer
  return Buffer.from(key, 'hex');
};

/**
 * Encrypt sensitive data
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text in hex format
 */
const encrypt = (text) => {
  try {
    if (!text) {
      return text;
    }

    // Convert text to string if it isn't already
    const textString = typeof text === 'string' ? text : JSON.stringify(text);

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive key from master key and salt
    const key = getEncryptionKey();
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt
    let encrypted = cipher.update(textString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag
    const tag = cipher.getAuthTag();
    
    // Combine salt + iv + tag + encrypted data
    const result = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, 'hex')
    ]);
    
    return result.toString('hex');
  } catch (error) {
    logger.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt sensitive data
 * @param {string} encryptedHex - Encrypted text in hex format
 * @returns {string} - Decrypted plain text
 */
const decrypt = (encryptedHex) => {
  try {
    if (!encryptedHex) {
      return encryptedHex;
    }

    // Convert hex to buffer
    const data = Buffer.from(encryptedHex, 'hex');
    
    // Extract components
    // Salt is not used for decryption with AES-GCM, but stored for future compatibility
    // const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = data.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = data.subarray(ENCRYPTED_POSITION);
    
    // Derive key
    const key = getEncryptionKey();
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Hash sensitive data (one-way, for comparison only)
 * @param {string} text - Text to hash
 * @returns {string} - Hashed text
 */
const hash = (text) => {
  try {
    if (!text) {
      return text;
    }

    const textString = typeof text === 'string' ? text : JSON.stringify(text);
    return crypto.createHash('sha256').update(textString).digest('hex');
  } catch (error) {
    logger.error('Hashing error:', error);
    throw new Error('Failed to hash data');
  }
};

/**
 * Generate a secure random encryption key
 * Use this to generate FIELD_ENCRYPTION_KEY
 * @returns {string} - 64-character hex string (32 bytes)
 */
const generateEncryptionKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Encrypt object fields selectively
 * @param {Object} obj - Object with fields to encrypt
 * @param {Array<string>} fields - Array of field names to encrypt
 * @returns {Object} - Object with encrypted fields
 */
const encryptFields = (obj, fields) => {
  const encrypted = { ...obj };
  
  fields.forEach(field => {
    if (encrypted[field]) {
      encrypted[field] = encrypt(encrypted[field]);
    }
  });
  
  return encrypted;
};

/**
 * Decrypt object fields selectively
 * @param {Object} obj - Object with encrypted fields
 * @param {Array<string>} fields - Array of field names to decrypt
 * @returns {Object} - Object with decrypted fields
 */
const decryptFields = (obj, fields) => {
  const decrypted = { ...obj };
  
  fields.forEach(field => {
    if (decrypted[field]) {
      try {
        decrypted[field] = decrypt(decrypted[field]);
      } catch (error) {
        logger.warn(`Failed to decrypt field ${field}:`, error.message);
        // Leave encrypted if decryption fails
      }
    }
  });
  
  return decrypted;
};

/**
 * Check if encryption is properly configured
 * @returns {boolean} - True if encryption is available
 */
const isEncryptionAvailable = () => {
  try {
    getEncryptionKey();
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  encrypt,
  decrypt,
  hash,
  generateEncryptionKey,
  encryptFields,
  decryptFields,
  isEncryptionAvailable
};
