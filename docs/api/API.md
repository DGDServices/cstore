# Cryptons.com API Documentation

Complete API documentation for the Cryptons.com Professional Cryptocurrency Trading Platform.

## Base URL
```
http://localhost:3000/api
```

For production:
```
https://your-domain.com/api
```

## Quick Start

1. Register a user account
2. Login to get your JWT token
3. Use the token in Authorization header for protected endpoints
4. Browse products and create orders
5. Confirm payments with transaction hash

## Table of Contents

- [Authentication](#authentication)
- [Response Format](#response-format)
- [Authentication Endpoints](#authentication-endpoints)
- [Product Endpoints](#product-endpoints)
- [Order Endpoints](#order-endpoints)
- [Payment Endpoints](#payment-endpoints)
- [Cryptocurrency Endpoints](#cryptocurrency-endpoints)
- [Health Check](#health-check)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)

See the full documentation in this file for all endpoint details.

## Authentication

Include JWT token in Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Default Admin Credentials

For testing (change immediately in production):
- Email: `admin@cryptons.com`
- Password: `admin123`

---

For complete endpoint documentation, security information, and examples, please refer to the full API documentation above.