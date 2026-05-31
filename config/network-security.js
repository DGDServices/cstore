/**
 * Network Security Configuration
 * Defines network policies, security groups, and firewall rules
 */

module.exports = {
  // Enable network security policies
  enabled: process.env.NETWORK_POLICIES_ENABLED === 'true',

  // VPC Configuration
  vpc: {
    cidr: process.env.VPC_CIDR || '10.0.0.0/16',
    
    // Subnets
    subnets: {
      public: {
        cidr: '10.0.1.0/24',
        availabilityZone: 'us-east-1a'
      },
      private: {
        cidr: '10.0.2.0/24',
        availabilityZone: 'us-east-1a'
      },
      database: {
        cidr: '10.0.3.0/24',
        availabilityZone: 'us-east-1b'
      }
    },
    
    // Network ACLs
    networkACLs: {
      public: {
        ingress: [
          { protocol: 'tcp', port: 80, cidr: '0.0.0.0/0' },
          { protocol: 'tcp', port: 443, cidr: '0.0.0.0/0' }
        ],
        egress: [
          { protocol: 'all', port: 'all', cidr: '0.0.0.0/0' }
        ]
      },
      private: {
        ingress: [
          { protocol: 'tcp', port: 3000, cidr: '10.0.1.0/24' }
        ],
        egress: [
          { protocol: 'all', port: 'all', cidr: '0.0.0.0/0' }
        ]
      },
      database: {
        ingress: [
          { protocol: 'tcp', port: 27017, cidr: '10.0.2.0/24' }
        ],
        egress: []
      }
    }
  },

  // Security Groups
  securityGroups: {
    // Load balancer security group
    loadBalancer: {
      ingress: [
        {
          protocol: 'tcp',
          port: 80,
          source: '0.0.0.0/0',
          description: 'HTTP from anywhere'
        },
        {
          protocol: 'tcp',
          port: 443,
          source: '0.0.0.0/0',
          description: 'HTTPS from anywhere'
        }
      ],
      egress: [
        {
          protocol: 'all',
          port: 'all',
          destination: '0.0.0.0/0'
        }
      ]
    },

    // Application security group
    application: {
      ingress: [
        {
          protocol: 'tcp',
          port: 3000,
          source: 'sg-load-balancer',
          description: 'Application port from load balancer'
        },
        {
          protocol: 'tcp',
          port: 22,
          source: 'sg-bastion',
          description: 'SSH from bastion host'
        }
      ],
      egress: [
        {
          protocol: 'tcp',
          port: 27017,
          destination: 'sg-database',
          description: 'MongoDB'
        },
        {
          protocol: 'tcp',
          port: 6379,
          destination: 'sg-redis',
          description: 'Redis'
        },
        {
          protocol: 'tcp',
          port: 443,
          destination: '0.0.0.0/0',
          description: 'HTTPS outbound'
        }
      ]
    },

    // Database security group
    database: {
      ingress: [
        {
          protocol: 'tcp',
          port: 27017,
          source: 'sg-application',
          description: 'MongoDB from application'
        }
      ],
      egress: []
    },

    // Redis security group
    redis: {
      ingress: [
        {
          protocol: 'tcp',
          port: 6379,
          source: 'sg-application',
          description: 'Redis from application'
        }
      ],
      egress: []
    },

    // Bastion host security group
    bastion: {
      ingress: [
        {
          protocol: 'tcp',
          port: 22,
          source: process.env.ADMIN_IP_WHITELIST || '0.0.0.0/0',
          description: 'SSH from admin IPs'
        }
      ],
      egress: [
        {
          protocol: 'tcp',
          port: 22,
          destination: '10.0.0.0/16',
          description: 'SSH to private instances'
        }
      ]
    }
  },

  // Firewall Rules (for on-premise/self-hosted)
  firewall: {
    enabled: true,
    
    // Default policy
    defaultPolicy: 'deny',
    
    // Allow rules
    allowRules: [
      {
        name: 'allow-http',
        protocol: 'tcp',
        port: 80,
        source: 'any',
        destination: 'load-balancer'
      },
      {
        name: 'allow-https',
        protocol: 'tcp',
        port: 443,
        source: 'any',
        destination: 'load-balancer'
      },
      {
        name: 'allow-app-from-lb',
        protocol: 'tcp',
        port: 3000,
        source: 'load-balancer',
        destination: 'application'
      },
      {
        name: 'allow-db-from-app',
        protocol: 'tcp',
        port: 27017,
        source: 'application',
        destination: 'database'
      },
      {
        name: 'allow-redis-from-app',
        protocol: 'tcp',
        port: 6379,
        source: 'application',
        destination: 'redis'
      }
    ],
    
    // Deny rules
    denyRules: [
      {
        name: 'deny-db-from-internet',
        protocol: 'tcp',
        port: 27017,
        source: 'any',
        destination: 'database'
      },
      {
        name: 'deny-redis-from-internet',
        protocol: 'tcp',
        port: 6379,
        source: 'any',
        destination: 'redis'
      }
    ]
  },

  // DDoS Protection
  ddosProtection: {
    enabled: true,
    
    // Rate limiting
    rateLimit: {
      enabled: true,
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15', 10) * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      
      // IP whitelist (no rate limiting)
      whitelist: process.env.RATE_LIMIT_WHITELIST 
        ? process.env.RATE_LIMIT_WHITELIST.split(',')
        : []
    },
    
    // Connection limits
    connectionLimits: {
      maxConcurrent: 10000,
      maxPerIP: 100
    },
    
    // Traffic filtering
    filtering: {
      blockInvalidUserAgents: true,
      blockSuspiciousPatterns: true,
      geoBlocking: {
        enabled: false,
        blockedCountries: []
      }
    }
  },

  // Web Application Firewall (WAF)
  waf: {
    enabled: process.env.WAF_ENABLED === 'true',
    
    // OWASP Top 10 protection
    owasp: {
      sqlInjection: true,
      xss: true,
      csrf: true,
      commandInjection: true,
      pathTraversal: true,
      xxe: true
    },
    
    // Custom rules
    customRules: [
      {
        name: 'block-admin-brute-force',
        condition: 'path="/api/admin/login" AND rate > 5/minute',
        action: 'block'
      },
      {
        name: 'require-auth-header',
        condition: 'path="/api/*" AND missing header "Authorization"',
        action: 'allow' // Some endpoints don't require auth
      }
    ],
    
    // IP reputation
    ipReputation: {
      enabled: true,
      blockMaliciousIPs: true,
      blockTorNodes: false
    }
  },

  // Network Segmentation
  segmentation: {
    enabled: true,
    
    // Network zones
    zones: {
      dmz: {
        name: 'DMZ',
        services: ['load-balancer', 'web-server'],
        isolation: 'high'
      },
      application: {
        name: 'Application',
        services: ['api-server', 'worker'],
        isolation: 'high'
      },
      data: {
        name: 'Data',
        services: ['database', 'redis', 'elasticsearch'],
        isolation: 'critical'
      },
      management: {
        name: 'Management',
        services: ['bastion', 'monitoring'],
        isolation: 'critical'
      }
    },
    
    // Inter-zone communication rules
    communicationRules: [
      { from: 'dmz', to: 'application', allowed: true },
      { from: 'application', to: 'data', allowed: true },
      { from: 'dmz', to: 'data', allowed: false },
      { from: 'management', to: 'all', allowed: true }
    ]
  },

  // VPN Configuration
  vpn: {
    enabled: process.env.VPN_ENABLED === 'true',
    
    // VPN server
    server: {
      endpoint: process.env.VPN_ENDPOINT,
      protocol: 'WireGuard', // or 'OpenVPN'
      port: 51820
    },
    
    // Client access
    clients: {
      allowedUsers: process.env.VPN_ALLOWED_USERS 
        ? process.env.VPN_ALLOWED_USERS.split(',')
        : [],
      mfa: true
    }
  },

  // SSL/TLS Configuration
  ssl: {
    // Minimum TLS version
    minVersion: 'TLSv1.2',
    
    // Preferred ciphers
    ciphers: [
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384'
    ],
    
    // Certificate configuration
    certificates: {
      autoRenew: true,
      renewBefore: 30, // days
      provider: 'letsencrypt'
    },
    
    // HSTS
    hsts: {
      enabled: true,
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  },

  // Network Monitoring
  monitoring: {
    enabled: true,
    
    // Traffic analysis
    trafficAnalysis: {
      enabled: true,
      sampling: 1, // 1% of traffic
      retention: 30 // days
    },
    
    // Intrusion detection
    ids: {
      enabled: true,
      mode: 'detect', // or 'prevent'
      alertThreshold: 'medium'
    },
    
    // Flow logs
    flowLogs: {
      enabled: true,
      destination: 's3',
      format: 'json'
    }
  }
};
