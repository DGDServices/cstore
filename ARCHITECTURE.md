# Technical Architecture

**System architecture and technical design documentation for Cryptons.com**

**Version:** 2.2.0 | **Last Updated:** April 2026

---

## 📋 Table of Contents

- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [API Architecture](#-api-architecture)
- [Database Design](#-database-design)
- [Security Architecture](#-security-architecture)
- [Blockchain Integration](#-blockchain-integration)
- [Scalability & Performance](#-scalability--performance)
- [Development Workflow](#-development-workflow)

---

## 🎯 Overview

Cryptons.com is a full-stack cryptocurrency e-commerce platform built on a modern, scalable architecture using Node.js, Express, and MongoDB. The system follows RESTful API principles, implements microservices patterns where appropriate, and prioritizes security and scalability.

### Design Principles

1. **Security First**: All components designed with security as primary concern
2. **Scalability**: Horizontal scaling capabilities built-in
3. **Maintainability**: Clean code, modular design, comprehensive documentation
4. **Performance**: Caching, query optimization, efficient data structures
5. **Reliability**: Error handling, logging, monitoring, health checks

### Key Characteristics

- **Stateless API**: JWT-based authentication for horizontal scaling
- **Event-Driven**: Webhook support for blockchain events
- **Async Processing**: Background jobs for long-running operations
- **Caching Layer**: Redis for session and data caching
- **Search Engine**: Elasticsearch for advanced product search

---

## 🏗 System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
├─────────────────────────┬───────────────────────────────────┤
│   Web Application       │     Admin Dashboard (React)       │
│   (User-facing)         │     (Management Interface)        │
└──────────┬──────────────┴─────────────────┬─────────────────┘
           │                                 │
           └────────────┬───────────────────┘
                        │
                   ┌────▼─────┐
                   │   CDN    │ (Static Assets)
                   └────┬─────┘
                        │
           ┌────────────▼─────────────┐
           │    Load Balancer/Proxy    │
           │    (NGINX/AWS ALB)        │
           └────────────┬──────────────┘
                        │
        ┌───────────────┼────────────────┐
        │               │                │
   ┌────▼────┐    ┌────▼────┐    ┌─────▼────┐
   │ API     │    │ API     │    │  API     │
   │ Server 1│    │ Server 2│    │ Server N │
   └────┬────┘    └────┬────┘    └─────┬────┘
        │              │               │
        └──────────────┼───────────────┘
                       │
        ┌──────────────┼──────────────────────┐
        │              │                      │
   ┌────▼─────┐  ┌────▼──────┐   ┌──────────▼─────┐
   │ MongoDB  │  │  Redis    │   │ Elasticsearch  │
   │ (Primary)│  │  (Cache)  │   │   (Search)     │
   └────┬─────┘  └───────────┘   └────────────────┘
        │
   ┌────▼─────────┐
   │   MongoDB    │
   │  (Replicas)  │
   └──────────────┘

External Services:
├── Bitcoin Core RPC
├── Lightning Network Node
├── Email Service (SMTP)
├── Payment Processors
└── KYC/AML Providers
```

### Component Breakdown

#### 1. API Layer (Express.js)
- **Request handling** with middleware chain
- **Authentication & Authorization** via JWT
- **Input validation** and sanitization
- **Rate limiting** and security headers
- **Error handling** and logging

#### 2. Business Logic Layer
- **Service modules** for core functionality
- **Domain models** with Mongoose schemas
- **Business rules** and validation logic
- **Transaction management**
- **Event emission** for async processing

#### 3. Data Layer
- **MongoDB** for persistent storage
- **Redis** for caching and sessions
- **Elasticsearch** for search indexing
- **File storage** for media assets

#### 4. Integration Layer
- **Blockchain integrations** (Bitcoin, Lightning)
- **Payment processors**
- **Email services**
- **Third-party APIs** (KYC, exchange rates)

---

## 🔧 Technology Stack

### Backend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Node.js 16+ | JavaScript runtime |
| **Framework** | Express.js 4.x | Web application framework |
| **Database** | MongoDB 4.4+ | Primary data store |
| **Cache** | Redis 7.x | Session storage, caching |
| **Search** | Elasticsearch 8.x | Full-text search engine |
| **Authentication** | JWT + bcrypt | Token-based auth, password hashing |
| **Validation** | Joi | Request validation |
| **Logging** | Winston | Application logging |
| **Testing** | Jest + Supertest | Unit and integration testing |

### Frontend (Admin Dashboard)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | React 19 | UI library |
| **Language** | TypeScript | Type-safe JavaScript |
| **UI Library** | Material-UI v6 | Component library |
| **State Management** | Redux Toolkit | Global state |
| **Routing** | React Router v6 | Client-side routing |
| **Charts** | Recharts | Data visualization |
| **Build Tool** | Vite | Fast build tooling |

### Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Containerization** | Docker | Application containers |
| **Orchestration** | Kubernetes | Container orchestration |
| **CI/CD** | GitHub Actions | Automated pipelines |
| **Monitoring** | Prometheus + Grafana | Metrics and dashboards |
| **Reverse Proxy** | NGINX | Load balancing, SSL termination |

### Security

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **HTTP Security** | Helmet.js | Security headers |
| **Rate Limiting** | express-rate-limit | DDoS protection |
| **CORS** | cors middleware | Cross-origin control |
| **Input Sanitization** | express-validator | XSS prevention |
| **Secrets Management** | dotenv (dev), Vault (prod) | Environment variables |

---

## 🌐 API Architecture

### RESTful API Design

**Base URL**: `https://api.cryptons.com/api`

**API Versioning**: Implicit v1 (future: `/api/v2/`)

#### Resource Structure

```
/api
├── /auth
│   ├── POST /register        # User registration
│   ├── POST /login           # User login
│   └── GET /profile          # Get user profile
│
├── /products
│   ├── GET /                 # List products
│   ├── GET /:id              # Get product
│   ├── POST /                # Create product (admin)
│   ├── PUT /:id              # Update product (admin)
│   └── DELETE /:id           # Delete product (admin)
│
├── /orders
│   ├── GET /                 # List user orders
│   ├── GET /:id              # Get order details
│   ├── POST /                # Create order
│   └── PUT /:id/status       # Update status (admin)
│
├── /cart
│   ├── GET /                 # Get cart
│   ├── POST /items           # Add item
│   ├── PUT /items/:id        # Update item
│   └── DELETE /items/:id     # Remove item
│
├── /reviews
│   ├── GET /product/:id      # Get product reviews
│   ├── POST /                # Create review
│   └── DELETE /:id           # Delete review
│
└── /admin
    ├── GET /stats            # Dashboard statistics
    ├── GET /analytics        # Analytics data
    └── GET /health           # System health
```

### Request/Response Format

**Request Headers**:
```http
Content-Type: application/json
Authorization: Bearer <jwt-token>
Accept: application/json
```

**Success Response**:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

### Middleware Chain

```javascript
Request
  ↓
[1. CORS] → Handles cross-origin requests
  ↓
[2. Helmet] → Sets security headers
  ↓
[3. Rate Limiting] → Prevents abuse
  ↓
[4. Body Parser] → Parses JSON body
  ↓
[5. Authentication] → Validates JWT token
  ↓
[6. Authorization] → Checks user permissions
  ↓
[7. Validation] → Validates request data
  ↓
[8. Route Handler] → Executes business logic
  ↓
[9. Error Handler] → Catches and formats errors
  ↓
Response
```

### Authentication Flow

```
1. User Registration/Login
   ↓
2. Server validates credentials
   ↓
3. Server generates JWT token
   ↓
4. Client stores token (localStorage/cookie)
   ↓
5. Client sends token in Authorization header
   ↓
6. Server validates token on each request
   ↓
7. Server extracts user info from token
   ↓
8. Request proceeds with authenticated context
```

**JWT Payload**:
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "role": "user",
  "iat": 1634567890,
  "exp": 1634654290
}
```

---

## 🗄 Database Design

### MongoDB Schema Design

#### Core Collections

**1. Users Collection**
```javascript
{
  _id: ObjectId,
  username: String (unique, indexed),
  email: String (unique, indexed),
  password: String (bcrypt hashed),
  role: String (enum: ['user', 'admin']),
  profile: {
    firstName: String,
    lastName: String,
    phone: String,
    address: Object
  },
  createdAt: Date,
  updatedAt: Date
}
```

**2. Products Collection**
```javascript
{
  _id: ObjectId,
  name: String (indexed),
  description: String,
  price: Number,
  priceInCrypto: {
    BTC: Number,
    LTC: Number,
    XRP: Number
  },
  category: ObjectId (ref: Category),
  stock: Number,
  images: [String],
  sku: String (unique, indexed),
  ratings: {
    average: Number,
    count: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

**3. Orders Collection**
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, indexed),
  orderNumber: String (unique, indexed),
  items: [{
    productId: ObjectId (ref: Product),
    quantity: Number,
    price: Number,
    cryptocurrency: String
  }],
  totalAmount: Number,
  cryptocurrency: String,
  status: String (enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  paymentStatus: String,
  transactionHash: String,
  shippingAddress: Object,
  createdAt: Date (indexed),
  updatedAt: Date
}
```

**4. Cart Collection**
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, unique, indexed),
  items: [{
    productId: ObjectId (ref: Product),
    quantity: Number,
    addedAt: Date
  }],
  updatedAt: Date
}
```

**5. Reviews Collection**
```javascript
{
  _id: ObjectId,
  productId: ObjectId (ref: Product, indexed),
  userId: ObjectId (ref: User, indexed),
  rating: Number (1-5),
  comment: String,
  approved: Boolean (default: false),
  helpfulVotes: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Indexing Strategy

**Performance Indexes**:
- `users.email` - Unique index for login
- `users.username` - Unique index for username lookup
- `products.name` - Text index for search
- `products.category` - Compound index with price
- `orders.userId` - Index for user's orders
- `orders.createdAt` - Index for date-based queries
- `reviews.productId` - Index for product reviews

**Compound Indexes**:
```javascript
products.index({ category: 1, price: 1 });
orders.index({ userId: 1, createdAt: -1 });
reviews.index({ productId: 1, approved: 1 });
```

### Data Relationships

```
User (1) ──── (N) Orders
User (1) ──── (1) Cart
User (1) ──── (N) Reviews

Product (1) ──── (N) OrderItems
Product (1) ──── (N) CartItems
Product (1) ──── (N) Reviews
Product (N) ──── (1) Category

Order (1) ──── (N) OrderItems
```

---

## 🔒 Security Architecture

### Multi-Layer Security

```
[1. Network Layer]
    ├── DDoS Protection (Cloudflare/AWS Shield)
    ├── WAF (Web Application Firewall)
    └── Rate Limiting

[2. Transport Layer]
    ├── TLS 1.3 encryption
    ├── SSL certificate management
    └── HSTS enforcement

[3. Application Layer]
    ├── JWT authentication
    ├── Role-based access control (RBAC)
    ├── Input validation (Joi)
    ├── SQL injection prevention (MongoDB parameterization)
    ├── XSS protection (sanitization)
    ├── CSRF protection
    └── Security headers (Helmet.js)

[4. Data Layer]
    ├── Password hashing (bcrypt)
    ├── Database encryption at rest
    ├── Sensitive data masking
    └── Audit logging
```

### Authentication & Authorization

**JWT Token Structure**:
```
Header:     { alg: "HS256", typ: "JWT" }
Payload:    { userId, email, role, iat, exp }
Signature:  HMACSHA256(base64UrlEncode(header) + "." + 
                       base64UrlEncode(payload), secret)
```

**Authorization Middleware**:
```javascript
// Protect route - require authentication
router.use(authenticate);

// Require admin role
router.use(authorize(['admin']));

// Require specific permissions
router.use(requirePermission('products:write'));
```

### Security Headers (Helmet.js)

```javascript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
})
```

### Rate Limiting Strategy

```javascript
// Global rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per window
}));

// Stricter for authentication endpoints
authRouter.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5 // 5 login attempts per window
}));
```

---

## ⛓ Blockchain Integration

### Bitcoin Core RPC Integration

```
Application
    ↓
[Bitcoin RPC Client]
    ↓ (JSON-RPC over HTTP)
[Bitcoin Core Node]
    ↓
Bitcoin Network
```

**Key Operations**:
- `getnewaddress()` - Generate payment addresses
- `getreceivedbyaddress()` - Check payment received
- `sendtoaddress()` - Send Bitcoin payments
- `gettransaction()` - Verify transactions

**Implementation**:
```javascript
const bitcoin = require('bitcoin-core');

const client = new bitcoin({
  network: 'mainnet',
  host: process.env.BITCOIN_RPC_HOST,
  port: process.env.BITCOIN_RPC_PORT,
  username: process.env.BITCOIN_RPC_USER,
  password: process.env.BITCOIN_RPC_PASS
});

// Generate address for order
const address = await client.getNewAddress('order_' + orderId);
```

### Lightning Network Integration

```
Application
    ↓
[LND gRPC Client]
    ↓ (gRPC)
[Lightning Network Daemon (LND)]
    ↓
Lightning Network
```

**Key Operations**:
- `AddInvoice()` - Create Lightning invoice
- `LookupInvoice()` - Check invoice status
- `SendPaymentSync()` - Send Lightning payment
- `ListChannels()` - Manage Lightning channels

### Webhook Architecture

```
Blockchain Event (e.g., payment confirmed)
    ↓
[Webhook Service] (Node.js server or third-party)
    ↓ (HTTP POST)
[API Endpoint: /api/webhooks/payment]
    ↓
[Validate Webhook Signature]
    ↓
[Update Order Status]
    ↓
[Send Confirmation Email]
```

**Webhook Payload**:
```json
{
  "event": "payment.confirmed",
  "data": {
    "orderId": "abc123",
    "transactionHash": "0x...",
    "amount": 0.001,
    "confirmations": 6
  },
  "signature": "sha256_hmac_signature"
}
```

---

## 🚀 Scalability & Performance

### Horizontal Scaling Strategy

```
Request Distribution:

User → Load Balancer → [API Server 1]
                    → [API Server 2]
                    → [API Server 3]
                    → [API Server N]

All servers are stateless (JWT auth)
All servers connect to same MongoDB cluster
Redis for shared session/cache data
```

### Caching Strategy

**Multi-Layer Caching**:

```
[1. Client-Side Cache]
    ├── Browser cache (static assets)
    └── LocalStorage (user preferences)

[2. CDN Cache]
    ├── Static files (images, CSS, JS)
    └── API responses (public data)

[3. Application Cache (Redis)]
    ├── Session data
    ├── Frequently accessed data
    ├── API rate limiting counters
    └── Temporary data

[4. Database Query Cache]
    └── MongoDB query result cache
```

**Redis Caching Implementation**:
```javascript
// Cache product data
await redis.setex(`product:${id}`, 3600, JSON.stringify(product));

// Retrieve from cache
const cached = await redis.get(`product:${id}`);
if (cached) return JSON.parse(cached);
```

### Database Optimization

**Query Optimization**:
- Use indexes for frequent queries
- Limit fields returned with projection
- Use aggregation pipeline for complex queries
- Implement pagination for large result sets

**Connection Pooling**:
```javascript
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,
  minPoolSize: 5,
  socketTimeoutMS: 45000,
});
```

**MongoDB Replica Set**:
```
Primary Node (Read/Write)
    ├── Secondary Node 1 (Read)
    └── Secondary Node 2 (Read)
```

### Performance Metrics

**Target Metrics**:
- API Response Time: < 200ms (p95)
- Database Query Time: < 50ms (average)
- Uptime: 99.9%
- Concurrent Users: 1000+
- Requests per Second: 500+

---

## 🔄 Development Workflow

### Project Structure

```
cstore/
├── src/
│   ├── models/           # Mongoose schemas
│   ├── routes/           # Express routes
│   ├── controllers/      # Route handlers
│   ├── middleware/       # Custom middleware
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions
│   └── config/           # Configuration files
│
├── tests/                # Jest tests
├── docs/                 # Documentation
├── scripts/              # Utility scripts
├── k8s/                  # Kubernetes manifests
├── admin-dashboard/      # React admin UI
├── public/               # Static files
├── logs/                 # Application logs
│
├── .env.example          # Environment template
├── server.js             # Main entry point
├── package.json          # Dependencies
├── jest.config.js        # Test configuration
└── docker-compose.yml    # Docker setup
```

### Code Organization Patterns

**MVC Pattern**:
```
Request → Route → Controller → Service → Model → Database
                     ↓
                 Response
```

**Example**:
```javascript
// Route (routes/products.js)
router.get('/:id', authenticate, productController.getProduct);

// Controller (controllers/productController.js)
exports.getProduct = async (req, res, next) => {
  try {
    const product = await productService.getById(req.params.id);
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// Service (services/productService.js)
exports.getById = async (id) => {
  const product = await Product.findById(id).populate('category');
  if (!product) throw new NotFoundError('Product not found');
  return product;
};

// Model (models/Product.js)
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  // ...
});
```

### Error Handling Strategy

**Centralized Error Handler**:
```javascript
// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});
```

**Custom Error Classes**:
```javascript
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
  }
}

class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.statusCode = 400;
    this.code = 'VALIDATION_ERROR';
    this.details = details;
  }
}
```

### Testing Strategy

**Test Pyramid**:
```
        [E2E Tests] (10%)
           /  \
      [Integration Tests] (30%)
         /      \
    [Unit Tests] (60%)
```

**Test Example**:
```javascript
describe('Product API', () => {
  describe('GET /api/products/:id', () => {
    it('should return product when ID is valid', async () => {
      const product = await Product.create({ name: 'Test', price: 100 });
      
      const res = await request(app)
        .get(`/api/products/${product._id}`)
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test');
    });
    
    it('should return 404 when product not found', async () => {
      const res = await request(app)
        .get('/api/products/invalid-id')
        .expect(404);
      
      expect(res.body.success).toBe(false);
    });
  });
});
```

---

## 📚 Additional Resources

### Architecture Documentation
- **[API Endpoints](docs/api/API_ENDPOINTS.md)** - Complete API reference
- **[Database Schema](docs/api/API.md)** - Detailed schema documentation
- **[Security Implementation](docs/security/README.md)** - Security architecture details
- **[Infrastructure](docs/infrastructure/README.md)** - Deployment architecture

### Design Documents
- **[Feature Implementation](docs/features/FEATURE_IMPLEMENTATION_SUMMARY.md)** - Feature technical specs
- **[Blockchain Integration](docs/api/BITCOIN_RPC.md)** - Blockchain architecture
- **[Lightning Network](docs/api/LIGHTNING_NETWORK.md)** - Lightning implementation

### Getting Started
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Development setup
- **[FEATURES.md](FEATURES.md)** - Feature documentation
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment guide
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines

---

## 🔮 Future Architecture Improvements

### Planned Enhancements

1. **Microservices Migration**
   - Split monolith into domain-specific services
   - Event-driven communication (RabbitMQ/Kafka)
   - API Gateway pattern

2. **Advanced Caching**
   - GraphQL with DataLoader
   - Varnish for HTTP caching
   - Redis Cluster for distributed caching

3. **Real-Time Features**
   - WebSocket server for live updates
   - Server-Sent Events (SSE) for notifications
   - Real-time order tracking

4. **Data Analytics**
   - Apache Kafka for event streaming
   - Data warehouse (Snowflake/BigQuery)
   - Machine learning for recommendations

5. **Enhanced Security**
   - Zero-trust architecture
   - Service mesh (Istio)
   - Advanced threat detection

---

**Version:** 2.2.0  
**Last Updated:** October 2025  
**Architecture Status:** Production-Ready (with security implementations)

*For implementation details and guides, see related documentation in /docs*
