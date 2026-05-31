# Installation Guide

This guide will help you get Cryptons.com up and running on your local machine for development and testing.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v6 or higher) - [Download](https://www.mongodb.com/try/download/community)
- **npm** or **yarn** - Comes with Node.js
- **Git** - For version control

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/thewriterben/cstore.git
cd cstore
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and set the following required variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/cryptons

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Admin Credentials (Initial Setup)
ADMIN_EMAIL=admin@cryptons.com
ADMIN_PASSWORD=admin123
```

### 4. Start MongoDB

Make sure MongoDB is running on your system:

```bash
# For macOS (using Homebrew)
brew services start mongodb-community

# For Ubuntu/Linux
sudo systemctl start mongod

# For Windows
# MongoDB runs as a Windows service after installation
```

### 5. Start the Application

```bash
npm start
```

The server will start on `http://localhost:3000` (or the port you configured).

### 6. Access the Application

- **API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/api/health
- **Admin Dashboard**: See [admin-dashboard/README.md](../../admin-dashboard/README.md)

## Docker Deployment

### Using Docker Compose (Recommended for Development)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

This will start:
- Application server on port 3000
- MongoDB on port 27017

### Using Docker Only

```bash
# Build the image
docker build -t cryptons .

# Run the container
docker run -p 3000:3000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/cryptons \
  -e JWT_SECRET=your-jwt-secret \
  cryptons
```

## Verification

### Check Server Status

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-10-15T...",
  "version": "2.2.0"
}
```

### Create Admin User

On first run, an admin user is automatically created with the credentials from your `.env` file.

Login:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cryptons.com",
    "password": "admin123"
  }'
```

## Development Tools

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Linting

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix
```

### Code Formatting

```bash
# Check formatting
npm run format:check

# Auto-format code
npm run format
```

## Troubleshooting

### MongoDB Connection Issues

**Problem**: Cannot connect to MongoDB

**Solutions**:
1. Verify MongoDB is running: `mongosh` or `mongo`
2. Check your `MONGODB_URI` in `.env`
3. Ensure MongoDB is listening on the correct port
4. For Docker: Use `host.docker.internal` instead of `localhost`

### Port Already in Use

**Problem**: Port 3000 is already in use

**Solutions**:
1. Change `PORT` in `.env` to a different port
2. Kill the process using port 3000:
   ```bash
   # macOS/Linux
   lsof -ti:3000 | xargs kill -9
   
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

### Missing Dependencies

**Problem**: Module not found errors

**Solution**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- Read the [API Documentation](../api/README.md) to understand available endpoints
- Review [Security Best Practices](../security/README.md)
- Check out the [Contributing Guide](../../CONTRIBUTING.md)
- Explore the [Feature Documentation](../features/README.md)

## ⚠️ Production Deployment

**Important**: This installation is for development/testing only. Before production deployment:

1. Review the [Production Readiness Checklist](../../audit/PRODUCTION_READINESS.md)
2. Implement all [Critical Security Features](../security/README.md)
3. Complete [Compliance Requirements](../compliance/COMPLIANCE_CHECKLIST.md)
4. Review the [Security Audit](../../audit/SECURITY_AUDIT.md)

**Do not use this platform for real cryptocurrency transactions without proper licenses and security implementations.**

---

**Need Help?**
- Check the [FAQ section](README.md)
- Open an issue on [GitHub](https://github.com/thewriterben/cstore/issues)
- Review the [Documentation Index](../../DOCUMENTATION_INDEX.md)
