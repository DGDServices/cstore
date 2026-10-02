const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '30d';

// Generate access token.
// `issuedAt` (epoch seconds) lets a caller date the token explicitly; used
// after a revoke-all so the replacement token post-dates the revocation.
const generateToken = (userId, { issuedAt } = {}) => {
  const payload = { id: userId };
  if (issuedAt) payload.iat = issuedAt;
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  });
};

// Generate refresh token
const generateRefreshToken = (userId, { issuedAt } = {}) => {
  const payload = { id: userId };
  if (issuedAt) payload.iat = issuedAt;
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRE,
  });
};

// Verify access token
const verifyToken = token => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Verify refresh token
const verifyRefreshToken = token => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
};
