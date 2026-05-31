const { asyncHandler } = require('../middleware/errorHandler');
const cfvService = require('../services/cfvService');

// @desc    Get all CFV-supported DGF coins with current CFV data
// @route   GET /api/cfv/coins
// @access  Public
const getAllCFVCoins = asyncHandler(async (req, res) => {
  const coins = await cfvService.getAllCFVCoins();
  res.json({
    success: true,
    data: { coins }
  });
});

// @desc    Get CFV analysis for one DGF coin
// @route   GET /api/cfv/coins/:symbol
// @access  Public
const getCFVCoinBySymbol = asyncHandler(async (req, res) => {
  const coin = await cfvService.getCFVForCoin(req.params.symbol);
  const valuation = await cfvService.getCoinValuationStatus(req.params.symbol);
  res.json({
    success: true,
    data: { coin, valuation }
  });
});

// @desc    Get CFV summary for all supported DGF coins
// @route   GET /api/cfv/summary
// @access  Public
const getCFVSummary = asyncHandler(async (req, res) => {
  const coins = await cfvService.getAllCFVCoins();
  const summary = coins.map(coin => ({
    symbol: coin.symbol,
    name: coin.name,
    currentPrice: coin.currentPrice ?? null,
    fairValue: coin.fairValue ?? null,
    valuationStatus: coin.valuationStatus || 'unknown',
    percentageDifference: coin.percentageDifference ?? null
  }));

  res.json({
    success: true,
    data: {
      totals: {
        totalCoins: summary.length,
        undervalued: summary.filter(item => item.valuationStatus === 'undervalued').length,
        overvalued: summary.filter(item => item.valuationStatus === 'overvalued').length,
        fairlyValued: summary.filter(item => item.valuationStatus === 'fairly valued').length
      },
      coins: summary
    }
  });
});

module.exports = {
  getAllCFVCoins,
  getCFVCoinBySymbol,
  getCFVSummary
};
