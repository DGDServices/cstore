# Authentication System Documentation

## Overview

The CStore application implements a comprehensive, production-ready authentication system with JWT (JSON Web Tokens), bcrypt password hashing, and role-based access control (RBAC). The system is built on Node.js, Express, and MongoDB.

## Table of Contents

- [Architecture](#architecture)
- [Components](#components)
- [Security Features](#security-features)
- [Authentication Flow](#authentication-flow)
- [API Endpoints](#api-endpoints)
- [Middleware](#middleware)
- [User Roles](#user-roles)
- [Token Management](#token-management)
- [Best Practices](#best-practices)
- [Testing](#testing)

## Architecture

The authentication system follows a modular architecture with clear separation of concerns:

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP Request (with JWT token)
       ▼
┌─────────────────────────────────┐
│      Express Middleware         │
│  ┌──────────────────────────┐   │
│  │  Security Headers        │   │
│  │  Rate Limiting           │   │
│  │  Input Sanitization      │   │
│  └──────────┬───────────────┘   │
└─────────────┼───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│   Authentication Middleware     │
│  ┌──────────────────────────┐   │
│  │  protect() - Verify JWT  │   │
│  │  authorize() - Check Role│   │
│  └──────────┬───────────────┘   │
└─────────────┼───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│      Route Controllers          │
│  ┌──────────────────────────┐   │
│  │  register()              │   │
│  │  login()                 │   │
│  │  getMe()                 │   │
│  │  updateProfile()         │   │
│  │  updatePassword()        │   │
│  └──────────┬───────────────┘   │
└─────────────┼───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│      Database Layer             │
│  ┌──────────────────────────┐   │
│  │  User Model (Mongoose)   │   │
│  │  - Password Hashing      │   │
│  │  - Validation            │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

## Components

### 1. User Model (`src/models/User.js`)

The User model defines the schema for user data and includes password hashing:

**Schema Fields:**
- `email`: Unique, validated email address
- `password`: Hashed using bcrypt (10 salt rounds)
- `name`: User's display name
- `role`: Either 'user' or 'admin' (default: 'user')
- `isActive`: Account status flag (default: true)
- `walletAddresses`: Array of cryptocurrency wallet addresses
- `resetPasswordToken`: Token for password reset (future feature)
- `resetPasswordExpire`: Expiration for reset token

**Key Features:**
- Pre-save hook that automatically hashes passwords using bcrypt
- `matchPassword()` method for comparing entered password with stored hash
- Password field excluded from queries by default (`select: false`)
- Built-in email validation using regex
- Timestamps (createdAt, updatedAt) automatically managed

### 2. JWT Utilities (`src/utils/jwt.js`)

Handles all JWT token operations:

**Functions:**
- `generateToken(userId)`: Creates access token (default: 7 days expiry)
- `generateRefreshToken(userId)`: Creates refresh token (default: 30 days expiry)
- `verifyToken(token)`: Validates access token and returns decoded payload
- `verifyRefreshToken(token)`: Validates refresh token

**Configuration (Environment Variables):**
- `JWT_SECRET`: Secret key for signing access tokens
- `JWT_EXPIRE`: Access token expiration time
- `JWT_REFRESH_SECRET`: Secret key for signing refresh tokens
- `JWT_REFRESH_EXPIRE`: Refresh token expiration time

### 3. Authentication Controller (`src/controllers/authController.js`)

Handles all authentication-related HTTP requests:

**Endpoints Implemented:**

#### `register(req, res, next)`
- **Route**: `POST /api/auth/register`
- **Access**: Public
- **Validates**: Name, email, password
- **Returns**: User object (without password) and JWT tokens

#### `login(req, res, next)`
- **Route**: `POST /api/auth/login`
- **Access**: Public
- **Validates**: Email and password
- **Returns**: User object and JWT tokens

#### `getMe(req, res, next)`
- **Route**: `GET /api/auth/me`
- **Access**: Private (requires authentication)
- **Returns**: Current user's profile information

#### `updateProfile(req, res, next)`
- **Route**: `PUT /api/auth/profile`
- **Access**: Private
- **Validates**: Name and/or email
- **Returns**: Updated user object

#### `updatePassword(req, res, next)`
- **Route**: `PUT /api/auth/password`
- **Access**: Private
- **Validates**: Current password and new password
- **Returns**: Success message

### 4. Authentication Middleware (`src/middleware/auth.js`)

Provides middleware functions for protecting routes:

#### `protect(req, res, next)`
**Purpose**: Ensures user is authenticated before accessing a route

**Process:**
1. Extracts JWT token from Authorization header (`Bearer <token>`)
2. Verifies token using `verifyToken()`
3. Retrieves user from database using token's user ID
4. Checks if user exists and is active
5. Attaches user object to `req.user`
6. Calls `next()` to proceed to route handler

**Error Cases:**
- No token provided: 401 Unauthorized
- Invalid/expired token: 401 Unauthorized
- User not found or inactive: 401 Unauthorized

#### `authorize(...roles)`
**Purpose**: Restricts route access based on user roles

**Usage Example:**
```javascript
router.delete('/products/:id', protect, authorize('admin'), deleteProduct);
```

**Process:**
1. Checks if `req.user.role` is in the allowed roles array
2. Returns 403 Forbidden if role doesn't match
3. Calls `next()` if authorized

#### `optionalAuth(req, res, next)`
**Purpose**: Attempts to authenticate but doesn't fail if no token

**Use Case**: Routes that behave differently for authenticated vs anonymous users

**Process:**
1. Checks for Authorization header
2. If present, verifies token and attaches user
3. If absent or invalid, continues without user
4. Always calls `next()`

### 5. Validation Schemas (`src/middleware/validation.js`)

Uses Joi for request validation:

**Registration Schema:**
```javascript
{
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required()
}
```

**Login Schema:**
```javascript
{
  email: Joi.string().email().required(),
  password: Joi.string().required()
}
```

### 6. Routes Configuration (`src/routes/authRoutes.js`)

Defines all authentication endpoints:

```javascript
POST   /api/auth/register   - Register new user (with validation)
POST   /api/auth/login      - Login user (with validation)
GET    /api/auth/me         - Get current user (protected)
PUT    /api/auth/profile    - Update profile (protected)
PUT    /api/auth/password   - Update password (protected)
```

## Security Features

### 1. Password Security
- **Bcrypt Hashing**: Uses bcrypt with 10 salt rounds
- **Password Requirements**: Minimum 6 characters
- **No Plain Text Storage**: Passwords never stored in plain text
- **Secure Comparison**: Uses bcrypt's built-in timing-safe comparison

### 2. Token Security
- **JWT Signing**: Tokens signed with secret keys
- **Token Expiration**: Access tokens expire after 7 days (configurable)
- **Refresh Tokens**: Longer-lived tokens for renewing access
- **Stateless Authentication**: No server-side session storage

### 3. Request Security
- **Rate Limiting**: Special rate limiter for auth routes (more restrictive)
- **Input Sanitization**: MongoDB injection prevention
- **XSS Protection**: Input cleaning to prevent XSS attacks
- **HTTP Headers**: Security headers via Helmet
- **CORS**: Configurable cross-origin resource sharing

### 4. Account Security
- **Email Uniqueness**: Prevents duplicate accounts
- **Active Flag**: Soft delete capability (isActive)
- **Email Validation**: Regex pattern matching
- **Case-Insensitive Emails**: Emails stored in lowercase

## Authentication Flow

### Registration Flow

```
1. Client sends POST /api/auth/register
   {
     "name": "John Doe",
     "email": "john@example.com",
     "password": "securepass123"
   }

2. Validation middleware validates input

3. Controller checks if email already exists

4. User document created with hashed password
   (pre-save hook automatically hashes password)

5. JWT tokens generated (access + refresh)

6. Response sent with user data and tokens
   {
     "success": true,
     "data": {
       "user": {
         "id": "...",
         "name": "John Doe",
         "email": "john@example.com",
         "role": "user"
       },
       "token": "eyJhbGc...",
       "refreshToken": "eyJhbGc..."
     }
   }
```

### Login Flow

```
1. Client sends POST /api/auth/login
   {
     "email": "john@example.com",
     "password": "securepass123"
   }

2. Validation middleware validates input

3. Controller finds user by email (includes password)

4. Checks if user exists and is active

5. Compares password using bcrypt
   user.matchPassword(enteredPassword)

6. If valid, generates JWT tokens

7. Response sent with user data and tokens
```

### Protected Route Access Flow

```
1. Client sends request with Authorization header
   GET /api/auth/me
   Authorization: Bearer eyJhbGc...

2. protect() middleware intercepts request

3. Extracts token from header

4. Verifies token signature and expiration

5. Retrieves user from database

6. Checks if user exists and is active

7. Attaches user to req.user

8. Route handler executes with authenticated user
```

### Role-Based Access Flow

```
1. Request reaches protected route with role restriction
   DELETE /api/products/:id
   (protected, admin only)

2. protect() middleware authenticates user

3. authorize('admin') middleware checks role

4. If req.user.role === 'admin', proceeds
   Otherwise, returns 403 Forbidden

5. Route handler executes
```

## API Endpoints

### POST /api/auth/register

Register a new user account.

**Request:**
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepass123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64abc123...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Validation Errors (400):**
```json
{
  "success": false,
  "message": "\"password\" length must be at least 6 characters long"
}
```

**Duplicate Email (400):**
```json
{
  "success": false,
  "message": "User already exists with this email"
}
```

### POST /api/auth/login

Authenticate and receive JWT tokens.

**Request:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepass123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64abc123...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Invalid Credentials (401):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

### GET /api/auth/me

Get current authenticated user's profile.

**Request:**
```http
GET /api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64abc123...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

**Not Authenticated (401):**
```json
{
  "success": false,
  "message": "Not authorized to access this route"
}
```

### PUT /api/auth/profile

Update user profile information.

**Request:**
```http
PUT /api/auth/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "John Updated",
  "email": "newemail@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64abc123...",
      "name": "John Updated",
      "email": "newemail@example.com",
      "role": "user"
    }
  }
}
```

**Email Already Taken (400):**
```json
{
  "success": false,
  "message": "Email already in use"
}
```

### PUT /api/auth/password

Update user password (requires current password).

**Request:**
```http
PUT /api/auth/password
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "currentPassword": "oldpass123",
  "newPassword": "newpass123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

**Wrong Current Password (401):**
```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```

## Middleware

### Using Authentication Middleware

#### Protect a Route (Authentication Required)

```javascript
const { protect } = require('../middleware/auth');

// Only authenticated users can access
router.get('/profile', protect, getProfile);
```

#### Protect with Role Authorization

```javascript
const { protect, authorize } = require('../middleware/auth');

// Only authenticated admins can access
router.delete('/users/:id', protect, authorize('admin'), deleteUser);

// Multiple roles allowed
router.put('/products/:id', protect, authorize('admin', 'moderator'), updateProduct);
```

#### Optional Authentication

```javascript
const { optionalAuth } = require('../middleware/auth');

// Works for both authenticated and anonymous users
// but provides user context if authenticated
router.get('/products', optionalAuth, getProducts);

// In controller:
function getProducts(req, res) {
  // req.user will be present if authenticated
  // or undefined if anonymous
  if (req.user) {
    // Show personalized content
  } else {
    // Show public content
  }
}
```

## User Roles

### Available Roles

1. **user** (default)
   - Can register and login
   - Can view products
   - Can create orders
   - Can view own orders
   - Can update own profile
   
2. **admin**
   - All user permissions
   - Can create products
   - Can update products
   - Can delete products
   - Can view all orders
   - Can update order status
   - Can view all payments

### Setting Admin Role

Admin roles must be set directly in the database or through a seeding script:

```javascript
// In MongoDB shell or seed script
db.users.updateOne(
  { email: 'admin@example.com' },
  { $set: { role: 'admin' } }
);
```

Or using Mongoose:

```javascript
const user = await User.findOne({ email: 'admin@example.com' });
user.role = 'admin';
await user.save();
```

## Token Management

### Token Structure

JWT tokens contain:
```javascript
{
  "id": "64abc123...",  // User's MongoDB _id
  "iat": 1641024000,    // Issued at (timestamp)
  "exp": 1641628800     // Expiration (timestamp)
}
```

### Using Tokens in Client Applications

#### JavaScript (Fetch API)

```javascript
// Store token after login
const { token } = response.data;
localStorage.setItem('authToken', token);

// Use token in requests
fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
  }
})
```

#### Axios

```javascript
// Set default header
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// Or per-request
axios.get('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

#### cURL

```bash
curl -H "Authorization: Bearer eyJhbGc..." http://localhost:3000/api/auth/me
```

### Token Refresh (Future Implementation)

The system has refresh tokens but the refresh endpoint needs implementation:

```javascript
// TODO: Implement token refresh endpoint
POST /api/auth/refresh
{
  "refreshToken": "eyJhbGc..."
}
```

## Best Practices

### For Developers

1. **Never log passwords or tokens**
   ```javascript
   // Bad
   console.log('User login:', req.body);
   
   // Good
   logger.info(`User logged in: ${user.email}`);
   ```

2. **Use environment variables for secrets**
   ```javascript
   // .env file (never commit to git)
   JWT_SECRET=your-super-secret-key-here
   JWT_REFRESH_SECRET=another-super-secret-key
   ```

3. **Always use protect middleware for sensitive routes**
   ```javascript
   // Good
   router.get('/my-orders', protect, getMyOrders);
   
   // Bad - exposes sensitive data
   router.get('/my-orders', getMyOrders);
   ```

4. **Validate user permissions in controllers**
   ```javascript
   // Even with middleware, verify user owns resource
   const order = await Order.findById(orderId);
   if (order.userId.toString() !== req.user.id && req.user.role !== 'admin') {
     return next(new AppError('Not authorized', 403));
   }
   ```

5. **Handle errors consistently**
   ```javascript
   // Use AppError for operational errors
   if (!user) {
     return next(new AppError('User not found', 404));
   }
   ```

### For Production Deployment

1. **Use strong JWT secrets**
   - Generate using: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
   - Different secrets for access and refresh tokens
   - Store in secure environment variables

2. **Configure appropriate token expiration**
   ```env
   JWT_EXPIRE=15m          # Short-lived access tokens
   JWT_REFRESH_EXPIRE=7d   # Longer refresh tokens
   ```

3. **Enable HTTPS**
   - Never transmit tokens over HTTP in production
   - Use SSL/TLS certificates

4. **Configure rate limiting**
   ```javascript
   // Stricter limits for auth routes
   authLimiter: 5 requests per 15 minutes
   ```

5. **Monitor for suspicious activity**
   - Log failed login attempts
   - Track unusual access patterns
   - Implement account lockout after repeated failures

6. **Regular security updates**
   - Keep dependencies updated
   - Monitor security advisories
   - Scan for vulnerabilities regularly

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Test Suite Coverage

The authentication system has comprehensive test coverage:

**Registration Tests:**
- ✅ Successfully register new user
- ✅ Prevent duplicate email registration
- ✅ Validate required fields
- ✅ Validate email format
- ✅ Validate password length

**Login Tests:**
- ✅ Login with correct credentials
- ✅ Reject incorrect password
- ✅ Reject non-existent email
- ✅ Return JWT tokens on success

**Protected Routes Tests:**
- ✅ Access with valid token
- ✅ Reject access without token
- ✅ Reject access with invalid token
- ✅ Reject access with expired token

**Authorization Tests:**
- ✅ Admin can access admin routes
- ✅ Regular user cannot access admin routes
- ✅ Proper 403 response for unauthorized role

### Example Test

```javascript
describe('Authentication', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('test@example.com');
    expect(res.body.data.user.password).toBeUndefined();
  });
});
```

## Troubleshooting

### Common Issues

**Issue: "Not authorized to access this route"**
- Check if token is included in Authorization header
- Verify token format: `Bearer <token>`
- Check if token has expired
- Ensure user account is active

**Issue: "Invalid credentials"**
- Verify email and password are correct
- Check if account exists
- Ensure password meets requirements

**Issue: "User already exists with this email"**
- Email addresses must be unique
- Use login endpoint instead
- Or use password reset if forgotten

**Issue: Token expiration**
- Access tokens expire after configured time
- Use refresh token to get new access token
- Re-login if both tokens expired

## Security Considerations

### Vulnerabilities Mitigated

1. **SQL/NoSQL Injection**: Input sanitization middleware
2. **XSS Attacks**: Input cleaning and output encoding
3. **Brute Force**: Rate limiting on auth endpoints
4. **Password Exposure**: Bcrypt hashing, never return passwords
5. **Session Hijacking**: Stateless JWT tokens
6. **CSRF**: Token-based authentication
7. **Timing Attacks**: Bcrypt's timing-safe comparison

### Known Limitations

1. **No token revocation**: JWTs are stateless, can't be revoked before expiry
   - Mitigation: Short token expiration times
   - Future: Implement token blacklist

2. **No password reset**: Endpoint exists but not fully implemented
   - Future: Email-based password reset flow

3. **No 2FA/MFA**: Two-factor authentication not implemented
   - Future: Add TOTP-based 2FA

4. **No refresh endpoint**: Refresh tokens generated but no endpoint
   - Future: Implement refresh token rotation

## Conclusion

The CStore authentication system provides a robust, secure foundation for user management and access control. It follows industry best practices and includes all essential features for a production-ready application:

- ✅ Secure password hashing with bcrypt
- ✅ JWT-based stateless authentication
- ✅ Role-based access control
- ✅ Comprehensive input validation
- ✅ Security middleware (rate limiting, sanitization)
- ✅ Proper error handling
- ✅ MongoDB integration
- ✅ Test coverage
- ✅ Production-ready configuration

For questions or issues, please refer to the main README.md or create an issue in the repository.
