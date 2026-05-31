const logger = require('./logger');
const conversionConfig = require('../../config/conversion');

/**
 * Risk Calculator Utility
 * Calculates risk scores and determines approval requirements for conversions
 */

class RiskCalculator {
  /**
   * Calculate overall risk score for a conversion
   */
  static async calculateRiskScore(conversionData) {
    const weights = conversionConfig.risk.riskWeights;
    
    // Calculate individual risk factors
    const amountScore = this.calculateAmountRisk(conversionData.fiatAmount);
    const volatilityScore = this.calculateVolatilityRisk(conversionData.volatility || 0);
    const userScore = await this.calculateUserHistoryRisk(conversionData.userId);
    const exchangeScore = this.calculateExchangeHealthRisk(conversionData.exchange);
    
    // Calculate weighted risk score (0-100)
    const totalScore = 
      (amountScore * weights.amount) +
      (volatilityScore * weights.volatility) +
      (userScore * weights.userHistory) +
      (exchangeScore * weights.exchangeHealth);
    
    return {
      totalScore: Math.round(totalScore),
      breakdown: {
        amount: Math.round(amountScore),
        volatility: Math.round(volatilityScore),
        userHistory: Math.round(userScore),
        exchangeHealth: Math.round(exchangeScore)
      }
    };
  }

  /**
   * Calculate risk based on conversion amount
   */
  static calculateAmountRisk(fiatAmount) {
    const limits = conversionConfig.limits;
    const autoApprovalLimit = limits.autoApprovalLimit;
    const maxAmount = limits.maxAmount;
    
    // Linear scale from 0-100
    if (fiatAmount <= autoApprovalLimit) {
      // Low risk zone
      return (fiatAmount / autoApprovalLimit) * 30;
    } else if (fiatAmount <= maxAmount) {
      // Medium to high risk zone
      const excessPercentage = (fiatAmount - autoApprovalLimit) / (maxAmount - autoApprovalLimit);
      return 30 + (excessPercentage * 70);
    } else {
      // Above maximum - highest risk
      return 100;
    }
  }

  /**
   * Calculate risk based on volatility
   */
  static calculateVolatilityRisk(volatilityPercentage) {
    const threshold = conversionConfig.risk.volatilityThreshold;
    
    // Volatility below threshold is low risk
    if (volatilityPercentage <= threshold) {
      return (volatilityPercentage / threshold) * 30;
    }
    
    // Volatility above threshold increases risk exponentially
    const excessVolatility = volatilityPercentage - threshold;
    const excessScore = Math.min((excessVolatility / threshold) * 70, 70);
    return 30 + excessScore;
  }

  /**
   * Calculate risk based on user history
   * @param {string} userId - User ID
   * @returns {Promise<number>} Risk score (0-100)
   */
  static async calculateUserHistoryRisk(userId) {
    if (!userId) {
      // No user history - medium risk
      return 50;
    }

    try {
      // This would integrate with the ConversionTransaction model
      // For now, return a default score
      // TODO: Implement actual user history analysis
      
      // Factors to consider:
      // - Number of successful conversions
      // - Failed conversion rate
      // - Account age
      // - Verification level
      // - Previous fraud indicators
      
      return 25; // Default: low risk for existing users
    } catch (error) {
      logger.error('Error calculating user history risk:', error);
      return 50; // Default to medium risk on error
    }
  }

  /**
   * Calculate risk based on exchange health
   */
  static calculateExchangeHealthRisk(exchange) {
    // This would integrate with exchange monitoring
    // For now, return static scores based on exchange reputation
    
    const exchangeScores = {
      coinbase: 10,  // Highly reputable, regulated
      kraken: 15,    // Reputable, good track record
      binance: 25,   // Large but has had regulatory issues
      manual: 50     // Manual conversions are medium risk
    };

    return exchangeScores[exchange] || 30;
  }

  /**
   * Determine risk level from score
   */
  static determineRiskLevel(riskScore) {
    const thresholds = conversionConfig.risk.riskThresholds;
    
    if (riskScore <= thresholds.low) {
      return 'low';
    }
    
    if (riskScore <= thresholds.medium) {
      return 'medium';
    }
    
    return 'high';
  }

  /**
   * Check if conversion requires approval
   */
  static requiresApproval(fiatAmount, riskLevel) {
    const autoApprovalLimit = conversionConfig.limits.autoApprovalLimit;
    const requireHighRiskApproval = conversionConfig.approval.requireApprovalForHighRisk;
    const requireAboveLimitApproval = conversionConfig.approval.requireApprovalAboveLimit;
    
    // Check amount-based approval
    if (requireAboveLimitApproval && fiatAmount > autoApprovalLimit) {
      return {
        required: true,
        reason: 'Amount exceeds auto-approval limit'
      };
    }
    
    // Check risk-based approval
    if (requireHighRiskApproval && riskLevel === 'high') {
      return {
        required: true,
        reason: 'High risk conversion'
      };
    }
    
    return {
      required: false,
      reason: 'Within auto-approval parameters'
    };
  }

  /**
   * Validate conversion against risk parameters
   */
  static async validateConversion(conversionData) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      requiresApproval: false,
      riskScore: null,
      riskLevel: null
    };

    try {
      // Calculate risk score
      const riskAnalysis = await this.calculateRiskScore(conversionData);
      validation.riskScore = riskAnalysis.totalScore;
      validation.riskLevel = this.determineRiskLevel(riskAnalysis.totalScore);

      // Check if approval is required
      const approvalCheck = this.requiresApproval(
        conversionData.fiatAmount,
        validation.riskLevel
      );
      validation.requiresApproval = approvalCheck.required;

      // Check volatility
      if (conversionData.volatility > conversionConfig.risk.volatilityThreshold) {
        validation.warnings.push(
          `High volatility detected: ${conversionData.volatility.toFixed(2)}%`
        );
      }

      // Check slippage
      if (conversionData.slippage && Math.abs(conversionData.slippage) > conversionConfig.risk.maxSlippage) {
        validation.errors.push(
          `Price slippage exceeds maximum allowed: ${conversionData.slippage.toFixed(2)}%`
        );
        validation.valid = false;
      }

      // Check amount limits
      const limits = conversionConfig.limits;
      if (conversionData.fiatAmount < limits.minAmount) {
        validation.errors.push(
          `Amount below minimum: ${limits.minAmount}`
        );
        validation.valid = false;
      }

      if (conversionData.fiatAmount > limits.maxAmount) {
        validation.errors.push(
          `Amount exceeds maximum: ${limits.maxAmount}`
        );
        validation.valid = false;
      }

      // Check fees
      const maxFeePercentage = conversionConfig.fees.maxTotalFeePercentage;
      if (conversionData.totalFeePercentage > maxFeePercentage) {
        validation.warnings.push(
          `Total fees (${conversionData.totalFeePercentage.toFixed(2)}%) exceed recommended maximum (${maxFeePercentage}%)`
        );
      }

      return validation;
    } catch (error) {
      logger.error('Error validating conversion:', error);
      validation.valid = false;
      validation.errors.push('Failed to complete risk validation');
      return validation;
    }
  }

  /**
   * Calculate daily conversion limits
   */
  static async checkDailyLimits(userId, additionalAmount) {
    // This would integrate with ConversionTransaction model
    // to check daily totals
    
    const limits = conversionConfig.limits;
    const dailyUserLimit = limits.dailyUserLimit;
    
    // TODO: Query actual daily totals from database
    // For now, return a default response
    
    return {
      withinLimit: true,
      userDailyTotal: 0,
      userDailyLimit: dailyUserLimit,
      remainingLimit: dailyUserLimit,
      newTotal: additionalAmount
    };
  }

  /**
   * Assess exchange reliability
   */
  static assessExchangeReliability(exchange, recentFailures = 0) {
    const consecutiveFailureThreshold = conversionConfig.monitoring.consecutiveFailureAlert;
    
    if (recentFailures >= consecutiveFailureThreshold) {
      return {
        reliable: false,
        reason: `Exchange has ${recentFailures} consecutive failures`,
        recommendFallback: true
      };
    }

    return {
      reliable: true,
      reason: 'Exchange operating normally'
    };
  }

  /**
   * Generate risk report
   */
  static async generateRiskReport(conversionData) {
    const riskAnalysis = await this.calculateRiskScore(conversionData);
    const riskLevel = this.determineRiskLevel(riskAnalysis.totalScore);
    const approvalCheck = this.requiresApproval(conversionData.fiatAmount, riskLevel);
    
    return {
      timestamp: new Date(),
      conversionAmount: conversionData.fiatAmount,
      cryptocurrency: conversionData.cryptocurrency,
      exchange: conversionData.exchange,
      riskScore: riskAnalysis.totalScore,
      riskLevel: riskLevel,
      riskBreakdown: riskAnalysis.breakdown,
      requiresApproval: approvalCheck.required,
      approvalReason: approvalCheck.reason,
      recommendations: this.generateRecommendations(riskAnalysis, conversionData)
    };
  }

  /**
   * Generate recommendations based on risk analysis
   */
  static generateRecommendations(riskAnalysis, conversionData) {
    const recommendations = [];

    // Amount-based recommendations
    if (riskAnalysis.breakdown.amount > 50) {
      recommendations.push('Consider splitting into multiple smaller conversions');
    }

    // Volatility recommendations
    if (riskAnalysis.breakdown.volatility > 50) {
      recommendations.push('Market volatility is high - consider waiting for stabilization');
    }

    // Exchange recommendations
    if (riskAnalysis.breakdown.exchangeHealth > 30) {
      recommendations.push('Consider using a more reliable exchange');
    }

    // General recommendations
    if (riskAnalysis.totalScore > 70) {
      recommendations.push('High risk detected - manual review recommended');
      recommendations.push('Ensure adequate fraud monitoring');
    }

    return recommendations;
  }
}

module.exports = RiskCalculator;
