# Cryptons.com

**Professional Cryptocurrency E-Commerce & Marketplace Platform**

[![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)
[![Status](https://img.shields.io/badge/status-Development-orange.svg)](README.md)

A full-featured cryptocurrency e-commerce and peer-to-peer marketplace platform with blockchain integration, multi-currency support, auction system, seller marketplace, consumer-to-consumer listings, content moderation, escrow services, print-on-demand, and a comprehensive KYC/AML compliance framework. Built with Node.js, Express, MongoDB, and React.

---

## ⚠️ CRITICAL PRODUCTION WARNING

**🚫 NOT PRODUCTION-READY FOR REAL CRYPTOCURRENCY TRANSACTIONS**

- **Current Status**: Development/Educational Platform (April 2026)
- **Production Readiness**: ~65%
- **Timeline to Production**: 12-24 months minimum
- **Estimated Cost**: $1.5-4M+ initial investment

### Required Before Production

**🔴 BLOCKING REQUIREMENTS**
- [ ] Professional security audit and penetration testing
- [ ] Legal compliance (Money Transmitter Licenses in 48+ states, FinCEN registration)
- [ ] Disaster recovery procedures and 24/7 monitoring
- [ ] Terms of Service and Privacy Policy (legal review required)

**⚖️ Legal Warning**: Operating without proper licenses is **ILLEGAL** and can result in criminal prosecution, asset seizure, and imprisonment.

**See**: [Production Readiness Checklist](#-production-readiness) | [Compliance Requirements](docs/compliance/COMPLIANCE_CHECKLIST.md)

---

## 🚀 Quick Start

### For Evaluators (2 minutes)
- **What is it?** Full-featured crypto e-commerce + P2P marketplace with Bitcoin, Lightning Network, multi-sig wallets, auctions, and C2C listings
- **Status?** Feature-rich with security hardening and compliance implemented; regulatory licensing needed for production
- **Tech Stack?** Node.js, Express, MongoDB, Redis, React, Kubernetes
- **View**: [Features](FEATURES.md) | [Architecture](ARCHITECTURE.md)

### For Developers (5 minutes)
```bash
# Clone and install
git clone https://github.com/thewriterben/cstore.git
cd cstore
npm install

# Configure
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Start
npm run dev

# Test
npm test
```

**Next Steps**: [Getting Started Guide](GETTING_STARTED.md) | [API Documentation](docs/api/README.md)

### For Contributors
1. Review [CONTRIBUTING.md](CONTRIBUTING.md)
2. Check [GitHub Issues](https://github.com/thewriterben/cstore/issues) for tasks
3. Read [Development Workflow](CONTRIBUTING.md#contribution-workflow)

---

## ✨ Key Features

### Core E-commerce
✅ Product catalog with advanced search (Elasticsearch)  
✅ Shopping cart and order management  
✅ User authentication (JWT) and role-based access  
✅ JWT token revocation via Redis token blacklist  
✅ Review & rating system with moderation  
✅ Product Q&A system  
✅ Wishlist functionality  
✅ Multi-language support (5 languages)  
✅ Multi-currency pricing (10+ currencies)  
✅ Regional payment methods (15+ options)  
✅ Recommendation engine  

### Cryptocurrency & Finance
✅ Bitcoin, Litecoin, XRP integration  
✅ Lightning Network for instant payments (LND)  
✅ Lightning channel monitoring and rebalancing  
✅ Multi-signature wallets (2-of-3, 3-of-5)  
✅ Blockchain transaction verification  
✅ Real-time payment webhooks with signature verification  
✅ Escrow service with milestone support and dispute resolution  
✅ Crypto-to-fiat conversion with exchange integration (Coinbase, Kraken, Binance)  
✅ Crypto Fair Value (CFV) metrics  
✅ Multi-exchange balance tracking  

### Marketplace (v3.0)
✅ **Auction system** – timed auctions, bids, and auction watch lists  
✅ **Seller platform** – seller onboarding, seller products, and commission rules  
✅ **C2C listings** – consumer-to-consumer listings with offer/counter-offer flows  
✅ **In-app messaging** – conversations and messages between buyers and sellers  
✅ **Buy Box** – algorithmic buy box selection across competing offers  

### Content Moderation
✅ Multi-provider moderation pipeline (feature-flagged):  
&nbsp;&nbsp;&nbsp;• PhotoDNA (image hash matching)  
&nbsp;&nbsp;&nbsp;• AWS Rekognition (image/video analysis)  
&nbsp;&nbsp;&nbsp;• Azure Content Safety  
&nbsp;&nbsp;&nbsp;• OpenAI Moderation API  
&nbsp;&nbsp;&nbsp;• Perspective API (text toxicity)  
✅ Prohibited item rules engine  
✅ Content moderation audit log  
✅ Authority reporting service  

### Print-on-Demand (Printify)
✅ Printify API integration for POD products  
✅ Automatic order submission to production  
✅ Product sync and webhook handling  

### Admin Dashboard
✅ React 19 + TypeScript management interface (Vite)  
✅ Real-time analytics and charts (Recharts)  
✅ Product, order, and user management  
✅ Export functionality (CSV/PDF)  
✅ Drag-and-drop interfaces (dnd-kit)  

### Compliance Framework
✅ KYC identity verification (Jumio, Onfido, Sumsub)  
✅ AML transaction monitoring with ML-based risk scoring  
✅ Sanctions screening (OFAC, UN, EU lists)  
✅ Multi-factor risk assessment and risk scoring  
✅ GDPR compliance – all data subject rights implemented  
&nbsp;&nbsp;&nbsp;• Right to Access / Portability (JSON/CSV export)  
&nbsp;&nbsp;&nbsp;• Right to Erasure (right to be forgotten)  
&nbsp;&nbsp;&nbsp;• Right to Rectification and to Object  
✅ Consent management and data retention automation  
✅ Automated regulatory reporting (CTR/SAR)  
✅ Compliance case management and officer tools  
✅ Regulatory calendar and deadline tracking  
✅ Comprehensive audit trail  

### Security
✅ JWT token revocation (Redis-backed token blacklist)  
✅ Database encryption at rest (MongoDB Enterprise config + field-level helpers)  
✅ Webhook signature verification  
✅ Secrets management (HashiCorp Vault + AWS Secrets Manager with fallback)  
✅ HTTPS enforcement middleware  
✅ Helmet security headers, rate limiting (global + auth-specific)  
✅ Input sanitization (NoSQL injection, XSS, parameter pollution)  
✅ CORS environment-specific configuration  

### Infrastructure
✅ CI/CD pipeline with GitHub Actions  
✅ Kubernetes deployment manifests  
✅ Docker containerization (multi-stage builds)  
✅ Prometheus + Grafana monitoring  
✅ Structured logging with Winston and correlation IDs  
✅ Performance tracking per endpoint  
✅ Health check endpoints (liveness, readiness, startup probes)  
✅ Automated backup and restore scripts  
✅ Automated testing (Jest, 43 test files)

**Complete Feature List**: [FEATURES.md](FEATURES.md)

---

## 📡 API Routes

| Prefix | Description |
|--------|-------------|
| `/api/auth` | Authentication (register, login, logout, refresh) |
| `/api/products` | Product catalog (CRUD, search, variants) |
| `/api/categories` | Category management (hierarchical) |
| `/api/cart` | Shopping cart (persistent) |
| `/api/orders` | Order lifecycle management |
| `/api/payments` | Payment processing (crypto + fiat) |
| `/api/reviews` | Reviews and ratings |
| `/api/wishlist` | User wishlists |
| `/api/multisig` | Multi-signature wallet operations |
| `/api/lightning` | Lightning Network payments and channels |
| `/api/escrow` | Escrow service and disputes |
| `/api/cfv` | Crypto Fair Value metrics |
| `/api/printify` | Print-on-demand (Printify) |
| `/api/webhooks` | Blockchain and payment webhooks |
| `/api/currency` | Currency rates and exchange |
| `/api/conversion` | Crypto-to-fiat conversion |
| `/api/exchange` | Exchange balances (Coinbase/Kraken/Binance) |
| `/api/regional-payments` | Regional payment methods |
| `/api/admin` | Admin management interface |
| `/api/auctions` | Auction system and bids |
| `/api/sellers` | Seller onboarding and products |
| `/api/c2c` | C2C listings and offers |
| `/api/messages` | In-app messaging and conversations |
| `/api/moderation` | Content moderation and prohibited rules |
| `/api/health` | Health checks (live, ready, startup) |
| `/api/metrics` | Prometheus metrics |
| `/api/performance` | Performance report |

---

## 📚 Documentation

### Getting Started
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Quick setup guide (5 minutes)
- **[Installation Guide](docs/getting-started/INSTALLATION.md)** - Detailed installation
- **[FEATURES.md](FEATURES.md)** - Comprehensive feature documentation

### Technical
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design
- **[API Documentation](docs/api/README.md)** - Complete API reference
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment and infrastructure guide

### Contributing
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines
- **[SECURITY.md](SECURITY.md)** - Security policy
- **[CHANGELOG.md](CHANGELOG.md)** - Version history

### For Stakeholders
- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** - Master documentation index
- **[Compliance Checklist](docs/compliance/COMPLIANCE_CHECKLIST.md)** - Regulatory requirements
- **[Security Audit](audit/SECURITY_AUDIT.md)** - Security assessment
- **[Production Readiness](audit/PRODUCTION_READINESS.md)** - Production checklist

---

## 🛠 Technology Stack

**Backend**: Node.js 18+, Express 5, MongoDB (Mongoose 8), Redis (ioredis), Elasticsearch  
**Frontend**: React 19, TypeScript, Material-UI v6, Redux Toolkit, Vite  
**Blockchain**: Bitcoin Core RPC, Lightning Network (LND), XRP Ledger (xrpl), Web3/Ethereum  
**Integrations**: Printify (POD), Coinbase/Kraken/Binance exchanges, Stripe, PayPal  
**Compliance**: Jumio, Onfido, Sumsub (KYC); OFAC/UN/EU sanctions; PhotoDNA, AWS Rekognition, Azure Content Safety, OpenAI Moderation, Perspective API  
**Secrets**: HashiCorp Vault, AWS Secrets Manager  
**Infrastructure**: Docker, Kubernetes, GitHub Actions, Prometheus, Grafana, Winston  
**Testing**: Jest 30, Supertest, K6 (performance)  
**Security**: Helmet, express-rate-limit, express-mongo-sanitize, express-validator, joi, hpp, xss-clean

**Codebase size**: 41 models · 47 services · 32 controllers · 25 route files · 43 test files

**Details**: [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 🤝 Contributing

We welcome contributions! Whether you're fixing bugs, adding features, improving documentation, or enhancing security.

**Quick Start**:
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and add tests
4. Submit a pull request

**Guidelines**: [CONTRIBUTING.md](CONTRIBUTING.md)

**Good First Issues**: [GitHub Issues](https://github.com/thewriterben/cstore/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)

---

## 📋 Production Readiness

**Status as of April 2026**: ~65% complete

### Security

- [x] JWT token revocation (Redis token blacklist)
- [x] Database encryption at rest (configuration + field-level helpers)
- [x] Webhook signature verification
- [x] Secrets management (Vault / AWS Secrets Manager)
- [x] HTTPS enforcement
- [ ] Professional security audit and penetration testing

### Compliance

- [x] KYC/AML framework (Jumio, Onfido, Sumsub)
- [x] Sanctions screening (OFAC, UN, EU)
- [x] GDPR data subject rights
- [x] Automated regulatory reporting (CTR/SAR)
- [ ] Money Transmitter Licenses (48+ U.S. states)
- [ ] FinCEN MSB Registration
- [ ] Terms of Service (legal review required)
- [ ] Privacy Policy (legal review required)

### Infrastructure

- [x] Docker containerization
- [x] Kubernetes manifests
- [x] CI/CD pipeline (GitHub Actions)
- [x] Health check probes
- [x] Monitoring (Prometheus/Grafana)
- [ ] Load balancing and auto-scaling (production-grade)
- [ ] Disaster recovery procedures
- [ ] 24/7 on-call monitoring and alerting

**Timeline**: 12-24 months | **Cost**: $1.5-4M+ | **Details**: [Production Readiness](audit/PRODUCTION_READINESS.md)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/thewriterben/cstore/issues)
- **Discussions**: [GitHub Discussions](https://github.com/thewriterben/cstore/discussions)
- **Documentation**: [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)

---

## ⚠️ Final Notice

**Educational Purpose**: This platform demonstrates modern cryptocurrency platform architecture, blockchain integration, P2P marketplace design, and compliance framework development.

**Approved Use Cases**:
- ✅ Learning cryptocurrency platform development
- ✅ Educational demonstrations
- ✅ Portfolio projects
- ✅ Architecture study
- ✅ Testnet experimentation

**NOT Approved**:
- 🚫 Real cryptocurrency transactions
- 🚫 Production deployment without licenses
- 🚫 Handling real customer funds
- 🚫 Operating without legal counsel

**Made with ❤️ for the crypto community**

*Version 2.2.0 | Last Updated: April 2026*
