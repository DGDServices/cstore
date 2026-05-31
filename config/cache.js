/**
 * Cache Configuration
 * Defines caching strategies, TTL, and invalidation rules
 */

module.exports = {
  // Enable/disable caching
  enabled: process.env.CACHE_ENABLED === 'true',

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
    
    // Redis cluster mode
    cluster: {
      enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
      nodes: process.env.REDIS_CLUSTER_NODES 
        ? process.env.REDIS_CLUSTER_NODES.split(',')
        : ['localhost:6379', 'localhost:6380', 'localhost:6381']
    },
    
    // Connection pool
    pool: {
      min: 2,
      max: parseInt(process.env.REDIS_POOL_SIZE || '10', 10)
    },
    
    // Retry strategy
    retry: {
      maxAttempts: 10,
      initialDelay: 100,
      maxDelay: 3000,
      factor: 2 // Exponential backoff
    }
  },

  // Default TTL (Time To Live) in seconds
  defaultTTL: parseInt(process.env.CACHE_TTL || '3600', 10),

  // Cache strategies by entity type
  strategies: {
    // Product catalog
    products: {
      ttl: 3600, // 1 hour
      strategy: 'cache-aside',
      invalidateOn: ['create', 'update', 'delete'],
      warmUp: true // Pre-load on startup
    },
    
    // User sessions
    sessions: {
      ttl: 86400, // 24 hours
      strategy: 'write-through',
      invalidateOn: ['logout', 'password_change']
    },
    
    // API responses
    api: {
      ttl: 300, // 5 minutes
      strategy: 'cache-aside',
      vary: ['user', 'locale'], // Cache varies by these parameters
      maxSize: 1000 // Maximum cached responses
    },
    
    // Database queries
    queries: {
      ttl: 600, // 10 minutes
      strategy: 'cache-aside',
      invalidateOn: ['data_change']
    },
    
    // Static assets
    static: {
      ttl: 86400, // 24 hours
      strategy: 'cache-first',
      immutable: true
    },
    
    // Currency exchange rates
    rates: {
      ttl: 300, // 5 minutes
      strategy: 'cache-aside',
      staleWhileRevalidate: true // Serve stale while fetching fresh
    },
    
    // User profiles
    users: {
      ttl: 1800, // 30 minutes
      strategy: 'write-through',
      invalidateOn: ['profile_update']
    },
    
    // Analytics data
    analytics: {
      ttl: 3600, // 1 hour
      strategy: 'cache-aside',
      aggregated: true
    }
  },

  // Cache key patterns
  keyPatterns: {
    product: 'product:{id}',
    products: 'products:page:{page}',
    user: 'user:{id}',
    session: 'session:{token}',
    api: 'api:{method}:{path}:{query}',
    query: 'query:{hash}',
    rate: 'rate:{from}:{to}'
  },

  // Cache invalidation rules
  invalidation: {
    // Auto-invalidate on these events
    events: {
      'product.created': ['products:*'],
      'product.updated': ['product:{id}', 'products:*'],
      'product.deleted': ['product:{id}', 'products:*'],
      'user.updated': ['user:{id}'],
      'order.created': ['analytics:*', 'products:*']
    },
    
    // Time-based invalidation
    scheduled: {
      enabled: true,
      // Clear all cached analytics at midnight
      analytics: '0 0 * * *',
      // Clear stale sessions daily
      sessions: '0 2 * * *'
    },
    
    // Manual invalidation API
    api: {
      enabled: true,
      requireAuth: true,
      allowedRoles: ['admin']
    }
  },

  // Cache warming
  warming: {
    enabled: true,
    
    // Pre-load these on startup
    onStartup: [
      'popular_products',
      'categories',
      'exchange_rates'
    ],
    
    // Refresh strategy
    refresh: {
      // Refresh before expiry
      beforeExpiry: 300, // 5 minutes before
      
      // Background refresh
      background: true
    }
  },

  // Cache monitoring
  monitoring: {
    enabled: true,
    
    // Metrics to track
    metrics: [
      'hit_rate',
      'miss_rate',
      'eviction_rate',
      'memory_usage',
      'key_count',
      'avg_ttl'
    ],
    
    // Thresholds for alerts
    alerts: {
      lowHitRate: {
        enabled: true,
        threshold: 70 // Alert if hit rate < 70%
      },
      
      highMemory: {
        enabled: true,
        threshold: 90 // Alert if memory usage > 90%
      }
    }
  },

  // Cache limits
  limits: {
    // Maximum cache size (MB)
    maxMemory: parseInt(process.env.REDIS_MAX_MEMORY || '512', 10),
    
    // Eviction policy
    evictionPolicy: 'allkeys-lru', // Least Recently Used
    
    // Maximum key size (bytes)
    maxKeySize: 1024,
    
    // Maximum value size (MB)
    maxValueSize: 10
  },

  // Compression
  compression: {
    enabled: true,
    
    // Compress values larger than this (bytes)
    threshold: 1024,
    
    // Compression algorithm
    algorithm: 'gzip'
  },

  // Serialization
  serialization: {
    // Default to JSON
    format: 'json',
    
    // Custom serializers for specific types
    custom: {
      date: true,
      buffer: true,
      bigint: true
    }
  },

  // Multi-tier caching
  multiTier: {
    enabled: false, // Enable for advanced scenarios
    
    tiers: [
      {
        name: 'memory',
        type: 'in-memory',
        maxSize: 100, // MB
        ttl: 60 // seconds
      },
      {
        name: 'redis',
        type: 'redis',
        ttl: 3600 // seconds
      }
    ]
  }
};
