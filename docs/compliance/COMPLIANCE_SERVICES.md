# Compliance Services Documentation

This document provides an overview of the Phase 3 Compliance Foundation implementation for Cryptons.com.

## Overview

The compliance framework provides essential regulatory compliance services required for operating a cryptocurrency trading platform. This includes KYC/AML, GDPR data protection, transaction monitoring, and regulatory reporting.

## Architecture

### Models

#### KYCVerification
Stores user identity verification data including personal information, documents, and verification status.

**Fields:**
- `user` - Reference to User
- `status` - pending, in_review, approved, rejected, expired
- `riskLevel` - low, medium, high
- `personalInfo` - Name, DOB, address, nationality
- `documents` - Uploaded verification documents
- `provider` - jumio, onfido, sumsub, manual
- `verificationMethod` - manual, automated, video_call

#### AMLAlert
Tracks anti-money laundering alerts and suspicious activities.

**Types:**
- CTR_REQUIRED - Currency Transaction Report
- SAR_REQUIRED - Suspicious Activity Report
- POTENTIAL_STRUCTURING - Multiple transactions below threshold
- SANCTIONS_HIT - Sanctioned entity detected
- HIGH_RISK_COUNTRY - Transaction from high-risk jurisdiction
- UNUSUAL_PATTERN - Abnormal transaction behavior

#### SanctionsScreening
Records sanctions list screening results against OFAC, UN, EU lists.

#### ComplianceCase
Manages compliance investigation cases with workflow tracking.

#### UserConsent
Tracks user consent for data processing, marketing, cookies (GDPR compliance).

#### AuditLog
Comprehensive audit trail for all system actions.

#### LegalDocument
Manages legal documents (Terms of Service, Privacy Policy, etc.) with versioning.

#### DataRetentionPolicy
Defines data retention periods for different data types.

## Services

### 1. KYC Service (`src/services/kyc.js`)

**Purpose:** Customer identity verification

**Key Functions:**
```javascript
// Start verification process
await kycService.startVerification(userId, userData, provider);

// Update verification status
await kycService.updateVerificationStatus(verificationId, 'approved', notes, verifiedBy);

// Check verification status
await kycService.checkVerificationStatus(userId);

// Submit documents
await kycService.submitDocuments(userId, documents);

// Enhanced due diligence
await kycService.performEnhancedDueDiligence(userId);
```

**Providers Supported:**
- Jumio
- Onfido
- Sumsub
- Manual verification

### 2. AML Service (`src/services/aml.js`)

**Purpose:** Anti-money laundering monitoring

**Key Functions:**
```javascript
// Monitor transaction
await amlService.monitorTransaction(transaction);

// Detect structuring (smurfing)
await amlService.detectStructuring(userId, transaction);

// Generate SAR
await amlService.generateSAR(alertId, reportData);

// Resolve alert
await amlService.resolveAlert(alertId, resolution);
```

**Detection Rules:**
- Large transactions (≥ $10,000) → CTR required
- Multiple transactions just below threshold → Structuring alert
- Rapid succession of transactions → High-frequency alert
- Unusual patterns compared to user history

### 3. Sanctions Screening Service (`src/services/sanctions.js`)

**Purpose:** Screen against sanctions lists

**Key Functions:**
```javascript
// Screen user
await sanctionsService.screenUser(userId, userData);

// Re-screen (periodic)
await sanctionsService.rescreenUser(userId);

// Review potential match
await sanctionsService.reviewMatch(screeningId, reviewData);
```

**Lists Checked:**
- OFAC (US Treasury)
- UN Sanctions
- EU Sanctions
- UK HMT

### 4. Transaction Monitoring Service (`src/services/transactionMonitoring.js`)

**Purpose:** Real-time transaction monitoring

**Key Functions:**
```javascript
// Pre-transaction monitoring
await transactionMonitoring.monitorBeforeTransaction(transaction, user);

// Post-transaction monitoring
await transactionMonitoring.monitorAfterTransaction(transaction);

// Generate monitoring report
await transactionMonitoring.generateMonitoringReport(startDate, endDate);
```

### 5. GDPR Service (`src/services/gdpr.js`)

**Purpose:** GDPR data subject rights

**Key Functions:**
```javascript
// Data access request (Right to Access)
await gdprService.handleDataAccessRequest(userId);

// Data rectification (Right to Rectification)
await gdprService.handleRectificationRequest(userId, updates);

// Data erasure (Right to be Forgotten)
await gdprService.handleErasureRequest(userId, reason);

// Data portability
await gdprService.handlePortabilityRequest(userId, format);
```

### 6. Consent Management Service (`src/services/consentManagement.js`)

**Purpose:** User consent tracking

**Key Functions:**
```javascript
// Record consent
await consentManagement.recordConsent(userId, consentData);

// Check consent
await consentManagement.hasConsent(userId, consentType);

// Revoke consent
await consentManagement.revokeConsent(userId, consentType);

// Check required consents
await consentManagement.checkRequiredConsents(userId);
```

### 7. Audit Trail Service (`src/services/auditTrail.js`)

**Purpose:** Comprehensive audit logging

**Key Functions:**
```javascript
// Log event
await auditTrail.log(eventData);

// Log authentication
await auditTrail.logAuth(userId, action, status, ipAddress);

// Get audit logs
await auditTrail.getLogs(filters);

// Generate audit report
await auditTrail.generateReport(startDate, endDate);
```

**Categories:**
- auth - Authentication events
- transaction - Transaction operations
- user - User actions
- admin - Administrative actions
- compliance - Compliance activities
- system - System events

### 8. Compliance Reporting Service (`src/services/complianceReporting.js`)

**Purpose:** Regulatory reporting

**Key Functions:**
```javascript
// Generate CTR
await complianceReporting.generateCTR(transactionId);

// Generate SAR
await complianceReporting.generateSAR(alertId, details);

// Monthly regulatory report
await complianceReporting.generateMonthlyReport(year, month);

// Tax report
await complianceReporting.generateTaxReport(userId, taxYear);
```

### 9. Risk Scoring Service (`src/services/riskScoring.js`)

**Purpose:** ML-based risk assessment

**Key Functions:**
```javascript
// Calculate transaction risk
await riskScoring.calculateTransactionRisk(transaction, user, userHistory);

// Calculate user risk profile
await riskScoring.calculateUserRiskProfile(userId);

// Get recommendations
riskScoring.getRiskRecommendations(riskScore, riskLevel);
```

**Risk Factors:**
- Transaction amount (30% weight)
- Transaction frequency (20% weight)
- User history (20% weight)
- Geography (15% weight)
- Time patterns (15% weight)

### 10. Legal Documents Service (`src/services/legalDocuments.js`)

**Purpose:** Legal document management

**Key Functions:**
```javascript
// Create document
await legalDocuments.createDocument(documentData);

// Get active document
await legalDocuments.getActiveDocument(type, language);

// Activate document
await legalDocuments.activateDocument(documentId, approvedBy);

// Generate templates
await legalDocuments.generateTermsOfService(companyInfo);
await legalDocuments.generatePrivacyPolicy(companyInfo);
```

### 11. Data Retention Service (`src/services/dataRetention.js`)

**Purpose:** Automated data retention and purging

**Key Functions:**
```javascript
// Set retention policy
await dataRetention.setRetentionPolicy(dataType, retentionDays);

// Run cleanup
await dataRetention.runCleanup();

// Initialize default policies
await dataRetention.initializeDefaultPolicies();
```

**Default Retention Periods:**
- Audit logs: 2555 days (7 years)
- Transaction records: 2555 days (7 years)
- KYC documents: 1825 days (5 years)
- User sessions: 90 days
- Marketing data: 730 days (2 years)

### 12. Privacy Controls Service (`src/services/privacyControls.js`)

**Purpose:** User privacy settings management

**Key Functions:**
```javascript
// Update privacy settings
await privacyControls.updatePrivacySettings(userId, settings);

// Check data sharing permission
await privacyControls.canShareData(userId, purpose);

// Export user data
await privacyControls.exportUserData(userId);
```

### 13. Compliance Officer Service (`src/services/complianceOfficer.js`)

**Purpose:** Compliance case management

**Key Functions:**
```javascript
// Create case
await complianceOfficer.createCase(caseData);

// Assign case
await complianceOfficer.assignCase(caseId, officerId);

// Update status
await complianceOfficer.updateCaseStatus(caseId, status, notes);

// Get dashboard
await complianceOfficer.getDashboard();
```

### 14. Regulatory Calendar Service (`src/services/regulatoryCalendar.js`)

**Purpose:** Compliance deadlines and reminders

**Key Functions:**
```javascript
// Get upcoming deadlines
await regulatoryCalendar.getUpcomingDeadlines(days);

// Get overdue items
await regulatoryCalendar.getOverdueItems();

// Generate calendar
await regulatoryCalendar.generateCalendar(startDate, endDate);
```

## Configuration

### Environment Variables

```bash
# KYC/AML Configuration
KYC_PROVIDER=manual
JUMIO_API_TOKEN=
ONFIDO_API_TOKEN=
SUMSUB_APP_TOKEN=
AML_ENABLED=true
SANCTIONS_API_KEY=
RISK_THRESHOLD_HIGH=85
RISK_THRESHOLD_MEDIUM=50
AUTO_BLOCK_THRESHOLD=95
MANUAL_REVIEW_THRESHOLD=75

# GDPR Configuration
GDPR_ENABLED=true
DATA_RETENTION_DAYS=2555
CONSENT_REQUIRED=true
DATA_CONTROLLER_EMAIL=privacy@cryptons.com

# Regulatory Reporting
FINCEN_ENABLED=false
STATE_REPORTING_ENABLED=false
TAX_REPORTING_ENABLED=false
REPORTING_SCHEDULE=daily

# Compliance Management
COMPLIANCE_OFFICER_EMAIL=compliance@cryptons.com
COMPLIANCE_ALERTS_ENABLED=true
AUDIT_LOGGING_ENABLED=true
RISK_ASSESSMENT_FREQUENCY=monthly
```

## Workflow Examples

### KYC Verification Workflow

1. User submits personal information
2. System calls `kycService.startVerification()`
3. Documents are uploaded via `kycService.submitDocuments()`
4. Compliance officer reviews in dashboard
5. Status updated via `kycService.updateVerificationStatus()`
6. User notified of approval/rejection

### AML Transaction Monitoring Workflow

1. Transaction initiated by user
2. `transactionMonitoring.monitorBeforeTransaction()` called
3. Multiple checks performed:
   - Sanctions screening
   - AML rule checks
   - Risk scoring
4. Decision: approve, require manual review, or block
5. If approved, transaction proceeds
6. `transactionMonitoring.monitorAfterTransaction()` for pattern analysis

### GDPR Data Request Workflow

1. User submits data access request
2. System calls `gdprService.handleDataAccessRequest()`
3. All user data collected from various models
4. Data exported in requested format (JSON/CSV)
5. User receives download link
6. Action logged in audit trail

### Compliance Case Management Workflow

1. Alert triggered (e.g., high-risk transaction)
2. `complianceOfficer.createCase()` automatically or manually
3. Case assigned to compliance officer
4. Investigation performed, actions recorded
5. Case resolved with outcome documented
6. All actions logged in audit trail

## Testing

Run compliance tests:

```bash
npm test tests/compliance.test.js
```

Test coverage includes:
- KYC verification processes
- AML alert generation and resolution
- Sanctions screening
- GDPR data subject rights
- Consent management
- Audit trail logging
- Compliance case management

## Best Practices

1. **Enable audit logging in production** - Set `AUDIT_LOGGING_ENABLED=true`
2. **Configure appropriate risk thresholds** - Adjust based on your risk appetite
3. **Implement periodic sanctions screening** - Re-screen users every 30 days
4. **Review KYC documents promptly** - Establish SLA for verification
5. **Monitor compliance dashboard daily** - Check for high-priority alerts
6. **Regular data retention cleanup** - Run cleanup jobs weekly
7. **Keep legal documents updated** - Review and update quarterly
8. **Train staff on compliance procedures** - Ensure proper case handling

## Regulatory Compliance

This implementation provides the foundation for:

- **FinCEN BSA Compliance** - AML program, CTR/SAR filing
- **GDPR Compliance** - Data subject rights, consent management
- **CCPA Compliance** - Data privacy and consumer rights
- **KYC Regulations** - Identity verification requirements
- **AML/CFT Requirements** - Transaction monitoring, sanctions screening

⚠️ **Important:** This implementation provides the technical framework but does not constitute legal compliance. Always consult with qualified legal counsel and compliance professionals before operating a financial services platform.

## Support and Documentation

- [Compliance Checklist](./COMPLIANCE_CHECKLIST.md)
- [Compliance Audit](../../audit/COMPLIANCE_AUDIT.md)
- [Security Documentation](../security/README.md)
- [API Documentation](../api/README.md)

## License

This compliance framework is part of Cryptons.com and is subject to the same license terms.
