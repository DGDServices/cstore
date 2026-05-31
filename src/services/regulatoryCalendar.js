const logger = require('../utils/logger');

/**
 * Regulatory Calendar Service
 * Manages compliance deadlines, reporting schedules, and reminders
 */
class RegulatoryCalendarService {
  constructor() {
    this.reportingSchedule = process.env.REPORTING_SCHEDULE || 'daily';
    this.riskAssessmentFrequency = process.env.RISK_ASSESSMENT_FREQUENCY || 'monthly';
    this.policyReviewFrequency = process.env.POLICY_REVIEW_FREQUENCY || 'quarterly';
  }

  /**
   * Get upcoming compliance deadlines
   */
  async getUpcomingDeadlines(days = 30) {
    try {
      const deadlines = [];
      const today = new Date();

      // Add reporting deadlines
      if (this.reportingSchedule === 'daily') {
        deadlines.push({
          type: 'daily_report',
          name: 'Daily Transaction Report',
          dueDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          priority: 'medium',
          recurring: true,
          frequency: 'daily'
        });
      }

      // Monthly reporting
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 15);
      if (this.isWithinDays(nextMonth, days)) {
        deadlines.push({
          type: 'monthly_report',
          name: 'Monthly Regulatory Report',
          dueDate: nextMonth,
          priority: 'high',
          recurring: true,
          frequency: 'monthly'
        });
      }

      // Quarterly policy review
      const nextQuarter = this.getNextQuarterEnd();
      if (this.isWithinDays(nextQuarter, days)) {
        deadlines.push({
          type: 'policy_review',
          name: 'Quarterly Policy Review',
          dueDate: nextQuarter,
          priority: 'high',
          recurring: true,
          frequency: 'quarterly'
        });
      }

      // Annual audit
      const nextYearEnd = new Date(today.getFullYear(), 11, 31);
      if (this.isWithinDays(nextYearEnd, days)) {
        deadlines.push({
          type: 'annual_audit',
          name: 'Annual Compliance Audit',
          dueDate: nextYearEnd,
          priority: 'critical',
          recurring: true,
          frequency: 'annually'
        });
      }

      // Sort by due date
      deadlines.sort((a, b) => a.dueDate - b.dueDate);

      return deadlines;
    } catch (error) {
      logger.error(`Error getting upcoming deadlines: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get next quarter end date
   */
  getNextQuarterEnd() {
    const today = new Date();
    const quarter = Math.floor(today.getMonth() / 3);
    const nextQuarterMonth = (quarter + 1) * 3;
    
    if (nextQuarterMonth >= 12) {
      return new Date(today.getFullYear() + 1, 2, 31); // Q1 next year
    }
    
    return new Date(today.getFullYear(), nextQuarterMonth, 0); // Last day of quarter
  }

  /**
   * Check if date is within specified days
   */
  isWithinDays(date, days) {
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= days;
  }

  /**
   * Get overdue compliance items
   */
  async getOverdueItems() {
    try {
      const ComplianceCase = require('../models/ComplianceCase');
      
      const overdueCases = await ComplianceCase.find({
        dueDate: { $lt: new Date() },
        status: { $nin: ['resolved', 'closed'] }
      })
        .populate('user', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ dueDate: 1 });

      return {
        count: overdueCases.length,
        items: overdueCases
      };
    } catch (error) {
      logger.error(`Error getting overdue items: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate compliance calendar for a period
   */
  async generateCalendar(startDate, endDate) {
    try {
      const calendar = [];
      const current = new Date(startDate);

      while (current <= endDate) {
        const dayEvents = await this.getEventsForDate(current);
        if (dayEvents.length > 0) {
          calendar.push({
            date: new Date(current),
            events: dayEvents
          });
        }
        current.setDate(current.getDate() + 1);
      }

      return calendar;
    } catch (error) {
      logger.error(`Error generating calendar: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get compliance events for a specific date
   */
  async getEventsForDate(date) {
    const events = [];
    const day = date.getDate();
    const month = date.getMonth();

    // Daily reports
    if (this.reportingSchedule === 'daily') {
      events.push({
        type: 'daily_report',
        name: 'Daily Transaction Report Due',
        priority: 'medium'
      });
    }

    // Monthly reports (15th of each month)
    if (day === 15) {
      events.push({
        type: 'monthly_report',
        name: 'Monthly Regulatory Report Due',
        priority: 'high'
      });
    }

    // Quarterly reviews (last day of quarter)
    if ((month === 2 && day === 31) || (month === 5 && day === 30) || 
        (month === 8 && day === 30) || (month === 11 && day === 31)) {
      events.push({
        type: 'quarterly_review',
        name: 'Quarterly Compliance Review',
        priority: 'high'
      });
    }

    // Annual audit (December 31)
    if (month === 11 && day === 31) {
      events.push({
        type: 'annual_audit',
        name: 'Annual Compliance Audit',
        priority: 'critical'
      });
    }

    return events;
  }

  /**
   * Create reminder for compliance deadline
   */
  async createReminder(deadlineData) {
    try {
      // In production, this would send notifications
      logger.info(`Reminder created: ${deadlineData.name} due ${deadlineData.dueDate}`);

      const reminder = {
        id: Date.now(),
        ...deadlineData,
        createdAt: new Date(),
        notificationSent: false
      };

      return reminder;
    } catch (error) {
      logger.error(`Error creating reminder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get compliance dashboard summary
   */
  async getDashboardSummary() {
    try {
      const upcomingDeadlines = await this.getUpcomingDeadlines(7);
      const overdueItems = await this.getOverdueItems();

      return {
        upcomingDeadlines: upcomingDeadlines.slice(0, 5),
        overdueCount: overdueItems.count,
        nextCriticalDeadline: upcomingDeadlines.find(d => d.priority === 'critical'),
        summary: {
          total: upcomingDeadlines.length,
          critical: upcomingDeadlines.filter(d => d.priority === 'critical').length,
          high: upcomingDeadlines.filter(d => d.priority === 'high').length,
          medium: upcomingDeadlines.filter(d => d.priority === 'medium').length
        },
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error(`Error getting dashboard summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark deadline as completed
   */
  async markCompleted(deadlineId) {
    try {
      logger.info(`Deadline ${deadlineId} marked as completed`);

      return {
        success: true,
        completedAt: new Date()
      };
    } catch (error) {
      logger.error(`Error marking deadline completed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get regulatory reporting schedule
   */
  getReportingSchedule() {
    return {
      daily: this.reportingSchedule === 'daily',
      weekly: this.reportingSchedule === 'weekly',
      monthly: true, // Always required
      quarterly: true, // Always required
      annually: true, // Always required
      nextDailyReport: this.reportingSchedule === 'daily' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      nextMonthlyReport: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15),
      nextQuarterlyReport: this.getNextQuarterEnd(),
      nextAnnualReport: new Date(new Date().getFullYear(), 11, 31)
    };
  }
}

// Export singleton instance
module.exports = new RegulatoryCalendarService();
