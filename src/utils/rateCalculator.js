const logger = require('./logger');
const conversionConfig = require('../../config/conversion');
const exchangeConfig = require('../../config/exchanges');

/**
 * Rate Calculator Utility
 * Handles exchange rate calculations with spread protection and fee estimation
 */

class RateCalculator {
  /**
   * Calculate exchange rate with spread
   */
  static calculateRateWithSpread(baseRate, spreadPercentage = null) {
    const spread = spreadPercentage || conversionConfig.rates.spreadPercentage;
    return baseRate * (1 + spread / 100);
  }

  /**
   * Calculate fiat amount from crypto amount
   */
  static calculateFiatAmount(cryptoAmount, exchangeRate) {
    return cryptoAmount * exchangeRate;
  }

  /**
   * Calculate crypto amount from fiat amount
   */
  static calculateCryptoAmount(fiatAmount, exchangeRate) {
    return fiatAmount / exchangeRate;
  }

  /**
   * Calculate exchange fee
   */
  static calculateExchangeFee(amount, exchange, isTaker = true) {
    const exchangeFeeConfig = exchangeConfig[exchange]?.fees;
    
    if (!exchangeFeeConfig) {
      logger.warn(`Exchange fee config not found for ${exchange}, using default`);
      return amount * 0.001; // 0.1% default
    }

    const feeRate = isTaker ? exchangeFeeConfig.takerFee : exchangeFeeConfig.makerFee;
    return amount * feeRate;
  }

  /**
   * Calculate processing fee
   */
  static calculateProcessingFee(amount) {
    const feePercentage = conversionConfig.fees.processingFeePercentage;
    const minFee = conversionConfig.fees.minProcessingFee;
    
    const calculatedFee = amount * (feePercentage / 100);
    return Math.max(calculatedFee, minFee);
  }

  /**
   * Calculate total fees
   */
  static calculateTotalFees(fiatAmount, exchange, includeNetworkFee = false, networkFee = 0) {
    const exchangeFee = this.calculateExchangeFee(fiatAmount, exchange);
    const processingFee = this.calculateProcessingFee(fiatAmount);
    const netFee = includeNetworkFee ? networkFee : 0;
    
    return {
      exchangeFee,
      processingFee,
      networkFee: netFee,
      total: exchangeFee + processingFee + netFee
    };
  }

  /**
   * Calculate net amount after fees
   */
  static calculateNetAmount(grossAmount, fees) {
    const totalFees = fees.total || (fees.exchangeFee + fees.processingFee + fees.networkFee);
    return grossAmount - totalFees;
  }

  /**
   * Calculate price slippage
   */
  static calculateSlippage(expectedRate, actualRate) {
    return ((actualRate - expectedRate) / expectedRate) * 100;
  }

  /**
   * Validate slippage is within acceptable range
   */
  static isSlippageAcceptable(expectedRate, actualRate) {
    const slippage = Math.abs(this.calculateSlippage(expectedRate, actualRate));
    const maxSlippage = conversionConfig.risk.maxSlippage;
    return slippage <= maxSlippage;
  }

  /**
   * Get best exchange rate from multiple exchanges
   */
  static getBestRate(rates) {
    if (!rates || rates.length === 0) {
      throw new Error('No rates provided');
    }

    return rates.reduce((best, current) => {
      if (!best || current.rate > best.rate) {
        return current;
      }
      return best;
    });
  }

  /**
   * Calculate rate comparison across exchanges
   */
  static compareRates(rates) {
    if (!rates || rates.length < 2) {
      return null;
    }

    const sortedRates = [...rates].sort((a, b) => b.rate - a.rate);
    const bestRate = sortedRates[0];
    const worstRate = sortedRates[sortedRates.length - 1];
    
    const spreadPercentage = ((bestRate.rate - worstRate.rate) / worstRate.rate) * 100;

    return {
      bestExchange: bestRate.exchange,
      bestRate: bestRate.rate,
      worstExchange: worstRate.exchange,
      worstRate: worstRate.rate,
      spreadPercentage,
      rates: sortedRates
    };
  }

  /**
   * Estimate conversion amount with fees
   */
  static estimateConversion(cryptoAmount, exchangeRate, exchange, cryptocurrency, fiatCurrency = 'USD') {
    // Calculate gross fiat amount
    const grossFiatAmount = this.calculateFiatAmount(cryptoAmount, exchangeRate);
    
    // Calculate fees
    const fees = this.calculateTotalFees(grossFiatAmount, exchange);
    
    // Calculate net amount
    const netFiatAmount = this.calculateNetAmount(grossFiatAmount, fees);
    
    // Calculate effective rate (net amount per crypto unit)
    const effectiveRate = netFiatAmount / cryptoAmount;
    
    // Calculate total fee percentage
    const totalFeePercentage = (fees.total / grossFiatAmount) * 100;

    return {
      cryptoAmount,
      cryptocurrency,
      fiatCurrency,
      exchangeRate,
      grossFiatAmount,
      fees,
      netFiatAmount,
      effectiveRate,
      totalFeePercentage,
      exchange
    };
  }

  /**
   * Calculate rate volatility
   */
  static calculateVolatility(historicalRates) {
    if (!historicalRates || historicalRates.length < 2) {
      return 0;
    }

    // Calculate percentage changes
    const changes = [];
    for (let i = 1; i < historicalRates.length; i++) {
      const change = ((historicalRates[i] - historicalRates[i - 1]) / historicalRates[i - 1]) * 100;
      changes.push(change);
    }

    // Calculate standard deviation
    const mean = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    const squaredDiffs = changes.map(change => Math.pow(change - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / squaredDiffs.length;
    const standardDeviation = Math.sqrt(variance);

    return standardDeviation;
  }

  /**
   * Check if volatility is high
   */
  static isHighVolatility(volatilityScore) {
    return volatilityScore > conversionConfig.risk.volatilityThreshold;
  }

  /**
   * Calculate minimum confirmations required
   */
  static getMinConfirmations(cryptocurrency) {
    return conversionConfig.risk.minConfirmations[cryptocurrency] || 6;
  }

  /**
   * Calculate estimated time for confirmations
   */
  static estimateConfirmationTime(cryptocurrency, confirmations = null) {
    const requiredConfirmations = confirmations || this.getMinConfirmations(cryptocurrency);
    
    // Average block times in minutes
    const blockTimes = {
      'BTC': 10,
      'ETH': 0.2,
      'LTC': 2.5,
      'XRP': 0.067,
      'USDT': 0.2, // Assumes ETH-based USDT
      'BTC-LN': 0 // Instant
    };

    const blockTime = blockTimes[cryptocurrency] || 10;
    return requiredConfirmations * blockTime;
  }

  /**
   * Validate conversion amount against limits
   */
  static validateAmount(amount, fiatCurrency = 'USD') {
    const limits = conversionConfig.limits;
    
    // Convert to USD equivalent if needed (simplified - assumes USD for now)
    const usdAmount = amount;

    if (usdAmount < limits.minAmount) {
      return {
        valid: false,
        error: `Amount is below minimum conversion limit of ${limits.minAmount} ${fiatCurrency}`
      };
    }

    if (usdAmount > limits.maxAmount) {
      return {
        valid: false,
        error: `Amount exceeds maximum conversion limit of ${limits.maxAmount} ${fiatCurrency}`
      };
    }

    return { valid: true };
  }

  /**
   * Check if conversion requires approval
   */
  static requiresApproval(amount, riskLevel) {
    const autoApprovalLimit = conversionConfig.limits.autoApprovalLimit;
    
    // Require approval if amount exceeds limit
    if (amount > autoApprovalLimit) {
      return true;
    }

    // Require approval for high-risk conversions
    if (riskLevel === 'high' && conversionConfig.approval.requireApprovalForHighRisk) {
      return true;
    }

    return false;
  }

  /**
   * Format rate with appropriate precision
   */
  static formatRate(rate, decimals = 6) {
    return parseFloat(rate.toFixed(decimals));
  }

  /**
   * Format currency amount
   */
  static formatAmount(amount, currency) {
    // Crypto currencies - more decimals
    if (['BTC', 'ETH', 'LTC', 'XRP'].includes(currency)) {
      return parseFloat(amount.toFixed(8));
    }
    
    // Fiat currencies - standard 2 decimals
    return parseFloat(amount.toFixed(2));
  }
}

module.exports = RateCalculator;
