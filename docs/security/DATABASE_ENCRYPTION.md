# Database Encryption at Rest Implementation Guide

**Status**: 🔴 CRITICAL - Not Implemented  
**Priority**: HIGH  
**CVSS Score**: 8.1 (HIGH)  
**Timeline**: 1-2 weeks

---

## Overview

Currently, the MongoDB database does not have encryption at rest enabled. This means sensitive data (user information, payment details, wallet addresses) is stored in plain text on disk, making it vulnerable to physical theft or unauthorized access to the storage layer.

## Problem Statement

**Current Risks:**
- Database files stored unencrypted on disk
- Sensitive data (PII, financial info) readable if disk is accessed
- Non-compliance with data protection regulations (GDPR, PCI DSS)
- Vulnerability to physical server compromise
- Backup files also unencrypted

**Data at Risk:**
- User passwords (hashed but salt visible)
- Email addresses and personal information
- Payment transaction details
- Wallet addresses and balances
- Order history
- Admin audit logs

## MongoDB Encryption Options

### Option 1: MongoDB Enterprise Encryption at Rest (Recommended for Production)

**Pros:**
- ✅ Native MongoDB feature
- ✅ Transparent to application
- ✅ High performance
- ✅ Automatic key rotation
- ✅ FIPS 140-2 compliant

**Cons:**
- ❌ Requires MongoDB Enterprise license
- ❌ Additional cost
- ❌ More complex setup

### Option 2: File System Encryption (Alternative)

**Pros:**
- ✅ No MongoDB Enterprise required
- ✅ Works with Community Edition
- ✅ Protects entire disk
- ✅ Operating system managed

**Cons:**
- ❌ Performance overhead
- ❌ Less granular control
- ❌ Vulnerable if OS compromised

### Option 3: Application-Level Field Encryption

**Pros:**
- ✅ Fine-grained control
- ✅ No MongoDB Enterprise required
- ✅ Can encrypt specific fields

**Cons:**
- ❌ Application complexity
- ❌ Cannot query encrypted fields
- ❌ Key management burden

## Implementation: MongoDB Enterprise Encryption at Rest

### Prerequisites

1. MongoDB Enterprise Edition
2. Key Management System (KMS)
3. KMIP-compatible key server or local key file

### Step 1: Install MongoDB Enterprise

```bash
# Ubuntu/Debian
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-enterprise/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-enterprise-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-enterprise

# RHEL/CentOS
sudo tee /etc/yum.repos.d/mongodb-enterprise-6.0.repo <<EOF
[mongodb-enterprise-6.0]
name=MongoDB Enterprise Repository
baseurl=https://repo.mongodb.com/yum/redhat/8/mongodb-enterprise/6.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-6.0.asc
EOF
sudo yum install -y mongodb-enterprise
```

### Step 2: Generate Encryption Key

```bash
# Generate a master key (32 bytes for AES-256)
openssl rand -base64 32 > /etc/mongodb/mongodb-keyfile

# Set proper permissions
sudo chmod 600 /etc/mongodb/mongodb-keyfile
sudo chown mongodb:mongodb /etc/mongodb/mongodb-keyfile
```

### Step 3: Configure MongoDB with Encryption

Edit `/etc/mongod.conf`:

```yaml
# MongoDB Configuration with Encryption at Rest

storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true
  engine: wiredTiger
  wiredTiger:
    engineConfig:
      # Enable encryption at rest
      encryptionAtRest:
        enabled: true
        # Local key file method (for development/staging)
        keyManagement:
          method: keyFile
          keyFile: /etc/mongodb/mongodb-keyfile
        # Encryption cipher (AES256-CBC or AES256-GCM)
        cipher: AES256-GCM

# Network settings
net:
  port: 27017
  bindIp: 127.0.0.1
  # Enable TLS/SSL
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/mongodb/mongodb-cert.pem
    CAFile: /etc/mongodb/ca.pem

# Security settings
security:
  authorization: enabled
  # Enable encryption key rotation
  keyFile: /etc/mongodb/mongodb-keyfile

# Replication (recommended for production)
replication:
  replSetName: cryptons-rs

# System log
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

# Process management
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
```

### Step 4: Configure with Cloud KMS (Production Recommended)

For AWS KMS:

```yaml
storage:
  wiredTiger:
    engineConfig:
      encryptionAtRest:
        enabled: true
        keyManagement:
          method: aws
          aws:
            accessKeyId: YOUR_AWS_ACCESS_KEY
            secretAccessKey: YOUR_AWS_SECRET_KEY
            region: us-east-1
            # Master key ARN
            customerMasterKey: arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012
```

For Google Cloud KMS:

```yaml
storage:
  wiredTiger:
    engineConfig:
      encryptionAtRest:
        enabled: true
        keyManagement:
          method: gcp
          gcp:
            serviceAccountKey: /path/to/service-account-key.json
            projectId: your-project-id
            location: us-east1
            keyRing: cryptons-keyring
            keyName: mongodb-encryption-key
```

For Azure Key Vault:

```yaml
storage:
  wiredTiger:
    engineConfig:
      encryptionAtRest:
        enabled: true
        keyManagement:
          method: azure
          azure:
            clientId: YOUR_CLIENT_ID
            clientSecret: YOUR_CLIENT_SECRET
            tenantId: YOUR_TENANT_ID
            keyVaultURL: https://your-keyvault.vault.azure.net
            keyName: mongodb-encryption-key
```

### Step 5: Restart MongoDB

```bash
# Stop MongoDB
sudo systemctl stop mongod

# Start with encryption enabled
sudo systemctl start mongod

# Check status
sudo systemctl status mongod

# Verify encryption is enabled
mongo --eval "db.serverStatus().encryptionAtRest"
```

### Step 6: Update Connection String

Update `.env`:

```env
# MongoDB with TLS and authentication
MONGODB_URI=mongodb://username:password@localhost:27017/cryptons?tls=true&tlsCAFile=/etc/mongodb/ca.pem&authSource=admin
```

### Step 7: Verify Encryption

```javascript
// Verification script: scripts/verify-encryption.js
const { MongoClient } = require('mongodb');

const verifyEncryption = async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const admin = client.db().admin();
    const status = await admin.serverStatus();
    
    console.log('Encryption Status:', status.encryptionAtRest);
    
    if (status.encryptionAtRest?.enabled) {
      console.log('✅ Encryption at rest is ENABLED');
      console.log('Cipher:', status.encryptionAtRest.cipher);
      console.log('Key management:', status.encryptionAtRest.keyManagement);
    } else {
      console.log('❌ Encryption at rest is NOT ENABLED');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
};

verifyEncryption();
```

Run verification:
```bash
node scripts/verify-encryption.js
```

## Implementation: File System Encryption (Alternative)

### For Linux (LUKS)

```bash
# 1. Install cryptsetup
sudo apt-get install cryptsetup

# 2. Create encrypted partition
sudo cryptsetup luksFormat /dev/sdb1

# 3. Open encrypted partition
sudo cryptsetup luksOpen /dev/sdb1 mongodb-data

# 4. Format and mount
sudo mkfs.ext4 /dev/mapper/mongodb-data
sudo mkdir -p /var/lib/mongodb-encrypted
sudo mount /dev/mapper/mongodb-data /var/lib/mongodb-encrypted

# 5. Update MongoDB data path
# Edit /etc/mongod.conf
storage:
  dbPath: /var/lib/mongodb-encrypted
```

### For Docker Volumes

```yaml
# docker-compose.yml with encrypted volumes
version: '3.8'

services:
  mongodb:
    image: mongo:6-enterprise
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=${MONGODB_ROOT_PASSWORD}
    volumes:
      - mongodb-data:/data/db
      - mongodb-config:/data/configdb
      - ./mongodb-keyfile:/etc/mongodb/mongodb-keyfile:ro
    command: >
      --enableEncryption
      --encryptionKeyFile /etc/mongodb/mongodb-keyfile
      --encryptionCipherMode AES256-GCM
    networks:
      - cryptons-network

volumes:
  mongodb-data:
    driver: local
    driver_opts:
      type: none
      o: bind,encryption=aes256
      device: /encrypted/mongodb/data
```

### For Kubernetes

```yaml
# kubernetes/mongodb-encryption.yaml
apiVersion: v1
kind: Secret
metadata:
  name: mongodb-encryption-key
type: Opaque
data:
  keyfile: <base64-encoded-key>
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
spec:
  serviceName: mongodb
  replicas: 3
  template:
    spec:
      containers:
      - name: mongodb
        image: mongo:6-enterprise
        command:
        - mongod
        - --enableEncryption
        - --encryptionKeyFile
        - /etc/mongodb/keyfile
        - --encryptionCipherMode
        - AES256-GCM
        volumeMounts:
        - name: mongodb-data
          mountPath: /data/db
        - name: mongodb-key
          mountPath: /etc/mongodb
          readOnly: true
      volumes:
      - name: mongodb-key
        secret:
          secretName: mongodb-encryption-key
  volumeClaimTemplates:
  - metadata:
      name: mongodb-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: encrypted-storage
      resources:
        requests:
          storage: 100Gi
```

## Application-Level Field Encryption

For sensitive fields only:

```javascript
// src/utils/fieldEncryption.js
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY; // 32 bytes
const ALGORITHM = 'aes-256-gcm';

class FieldEncryption {
  /**
   * Encrypt a field value
   * @param {string} text - Plain text to encrypt
   * @returns {object} - { encrypted, iv, authTag }
   */
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  /**
   * Decrypt a field value
   * @param {object} data - { encrypted, iv, authTag }
   * @returns {string} - Decrypted plain text
   */
  decrypt(data) {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      Buffer.from(data.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
    
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

module.exports = new FieldEncryption();
```

Usage in models:

```javascript
// src/models/User.js
const fieldEncryption = require('../utils/fieldEncryption');

// Encrypt sensitive fields before save
UserSchema.pre('save', function(next) {
  if (this.isModified('ssn')) {
    const encrypted = fieldEncryption.encrypt(this.ssn);
    this.ssn_encrypted = encrypted.encrypted;
    this.ssn_iv = encrypted.iv;
    this.ssn_authTag = encrypted.authTag;
    this.ssn = undefined; // Remove plain text
  }
  next();
});

// Decrypt when retrieving
UserSchema.methods.getSSN = function() {
  if (this.ssn_encrypted) {
    return fieldEncryption.decrypt({
      encrypted: this.ssn_encrypted,
      iv: this.ssn_iv,
      authTag: this.ssn_authTag
    });
  }
  return null;
};
```

## Environment Variables

Add to `.env`:

```env
# Database Encryption
MONGODB_ENCRYPTION_ENABLED=true
MONGODB_ENCRYPTION_KEY_FILE=/etc/mongodb/mongodb-keyfile
MONGODB_ENCRYPTION_CIPHER=AES256-GCM

# Field-Level Encryption (if using)
FIELD_ENCRYPTION_KEY=generate-64-char-hex-string-here

# TLS/SSL Configuration
MONGODB_TLS_ENABLED=true
MONGODB_TLS_CA_FILE=/etc/mongodb/ca.pem
MONGODB_TLS_CERT_FILE=/etc/mongodb/mongodb-cert.pem
```

## Key Management Best Practices

### Key Generation

```bash
# Generate encryption key
openssl rand -hex 32 > encryption-key.txt

# Store securely (never commit to git)
export MONGODB_ENCRYPTION_KEY=$(cat encryption-key.txt)
```

### Key Rotation

```javascript
// scripts/rotate-encryption-key.js
const { MongoClient } = require('mongodb');

const rotateEncryptionKey = async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const admin = client.db().admin();
    
    // Rotate encryption key
    await admin.command({
      rotateMasterKey: 1,
      newKeyManagement: {
        method: 'aws',
        aws: {
          customerMasterKey: process.env.NEW_KMS_KEY_ARN
        }
      }
    });
    
    console.log('✅ Encryption key rotated successfully');
  } catch (error) {
    console.error('❌ Key rotation failed:', error);
  } finally {
    await client.close();
  }
};

rotateEncryptionKey();
```

### Key Storage

**DON'T:**
- ❌ Store keys in source code
- ❌ Store keys in environment variables (production)
- ❌ Commit keys to version control
- ❌ Share keys via email or chat

**DO:**
- ✅ Use cloud KMS (AWS KMS, Google Cloud KMS, Azure Key Vault)
- ✅ Use hardware security modules (HSM) for production
- ✅ Implement key rotation
- ✅ Maintain key backup with proper security
- ✅ Use separate keys for different environments

## Testing

### Verify Encryption

```bash
# Test reading raw database files
sudo cat /var/lib/mongodb/collection-0--123456789.wt | strings

# Should NOT see any sensitive data in plain text
# Should see encrypted binary data
```

### Performance Testing

```javascript
// Test encryption performance impact
const { performance } = require('perf_hooks');

const testPerformance = async () => {
  const iterations = 10000;
  
  // Without encryption
  const startWithout = performance.now();
  // ... perform operations
  const endWithout = performance.now();
  
  // With encryption
  const startWith = performance.now();
  // ... perform operations
  const endWith = performance.now();
  
  console.log(`Without encryption: ${endWithout - startWithout}ms`);
  console.log(`With encryption: ${endWith - startWith}ms`);
  console.log(`Overhead: ${((endWith - startWith) / (endWithout - startWithout) - 1) * 100}%`);
};
```

## Monitoring

```javascript
// Monitor encryption status
const monitorEncryption = async () => {
  const status = await db.serverStatus();
  
  if (!status.encryptionAtRest?.enabled) {
    logger.error('CRITICAL: Database encryption is disabled!');
    // Send alert
    await alertSecurityTeam('Database encryption disabled');
  }
};

// Run every hour
setInterval(monitorEncryption, 3600000);
```

## Compliance

### GDPR Requirements
- ✅ Encryption at rest for personal data
- ✅ Right to erasure support
- ✅ Data breach notification capability
- ✅ Data portability support

### PCI DSS Requirements
- ✅ Cardholder data encryption
- ✅ Key management procedures
- ✅ Encryption key rotation
- ✅ Access controls for keys

## Backup and Recovery

```bash
# Backup encrypted database
mongodump --uri="mongodb://localhost:27017" --out=/backup/encrypted-$(date +%Y%m%d)

# Restore (encryption keys required)
mongorestore --uri="mongodb://localhost:27017" /backup/encrypted-20241005

# Note: Backups are encrypted with same key
# Store backup encryption keys separately
```

## Cost Estimate

### MongoDB Enterprise License
- **Small Deployment**: $57/month per server
- **Production Cluster**: $600-2000/month (3-5 servers)

### Cloud KMS
- **AWS KMS**: $1/month per key + $0.03 per 10,000 requests
- **Google Cloud KMS**: $0.06 per key version per month
- **Azure Key Vault**: $0.03 per 10,000 operations

### Implementation Effort
- **Setup**: 20-40 hours
- **Testing**: 20-30 hours
- **Documentation**: 10-15 hours
- **Total**: 50-85 hours

## Success Criteria

- ✅ MongoDB encryption at rest enabled
- ✅ TLS/SSL enabled for connections
- ✅ Keys stored in secure vault
- ✅ Key rotation procedure documented
- ✅ Backup encryption verified
- ✅ Performance impact < 10%
- ✅ Compliance requirements met
- ✅ Monitoring and alerting configured

---

**Status**: Implementation Required  
**Owner**: DevOps + Backend Team  
**Priority**: CRITICAL  
**Estimated Effort**: 50-85 hours
