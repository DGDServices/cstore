# API Documentation

This directory contains comprehensive API documentation for Cryptons.com, including endpoint references, usage examples, and integration guides.

## 📚 Contents

### API Reference
- **API.md** - Main API documentation
  - Authentication
  - Endpoints overview
  - Request/response formats
  - Error handling

- **API_ENDPOINTS.md** - Detailed endpoint reference
  - Complete endpoint list
  - Request parameters
  - Response schemas
  - Authentication requirements
  - Example requests/responses

### Integration Guides

### Specialized APIs
- **ELASTICSEARCH.md** - Search API integration

## 🎯 Intended Audience

- **Developers**: Integrating with the platform
- **Frontend Developers**: Building user interfaces
- **Third-party Integrations**: External service integration
- **Mobile App Developers**: Mobile application development

## 🚀 Quick Start

### Authentication
All API requests (except public endpoints) require JWT authentication:

```bash
# Login to get token
curl -X POST https://api.cryptons.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Use token in requests
curl -X GET https://api.cryptons.com/api/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Common Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/products` - List products
- `POST /api/orders` - Create order
- `POST /api/payments` - Process payment

## 📖 Recommended Reading Order

1. **API.md** - Start here for API overview
2. **API_ENDPOINTS.md** - Detailed endpoint reference
3. Specific integration guides as needed

## 🔒 Security Considerations

- Always use HTTPS in production
- Store JWT tokens securely
- Implement rate limiting on client side
- Validate all responses
- Handle errors appropriately

## 🔗 Related Documentation

- [Security Documentation](../security/README.md) - API security
- [Authentication Guide](../security/AUTHENTICATION.md) - Authentication details
- [Feature Documentation](../features/README.md) - Feature-specific APIs

---

**API Status**: Version 2.2.0 - Stable for development, production requires security hardening.
