const ComplianceCase = require('../models/ComplianceCase');
const AMLAlert = require('../models/AMLAlert');
const logger = require('../utils/logger');

/**
 * Compliance Officer Service
 * Case management and compliance workflow for compliance officers
 */
class ComplianceOfficerService {
  constructor() {
    this.alertsEnabled = process.env.COMPLIANCE_ALERTS_ENABLED !== 'false';
  }

  /**
   * Create a compliance case
   */
  async createCase(caseData) {
    try {
      const complianceCase = new ComplianceCase({
        type: caseData.type,
        user: caseData.userId,
        priority: caseData.priority || 'medium',
        description: caseData.description,
        assignedTo: caseData.assignedTo,
        dueDate: caseData.dueDate
      });

      await complianceCase.save();

      logger.info(`Compliance case created: ${complianceCase.caseNumber}`);

      return {
        success: true,
        case: complianceCase
      };
    } catch (error) {
      logger.error(`Error creating compliance case: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get case by ID
   */
  async getCase(caseId) {
    try {
      const complianceCase = await ComplianceCase.findById(caseId)
        .populate('user', 'name email')
        .populate('assignedTo', 'name email')
        .populate('relatedAlerts');

      return complianceCase;
    } catch (error) {
      logger.error(`Error getting case: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update case status
   */
  async updateCaseStatus(caseId, status, notes) {
    try {
      const complianceCase = await ComplianceCase.findById(caseId);
      
      if (!complianceCase) {
        throw new Error('Case not found');
      }

      complianceCase.status = status;
      
      if (status === 'resolved' || status === 'closed') {
        complianceCase.resolution = {
          outcome: status,
          details: notes,
          resolvedAt: new Date()
        };
      }

      await complianceCase.save();

      logger.info(`Case ${caseId} status updated to ${status}`);

      return complianceCase;
    } catch (error) {
      logger.error(`Error updating case status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add action to case
   */
  async addCaseAction(caseId, actionData) {
    try {
      const complianceCase = await ComplianceCase.findById(caseId);
      
      if (!complianceCase) {
        throw new Error('Case not found');
      }

      complianceCase.actions.push({
        action: actionData.action,
        performedBy: actionData.performedBy,
        performedAt: new Date(),
        notes: actionData.notes
      });

      await complianceCase.save();

      logger.info(`Action added to case ${caseId}`);

      return complianceCase;
    } catch (error) {
      logger.error(`Error adding case action: ${error.message}`);
      throw error;
    }
  }

  /**
   * Assign case to officer
   */
  async assignCase(caseId, officerId) {
    try {
      const complianceCase = await ComplianceCase.findById(caseId);
      
      if (!complianceCase) {
        throw new Error('Case not found');
      }

      complianceCase.assignedTo = officerId;
      complianceCase.status = 'investigating';
      
      await complianceCase.save();

      logger.info(`Case ${caseId} assigned to officer ${officerId}`);

      return complianceCase;
    } catch (error) {
      logger.error(`Error assigning case: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cases for officer
   */
  async getOfficerCases(officerId, filters = {}) {
    try {
      const query = { assignedTo: officerId };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.priority) {
        query.priority = filters.priority;
      }

      if (filters.type) {
        query.type = filters.type;
      }

      const cases = await ComplianceCase.find(query)
        .populate('user', 'name email')
        .sort({ priority: -1, createdAt: -1 })
        .limit(filters.limit || 50);

      return cases;
    } catch (error) {
      logger.error(`Error getting officer cases: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get pending cases
   */
  async getPendingCases() {
    try {
      const cases = await ComplianceCase.find({
        status: { $in: ['open', 'investigating', 'pending_decision'] }
      })
        .populate('user', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ priority: -1, createdAt: -1 });

      return cases;
    } catch (error) {
      logger.error(`Error getting pending cases: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get high-priority cases
   */
  async getHighPriorityCases() {
    try {
      const cases = await ComplianceCase.find({
        priority: { $in: ['high', 'critical'] },
        status: { $nin: ['resolved', 'closed'] }
      })
        .populate('user', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ priority: -1, createdAt: -1 });

      return cases;
    } catch (error) {
      logger.error(`Error getting high-priority cases: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get overdue cases
   */
  async getOverdueCases() {
    try {
      const cases = await ComplianceCase.find({
        dueDate: { $lt: new Date() },
        status: { $nin: ['resolved', 'closed'] }
      })
        .populate('user', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ dueDate: 1 });

      return cases;
    } catch (error) {
      logger.error(`Error getting overdue cases: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate compliance dashboard
   */
  async getDashboard() {
    try {
      const dashboard = {
        summary: {
          totalOpen: await ComplianceCase.countDocuments({
            status: { $in: ['open', 'investigating', 'pending_decision'] }
          }),
          highPriority: await ComplianceCase.countDocuments({
            priority: { $in: ['high', 'critical'] },
            status: { $nin: ['resolved', 'closed'] }
          }),
          overdue: await ComplianceCase.countDocuments({
            dueDate: { $lt: new Date() },
            status: { $nin: ['resolved', 'closed'] }
          }),
          pendingAlerts: await AMLAlert.countDocuments({
            status: { $in: ['open', 'under_review'] }
          })
        },
        recentCases: await ComplianceCase.find({})
          .populate('user', 'name email')
          .sort({ createdAt: -1 })
          .limit(10),
        casesByType: await this.getCaseStatistics(),
        generatedAt: new Date()
      };

      return dashboard;
    } catch (error) {
      logger.error(`Error generating dashboard: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get case statistics
   */
  async getCaseStatistics() {
    try {
      const stats = await ComplianceCase.aggregate([
        {
          $group: {
            _id: {
              type: '$type',
              status: '$status'
            },
            count: { $sum: 1 }
          }
        }
      ]);

      return stats;
    } catch (error) {
      logger.error(`Error getting case statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search cases
   */
  async searchCases(searchTerm) {
    try {
      const cases = await ComplianceCase.find({
        $or: [
          { caseNumber: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ]
      })
        .populate('user', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .limit(50);

      return cases;
    } catch (error) {
      logger.error(`Error searching cases: ${error.message}`);
      throw error;
    }
  }

  /**
   * Link alert to case
   */
  async linkAlertToCase(caseId, alertId) {
    try {
      const complianceCase = await ComplianceCase.findById(caseId);
      
      if (!complianceCase) {
        throw new Error('Case not found');
      }

      if (!complianceCase.relatedAlerts.includes(alertId)) {
        complianceCase.relatedAlerts.push(alertId);
        await complianceCase.save();
      }

      logger.info(`Alert ${alertId} linked to case ${caseId}`);

      return complianceCase;
    } catch (error) {
      logger.error(`Error linking alert to case: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new ComplianceOfficerService();
