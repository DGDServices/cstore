# Contributing to Cryptons.com

Thank you for your interest in contributing to Cryptons.com! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Security Vulnerabilities](#security-vulnerabilities)

## Code of Conduct

By participating in this project, you agree to:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other community members
- Accept constructive criticism gracefully

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (v6 or higher)
- Git
- Basic understanding of JavaScript/Node.js
- Familiarity with cryptocurrency concepts (helpful but not required)

### Find an Issue to Work On

1. Check the [issue tracker](https://github.com/thewriterben/cstore/issues)
2. Look for issues labeled `good first issue` or `help wanted`
3. Comment on the issue to let others know you're working on it
4. Wait for a maintainer to assign the issue to you

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/cstore.git
cd cstore
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your local configuration
# At minimum, set:
# - MONGODB_URI (your local MongoDB connection)
# - JWT_SECRET (any secure random string for development)
```

### 4. Start MongoDB

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:6

# Or use your local MongoDB installation
```

### 5. Run the Application

```bash
# Development mode with auto-reload
npm run dev

# The API will be available at http://localhost:3000
```

### 6. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## How to Contribute

### Types of Contributions

We welcome various types of contributions:

1. **Bug Fixes**: Fix existing issues
2. **New Features**: Add new functionality (discuss first in an issue)
3. **Documentation**: Improve or add documentation
4. **Tests**: Add or improve test coverage
5. **Refactoring**: Improve code quality and structure
6. **Security**: Report or fix security vulnerabilities (see [SECURITY.md](SECURITY.md))

### Before You Start

1. **Check existing issues**: Make sure your contribution isn't already in progress
2. **Create an issue**: For significant changes, create an issue to discuss the approach
3. **Get feedback**: Wait for maintainer feedback before starting major work
4. **Small PRs**: Keep pull requests focused and reasonably sized

## Coding Standards

### JavaScript Style Guide

We use ESLint and Prettier for code formatting:

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

### Code Style Guidelines

1. **Use ES6+ features**: Arrow functions, destructuring, async/await, etc.
2. **Use meaningful names**: Variables and functions should be descriptive
3. **Write comments**: Explain complex logic, not obvious code
4. **Keep functions small**: Each function should do one thing well
5. **Error handling**: Always handle errors properly with try-catch
6. **Async/await**: Prefer async/await over promise chains

### Example Code Style

```javascript
// Good
async function getUserById(userId) {
  try {
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  } catch (error) {
    logger.error('Error fetching user:', error);
    throw error;
  }
}

// Bad
function getUserById(userId) {
  return User.findById(userId).then(user => {
    if (user) return user;
    else throw new Error('User not found');
  }).catch(err => console.log(err));
}
```

### File Organization

```
src/
├── config/          # Configuration files (database, Redis, CORS, i18n, startup)
├── controllers/     # Request handlers (27 controllers)
├── middleware/       # Express middleware (auth, security, validation, webhooks)
├── models/          # Mongoose models (29 models)
├── routes/          # API routes (20 route files)
├── services/        # Business logic services (40 services)
├── utils/           # Utility functions (logging, encryption, JWT, validation)
└── validation/      # Input validation schemas (Joi)
```

## Testing Guidelines

### Writing Tests

1. **Test file naming**: `*.test.js` or `*.spec.js`
2. **Test organization**: Group related tests with `describe` blocks
3. **Test descriptions**: Use clear, descriptive test names
4. **Test coverage**: Aim for at least 80% coverage for new code
5. **Test types**: Include unit tests and integration tests

### Test Structure

```javascript
describe('User Authentication', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);
      
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(userData.email);
    });
    
    it('should reject registration with invalid email', async () => {
      const userData = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/auth.test.js

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Pull Request Process

### 1. Create a Branch

```bash
# Create a feature branch from main
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-description
```

### 2. Make Your Changes

- Write clean, well-documented code
- Follow the coding standards
- Add tests for new functionality
- Update documentation as needed

### 3. Commit Your Changes

Use clear, descriptive commit messages:

```bash
# Good commit messages
git commit -m "Add JWT token revocation mechanism"
git commit -m "Fix memory leak in webhook handler"
git commit -m "Update documentation for multi-sig wallets"

# Bad commit messages (avoid these)
git commit -m "Fix stuff"
git commit -m "WIP"
git commit -m "Updates"
```

### 4. Update Your Branch

```bash
# Keep your branch up to date with main
git checkout main
git pull origin main
git checkout feature/your-feature-name
git rebase main
```

### 5. Push Your Changes

```bash
git push origin feature/your-feature-name
```

### 6. Create a Pull Request

1. Go to the repository on GitHub
2. Click "New Pull Request"
3. Select your branch
4. Fill out the PR template with:
   - Description of changes
   - Related issue number (e.g., "Fixes #123")
   - Screenshots (if applicable)
   - Testing performed
   - Checklist items completed

### 7. PR Review Process

- A maintainer will review your PR
- Address any feedback or requested changes
- Once approved, your PR will be merged
- Your contribution will be acknowledged in the release notes

## PR Checklist

Before submitting a PR, ensure:

- [ ] Code follows the style guidelines
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] New tests added for new features
- [ ] Documentation updated (if needed)
- [ ] Commit messages are clear and descriptive
- [ ] No sensitive data (passwords, API keys, etc.) committed
- [ ] Branch is up to date with main
- [ ] PR description is complete and clear

## Security Vulnerabilities

**Do not open public issues for security vulnerabilities.**

Please report security issues privately by following the guidelines in [SECURITY.md](SECURITY.md).

## Documentation

When contributing, please update relevant documentation:

- **Code comments**: For complex logic
- **API documentation**: In `docs/api/API.md` or `docs/api/API_ENDPOINTS.md`
- **README.md**: For major feature additions
- **Configuration**: Update `.env.example` if adding new environment variables
- **Documentation Index**: Update `DOCUMENTATION_INDEX.md` for new docs

## Questions?

- **General questions**: Open a [GitHub Discussion](https://github.com/thewriterben/cstore/discussions)
- **Bug reports**: Open an [Issue](https://github.com/thewriterben/cstore/issues)
- **Feature requests**: Open an [Issue](https://github.com/thewriterben/cstore/issues) with the "enhancement" label

## Recognition

Contributors will be:
- Listed in the repository's contributors page
- Mentioned in release notes for significant contributions
- Acknowledged in the project README (for major features)

## License

By contributing, you agree that your contributions will be licensed under the MIT License that covers this project. See [LICENSE](LICENSE) for details.

---

**Thank you for contributing to Cryptons.com!** 🚀

Your contributions help make cryptocurrency trading more accessible and secure for everyone.
