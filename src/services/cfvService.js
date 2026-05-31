const axios = require('axios');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { DGF_CFV_COINS } = require('../config/cryptocurrencies');

const DEFAULT_CFV_METRICS_API_URL = 'http://localhost:3000';
const DEFAULT_PRICE_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CALCULATION_CACHE_TTL_MS = 60 * 60 * 1000;
const CFV_ENDPOINTS_BY_SYMBOL = {
  DGB: ['/api/metrics/DGB', '/api/collect/DGB'],
  DASH: ['/api/metrics/DASH', '/api/collect/DASH'],
  XMR: ['/api/metrics/XMR', '/api/collect/XMR'],
  XNO: ['/api/metrics/XNO', '/api/collect/XNO'],
  ZCL: ['/api/metrics/ZCL', '/api/collect/ZCL'],
  RVN: ['/api/metrics/RVN', '/api/collect/RVN'],
  XEC: ['/api/metrics/XEC', '/api/collect/XEC'],
  EGLD: ['/api/metrics/EGLD', '/api/collect/EGLD'],
  NEAR: ['/api/metrics/NEAR', '/api/collect/NEAR'],
  ICP: ['/api/metrics/ICP', '/api/collect/ICP'],
  XCH: ['/api/metrics/XCH', '/api/collect/XCH'],
  DGD: ['/api/metrics/DGD', '/api/collect/DGD']
};

const getNestedValue = (obj, path) =>
  path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isValidCirculatingSupply = (supply) =>
  Number.isFinite(supply) && supply > 0;

const pickNumericValue = (obj, paths) => {
  for (const path of paths) {
    const value = toNumber(getNestedValue(obj, path));
    if (value !== null) {
      return value;
    }
  }
  return null;
};

class CFVService {
  constructor() {
    this.apiUrl = process.env.CFV_METRICS_API_URL || DEFAULT_CFV_METRICS_API_URL;
    this.enabled = (process.env.CFV_ENABLED || 'true').toLowerCase() === 'true';
    this.priceCacheTTL = (Number(process.env.CFV_CACHE_TTL) || DEFAULT_PRICE_CACHE_TTL_MS / 1000) * 1000;
    this.calculationCacheTTL = DEFAULT_CALCULATION_CACHE_TTL_MS;
    this.priceCache = new Map();
    this.calculationCache = new Map();
  }

  /**
   * Get the static list of CFV-supported DGF coins.
   * @returns {Array<{symbol: string, name: string}>}
   */
  getSupportedCFVCoins() {
    return DGF_CFV_COINS;
  }

  /**
   * Get CFV calculation and pricing data for one coin.
   * @param {string} symbol
   * @returns {Promise<Object>}
   */
  async getCFVForCoin(symbol) {
    this.ensureEnabled();

    const normalizedSymbol = this.normalizeSymbol(symbol);
    const now = Date.now();
    const cachedPrice = this.priceCache.get(normalizedSymbol);
    const cachedCalculation = this.calculationCache.get(normalizedSymbol);
    const hasFreshPrice = cachedPrice && now - cachedPrice.timestamp < this.priceCacheTTL;
    const hasFreshCalculation =
      cachedCalculation && now - cachedCalculation.timestamp < this.calculationCacheTTL;

    if (hasFreshPrice && hasFreshCalculation) {
      return this.buildResponseFromCaches(normalizedSymbol);
    }

    try {
      const fetchedData = await this.fetchCoinData(normalizedSymbol);
      this.updateCaches(normalizedSymbol, fetchedData);
      return this.buildResponseFromCaches(normalizedSymbol);
    } catch (error) {
      if (cachedPrice || cachedCalculation) {
        logger.warn(`Returning stale CFV cache for ${normalizedSymbol}: ${error.message}`);
        return this.buildResponseFromCaches(normalizedSymbol);
      }
      throw error;
    }
  }

  /**
   * Get CFV data for all supported DGF coins.
   * @returns {Promise<Array<Object>>}
   */
  async getAllCFVCoins() {
    this.ensureEnabled();
    const coins = this.getSupportedCFVCoins();

    return Promise.all(
      coins.map(async (coin) => {
        try {
          return await this.getCFVForCoin(coin.symbol);
        } catch (error) {
          logger.warn(`CFV lookup failed for ${coin.symbol}: ${error.message}`);
          return {
            symbol: coin.symbol,
            name: coin.name,
            error: 'CFV data unavailable'
          };
        }
      })
    );
  }

  /**
   * Get fair/under/over valuation status for one coin.
   * @param {string} symbol
   * @returns {Promise<Object>}
   */
  async getCoinValuationStatus(symbol) {
    const data = await this.getCFVForCoin(symbol);
    return {
      symbol: data.symbol,
      name: data.name,
      status: data.valuationStatus,
      percentageDifference: data.percentageDifference,
      currentPrice: data.currentPrice,
      fairValue: data.fairValue
    };
  }

  ensureEnabled() {
    if (!this.enabled) {
      throw new AppError('CFV integration is disabled', 503);
    }
  }

  normalizeSymbol(symbol) {
    const normalizedSymbol = String(symbol || '').trim().toUpperCase();
    const isSupported = this.getSupportedCFVCoins().some(coin => coin.symbol === normalizedSymbol);
    if (!isSupported) {
      throw new AppError(`Unsupported CFV coin symbol: ${normalizedSymbol}`, 400);
    }
    return normalizedSymbol;
  }

  async fetchCoinData(symbol) {
    const endpointPaths = CFV_ENDPOINTS_BY_SYMBOL[symbol];
    const endpoints = endpointPaths.map(path => `${this.apiUrl}${path}`);
    let response;
    let lastError;

    for (const endpoint of endpoints) {
      try {
        response = await axios.get(endpoint, { timeout: 10000 });
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!response) {
      throw new AppError(
        `CFV Metrics Agent unavailable for ${symbol}: ${lastError ? lastError.message : 'unknown error'}`,
        502
      );
    }

    const payload = response.data && response.data.data ? response.data.data : response.data;
    return this.extractCoinData(symbol, payload || {});
  }

  extractCoinData(symbol, payload) {
    const currentPrice = pickNumericValue(payload, [
      'currentPrice',
      'price',
      'marketPrice',
      'current_price',
      'pricing.currentPrice',
      'prices.current'
    ]);
    const fairValue = pickNumericValue(payload, [
      'fairValue',
      'fair_value',
      'fairValuePerCoin',
      'cfvPerCoin',
      'pricing.fairValue',
      'calculation.fairValuePerCoin'
    ]);
    const cfv = pickNumericValue(payload, [
      'cfv',
      'totalCFV',
      'fairValueMarketCap',
      'calculation.cfv',
      'calculation.totalCFV'
    ]);
    const adoption = pickNumericValue(payload, ['adoption', 'metrics.adoption', 'metrics.holders']);
    const annualTransactions = pickNumericValue(payload, [
      'annualTransactions',
      'metrics.annualTransactions',
      'metrics.transactionCountAnnual'
    ]);
    const annualTransactionValue = pickNumericValue(payload, [
      'annualTransactionValue',
      'metrics.annualTransactionValue',
      'metrics.transactionValueAnnual'
    ]);
    const developers = pickNumericValue(payload, ['developers', 'metrics.developers']);
    const circulatingSupply = pickNumericValue(payload, [
      'circulatingSupply',
      'supply.circulating',
      'metrics.circulatingSupply'
    ]);

    const resolvedFairValue =
      fairValue !== null
        ? fairValue
        : cfv !== null && isValidCirculatingSupply(circulatingSupply)
          ? cfv / circulatingSupply
          : null;
    const resolvedCFV =
      cfv !== null
        ? cfv
        : resolvedFairValue !== null && isValidCirculatingSupply(circulatingSupply)
          ? resolvedFairValue * circulatingSupply
          : null;

    const valuationStatus = this.calculateValuationStatus(currentPrice, resolvedFairValue);
    const percentageDifference =
      currentPrice !== null && resolvedFairValue !== null && currentPrice !== 0
        ? ((resolvedFairValue - currentPrice) / currentPrice) * 100
        : null;

    return {
      symbol,
      currentPrice,
      fairValue: resolvedFairValue,
      cfv: resolvedCFV,
      metrics: {
        adoption,
        annualTransactions,
        annualTransactionValue,
        developers,
        circulatingSupply
      },
      valuationStatus,
      percentageDifference,
      sourceTimestamp: payload.updatedAt || payload.timestamp || new Date().toISOString()
    };
  }

  calculateValuationStatus(currentPrice, fairValue) {
    if (currentPrice === null || fairValue === null) {
      return 'unknown';
    }

    if (currentPrice === 0 && fairValue === 0) {
      return 'fairly valued';
    }

    if (currentPrice === 0) {
      return 'unknown';
    }

    const deltaRatio = Math.abs(fairValue - currentPrice) / currentPrice;
    if (deltaRatio <= 0.05) {
      return 'fairly valued';
    }
    return fairValue > currentPrice ? 'undervalued' : 'overvalued';
  }

  updateCaches(symbol, data) {
    if (data.currentPrice !== null) {
      this.priceCache.set(symbol, {
        currentPrice: data.currentPrice,
        sourceTimestamp: data.sourceTimestamp,
        timestamp: Date.now()
      });
    }

    this.calculationCache.set(symbol, {
      fairValue: data.fairValue,
      cfv: data.cfv,
      metrics: data.metrics,
      valuationStatus: data.valuationStatus,
      percentageDifference: data.percentageDifference,
      sourceTimestamp: data.sourceTimestamp,
      timestamp: Date.now()
    });
  }

  buildResponseFromCaches(symbol) {
    const coin = this.getSupportedCFVCoins().find(item => item.symbol === symbol);
    const cachedPrice = this.priceCache.get(symbol) || {};
    const cachedCalculation = this.calculationCache.get(symbol) || {};
    return {
      symbol,
      name: coin ? coin.name : symbol,
      currentPrice: cachedPrice.currentPrice ?? null,
      fairValue: cachedCalculation.fairValue ?? null,
      cfv: cachedCalculation.cfv ?? null,
      metrics: cachedCalculation.metrics || null,
      valuationStatus: cachedCalculation.valuationStatus || 'unknown',
      percentageDifference: cachedCalculation.percentageDifference ?? null,
      updatedAt: cachedCalculation.sourceTimestamp || cachedPrice.sourceTimestamp || null
    };
  }
}

module.exports = new CFVService();
