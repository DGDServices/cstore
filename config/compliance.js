/**
 * Compliance Configuration
 * Centralized configuration for compliance services
 */

module.exports = {
  // KYC Configuration
  kyc: {
    enabled: true,
    provider: process.env.KYC_PROVIDER || 'manual',
    verificationRequired: true,
    documentTypes: ['passport', 'drivers_license', 'national_id', 'proof_of_address'],
    expiryDays: 365, // KYC verification expires after 1 year
    riskLevels: ['low', 'medium', 'high']
  },

  // AML Configuration
  aml: {
    enabled: process.env.AML_ENABLED === 'true',
    ctrThreshold: 10000, // Currency Transaction Report threshold (USD)
    structuringThreshold: 9000, // Transactions just below CTR threshold
    structuringCount: 3, // Number of transactions to trigger structuring alert
    rapidSuccessionWindow: 1, // Hours
    rapidSuccessionCount: 5, // Number of transactions
    monitoringEnabled: true
  },

  // Risk Scoring Configuration
  risk: {
    thresholds: {
      low: 30,
      medium: 60,
      high: 80,
      critical: 95
    },
    autoBlockThreshold: parseInt(process.env.AUTO_BLOCK_THRESHOLD) || 95,
    manualReviewThreshold: parseInt(process.env.MANUAL_REVIEW_THRESHOLD) || 75,
    weights: {
      amount: 0.3,
      frequency: 0.2,
      userHistory: 0.2,
      geography: 0.15,
      timePattern: 0.15
    }
  },

  // Sanctions Screening Configuration
  sanctions: {
    enabled: process.env.AML_ENABLED === 'true',
    lists: ['OFAC', 'UN', 'EU', 'UK_HMT'],
    rescreeningDays: 30, // Re-screen users every 30 days
    highRiskCountries: ['IR', 'KP', 'SY', 'CU', 'MM', 'VE', 'AF', 'IQ', 'LY', 'SO'],
    matchThresholds: {
      confirmed: 90, // 90% match = confirmed match
      potential: 70  // 70-89% match = potential match
    }
  },

  // GDPR Configuration
  gdpr: {
    enabled: process.env.GDPR_ENABLED !== 'false',
    dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS) || 2555, // 7 years
    consentRequired: process.env.CONSENT_REQUIRED !== 'false',
    dataControllerEmail: process.env.DATA_CONTROLLER_EMAIL || 'privacy@cryptons.com',
    erasureGracePeriod: 30, // Days before actual erasure
    portabilityFormats: ['json', 'csv'],
    subjectRights: [
      'access',        // Right to access
      'rectification', // Right to rectification
      'erasure',       // Right to be forgotten
      'portability',   // Right to data portability
      'restriction',   // Right to restriction of processing
      'objection'      // Right to object
    ]
  },

  // Data Retention Configuration
  dataRetention: {
    enabled: true,
    policies: {
      auditLogs: {
        retentionDays: 2555, // 7 years (regulatory requirement)
        deleteAfterExpiry: false,
        archiveBeforeDelete: true
      },
      transactionRecords: {
        retentionDays: 2555, // 7 years (regulatory requirement)
        deleteAfterExpiry: false,
        archiveBeforeDelete: true
      },
      kycDocuments: {
        retentionDays: 1825, // 5 years
        deleteAfterExpiry: false,
        archiveBeforeDelete: true
      },
      userSessions: {
        retentionDays: 90,
        deleteAfterExpiry: true,
        archiveBeforeDelete: false
      },
      marketingData: {
        retentionDays: 730, // 2 years
        deleteAfterExpiry: true,
        archiveBeforeDelete: false
      }
    }
  },

  // Audit Trail Configuration
  audit: {
    enabled: process.env.AUDIT_LOGGING_ENABLED !== 'false',
    categories: ['auth', 'transaction', 'user', 'admin', 'compliance', 'system'],
    logSensitiveData: false, // Don't log passwords, tokens, etc.
    retentionDays: 2555 // 7 years
  },

  // Regulatory Reporting Configuration
  reporting: {
    fincen: {
      enabled: process.env.FINCEN_ENABLED === 'true',
      bsaId: process.env.FINCEN_BSA_ID,
      userId: process.env.FINCEN_USER_ID
    },
    state: {
      enabled: process.env.STATE_REPORTING_ENABLED === 'true'
    },
    tax: {
      enabled: process.env.TAX_REPORTING_ENABLED === 'true'
    },
    schedule: process.env.REPORTING_SCHEDULE || 'daily',
    formats: ['json', 'xml', 'csv']
  },

  // Compliance Case Management Configuration
  cases: {
    priorities: ['low', 'medium', 'high', 'critical'],
    types: ['KYC', 'AML', 'SAR', 'CTR', 'SANCTIONS', 'GDPR', 'OTHER'],
    statuses: ['open', 'investigating', 'pending_decision', 'resolved', 'closed'],
    defaultDueDays: {
      critical: 1,
      high: 3,
      medium: 7,
      low: 14
    },
    escalationDays: {
      critical: 0.5,
      high: 1,
      medium: 3,
      low: 7
    }
  },

  // Legal Documents Configuration
  legal: {
    jurisdiction: process.env.LEGAL_JURISDICTION || 'US',
    documentTypes: [
      'terms_of_service',
      'privacy_policy',
      'risk_disclosure',
      'aml_policy',
      'cookie_policy'
    ],
    currentVersions: {
      terms: process.env.TERMS_VERSION || '1.0',
      privacy: process.env.PRIVACY_VERSION || '1.0',
      riskDisclosure: process.env.RISK_DISCLOSURE_VERSION || '1.0'
    },
    requireSignature: false, // Set to true if using DocuSign
    signingProvider: process.env.DOCUMENT_SIGNING_PROVIDER || 'manual'
  },

  // Consent Management Configuration
  consent: {
    types: [
      'terms_of_service',
      'privacy_policy',
      'marketing',
      'data_processing',
      'cookies'
    ],
    requiredTypes: ['terms_of_service', 'privacy_policy'],
    expiryDays: 365, // Consents expire after 1 year (re-consent required)
    trackIpAddress: true,
    trackUserAgent: true
  },

  // Privacy Controls Configuration
  privacy: {
    defaultSettings: {
      profileVisibility: 'private',
      shareDataWithThirdParties: false,
      marketingEmails: false,
      transactionHistory: 'private',
      analyticsTracking: false
    },
    allowUserControl: true
  },

  // Regulatory Calendar Configuration
  calendar: {
    riskAssessmentFrequency: process.env.RISK_ASSESSMENT_FREQUENCY || 'monthly',
    policyReviewFrequency: process.env.POLICY_REVIEW_FREQUENCY || 'quarterly',
    reportingSchedule: process.env.REPORTING_SCHEDULE || 'daily',
    reminderDaysBefore: [30, 14, 7, 3, 1] // Send reminders before deadlines
  },

  // Notifications Configuration
  notifications: {
    complianceOfficerEmail: process.env.COMPLIANCE_OFFICER_EMAIL || 'compliance@cryptons.com',
    alertsEnabled: process.env.COMPLIANCE_ALERTS_ENABLED !== 'false',
    severityLevels: {
      critical: {
        email: true,
        sms: false,
        dashboard: true
      },
      high: {
        email: true,
        sms: false,
        dashboard: true
      },
      medium: {
        email: false,
        sms: false,
        dashboard: true
      },
      low: {
        email: false,
        sms: false,
        dashboard: true
      }
    }
  },

  // Transaction Limits Configuration
  limits: {
    dailyUserLimit: 50000, // USD
    dailyTotalLimit: 500000, // USD
    monthlyUserLimit: 200000, // USD
    requireApprovalAbove: 10000, // USD
    autoApprovalLimit: 1000 // USD
  }
};
