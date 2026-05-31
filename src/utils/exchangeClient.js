const axios = require('axios');
const crypto = require('crypto');
const logger = require('./logger');
const exchangeConfig = require('../../config/exchanges');

/**
 * Exchange Client Utilities
 * Generic client for interacting with cryptocurrency exchanges
 */

class ExchangeClient {
  constructor(exchangeName) {
    this.exchangeName = exchangeName;
    this.config = exchangeConfig[exchangeName];
    
    if (!this.config) {
      throw new Error(`Exchange configuration not found for: ${exchangeName}`);
    }

    if (!this.config.enabled) {
      logger.warn(`Exchange ${exchangeName} is not enabled`);
    }

    // Create axios instance with base configuration
    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: exchangeConfig.settings.apiTimeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        logger.error(`${exchangeName} API error:`, {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url
        });
        throw error;
      }
    );
  }

  /**
   * Check if exchange is enabled and configured
   */
  isEnabled() {
    return this.config.enabled && this.config.apiKey && this.config.apiSecret;
  }

  /**
   * Generate authentication signature for Coinbase
   */
  generateCoinbaseSignature(timestamp, method, path, body = '') {
    const message = timestamp + method.toUpperCase() + path + body;
    return crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(message)
      .digest('hex');
  }

  /**
   * Generate authentication signature for Kraken
   */
  generateKrakenSignature(path, nonce, postData) {
    const message = postData + nonce + postData;
    const hash = crypto.createHash('sha256').update(message).digest();
    const hmac = crypto.createHmac('sha512', Buffer.from(this.config.apiSecret, 'base64'));
    hmac.update(path + hash.toString('binary'), 'binary');
    return hmac.digest('base64');
  }

  /**
   * Generate authentication signature for Binance
   */
  generateBinanceSignature(queryString) {
    return crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Make authenticated request to exchange
   */
  async makeAuthenticatedRequest(method, endpoint, data = {}) {
    if (!this.isEnabled()) {
      throw new Error(`Exchange ${this.exchangeName} is not properly configured`);
    }

    const timestamp = Date.now();
    let headers = {};
    let params = {};

    // Generate appropriate authentication based on exchange
    switch (this.exchangeName) {
      case 'coinbase':
        headers = {
          'CB-ACCESS-KEY': this.config.apiKey,
          'CB-ACCESS-SIGN': this.generateCoinbaseSignature(
            timestamp,
            method,
            endpoint,
            JSON.stringify(data)
          ),
          'CB-ACCESS-TIMESTAMP': timestamp
        };
        break;

      case 'kraken': {
        const nonce = Date.now() * 1000;
        const postData = new URLSearchParams({ nonce, ...data }).toString();
        headers = {
          'API-Key': this.config.apiKey,
          'API-Sign': this.generateKrakenSignature(endpoint, nonce, postData)
        };
        break;
      }

      case 'binance': {
        const queryString = new URLSearchParams({ timestamp, ...data }).toString();
        params = {
          ...data,
          timestamp,
          signature: this.generateBinanceSignature(queryString)
        };
        headers = {
          'X-MBX-APIKEY': this.config.apiKey
        };
        break;
      }

      default:
        throw new Error(`Authentication not implemented for ${this.exchangeName}`);
    }

    try {
      const response = await this.client.request({
        method,
        url: endpoint,
        headers,
        params: method === 'GET' ? params : undefined,
        data: method !== 'GET' ? data : undefined
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to make authenticated request to ${this.exchangeName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get current exchange rate for a currency pair
   */
  async getExchangeRate(cryptoCurrency, fiatCurrency) {
    try {
      let rate;
      
      switch (this.exchangeName) {
        case 'coinbase':
          rate = await this.getCoinbaseRate(cryptoCurrency, fiatCurrency);
          break;
        case 'kraken':
          rate = await this.getKrakenRate(cryptoCurrency, fiatCurrency);
          break;
        case 'binance':
          rate = await this.getBinanceRate(cryptoCurrency, fiatCurrency);
          break;
        default:
          throw new Error(`Rate fetching not implemented for ${this.exchangeName}`);
      }

      logger.info(`Exchange rate from ${this.exchangeName}: ${cryptoCurrency}/${fiatCurrency} = ${rate}`);
      return rate;
    } catch (error) {
      logger.error(`Failed to get exchange rate from ${this.exchangeName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get Coinbase exchange rate
   */
  async getCoinbaseRate(cryptoCurrency, fiatCurrency) {
    const response = await this.client.get(`/exchange-rates?currency=${cryptoCurrency}`);
    return parseFloat(response.data.data.rates[fiatCurrency]);
  }

  /**
   * Get Kraken exchange rate
   */
  async getKrakenRate(cryptoCurrency, fiatCurrency) {
    const pair = `${cryptoCurrency}${fiatCurrency}`;
    const response = await this.client.get(`/0/public/Ticker?pair=${pair}`);
    const data = Object.values(response.data.result)[0];
    return parseFloat(data.c[0]); // Last trade price
  }

  /**
   * Get Binance exchange rate
   */
  async getBinanceRate(cryptoCurrency, fiatCurrency) {
    const symbol = `${cryptoCurrency}${fiatCurrency}`;
    const response = await this.client.get(`/api/v3/ticker/price?symbol=${symbol}`);
    return parseFloat(response.data.price);
  }

  /**
   * Get account balances
   */
  async getBalances() {
    try {
      let balances;
      
      switch (this.exchangeName) {
        case 'coinbase':
          balances = await this.makeAuthenticatedRequest('GET', '/accounts');
          break;
        case 'kraken':
          balances = await this.makeAuthenticatedRequest('POST', '/0/private/Balance');
          break;
        case 'binance':
          balances = await this.makeAuthenticatedRequest('GET', '/api/v3/account');
          break;
        default:
          throw new Error(`Balance fetching not implemented for ${this.exchangeName}`);
      }

      return this.normalizeBalances(balances);
    } catch (error) {
      logger.error(`Failed to get balances from ${this.exchangeName}:`, error.message);
      throw error;
    }
  }

  /**
   * Normalize balance data across different exchanges
   */
  normalizeBalances(rawBalances) {
    const normalized = [];

    switch (this.exchangeName) {
      case 'coinbase':
        rawBalances.data.forEach(account => {
          if (parseFloat(account.balance.amount) > 0) {
            normalized.push({
              currency: account.currency.code,
              available: parseFloat(account.available_balance.value),
              reserved: parseFloat(account.hold.value),
              total: parseFloat(account.balance.amount)
            });
          }
        });
        break;

      case 'kraken':
        Object.entries(rawBalances.result).forEach(([currency, amount]) => {
          if (parseFloat(amount) > 0) {
            normalized.push({
              currency: currency,
              available: parseFloat(amount),
              reserved: 0,
              total: parseFloat(amount)
            });
          }
        });
        break;

      case 'binance':
        rawBalances.balances.forEach(balance => {
          const free = parseFloat(balance.free);
          const locked = parseFloat(balance.locked);
          if (free > 0 || locked > 0) {
            normalized.push({
              currency: balance.asset,
              available: free,
              reserved: locked,
              total: free + locked
            });
          }
        });
        break;
    }

    return normalized;
  }

  /**
   * Execute a conversion/trade
   */
  async executeConversion(cryptoCurrency, fiatCurrency, amount, side = 'sell') {
    try {
      let result;
      
      switch (this.exchangeName) {
        case 'coinbase':
          result = await this.executeCoinbaseConversion(cryptoCurrency, fiatCurrency, amount, side);
          break;
        case 'kraken':
          result = await this.executeKrakenConversion(cryptoCurrency, fiatCurrency, amount, side);
          break;
        case 'binance':
          result = await this.executeBinanceConversion(cryptoCurrency, fiatCurrency, amount, side);
          break;
        default:
          throw new Error(`Conversion not implemented for ${this.exchangeName}`);
      }

      logger.info(`Conversion executed on ${this.exchangeName}:`, result);
      return result;
    } catch (error) {
      logger.error(`Failed to execute conversion on ${this.exchangeName}:`, error.message);
      throw error;
    }
  }

  /**
   * Execute Coinbase conversion
   */
  async executeCoinbaseConversion(cryptoCurrency, fiatCurrency, amount, side) {
    const orderData = {
      product_id: `${cryptoCurrency}-${fiatCurrency}`,
      side: side,
      order_configuration: {
        market_market_ioc: {
          quote_size: amount.toString()
        }
      }
    };

    return await this.makeAuthenticatedRequest('POST', '/orders', orderData);
  }

  /**
   * Execute Kraken conversion
   */
  async executeKrakenConversion(cryptoCurrency, fiatCurrency, amount, side) {
    const pair = `${cryptoCurrency}${fiatCurrency}`;
    const orderData = {
      pair: pair,
      type: side === 'sell' ? 'sell' : 'buy',
      ordertype: 'market',
      volume: amount.toString()
    };

    return await this.makeAuthenticatedRequest('POST', '/0/private/AddOrder', orderData);
  }

  /**
   * Execute Binance conversion
   */
  async executeBinanceConversion(cryptoCurrency, fiatCurrency, amount, side) {
    const symbol = `${cryptoCurrency}${fiatCurrency}`;
    const orderData = {
      symbol: symbol,
      side: side.toUpperCase(),
      type: 'MARKET',
      quantity: amount
    };

    return await this.makeAuthenticatedRequest('POST', '/api/v3/order', orderData);
  }
}

/**
 * Factory function to create exchange client
 */
function createExchangeClient(exchangeName) {
  return new ExchangeClient(exchangeName);
}

module.exports = {
  ExchangeClient,
  createExchangeClient
};
