const SellerProduct = require('../models/SellerProduct');
const logger = require('../utils/logger');

class BuyBoxService {
  calculateBuyBoxScore(sellerProduct, seller) {
    const metrics = seller.performanceMetrics || {};

    const ratingScore = ((metrics.averageRating || 0) / 5) * 30;

    let fulfillmentScore;
    if (sellerProduct.fulfillmentType === 'fbp') {
      fulfillmentScore = 20;
    } else if (sellerProduct.fulfillmentType === 'pod') {
      fulfillmentScore = 18;
    } else {
      const processingMax = (seller.processingTime && seller.processingTime.max) || 3;
      if (processingMax <= 1) {
        fulfillmentScore = 15;
      } else if (processingMax <= 2) {
        fulfillmentScore = 12;
      } else {
        fulfillmentScore = 8;
      }
    }

    const defectRate = metrics.orderDefectRate || 0;
    const defectScore = Math.max(0, 10 - defectRate * 1000);

    // Price score placeholder — normalized against other offers in selectBuyBoxWinner
    const priceScore = 0;

    const score = priceScore + ratingScore + fulfillmentScore + defectScore;

    return {
      score,
      breakdown: { priceScore, ratingScore, fulfillmentScore, defectScore }
    };
  }

  async selectBuyBoxWinner(productId) {
    const offers = await SellerProduct.find({
      product: productId,
      isActive: true
    }).populate({
      path: 'seller',
      match: { verificationStatus: 'verified', isSuspended: false }
    });

    // Filter out offers where seller didn't match population conditions
    const eligible = offers.filter((o) => o.seller !== null);

    if (eligible.length === 0) {
      await SellerProduct.updateMany({ product: productId }, { isBuyBoxWinner: false });
      return null;
    }

    // Determine price rank for price component (40%)
    const sorted = [...eligible].sort((a, b) => a.priceUSD - b.priceUSD);

    const scoredOffers = eligible.map((offer) => {
      const rank = sorted.findIndex((o) => o._id.toString() === offer._id.toString());
      const priceScore = eligible.length === 1 ? 40 : 40 - (rank / (eligible.length - 1)) * 40;

      const base = this.calculateBuyBoxScore(offer, offer.seller);
      const totalScore = priceScore + base.breakdown.ratingScore + base.breakdown.fulfillmentScore + base.breakdown.defectScore;

      return {
        offer,
        score: totalScore,
        breakdown: { ...base.breakdown, priceScore }
      };
    });

    scoredOffers.sort((a, b) => b.score - a.score);
    const winner = scoredOffers[0];
    const now = new Date();

    await Promise.all(
      scoredOffers.map(({ offer, score }) => {
        const isWinner = offer._id.toString() === winner.offer._id.toString();
        offer.isBuyBoxWinner = isWinner;
        offer.buyBoxScore = isWinner ? score : offer.buyBoxScore;
        offer.buyBoxCalculatedAt = now;
        return offer.save();
      })
    );

    logger.info(`Buy box winner selected for product ${productId}: seller ${winner.offer.seller._id}`);
    return winner.offer;
  }

  async recalculateOnPriceChange(sellerProductId) {
    const sellerProduct = await SellerProduct.findById(sellerProductId);
    if (!sellerProduct) return null;
    return this.selectBuyBoxWinner(sellerProduct.product);
  }

  async getProductOffers(productId) {
    return SellerProduct.find({ product: productId, isActive: true })
      .populate('seller', 'displayName verificationStatus performanceMetrics returnPolicy')
      .sort({ buyBoxScore: -1 });
  }
}

module.exports = new BuyBoxService();
