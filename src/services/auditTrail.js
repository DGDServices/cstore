const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Audit Trail Service
 * Comprehensive audit logging for compliance and security
 */
class AuditTrailService {
  constructor() {
    this.enabled = process.env.AUDIT_LOGGING_ENABLED !== 'false';
  }

  /**
   * Log an audit event
   */
  async log(eventData) {
    if (!this.enabled) {
      return;
    }

    try {
      const auditLog = new AuditLog({
        user: eventData.userId,
        action: eventData.action,
        category: eventData.category,
        resource: eventData.resource,
        resourceId: eventData.resourceId,
        changes: eventData.changes,
        ipAddress: eventData.ipAddress,
        userAgent: eventData.userAgent,
        status: eventData.status || 'success',
        metadata: eventData.metadata
      });

      await auditLog.save();

      logger.debug(`Audit log created: ${eventData.action}`);
    } catch (error) {
      logger.error(`Error creating audit log: ${error.message}`);
    }
  }

  /**
   * Log authentication event
   */
  async logAuth(userId, action, status, ipAddress, userAgent) {
    await this.log({
      userId,
      action,
      category: 'auth',
      resource: 'authentication',
      status,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log transaction event
   */
  async logTransaction(userId, transactionId, action, changes, status) {
    await this.log({
      userId,
      action,
      category: 'transaction',
      resource: 'conversion_transaction',
      resourceId: transactionId,
      changes,
      status
    });
  }

  /**
   * Log user action
   */
  async logUserAction(userId, action, resourceType, resourceId, changes, ipAddress) {
    await this.log({
      userId,
      action,
      category: 'user',
      resource: resourceType,
      resourceId,
      changes,
      ipAddress
    });
  }

  /**
   * Log admin action
   */
  async logAdminAction(adminId, action, resourceType, resourceId, changes, ipAddress) {
    await this.log({
      userId: adminId,
      action,
      category: 'admin',
      resource: resourceType,
      resourceId,
      changes,
      ipAddress
    });
  }

  /**
   * Log compliance action
   */
  async logComplianceAction(userId, action, details, status = 'success') {
    await this.log({
      userId,
      action,
      category: 'compliance',
      resource: 'compliance_action',
      metadata: details,
      status
    });
  }

  /**
   * Log system event
   */
  async logSystemEvent(action, details, status = 'success') {
    await this.log({
      action,
      category: 'system',
      resource: 'system',
      metadata: details,
      status
    });
  }

  /**
   * Get audit logs
   */
  async getLogs(filters = {}) {
    try {
      const query = {};

      if (filters.userId) {
        query.user = filters.userId;
      }

      if (filters.action) {
        query.action = filters.action;
      }

      if (filters.category) {
        query.category = filters.category;
      }

      if (filters.resource) {
        query.resource = filters.resource;
      }

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.createdAt.$lte = filters.endDate;
        }
      }

      const logs = await AuditLog.find(query)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 100);

      return logs;
    } catch (error) {
      logger.error(`Error getting audit logs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get audit trail for a specific resource
   */
  async getResourceAuditTrail(resourceType, resourceId) {
    try {
      const logs = await AuditLog.find({
        resource: resourceType,
        resourceId
      })
        .populate('user', 'name email')
        .sort({ createdAt: -1 });

      return logs;
    } catch (error) {
      logger.error(`Error getting resource audit trail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user activity logs
   */
  async getUserActivity(userId, limit = 50) {
    try {
      const logs = await AuditLog.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit);

      return logs;
    } catch (error) {
      logger.error(`Error getting user activity: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate audit report
   */
  async generateReport(startDate, endDate) {
    try {
      const stats = await AuditLog.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: {
              category: '$category',
              action: '$action'
            },
            count: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
            },
            failureCount: {
              $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] }
            }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      return {
        period: {
          start: startDate,
          end: endDate
        },
        statistics: stats,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error(`Error generating audit report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search audit logs
   */
  async searchLogs(searchTerm, filters = {}) {
    try {
      const query = {
        $or: [
          { action: { $regex: searchTerm, $options: 'i' } },
          { resource: { $regex: searchTerm, $options: 'i' } }
        ]
      };

      if (filters.category) {
        query.category = filters.category;
      }

      if (filters.userId) {
        query.user = filters.userId;
      }

      const logs = await AuditLog.find(query)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 100);

      return logs;
    } catch (error) {
      logger.error(`Error searching audit logs: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AuditTrailService();
