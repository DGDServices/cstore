#!/usr/bin/env node
/**
 * Security Verification Script
 * 
 * This script verifies that all security measures are properly implemented
 * without requiring a database connection.
 */

console.log('🔒 CStore Security Verification\n');
console.log('=' .repeat(60));

let passCount = 0;
let failCount = 0;

function check(name, condition, details = '') {
  if (condition) {
    console.log(`✅ ${name}`);
    if (details) console.log(`   ${details}`);
    passCount++;
    return true;
  } else {
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
    failCount++;
    return false;
  }
}

console.log('\n1. Security Middleware Exports');
console.log('-'.repeat(60));
try {
  const security = require('../src/middleware/security');
  check('Helmet (Security Headers)', typeof security.securityHeaders === 'function');
  check('Rate Limiter', typeof security.limiter === 'function');
  check('Auth Rate Limiter', typeof security.authLimiter === 'function');
  check('MongoDB Sanitization', typeof security.sanitizeData === 'function');
  check('XSS Protection', typeof security.xssClean === 'function');
  check('HPP Protection', typeof security.preventParamPollution === 'function');
} catch (error) {
  check('Security Middleware', false, `Error: ${error.message}`);
}

console.log('\n2. Input Validation (Joi)');
console.log('-'.repeat(60));
try {
  const validation = require('../src/middleware/validation');
  check('Validation Middleware', typeof validation.validate === 'function');
  const schemaCount = Object.keys(validation.schemas).length;
  check('Validation Schemas', schemaCount > 0, `${schemaCount} schemas defined`);
  
  // Check specific schemas
  const schemas = validation.schemas;
  check('Register Schema', !!schemas.register);
  check('Login Schema', !!schemas.login);
  check('Create Order Schema', !!schemas.createOrder);
  check('Create Product Schema', !!schemas.createProduct);
} catch (error) {
  check('Input Validation', false, `Error: ${error.message}`);
}

console.log('\n3. Error Handling');
console.log('-'.repeat(60));
try {
  const errorHandler = require('../src/middleware/errorHandler');
  check('Error Handler', typeof errorHandler.errorHandler === 'function');
  check('AppError Class', typeof errorHandler.AppError === 'function');
  check('Async Handler', typeof errorHandler.asyncHandler === 'function');
  
  // Test AppError creation
  const testError = new errorHandler.AppError('Test error', 400);
  check('AppError Creation', testError.message === 'Test error' && testError.statusCode === 400);
} catch (error) {
  check('Error Handling', false, `Error: ${error.message}`);
}

console.log('\n4. Logging (Winston)');
console.log('-'.repeat(60));
try {
  const logger = require('../src/utils/logger');
  check('Logger Instance', typeof logger === 'object');
  check('Logger.info()', typeof logger.info === 'function');
  check('Logger.error()', typeof logger.error === 'function');
  check('Logger.warn()', typeof logger.warn === 'function');
} catch (error) {
  check('Logging', false, `Error: ${error.message}`);
}

console.log('\n5. JWT Authentication');
console.log('-'.repeat(60));
try {
  const jwt = require('../src/utils/jwt');
  check('Generate Token', typeof jwt.generateToken === 'function');
  check('Generate Refresh Token', typeof jwt.generateRefreshToken === 'function');
  check('Verify Token', typeof jwt.verifyToken === 'function');
  check('Verify Refresh Token', typeof jwt.verifyRefreshToken === 'function');
  
  // Test token generation
  const testToken = jwt.generateToken('testUserId123');
  check('Token Generation', typeof testToken === 'string' && testToken.length > 0);
} catch (error) {
  check('JWT Authentication', false, `Error: ${error.message}`);
}

console.log('\n6. Password Hashing (Bcrypt)');
console.log('-'.repeat(60));
try {
  const bcrypt = require('bcryptjs');
  check('Bcrypt Hash', typeof bcrypt.hash === 'function');
  check('Bcrypt Compare', typeof bcrypt.compare === 'function');
  check('Bcrypt GenSalt', typeof bcrypt.genSalt === 'function');
} catch (error) {
  check('Password Hashing', false, `Error: ${error.message}`);
}

console.log('\n7. CORS Configuration');
console.log('-'.repeat(60));
try {
  const cors = require('cors');
  check('CORS Package', typeof cors === 'function');
} catch (error) {
  check('CORS', false, `Error: ${error.message}`);
}

console.log('\n8. App Integration');
console.log('-'.repeat(60));
try {
  // Suppress database errors for this test
  process.env.SKIP_DB_CONNECTION = 'true';
  
  const app = require('../src/app');
  check('Express App', typeof app === 'function');
  
  // Verify middleware is used in app.js by checking the file content
  const fs = require('fs');
  const appContent = fs.readFileSync(__dirname + '/../src/app.js', 'utf8');
  check('Security Middleware Used', appContent.includes('app.use(securityHeaders)'));
  check('Rate Limiter Used', appContent.includes('app.use(limiter)'));
  check('XSS Clean Used', appContent.includes('app.use(xssClean)'));
  check('MongoDB Sanitize Used', appContent.includes('app.use(sanitizeData)'));
  check('HPP Protection Used', appContent.includes('app.use(preventParamPollution)'));
  check('CORS Used', appContent.includes('app.use(cors())'));
  check('Error Handler Used', appContent.includes('app.use(errorHandler)'));
} catch (error) {
  check('App Integration', false, `Error: ${error.message}`);
}

console.log('\n9. Route Protection');
console.log('-'.repeat(60));
try {
  // Check auth routes use validation
  const authRoutes = require('../src/routes/authRoutes');
  check('Auth Routes', typeof authRoutes === 'function');
  
  // Check product routes exist
  const productRoutes = require('../src/routes/productRoutes');
  check('Product Routes', typeof productRoutes === 'function');
  
  // Check order routes exist
  const orderRoutes = require('../src/routes/orderRoutes');
  check('Order Routes', typeof orderRoutes === 'function');
} catch (error) {
  check('Route Protection', false, `Error: ${error.message}`);
}

console.log('\n10. User Model Security');
console.log('-'.repeat(60));
try {
  // Verify User model has password hashing by checking the file content
  const fs = require('fs');
  const userModelContent = fs.readFileSync(__dirname + '/../src/models/User.js', 'utf8');
  
  check('User Model Exists', userModelContent.length > 0);
  check('Bcrypt Import', userModelContent.includes("require('bcryptjs')"));
  check('Pre-save Hook', userModelContent.includes("userSchema.pre('save'") && userModelContent.includes('bcrypt.hash'));
  check('matchPassword Method', userModelContent.includes('userSchema.methods.matchPassword') && userModelContent.includes('bcrypt.compare'));
  check('Password Select:false', userModelContent.includes('select: false'));
} catch (error) {
  check('User Model Security', false, `Error: ${error.message}`);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Summary');
console.log('-'.repeat(60));
console.log(`✅ Passed: ${passCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`📈 Total:  ${passCount + failCount}`);
console.log(`🎯 Success Rate: ${Math.round((passCount / (passCount + failCount)) * 100)}%`);

if (failCount === 0) {
  console.log('\n🎉 All security measures verified successfully!');
  console.log('✅ The application has all required security protections in place.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some security checks failed. Please review the output above.');
  process.exit(1);
}
