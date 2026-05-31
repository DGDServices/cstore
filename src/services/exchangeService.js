const { createExchangeClient } = require('../utils/exchangeClient');
const ExchangeBalance = require('../models/ExchangeBalance');
const logger = require('../utils/logger');
const exchangeConfig = require('../../config/exchanges');

/**
 * Exchange Service
 * Manages cryptocurrency exchange interactions and balance tracking
 */
class ExchangeService {
  constructor() {
    this.exchanges = {};
    this.rateCache = new Map();
    this.lastBalanceSync = {};
    
    // Initialize enabled exchanges
    this.initializeExchanges();
  }

  /**
   * Initialize exchange clients
   */
  initializeExchanges() {
    const exchangeNames = ['coinbase', 'kraken', 'binance'];
    
    exchangeNames.forEach(name => {
      try {
        const client = createExchangeClient(name);
        if (client.isEnabled()) {
          this.exchanges[name] = client;
          logger.info(`Exchange ${name} initialized successfully`);
        } else {
          logger.warn(`Exchange ${name} is not enabled or not configured`);
        }
      } catch (error) {
        logger.error(`Failed to initialize exchange ${name}:`, error.message);
      }
    });
  }

  /**
   * Get available exchanges
   */
  getAvailableExchanges() {
    return Object.keys(this.exchanges);
  }

  /**
   * Get exchange client by name
   */
  getExchange(exchangeName) {
    const exchange = this.exchanges[exchangeName];
    if (!exchange) {
      throw new Error(`Exchange ${exchangeName} is not available`);
    }
    return exchange;
  }

  /**
   * Get exchange rate from specific exchange
   */
  async getExchangeRate(exchangeName, cryptocurrency, fiatCurrency) {
    try {
      const exchange = this.getExchange(exchangeName);
      const cacheKey = `${exchangeName}_${cryptocurrency}_${fiatCurrency}`;
      
      // Check cache
      if (exchangeConfig.settings.enableRateCache) {
        const cached = this.rateCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < exchangeConfig.settings.rateCacheDuration) {
          logger.debug(`Using cached rate for ${cacheKey}`);
          return cached.rate;
        }
      }
      
      // Fetch fresh rate
      const rate = await exchange.getExchangeRate(cryptocurrency, fiatCurrency);
      
      // Cache the rate
      if (exchangeConfig.settings.enableRateCache) {
        this.rateCache.set(cacheKey, {
          rate,
          timestamp: Date.now()
        });
      }
      
      return rate;
    } catch (error) {
      logger.error(`Failed to get exchange rate from ${exchangeName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get exchange rates from all available exchanges
   */
  async getAllExchangeRates(cryptocurrency, fiatCurrency) {
    const rates = [];
    const availableExchanges = this.getAvailableExchanges();
    
    for (const exchangeName of availableExchanges) {
      try {
        const rate = await this.getExchangeRate(exchangeName, cryptocurrency, fiatCurrency);
        rates.push({
          exchange: exchangeName,
          rate,
          timestamp: new Date()
        });
      } catch (error) {
        logger.warn(`Failed to get rate from ${exchangeName}:`, error.message);
      }
    }
    
    return rates;
  }

  /**
   * Get best exchange rate
   */
  async getBestExchangeRate(cryptocurrency, fiatCurrency) {
    const rates = await this.getAllExchangeRates(cryptocurrency, fiatCurrency);
    
    if (rates.length === 0) {
      throw new Error('No exchange rates available');
    }
    
    // Find the best rate (highest for selling crypto)
    return rates.reduce((best, current) => {
      return current.rate > best.rate ? current : best;
    });
  }

  /**
   * Select best exchange based on configuration and availability
   */
  async selectBestExchange(cryptocurrency, fiatCurrency, amount) {
    if (!exchangeConfig.settings.autoSelectExchange) {
      // Use first available exchange from priority list
      for (const exchangeName of exchangeConfig.exchangePriority) {
        if (this.exchanges[exchangeName]) {
          return exchangeName;
        }
      }
    }
    
    // Get rates from all exchanges and select best
    const bestRate = await this.getBestExchangeRate(cryptocurrency, fiatCurrency);
    return bestRate.exchange;
  }

  /**
   * Sync balances from an exchange
   */
  async syncExchangeBalances(exchangeName) {
    try {
      const exchange = this.getExchange(exchangeName);
      const balances = await exchange.getBalances();
      
      logger.info(`Syncing ${balances.length} balances from ${exchangeName}`);
      
      // Update each balance in database
      for (const balance of balances) {
        try {
          // Determine currency type
          const currencyType = this.determineCurrencyType(balance.currency);
          
          // Find or create balance record
          let balanceRecord = await ExchangeBalance.findOne({
            exchange: exchangeName,
            currency: balance.currency
          });
          
          if (balanceRecord) {
            await balanceRecord.updateBalance(
              balance.available,
              balance.reserved,
              balance.total
            );
          } else {
            balanceRecord = await ExchangeBalance.create({
              exchange: exchangeName,
              currency: balance.currency,
              currencyType,
              available: balance.available,
              reserved: balance.reserved,
              total: balance.total,
              lastSync: new Date()
            });
          }
          
          logger.debug(`Synced balance for ${balance.currency} on ${exchangeName}`);
        } catch (error) {
          logger.error(`Failed to sync balance for ${balance.currency}:`, error.message);
        }
      }
      
      this.lastBalanceSync[exchangeName] = new Date();
      return { success: true, balancesSync: balances.length };
    } catch (error) {
      logger.error(`Failed to sync balances from ${exchangeName}:`, error.message);
      
      // Mark as failed in database
      await ExchangeBalance.updateMany(
        { exchange: exchangeName },
        { 
          $set: { 
            syncStatus: 'failed',
            syncError: error.message
          }
        }
      );
      
      throw error;
    }
  }

  /**
   * Sync balances from all exchanges
   */
  async syncAllBalances() {
    const results = {};
    const availableExchanges = this.getAvailableExchanges();
    
    for (const exchangeName of availableExchanges) {
      try {
        const result = await this.syncExchangeBalances(exchangeName);
        results[exchangeName] = result;
      } catch (error) {
        results[exchangeName] = { 
          success: false, 
          error: error.message 
        };
      }
    }
    
    return results;
  }

  /**
   * Get balance for specific currency on exchange
   */
  async getBalance(exchangeName, currency) {
    try {
      const balance = await ExchangeBalance.getBalance(exchangeName, currency);
      
      if (!balance) {
        // Try to sync if not found
        await this.syncExchangeBalances(exchangeName);
        return await ExchangeBalance.getBalance(exchangeName, currency);
      }
      
      // Check if balance is stale
      const staleThreshold = exchangeConfig.settings.balanceSyncInterval;
      const age = Date.now() - balance.lastSync.getTime();
      
      if (age > staleThreshold) {
        logger.info(`Balance for ${currency} on ${exchangeName} is stale, syncing...`);
        await this.syncExchangeBalances(exchangeName);
        return await ExchangeBalance.getBalance(exchangeName, currency);
      }
      
      return balance;
    } catch (error) {
      logger.error(`Failed to get balance for ${currency} on ${exchangeName}:`, error.message);
      throw error;
    }
  }

  /**
   * Execute a conversion on an exchange
   */
  async executeConversion(exchangeName, cryptocurrency, fiatCurrency, amount) {
    try {
      const exchange = this.getExchange(exchangeName);
      
      // Execute the conversion
      const result = await exchange.executeConversion(cryptocurrency, fiatCurrency, amount, 'sell');
      
      logger.info(`Conversion executed on ${exchangeName}:`, {
        cryptocurrency,
        fiatCurrency,
        amount,
        result: result
      });
      
      // Trigger balance sync after conversion
      setTimeout(() => {
        this.syncExchangeBalances(exchangeName).catch(err => {
          logger.error('Failed to sync balances after conversion:', err);
        });
      }, 5000);
      
      return result;
    } catch (error) {
      logger.error(`Failed to execute conversion on ${exchangeName}:`, error.message);
      throw error;
    }
  }

  /**
   * Test exchange connection
   */
  async testConnection(exchangeName) {
    try {
      const exchange = this.getExchange(exchangeName);
      
      // Try to fetch balances as a connection test
      await exchange.getBalances();
      
      return {
        success: true,
        exchange: exchangeName,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`Connection test failed for ${exchangeName}:`, error.message);
      return {
        success: false,
        exchange: exchangeName,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get low balance alerts
   */
  async getLowBalanceAlerts() {
    return await ExchangeBalance.getLowBalanceAlerts();
  }

  /**
   * Determine if currency is crypto or fiat
   */
  determineCurrencyType(currency) {
    const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'LTC', 'XRP', 'USDC', 'DAI', 'BNB'];
    return cryptoCurrencies.includes(currency) ? 'crypto' : 'fiat';
  }

  /**
   * Clear rate cache
   */
  clearRateCache() {
    this.rateCache.clear();
    logger.info('Rate cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.rateCache.size,
      exchanges: this.getAvailableExchanges().length,
      lastBalanceSync: this.lastBalanceSync
    };
  }
}

// Export singleton instance
module.exports = new ExchangeService();
