# Getting Started with Compliance Services

This guide helps you get started with the Phase 3 Compliance Foundation features in Cryptons.com.

## Prerequisites

- Node.js 16+ installed
- MongoDB running
- All environment variables configured in `.env`

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

The following compliance-related dependencies are now included:
- `crypto-js` - Encryption utilities
- `pdf-lib` - PDF document generation

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure the compliance settings:

```bash
cp .env.example .env
```

**Essential Settings:**

```env
# Enable AML monitoring
AML_ENABLED=true

# Enable GDPR features
GDPR_ENABLED=true

# Enable audit logging
AUDIT_LOGGING_ENABLED=true

# Compliance officer email
COMPLIANCE_OFFICER_EMAIL=compliance@yourcompany.com

# Data controller email
DATA_CONTROLLER_EMAIL=privacy@yourcompany.com
```

**Optional KYC Provider Configuration:**

```env
# Choose provider: manual, jumio, onfido, or sumsub
KYC_PROVIDER=manual

# If using Jumio
JUMIO_API_TOKEN=your-token
JUMIO_API_SECRET=your-secret

# If using Onfido
ONFIDO_API_TOKEN=your-token

# If using Sumsub
SUMSUB_APP_TOKEN=your-token
```

### 3. Initialize Data Retention Policies

Run this to set up default data retention policies:

```javascript
const dataRetention = require('./src/services/dataRetention');

async function initialize() {
  await dataRetention.initializeDefaultPolicies();
  console.log('Data retention policies initialized');
}

initialize();
```

### 4. Test Compliance Services

Run the compliance test suite:

```bash
npm test tests/compliance.test.js
```

## Usage Examples

### KYC Verification

```javascript
const kycService = require('./src/services/kyc');

// Start KYC verification for a user
const userData = {
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: new Date('1990-01-01'),
  nationality: 'US',
  address: {
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    country: 'US',
    postalCode: '10001'
  }
};

const result = await kycService.startVerification(userId, userData, 'manual');
console.log('Verification started:', result.verificationId);

// Check verification status
const status = await kycService.checkVerificationStatus(userId);
console.log('Verification status:', status.status);

// Update verification (compliance officer action)
await kycService.updateVerificationStatus(
  verificationId,
  'approved',
  'Documents verified',
  officerId
);
```

### Transaction Monitoring

```javascript
const transactionMonitoring = require('./src/services/transactionMonitoring');
const User = require('./src/models/User');

// Monitor transaction before execution
const user = await User.findById(userId);
const transaction = {
  fiatAmount: 5000,
  cryptocurrency: 'BTC',
  cryptoAmount: 0.1
};

const monitoringResult = await transactionMonitoring.monitorBeforeTransaction(
  transaction,
  user
);

if (!monitoringResult.approved) {
  console.log('Transaction blocked:', monitoringResult.checks);
} else if (monitoringResult.requiresManualReview) {
  console.log('Transaction requires manual review');
} else {
  console.log('Transaction approved');
  // Proceed with transaction
}
```

### GDPR Data Request

```javascript
const gdprService = require('./src/services/gdpr');

// Handle data access request
const dataExport = await gdprService.handleDataAccessRequest(userId);
console.log('User data exported:', dataExport.data);

// Handle data erasure request
const erasureResult = await gdprService.handleErasureRequest(
  userId,
  'User requested account deletion'
);

if (erasureResult.success) {
  console.log('User data has been anonymized');
} else {
  console.log('Cannot erase data:', erasureResult.reason);
}
```

### Consent Management

```javascript
const consentManagement = require('./src/services/consentManagement');

// Record user consent
await consentManagement.recordConsent(userId, {
  type: 'terms_of_service',
  version: '1.0',
  granted: true,
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});

// Check if user has required consents
const consentCheck = await consentManagement.checkRequiredConsents(userId);

if (!consentCheck.hasAllRequired) {
  console.log('Missing consents:', consentCheck.missing);
  // Redirect to consent page
}
```

### Audit Trail

```javascript
const auditTrail = require('./src/services/auditTrail');

// Log user action
await auditTrail.logUserAction(
  userId,
  'update_profile',
  'user_profile',
  userId,
  { name: { old: 'John', new: 'John Doe' } },
  req.ip
);

// Get audit trail for a user
const logs = await auditTrail.getUserActivity(userId, 50);
console.log('User activity:', logs);
```

### Compliance Case Management

```javascript
const complianceOfficer = require('./src/services/complianceOfficer');

// Create compliance case
const newCase = await complianceOfficer.createCase({
  type: 'AML',
  userId: userId,
  priority: 'high',
  description: 'Multiple high-value transactions detected',
  dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
});

// Assign case to officer
await complianceOfficer.assignCase(newCase.case._id, officerId);

// Add action to case
await complianceOfficer.addCaseAction(newCase.case._id, {
  action: 'review_transactions',
  performedBy: officerId,
  notes: 'Reviewed last 30 days of transactions'
});

// Resolve case
await complianceOfficer.updateCaseStatus(
  newCase.case._id,
  'resolved',
  'Transactions verified as legitimate'
);
```

## Integration with Express Routes

### Example: KYC Verification Endpoint

```javascript
const express = require('express');
const router = express.Router();
const kycService = require('../services/kyc');
const { authenticate } = require('../middleware/auth');

// Start KYC verification
router.post('/kyc/start', authenticate, async (req, res) => {
  try {
    const result = await kycService.startVerification(
      req.user.id,
      req.body,
      'manual'
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get KYC status
router.get('/kyc/status', authenticate, async (req, res) => {
  try {
    const status = await kycService.checkVerificationStatus(req.user.id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Example: GDPR Data Request Endpoint

```javascript
const express = require('express');
const router = express.Router();
const gdprService = require('../services/gdpr');
const { authenticate } = require('../middleware/auth');

// Data access request
router.post('/gdpr/access', authenticate, async (req, res) => {
  try {
    const data = await gdprService.handleDataAccessRequest(req.user.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Data erasure request
router.post('/gdpr/erasure', authenticate, async (req, res) => {
  try {
    const result = await gdprService.handleErasureRequest(
      req.user.id,
      req.body.reason
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Example: Transaction Monitoring Middleware

```javascript
const transactionMonitoring = require('../services/transactionMonitoring');

async function monitorTransaction(req, res, next) {
  try {
    const transaction = req.body;
    const user = req.user;

    const result = await transactionMonitoring.monitorBeforeTransaction(
      transaction,
      user
    );

    if (!result.approved) {
      return res.status(403).json({
        error: 'Transaction blocked by compliance',
        checks: result.checks
      });
    }

    if (result.requiresManualReview) {
      // Flag for manual review
      req.requiresComplianceReview = true;
    }

    req.complianceChecks = result.checks;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { monitorTransaction };
```

## Dashboard Integration

### Compliance Dashboard Data

```javascript
const complianceOfficer = require('../services/complianceOfficer');
const complianceReporting = require('../services/complianceReporting');

// Get dashboard data
router.get('/compliance/dashboard', authenticate, authorize('admin'), async (req, res) => {
  try {
    const dashboard = await complianceOfficer.getDashboard();
    const reportingData = await complianceReporting.generateDashboardData();
    
    res.json({
      cases: dashboard,
      reporting: reportingData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Scheduled Tasks

### Daily Compliance Tasks

Set up cron jobs or scheduled tasks for:

```javascript
const cron = require('node-cron');
const dataRetention = require('./src/services/dataRetention');
const sanctionsService = require('./src/services/sanctions');
const complianceReporting = require('./src/services/complianceReporting');

// Daily data retention cleanup (runs at 2 AM)
cron.schedule('0 2 * * *', async () => {
  console.log('Running data retention cleanup...');
  await dataRetention.runCleanup();
});

// Daily sanctions re-screening (runs at 3 AM)
cron.schedule('0 3 * * *', async () => {
  console.log('Running sanctions re-screening...');
  const usersToScreen = await sanctionsService.getUsersRequiringScreening();
  for (const user of usersToScreen) {
    await sanctionsService.rescreenUser(user.user._id);
  }
});

// Daily transaction summary report (runs at 11 PM)
cron.schedule('0 23 * * *', async () => {
  console.log('Generating daily summary report...');
  await complianceReporting.generateDailySummaryReport();
});
```

## Monitoring and Alerts

### Set Up Compliance Alerts

```javascript
const amlService = require('./src/services/aml');

// Configure alert notifications
process.env.COMPLIANCE_OFFICER_EMAIL = 'compliance@yourcompany.com';
process.env.COMPLIANCE_ALERTS_ENABLED = 'true';

// Alerts are automatically sent for:
// - Critical AML alerts
// - High-severity sanctions hits
// - Structuring detection
// - Large transactions (CTR required)
```

## Best Practices

1. **Regular Reviews**: Review compliance cases daily
2. **Timely Responses**: Respond to GDPR requests within 30 days
3. **Keep Records**: Maintain audit trails for 7 years minimum
4. **Stay Updated**: Review legal documents quarterly
5. **Test Regularly**: Run compliance tests before deployments
6. **Monitor Dashboards**: Check compliance dashboard daily
7. **Update Policies**: Review data retention policies annually
8. **Train Staff**: Ensure compliance team understands procedures

## Troubleshooting

### Common Issues

**Issue: KYC verification not starting**
```
Solution: Check KYC_PROVIDER is set correctly and provider credentials are valid
```

**Issue: AML alerts not generating**
```
Solution: Ensure AML_ENABLED=true in environment variables
```

**Issue: Audit logs not being created**
```
Solution: Verify AUDIT_LOGGING_ENABLED=true
```

**Issue: Data retention cleanup not running**
```
Solution: Check data retention policies are initialized
```

## Next Steps

1. Review [Compliance Services Documentation](./COMPLIANCE_SERVICES.md)
2. Configure production environment variables
3. Set up scheduled tasks for compliance automation
4. Integrate compliance endpoints into your API
5. Train compliance officers on dashboard usage
6. Establish compliance workflows and procedures
7. Consult with legal counsel for final compliance review

## Support

For questions or issues:
- Review documentation in `docs/compliance/`
- Check audit reports in `audit/`
- Consult with qualified legal and compliance professionals

## Legal Disclaimer

⚠️ This compliance framework provides the technical infrastructure but does not guarantee legal compliance. Always consult with qualified legal counsel, compliance professionals, and regulatory experts before operating a financial services platform.
