# Secrets Management Implementation Guide

**Status**: 🔴 CRITICAL - Not Implemented  
**Priority**: HIGH  
**Timeline**: 2-3 weeks

---

## Overview

Currently, secrets are stored in `.env` files and environment variables, which is insecure for production. This guide implements proper secrets management using industry-standard vaults and best practices.

## Problem Statement

**Current Issues:**
- Secrets in plain text files (`.env`)
- No secret rotation capability
- Secrets visible in process environment
- No audit trail for secret access
- Secrets may be committed to git accidentally
- Shared secrets across environments

**Security Risks:**
- Credential theft if server compromised
- No revocation mechanism
- Difficult to rotate secrets
- Compliance violations
- Insider threats

## Recommended Solutions

### Option 1: HashiCorp Vault (Recommended for Self-Hosted)

**Pros:**
- ✅ Industry standard
- ✅ Dynamic secrets
- ✅ Automatic rotation
- ✅ Audit logging
- ✅ Fine-grained access control
- ✅ Open source

**Cons:**
- ❌ Requires infrastructure
- ❌ Learning curve
- ❌ Maintenance overhead

### Option 2: AWS Secrets Manager (For AWS Deployments)

**Pros:**
- ✅ Fully managed
- ✅ Automatic rotation
- ✅ AWS IAM integration
- ✅ Easy setup
- ✅ High availability

**Cons:**
- ❌ AWS vendor lock-in
- ❌ Costs $0.40/secret/month
- ❌ AWS-only

### Option 3: Google Cloud Secret Manager

**Pros:**
- ✅ Fully managed
- ✅ GCP integration
- ✅ Automatic replication
- ✅ Version control

**Cons:**
- ❌ GCP-only
- ❌ Costs

### Option 4: Azure Key Vault

**Pros:**
- ✅ Fully managed
- ✅ Azure integration
- ✅ HSM support
- ✅ RBAC

**Cons:**
- ❌ Azure-only
- ❌ Costs

## Implementation: HashiCorp Vault

### Architecture

```
┌──────────────────┐
│  Cryptons.com    │
│   Application    │
└────────┬─────────┘
         │
         │ Authenticate
         │ (AppRole/K8s)
         ▼
┌──────────────────┐
│  HashiCorp       │
│     Vault        │
│  ┌────────────┐  │
│  │  Secrets   │  │
│  │  Engine    │  │
│  └────────────┘  │
│  ┌────────────┐  │
│  │   Audit    │  │
│  │    Logs    │  │
│  └────────────┘  │
└──────────────────┘
```

### Step 1: Install Vault

#### Docker Installation

```bash
# Create vault directory
mkdir -p vault/{config,data,logs}

# Create vault config
cat > vault/config/vault.hcl <<EOF
storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 0
  tls_cert_file = "/vault/config/cert.pem"
  tls_key_file  = "/vault/config/key.pem"
}

api_addr = "https://vault.cryptons.com:8200"
ui = true
EOF

# Run Vault container
docker run -d \
  --name vault \
  --cap-add=IPC_LOCK \
  -p 8200:8200 \
  -v $(pwd)/vault/config:/vault/config \
  -v $(pwd)/vault/data:/vault/data \
  -v $(pwd)/vault/logs:/vault/logs \
  vault:latest server -config=/vault/config/vault.hcl
```

#### Production Installation (Ubuntu/Debian)

```bash
# Add HashiCorp repo
curl -fsSL https://apt.releases.hashicorp.com/gpp | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"

# Install Vault
sudo apt-get update && sudo apt-get install vault

# Create vault user and directories
sudo useradd --system --home /etc/vault.d --shell /bin/false vault
sudo mkdir -p /etc/vault.d /opt/vault/data

# Create configuration
sudo tee /etc/vault.d/vault.hcl <<EOF
storage "raft" {
  path    = "/opt/vault/data"
  node_id = "vault-1"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_cert_file = "/etc/vault.d/cert.pem"
  tls_key_file  = "/etc/vault.d/key.pem"
}

api_addr = "https://vault.cryptons.com:8200"
cluster_addr = "https://vault.cryptons.com:8201"
ui = true

# Enable audit logging
audit {
  path = "/var/log/vault/audit.log"
}
EOF

# Start Vault
sudo systemctl enable vault
sudo systemctl start vault
```

### Step 2: Initialize and Unseal Vault

```bash
# Initialize Vault (run once)
vault operator init

# Output (SAVE THESE SECURELY!):
# Unseal Key 1: <key1>
# Unseal Key 2: <key2>
# Unseal Key 3: <key3>
# Unseal Key 4: <key4>
# Unseal Key 5: <key5>
# Initial Root Token: <root-token>

# Unseal Vault (requires 3 of 5 keys)
vault operator unseal <key1>
vault operator unseal <key2>
vault operator unseal <key3>

# Login with root token
export VAULT_ADDR='https://vault.cryptons.com:8200'
export VAULT_TOKEN='<root-token>'
vault login
```

### Step 3: Configure Secrets

```bash
# Enable KV secrets engine
vault secrets enable -path=cryptons kv-v2

# Store secrets
vault kv put cryptons/database \
  host="mongodb://localhost:27017" \
  username="cryptons" \
  password="secure-password"

vault kv put cryptons/jwt \
  secret="your-jwt-secret" \
  refresh_secret="your-refresh-secret"

vault kv put cryptons/email \
  smtp_host="smtp.gmail.com" \
  smtp_user="your-email@gmail.com" \
  smtp_password="app-password"

vault kv put cryptons/blockchain \
  btc_address="bc1qxy2..." \
  eth_address="0x742d..." \
  webhook_secret="webhook-secret"

vault kv put cryptons/encryption \
  field_encryption_key="64-char-hex" \
  database_encryption_key="64-char-hex"

# Verify secrets
vault kv get cryptons/database
```

### Step 4: Configure AppRole Authentication

```bash
# Enable AppRole auth
vault auth enable approle

# Create policy for app
vault policy write cryptons-policy - <<EOF
path "cryptons/*" {
  capabilities = ["read", "list"]
}

path "database/creds/cryptons" {
  capabilities = ["read"]
}
EOF

# Create AppRole
vault write auth/approle/role/cryptons \
  token_policies="cryptons-policy" \
  token_ttl=1h \
  token_max_ttl=4h

# Get Role ID
vault read auth/approle/role/cryptons/role-id

# Get Secret ID
vault write -f auth/approle/role/cryptons/secret-id

# Save these for application configuration
```

### Step 5: Application Integration

#### Install Vault Client

```bash
npm install node-vault
```

#### Create Vault Client Module

Create `src/config/vault.js`:

```javascript
const vault = require('node-vault');
const logger = require('../utils/logger');

class VaultClient {
  constructor() {
    this.client = null;
    this.token = null;
    this.secretCache = new Map();
    this.cacheExpiry = 3600000; // 1 hour
  }
  
  /**
   * Initialize Vault connection
   */
  async initialize() {
    try {
      this.client = vault({
        apiVersion: 'v1',
        endpoint: process.env.VAULT_ADDR || 'https://vault.cryptons.com:8200',
        requestOptions: {
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
      });
      
      // Authenticate with AppRole
      await this.authenticateAppRole();
      
      // Start token renewal
      this.startTokenRenewal();
      
      logger.info('Vault client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Vault client:', error);
      throw error;
    }
  }
  
  /**
   * Authenticate using AppRole
   */
  async authenticateAppRole() {
    const roleId = process.env.VAULT_ROLE_ID;
    const secretId = process.env.VAULT_SECRET_ID;
    
    if (!roleId || !secretId) {
      throw new Error('VAULT_ROLE_ID and VAULT_SECRET_ID must be set');
    }
    
    try {
      const result = await this.client.approleLogin({
        role_id: roleId,
        secret_id: secretId
      });
      
      this.token = result.auth.client_token;
      this.client.token = this.token;
      
      logger.info('Successfully authenticated with Vault');
    } catch (error) {
      logger.error('Vault authentication failed:', error);
      throw error;
    }
  }
  
  /**
   * Get secret from Vault
   * @param {string} path - Secret path (e.g., 'cryptons/database')
   * @param {string} key - Specific key to retrieve
   * @returns {Promise<string>} - Secret value
   */
  async getSecret(path, key = null) {
    // Check cache first
    const cacheKey = `${path}:${key}`;
    const cached = this.secretCache.get(cacheKey);
    
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }
    
    try {
      const result = await this.client.read(path);
      const data = result.data.data;
      
      if (key) {
        if (!data[key]) {
          throw new Error(`Key '${key}' not found in secret '${path}'`);
        }
        
        // Cache the value
        this.secretCache.set(cacheKey, {
          value: data[key],
          expiry: Date.now() + this.cacheExpiry
        });
        
        return data[key];
      }
      
      // Return all data
      return data;
    } catch (error) {
      logger.error(`Failed to get secret ${path}:`, error);
      throw error;
    }
  }
  
  /**
   * Get all secrets for the application
   * @returns {Promise<object>} - All secrets
   */
  async getAllSecrets() {
    try {
      const secrets = {
        database: await this.getSecret('cryptons/database'),
        jwt: await this.getSecret('cryptons/jwt'),
        email: await this.getSecret('cryptons/email'),
        blockchain: await this.getSecret('cryptons/blockchain'),
        encryption: await this.getSecret('cryptons/encryption')
      };
      
      return secrets;
    } catch (error) {
      logger.error('Failed to get all secrets:', error);
      throw error;
    }
  }
  
  /**
   * Start automatic token renewal
   */
  startTokenRenewal() {
    // Renew token every 30 minutes
    setInterval(async () => {
      try {
        await this.client.tokenRenewSelf();
        logger.info('Vault token renewed successfully');
      } catch (error) {
        logger.error('Failed to renew Vault token:', error);
        // Re-authenticate if renewal fails
        await this.authenticateAppRole();
      }
    }, 1800000); // 30 minutes
  }
  
  /**
   * Clear secret cache
   */
  clearCache() {
    this.secretCache.clear();
    logger.info('Secret cache cleared');
  }
}

// Singleton instance
const vaultClient = new VaultClient();

module.exports = vaultClient;
```

#### Update Server Initialization

Update `server-new.js`:

```javascript
const vaultClient = require('./src/config/vault');
const logger = require('./src/utils/logger');

// Initialize Vault before starting server
const startServer = async () => {
  try {
    // Initialize Vault
    if (process.env.VAULT_ENABLED === 'true') {
      await vaultClient.initialize();
      
      // Load secrets from Vault
      const secrets = await vaultClient.getAllSecrets();
      
      // Override environment variables with Vault secrets
      process.env.MONGODB_URI = secrets.database.host;
      process.env.JWT_SECRET = secrets.jwt.secret;
      process.env.JWT_REFRESH_SECRET = secrets.jwt.refresh_secret;
      process.env.SMTP_USER = secrets.email.smtp_user;
      process.env.SMTP_PASSWORD = secrets.email.smtp_password;
      
      logger.info('Secrets loaded from Vault');
    } else {
      logger.warn('Vault is disabled, using environment variables');
    }
    
    // Start Express server
    const app = require('./src/app');
    const PORT = process.env.PORT || 3000;
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
```

#### Helper Functions

Create `src/utils/secrets.js`:

```javascript
const vaultClient = require('../config/vault');

/**
 * Get database credentials
 */
exports.getDatabaseConfig = async () => {
  if (process.env.VAULT_ENABLED === 'true') {
    return await vaultClient.getSecret('cryptons/database');
  }
  
  return {
    host: process.env.MONGODB_URI,
    username: process.env.MONGODB_USER,
    password: process.env.MONGODB_PASSWORD
  };
};

/**
 * Get JWT secrets
 */
exports.getJWTSecrets = async () => {
  if (process.env.VAULT_ENABLED === 'true') {
    return await vaultClient.getSecret('cryptons/jwt');
  }
  
  return {
    secret: process.env.JWT_SECRET,
    refresh_secret: process.env.JWT_REFRESH_SECRET
  };
};

/**
 * Get email configuration
 */
exports.getEmailConfig = async () => {
  if (process.env.VAULT_ENABLED === 'true') {
    return await vaultClient.getSecret('cryptons/email');
  }
  
  return {
    smtp_host: process.env.SMTP_HOST,
    smtp_user: process.env.SMTP_USER,
    smtp_password: process.env.SMTP_PASSWORD
  };
};
```

### Step 6: Environment Variables

Update `.env`:

```env
# Vault Configuration
VAULT_ENABLED=true
VAULT_ADDR=https://vault.cryptons.com:8200
VAULT_ROLE_ID=your-role-id
VAULT_SECRET_ID=your-secret-id

# Fallback values (if Vault is disabled)
MONGODB_URI=mongodb://localhost:27017/cryptons
JWT_SECRET=fallback-secret
```

### Step 7: Docker Compose with Vault

```yaml
# docker-compose.yml
version: '3.8'

services:
  vault:
    image: vault:latest
    container_name: cryptons-vault
    cap_add:
      - IPC_LOCK
    ports:
      - "8200:8200"
    volumes:
      - vault-data:/vault/data
      - vault-config:/vault/config
    environment:
      - VAULT_ADDR=http://0.0.0.0:8200
    command: server

  app:
    build: .
    depends_on:
      - vault
      - mongodb
    environment:
      - VAULT_ENABLED=true
      - VAULT_ADDR=http://vault:8200
      - VAULT_ROLE_ID=${VAULT_ROLE_ID}
      - VAULT_SECRET_ID=${VAULT_SECRET_ID}
    volumes:
      - .:/app

volumes:
  vault-data:
  vault-config:
```

### Step 8: Kubernetes Integration

```yaml
# kubernetes/vault-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: vault-config
data:
  vault-addr: "https://vault.cryptons.com:8200"
  vault-path: "cryptons"

---
# kubernetes/vault-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: vault-auth
type: Opaque
data:
  role-id: <base64-encoded-role-id>
  secret-id: <base64-encoded-secret-id>

---
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cryptons-api
spec:
  template:
    spec:
      containers:
      - name: api
        env:
        - name: VAULT_ENABLED
          value: "true"
        - name: VAULT_ADDR
          valueFrom:
            configMapKeyRef:
              name: vault-config
              key: vault-addr
        - name: VAULT_ROLE_ID
          valueFrom:
            secretKeyRef:
              name: vault-auth
              key: role-id
        - name: VAULT_SECRET_ID
          valueFrom:
            secretKeyRef:
              name: vault-auth
              key: secret-id
```

## Implementation: AWS Secrets Manager

### Step 1: Create Secrets

```bash
# Install AWS CLI
pip install awscli

# Create secrets
aws secretsmanager create-secret \
  --name cryptons/database \
  --secret-string '{"host":"mongodb://...","username":"user","password":"pass"}'

aws secretsmanager create-secret \
  --name cryptons/jwt \
  --secret-string '{"secret":"...","refresh_secret":"..."}'

aws secretsmanager create-secret \
  --name cryptons/email \
  --secret-string '{"smtp_user":"...","smtp_password":"..."}'
```

### Step 2: Application Integration

```bash
npm install @aws-sdk/client-secrets-manager
```

Create `src/config/awsSecrets.js`:

```javascript
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const logger = require('../utils/logger');

class AWSSecretsClient {
  constructor() {
    this.client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.cache = new Map();
  }
  
  async getSecret(secretName) {
    // Check cache
    if (this.cache.has(secretName)) {
      return this.cache.get(secretName);
    }
    
    try {
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.client.send(command);
      const secret = JSON.parse(response.SecretString);
      
      // Cache for 5 minutes
      this.cache.set(secretName, secret);
      setTimeout(() => this.cache.delete(secretName), 300000);
      
      return secret;
    } catch (error) {
      logger.error(`Failed to get secret ${secretName}:`, error);
      throw error;
    }
  }
}

module.exports = new AWSSecretsClient();
```

## Secret Rotation

### Manual Rotation Script

```bash
#!/bin/bash
# scripts/rotate-secrets.sh

# Generate new secrets
NEW_JWT_SECRET=$(openssl rand -hex 32)
NEW_WEBHOOK_SECRET=$(openssl rand -hex 32)

# Update Vault
vault kv put cryptons/jwt \
  secret="$NEW_JWT_SECRET" \
  refresh_secret="$NEW_JWT_SECRET"

# Update application (rolling restart)
kubectl rollout restart deployment/cryptons-api

echo "✅ Secrets rotated successfully"
```

### Automatic Rotation (Vault)

```hcl
# Enable database secrets engine
vault secrets enable database

# Configure database connection
vault write database/config/mongodb \
  plugin_name=mongodb-database-plugin \
  allowed_roles="cryptons" \
  connection_url="mongodb://{{username}}:{{password}}@mongodb:27017/admin" \
  username="vaultadmin" \
  password="vaultpass"

# Create role for dynamic credentials
vault write database/roles/cryptons \
  db_name=mongodb \
  creation_statements='{ "db": "cryptons", "roles": [{ "role": "readWrite" }] }' \
  default_ttl="1h" \
  max_ttl="24h"

# Application reads dynamic credentials
vault read database/creds/cryptons
```

## Monitoring and Auditing

```javascript
// Monitor secret access
const auditSecretAccess = (secretPath, user) => {
  logger.info('Secret accessed', {
    path: secretPath,
    user,
    timestamp: new Date().toISOString(),
    ip: req.ip
  });
  
  // Send to monitoring system
  metrics.increment('secrets.accessed', {
    path: secretPath
  });
};
```

## Best Practices

1. **Never commit secrets to git**
   - Use `.gitignore` for `.env` files
   - Scan commits with GitLeaks

2. **Use different secrets per environment**
   - Dev, staging, production separate

3. **Rotate secrets regularly**
   - Every 90 days minimum
   - After team member leaves
   - After security incident

4. **Principle of least privilege**
   - Applications only access needed secrets
   - Use scoped policies

5. **Audit all secret access**
   - Log who accessed what and when
   - Alert on unusual access patterns

6. **Use encryption in transit**
   - Always use TLS for Vault communication
   - Encrypt secret values at rest

7. **Have a revocation plan**
   - Know how to invalidate compromised secrets
   - Test the process

## Success Criteria

- ✅ No secrets in environment variables
- ✅ No secrets in source code
- ✅ Secrets stored in Vault/Secrets Manager
- ✅ Automatic secret rotation enabled
- ✅ Audit logging configured
- ✅ Access controls implemented
- ✅ Documentation complete
- ✅ Team trained on secret management

---

**Status**: Implementation Required  
**Owner**: DevOps + Security Team  
**Priority**: CRITICAL  
**Estimated Effort**: 60-80 hours  
**Cost**: Vault (free/open source) or AWS Secrets Manager ($0.40/secret/month)
