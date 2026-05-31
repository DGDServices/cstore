const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const AuctionWatch = require('../models/AuctionWatch');
const logger = require('../utils/logger');

let emailService = null;
try {
  emailService = require('./emailService');
} catch (e) {
  logger.warn('emailService not available for auctionService');
}

class AuctionService {
  constructor() {
    this.redisClient = null;
    this.AUCTION_BID_KEY = (auctionId) => `auction:${auctionId}:bids`;
    this.AUCTION_PROXY_KEY = (auctionId) => `auction:${auctionId}:proxies`;
  }

  initRedis(redisClient) {
    this.redisClient = redisClient;
  }

  async createAuction(auctionData, sellerId) {
    const now = new Date();
    const startTime = new Date(auctionData.startTime);
    const status = startTime <= now ? 'active' : 'scheduled';

    const auction = await Auction.create({
      ...auctionData,
      seller: sellerId,
      currentPrice: auctionData.startingPrice,
      status
    });

    return auction;
  }

  async placeBid(auctionId, bidderId, amount, maxProxyBid, ipAddress) {
    const now = new Date();

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }
    if (auction.status !== 'active') {
      throw new Error('Auction is not active');
    }
    if (now < auction.startTime || now > auction.endTime) {
      throw new Error('Auction is not currently accepting bids');
    }
    if (auction.seller.toString() === bidderId.toString()) {
      throw new Error('Seller cannot bid on their own auction');
    }

    const minRequired = auction.currentPrice + auction.bidIncrement;
    if (amount < minRequired) {
      throw new Error(`Bid must be at least ${minRequired}`);
    }

    // Handle proxy bidding
    let finalAmount = amount;
    let proxyBidPlaced = false;

    const existingProxies = await Bid.find({
      auction: auctionId,
      maxProxyBid: { $ne: null },
      isWinning: true,
      status: { $in: ['active'] }
    }).sort({ maxProxyBid: -1 }).limit(1);

    const currentLeaderProxy = existingProxies.length > 0 ? existingProxies[0] : null;

    if (maxProxyBid) {
      proxyBidPlaced = true;
    }

    if (currentLeaderProxy && currentLeaderProxy.bidder.toString() !== bidderId.toString()) {
      // Proxy competition
      const leaderMax = currentLeaderProxy.maxProxyBid;
      const newMax = maxProxyBid || amount;

      if (leaderMax > newMax) {
        // Existing leader wins; auto-increment their bid
        finalAmount = Math.min(leaderMax, newMax + auction.bidIncrement);
      } else if (newMax > leaderMax) {
        // New bidder wins; set to leader's max + increment
        finalAmount = Math.min(newMax, leaderMax + auction.bidIncrement);
      }
      // If equal, first proxy wins (existing leader)
      if (leaderMax >= newMax) {
        // Auto-increment leader's displayed bid
        const autoAmount = Math.min(leaderMax, newMax + auction.bidIncrement);
        currentLeaderProxy.amount = autoAmount;
        currentLeaderProxy.isProxy = true;
        await currentLeaderProxy.save();

        // Update auction price
        auction.currentPrice = autoAmount;
        auction.totalBids += 1;
        await auction.save();

        return {
          bid: currentLeaderProxy,
          auction,
          extended: false,
          proxyBidPlaced
        };
      }
    }

    // Mark previous winning bid as outbid
    const previousWinning = await Bid.findOne({ auction: auctionId, isWinning: true });
    if (previousWinning) {
      previousWinning.isWinning = false;
      previousWinning.wasOutbid = true;
      previousWinning.outbidAt = now;
      previousWinning.outbidBy = bidderId;
      previousWinning.status = 'outbid';
      await previousWinning.save();
    }

    const bid = await Bid.create({
      auction: auctionId,
      bidder: bidderId,
      amount: finalAmount,
      maxProxyBid: maxProxyBid || null,
      isProxy: false,
      isWinning: true,
      status: 'active',
      ipAddress
    });

    // Update auction stats
    auction.currentPrice = finalAmount;
    auction.totalBids += 1;

    // Count unique bidders
    const uniqueBiddersCount = await Bid.distinct('bidder', {
      auction: auctionId,
      status: { $ne: 'retracted' }
    });
    auction.uniqueBidders = uniqueBiddersCount.length;

    // Check reserve
    if (auction.hasReserve && finalAmount >= auction.reservePrice) {
      auction.reserveMet = true;
    }

    // Anti-sniping
    let extended = false;
    if (auction.shouldExtend(now)) {
      auction.extendAuction();
      extended = true;
    }

    await auction.save();

    return { bid, auction, extended, proxyBidPlaced };
  }

  async processProxyBid(auction, newBid, newBidderMaxProxy) {
    const existingProxies = await Bid.find({
      auction: auction._id,
      maxProxyBid: { $ne: null },
      isWinning: true,
      status: 'active'
    }).sort({ maxProxyBid: -1 }).limit(1);

    if (!existingProxies.length) {
      return newBid;
    }

    const leaderProxy = existingProxies[0];
    const leaderMax = leaderProxy.maxProxyBid;
    const newMax = newBidderMaxProxy || newBid.amount;

    if (leaderMax >= newMax) {
      // Leader retains position
      leaderProxy.amount = Math.min(leaderMax, newMax + auction.bidIncrement);
      leaderProxy.isProxy = true;
      await leaderProxy.save();
      return leaderProxy;
    }

    // New bidder wins proxy competition
    newBid.amount = Math.min(newMax, leaderMax + auction.bidIncrement);
    return newBid;
  }

  async closeAuction(auctionId) {
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }

    const winningBid = await Bid.findOne({ auction: auctionId, isWinning: true });

    if (!winningBid || (auction.hasReserve && !auction.reserveMet)) {
      auction.status = 'ended';
    } else {
      auction.status = 'sold';
      auction.winnerId = winningBid.bidder;
      auction.winningBidId = winningBid._id;
      auction.winningAmount = winningBid.amount;
      winningBid.status = 'won';
      await winningBid.save();
    }

    await auction.save();

    // Notify winner fire-and-forget
    if (auction.status === 'sold' && emailService) {
      try {
        if (emailService.sendAuctionWonNotification) {
          emailService.sendAuctionWonNotification(auction.winnerId, auction).catch(() => {});
        }
      } catch (e) {
        logger.error('Failed to send auction won notification', e);
      }
    }

    return auction;
  }

  async buyItNow(auctionId, userId) {
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }
    if (auction.auctionType !== 'bin_hybrid') {
      throw new Error('Buy It Now is only available for bin_hybrid auctions');
    }
    if (!auction.buyItNowPrice) {
      throw new Error('No Buy It Now price set for this auction');
    }
    if (auction.status !== 'active') {
      throw new Error('Auction is not active');
    }
    if (auction.seller.toString() === userId.toString()) {
      throw new Error('Seller cannot use Buy It Now on their own auction');
    }

    auction.status = 'sold';
    auction.binPurchasedBy = userId;
    auction.binPurchasedAt = new Date();
    auction.winningAmount = auction.buyItNowPrice;
    auction.winnerId = userId;

    await auction.save();
    return auction;
  }

  async watchAuction(auctionId, userId, preferences) {
    const existing = await AuctionWatch.findOne({ auction: auctionId, user: userId });

    const watchData = {
      auction: auctionId,
      user: userId,
      ...preferences
    };

    let watch;
    let isNew = false;

    if (existing) {
      Object.assign(existing, preferences);
      watch = await existing.save();
    } else {
      watch = await AuctionWatch.create(watchData);
      isNew = true;
    }

    if (isNew) {
      await Auction.findByIdAndUpdate(auctionId, { $inc: { watcherCount: 1 } });
    }

    return watch;
  }

  async unwatchAuction(auctionId, userId) {
    const watch = await AuctionWatch.findOneAndDelete({ auction: auctionId, user: userId });
    if (watch) {
      await Auction.findByIdAndUpdate(auctionId, { $inc: { watcherCount: -1 } });
    }
    return { removed: true };
  }

  async getAuctions(filters, page, limit) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (filters.status) query.status = filters.status;
    if (filters.category) query.category = filters.category;
    if (filters.auctionType) query.auctionType = filters.auctionType;
    if (filters.minPrice || filters.maxPrice) {
      query.currentPrice = {};
      if (filters.minPrice) query.currentPrice.$gte = parseFloat(filters.minPrice);
      if (filters.maxPrice) query.currentPrice.$lte = parseFloat(filters.maxPrice);
    }
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const sortOrder = filters.status === 'active' ? { endTime: 1 } : { createdAt: -1 };

    const [auctions, total] = await Promise.all([
      Auction.find(query).sort(sortOrder).skip(skip).limit(limitNum),
      Auction.countDocuments(query)
    ]);

    return { auctions, total, page: pageNum, limit: limitNum };
  }

  async getAuction(auctionId) {
    return Auction.findById(auctionId)
      .populate('seller', 'name')
      .populate('category')
      .populate('product')
      .populate('winnerId', 'name');
  }

  async getBidHistory(auctionId, limit) {
    const limitNum = parseInt(limit, 10) || 50;
    return Bid.find({ auction: auctionId })
      .sort({ amount: -1 })
      .limit(limitNum)
      .populate('bidder', 'name');
  }

  async retractBid(bidId, userId, reason, isAdmin) {
    const bid = await Bid.findById(bidId).populate('auction');
    if (!bid) {
      throw new Error('Bid not found');
    }

    const auction = bid.auction;

    if (!isAdmin) {
      if (bid.bidder.toString() !== userId.toString()) {
        throw new Error('Not authorized to retract this bid');
      }
      if (['ended', 'sold', 'cancelled'].includes(auction.status)) {
        throw new Error('Cannot retract bid after auction has ended');
      }
      if (bid.isWinning) {
        throw new Error('Cannot retract the current winning bid');
      }
    }

    const wasWinning = bid.isWinning;

    bid.status = 'retracted';
    bid.retractionReason = reason;
    bid.retractedAt = new Date();
    bid.retractedBy = userId;
    bid.isWinning = false;

    await bid.save();

    // Recalculate winner if this was the winning bid
    if (wasWinning) {
      const nextBid = await Bid.findOne({
        auction: auction._id,
        status: 'active',
        _id: { $ne: bid._id }
      }).sort({ amount: -1 });

      if (nextBid) {
        nextBid.isWinning = true;
        nextBid.status = 'active';
        await nextBid.save();
        auction.currentPrice = nextBid.amount;
      } else {
        auction.currentPrice = auction.startingPrice;
      }
      await auction.save();
    }

    return bid;
  }

  async scheduleAuctionCloser() {
    const interval = setInterval(async () => {
      try {
        const now = new Date();
        const expiredAuctions = await Auction.find({
          status: 'active',
          endTime: { $lt: now }
        });

        for (const auction of expiredAuctions) {
          try {
            await this.closeAuction(auction._id);
          } catch (err) {
            logger.error(`Failed to close auction ${auction._id}:`, err);
          }
        }
      } catch (err) {
        logger.error('Error in auction closer interval:', err);
      }
    }, 60 * 1000);

    return interval;
  }

  async activateScheduledAuctions() {
    const now = new Date();
    const scheduled = await Auction.find({
      status: 'scheduled',
      startTime: { $lte: now }
    });

    for (const auction of scheduled) {
      auction.status = 'active';
      await auction.save();
    }

    return scheduled;
  }
}

module.exports = new AuctionService();
