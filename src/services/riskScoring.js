const logger = require('../utils/logger');

/**
 * Risk Scoring Service
 * ML-based risk assessment for transactions and users
 */
class RiskScoringService {
  constructor() {
    this.weights = {
      amount: 0.3,
      frequency: 0.2,
      userHistory: 0.2,
      geography: 0.15,
      timePattern: 0.15
    };
  }

  /**
   * Calculate comprehensive risk score for a transaction
   */
  async calculateTransactionRisk(transaction, user, userHistory) {
    try {
      const scores = {
        amount: this.scoreAmount(transaction.fiatAmount),
        frequency: await this.scoreFrequency(user._id, userHistory),
        userHistory: this.scoreUserHistory(userHistory),
        geography: this.scoreGeography(user.country),
        timePattern: this.scoreTimePattern(transaction, userHistory)
      };

      // Calculate weighted total
      const totalScore = 
        scores.amount * this.weights.amount +
        scores.frequency * this.weights.frequency +
        scores.userHistory * this.weights.userHistory +
        scores.geography * this.weights.geography +
        scores.timePattern * this.weights.timePattern;

      const riskLevel = this.determineRiskLevel(totalScore);

      return {
        totalScore: Math.round(totalScore),
        riskLevel,
        breakdown: scores,
        factors: this.identifyRiskFactors(scores)
      };
    } catch (error) {
      logger.error(`Error calculating transaction risk: ${error.message}`);
      throw error;
    }
  }

  /**
   * Score based on transaction amount
   */
  scoreAmount(amount) {
    if (amount < 100) return 10;
    if (amount < 1000) return 20;
    if (amount < 5000) return 40;
    if (amount < 10000) return 60;
    if (amount < 50000) return 80;
    return 95;
  }

  /**
   * Score based on transaction frequency
   */
  async scoreFrequency(userId, userHistory) {
    if (!userHistory || userHistory.length === 0) {
      return 30; // New user = medium risk
    }

    const recentTransactions = userHistory.filter(tx => {
      const daysSince = (Date.now() - new Date(tx.createdAt).getTime()) / (24 * 60 * 60 * 1000);
      return daysSince <= 7;
    });

    if (recentTransactions.length > 10) {
      return 80; // Very high frequency
    } else if (recentTransactions.length > 5) {
      return 50; // High frequency
    } else if (recentTransactions.length > 2) {
      return 30; // Normal frequency
    }
    
    return 15; // Low frequency
  }

  /**
   * Score based on user history
   */
  scoreUserHistory(userHistory) {
    if (!userHistory || userHistory.length === 0) {
      return 40; // No history = medium-high risk
    }

    const completedTransactions = userHistory.filter(tx => tx.status === 'completed').length;
    const failedTransactions = userHistory.filter(tx => tx.status === 'failed').length;
    
    const successRate = completedTransactions / (completedTransactions + failedTransactions);

    if (successRate > 0.95) return 10; // Excellent history
    if (successRate > 0.85) return 20; // Good history
    if (successRate > 0.70) return 40; // Fair history
    return 70; // Poor history
  }

  /**
   * Score based on geography
   */
  scoreGeography(country) {
    // High-risk countries
    const highRisk = ['IR', 'KP', 'SY', 'CU', 'MM'];
    // Medium-risk countries
    const mediumRisk = ['VE', 'AF', 'IQ', 'LY', 'SO'];

    if (highRisk.includes(country)) {
      return 90;
    } else if (mediumRisk.includes(country)) {
      return 60;
    }

    return 20; // Low-risk countries
  }

  /**
   * Score based on time patterns
   */
  scoreTimePattern(transaction, userHistory) {
    if (!userHistory || userHistory.length === 0) {
      return 25;
    }

    const hour = new Date(transaction.createdAt || Date.now()).getHours();

    // Unusual hours (2 AM - 5 AM) = higher risk
    if (hour >= 2 && hour <= 5) {
      return 60;
    }

    // Business hours = lower risk
    if (hour >= 9 && hour <= 17) {
      return 10;
    }

    return 30; // Other hours
  }

  /**
   * Determine risk level from score
   */
  determineRiskLevel(score) {
    if (score < 30) return 'low';
    if (score < 60) return 'medium';
    if (score < 80) return 'high';
    return 'critical';
  }

  /**
   * Identify specific risk factors
   */
  identifyRiskFactors(scores) {
    const factors = [];

    if (scores.amount > 60) {
      factors.push('High transaction amount');
    }

    if (scores.frequency > 60) {
      factors.push('Unusual transaction frequency');
    }

    if (scores.userHistory > 50) {
      factors.push('Limited or poor transaction history');
    }

    if (scores.geography > 60) {
      factors.push('High-risk geographic location');
    }

    if (scores.timePattern > 50) {
      factors.push('Unusual transaction timing');
    }

    return factors;
  }

  /**
   * Calculate user risk profile
   */
  async calculateUserRiskProfile(userId) {
    try {
      const ConversionTransaction = require('../models/ConversionTransaction');
      const User = require('../models/User');
      const AMLAlert = require('../models/AMLAlert');

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const transactions = await ConversionTransaction.find({ user: userId });
      const alerts = await AMLAlert.find({ user: userId });

      const profile = {
        userId,
        accountAge: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000)),
        totalTransactions: transactions.length,
        totalVolume: transactions.reduce((sum, tx) => sum + (tx.fiatAmount || 0), 0),
        averageTransactionSize: transactions.length > 0 
          ? transactions.reduce((sum, tx) => sum + (tx.fiatAmount || 0), 0) / transactions.length 
          : 0,
        failureRate: transactions.length > 0
          ? transactions.filter(tx => tx.status === 'failed').length / transactions.length
          : 0,
        alertCount: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        geography: user.country,
        riskScore: 0,
        riskLevel: 'low'
      };

      // Calculate overall risk score
      let riskScore = 0;

      // Account age factor
      if (profile.accountAge < 7) riskScore += 20;
      else if (profile.accountAge < 30) riskScore += 10;

      // Alert factor
      riskScore += Math.min(profile.alertCount * 10, 30);
      if (profile.criticalAlerts > 0) riskScore += 30;

      // Failure rate factor
      if (profile.failureRate > 0.3) riskScore += 20;
      else if (profile.failureRate > 0.1) riskScore += 10;

      // Geography factor
      riskScore += this.scoreGeography(profile.geography);

      profile.riskScore = Math.min(Math.round(riskScore), 100);
      profile.riskLevel = this.determineRiskLevel(profile.riskScore);

      return profile;
    } catch (error) {
      logger.error(`Error calculating user risk profile: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get risk recommendations
   */
  getRiskRecommendations(riskScore, riskLevel) {
    const recommendations = {
      low: [
        'Standard monitoring',
        'Normal transaction limits apply'
      ],
      medium: [
        'Enhanced monitoring recommended',
        'Review unusual patterns',
        'Consider transaction limits'
      ],
      high: [
        'Manual review required',
        'Enhanced due diligence',
        'Reduced transaction limits',
        'More frequent monitoring'
      ],
      critical: [
        'Immediate manual review required',
        'Transaction approval required',
        'Enhanced due diligence mandatory',
        'Consider account restrictions',
        'Escalate to compliance officer'
      ]
    };

    return recommendations[riskLevel] || recommendations.low;
  }
}

// Export singleton instance
module.exports = new RiskScoringService();
