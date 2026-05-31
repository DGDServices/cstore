# Getting Started with Cryptons.com

**Quick start guide for developers**

⚠️ **Important**: This platform is for educational/development purposes only. Not production-ready for real cryptocurrency transactions.

---

## 🎯 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ and npm
- **MongoDB** 6+ (local or cloud instance)
- **Git** for version control
- **Docker** (optional, for containerized development)

## ⚡ Quick Start (5 minutes)

### 1. Clone the Repository

```bash
git clone https://github.com/thewriterben/cstore.git
cd cstore
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and configure at minimum:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/cryptons

# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 4. Start the Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### 5. Verify Installation

Test the health endpoint:

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "OK",
  "database": "connected",
  "timestamp": "2025-10-14T07:39:49.253Z"
}
```

## 🧪 Run Tests

Verify everything works correctly:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint
```

## 🎨 Start Admin Dashboard (Optional)

The admin dashboard provides a React-based UI for managing the platform.

```bash
cd admin-dashboard
npm install
npm run dev
```

The dashboard will be available at `http://localhost:5173`

**Default Admin Login:**
Create an admin user via API first:

```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "SecurePassword123!",
    "role": "admin"
  }'
```

## 📚 Next Steps

### For Developers

1. **Explore the API**: Review [API Documentation](docs/api/README.md)
2. **Understand Architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md)
3. **View Features**: Check [FEATURES.md](FEATURES.md)
4. **Read Contributing Guide**: Review [CONTRIBUTING.md](CONTRIBUTING.md)

### For Contributors

1. **Fork the repository** on GitHub
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make your changes** and write tests
4. **Submit a pull request**: Follow [CONTRIBUTING.md](CONTRIBUTING.md)

### For DevOps/SRE

1. **Review Deployment Guide**: See [DEPLOYMENT.md](DEPLOYMENT.md)
2. **Explore CI/CD Pipeline**: Check [docs/infrastructure/CICD_PIPELINE.md](docs/infrastructure/CICD_PIPELINE.md)
3. **Kubernetes Setup**: Review [k8s/README.md](k8s/README.md)

## 🐳 Docker Quick Start (Alternative)

Run everything with Docker Compose:

```bash
# Start all services (API + MongoDB + Redis)
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

## ⚙️ Configuration Guide

### Essential Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `MONGODB_URI` | MongoDB connection string | Yes | `mongodb://localhost:27017/cryptons` |
| `JWT_SECRET` | Secret for JWT token signing | Yes | `your-secret-key` |
| `PORT` | Server port | No | `3000` (default) |
| `NODE_ENV` | Environment mode | No | `development` |

### Optional Services

#### Email Configuration (for notifications)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

#### Redis (for caching)
```env
REDIS_URL=redis://localhost:6379
```

#### Elasticsearch (for advanced search)
```env
ELASTICSEARCH_NODE=http://localhost:9200
```

Complete configuration options: [docs/getting-started/INSTALLATION.md](docs/getting-started/INSTALLATION.md)

## 🔧 Troubleshooting

### Common Issues

**MongoDB Connection Error**
- Ensure MongoDB is running: `mongod --version`
- Check connection string in `.env`
- Verify MongoDB service is started

**Port Already in Use**
- Change `PORT` in `.env`
- Or kill the process: `lsof -ti:3000 | xargs kill`

**Dependency Installation Fails**
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

**Tests Failing**
- Ensure MongoDB is running
- Check test database is accessible
- Review error messages for specific issues

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/thewriterben/cstore/issues)
- **Discussions**: [GitHub Discussions](https://github.com/thewriterben/cstore/discussions)
- **Documentation**: [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)

## 📖 Additional Resources

- **[README.md](README.md)** - Project overview and status
- **[FEATURES.md](FEATURES.md)** - Feature documentation
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical architecture
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide
- **[SECURITY.md](SECURITY.md)** - Security policy
- **[CHANGELOG.md](CHANGELOG.md)** - Version history

---

**Ready to contribute?** Check out [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

*Last Updated: April 2026*
