const C2CListing = require('../models/C2CListing');
const Offer = require('../models/Offer');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const logger = require('../utils/logger');

let contentModerationService;
try {
  contentModerationService = require('./contentModerationService');
} catch (e) {
  logger.warn('contentModerationService not available for c2cService');
}

const ALLOWED_UPDATE_FIELDS = [
  'title', 'description', 'images', 'price', 'isNegotiable',
  'condition', 'location', 'tags', 'preferredContactMethod',
  'paymentMethod', 'safeExchangePreferred'
];

class C2CService {
  async createListing(sellerId, listingData) {
    const listing = await C2CListing.create({
      ...listingData,
      seller: sellerId,
      status: 'pending_moderation'
    });

    // Fire-and-forget content moderation
    if (contentModerationService) {
      const imageUrls = (listing.images || []).map(i => i.url).filter(Boolean);
      contentModerationService.moderateContent(
        'listing',
        listing._id,
        { text: `${listing.title} ${listing.description}`, imageUrls },
        sellerId
      ).catch(err => logger.error('Content moderation error for listing:', err));
    }

    return listing;
  }

  async updateListing(listingId, sellerId, updates) {
    const listing = await C2CListing.findById(listingId);
    if (!listing) {
      const err = new Error('Listing not found');
      err.statusCode = 404;
      throw err;
    }
    if (listing.seller.toString() !== sellerId.toString()) {
      const err = new Error('Not authorized to update this listing');
      err.statusCode = 403;
      throw err;
    }
    if (['sold', 'removed'].includes(listing.status)) {
      const err = new Error('Cannot update a sold or removed listing');
      err.statusCode = 400;
      throw err;
    }

    const textChanged = updates.title || updates.description;
    const imagesChanged = updates.images;

    ALLOWED_UPDATE_FIELDS.forEach(field => {
      if (updates[field] !== undefined) {
        listing[field] = updates[field];
      }
    });

    if (textChanged || imagesChanged) {
      listing.status = 'pending_moderation';
      listing.moderationStatus = 'pending';

      if (contentModerationService) {
        const imageUrls = (listing.images || []).map(i => i.url).filter(Boolean);
        contentModerationService.moderateContent(
          'listing',
          listing._id,
          { text: `${listing.title} ${listing.description}`, imageUrls },
          sellerId
        ).catch(err => logger.error('Content moderation error on update:', err));
      }
    }

    await listing.save();
    return listing;
  }

  async searchListings(filters = {}, userCoords, page = 1, limit = 20) {
    const {
      category,
      condition,
      minPrice,
      maxPrice,
      search,
      radiusKm = 50
    } = filters;

    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 20;
    const skip = (page - 1) * limit;

    if (userCoords && Array.isArray(userCoords) && userCoords.length === 2) {
      // Use aggregation with $geoNear when coordinates provided
      const geoNearStage = {
        $geoNear: {
          near: { type: 'Point', coordinates: [parseFloat(userCoords[0]), parseFloat(userCoords[1])] },
          distanceField: 'distance',
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: {
            status: 'active',
            moderationStatus: 'approved',
            ...(category && { category }),
            ...(condition && { condition }),
            ...(minPrice !== undefined || maxPrice !== undefined ? {
              price: {
                ...(minPrice !== undefined && { $gte: parseFloat(minPrice) }),
                ...(maxPrice !== undefined && { $lte: parseFloat(maxPrice) })
              }
            } : {})
          }
        }
      };

      const pipeline = [
        geoNearStage,
        { $sort: { lastBumpedAt: -1, createdAt: -1 } },
        { $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }]
        }}
      ];

      const [result] = await C2CListing.aggregate(pipeline);
      const listings = result.data || [];
      const total = result.total[0] ? result.total[0].count : 0;
      return { listings, total, page, limit };
    }

    // Standard query without geo
    const query = { status: 'active', moderationStatus: 'approved' };
    if (category) query.category = category;
    if (condition) query.condition = condition;
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined) query.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      query.$text = { $search: search };
    }

    const [listings, total] = await Promise.all([
      C2CListing.find(query)
        .sort({ lastBumpedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      C2CListing.countDocuments(query)
    ]);

    return { listings, total, page, limit };
  }

  async getListing(listingId, _viewerUserId) {
    const listing = await C2CListing.findById(listingId)
      .populate('seller', 'name createdAt');

    if (!listing) {
      const err = new Error('Listing not found');
      err.statusCode = 404;
      throw err;
    }

    // Increment viewCount fire-and-forget
    C2CListing.findByIdAndUpdate(listingId, { $inc: { viewCount: 1 } })
      .catch(err => logger.error('Failed to increment viewCount:', err));

    return listing;
  }

  async markAsSold(listingId, sellerId) {
    const listing = await C2CListing.findById(listingId);
    if (!listing) {
      const err = new Error('Listing not found');
      err.statusCode = 404;
      throw err;
    }
    if (listing.seller.toString() !== sellerId.toString()) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }
    listing.status = 'sold';
    await listing.save();
    return listing;
  }

  async removeListing(listingId, userId, isAdmin) {
    const listing = await C2CListing.findById(listingId);
    if (!listing) {
      const err = new Error('Listing not found');
      err.statusCode = 404;
      throw err;
    }
    if (!isAdmin && listing.seller.toString() !== userId.toString()) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }
    listing.status = 'removed';
    await listing.save();
    return listing;
  }

  async bumpListing(listingId, sellerId) {
    const listing = await C2CListing.findById(listingId);
    if (!listing) {
      const err = new Error('Listing not found');
      err.statusCode = 404;
      throw err;
    }
    if (listing.seller.toString() !== sellerId.toString()) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }
    if (listing.status !== 'active') {
      const err = new Error('Only active listings can be bumped');
      err.statusCode = 400;
      throw err;
    }
    listing.lastBumpedAt = new Date();
    listing.bumpCount += 1;
    await listing.save();
    return listing;
  }

  async makeOffer(listingId, buyerId, amount, message) {
    const listing = await C2CListing.findById(listingId);
    if (!listing) {
      const err = new Error('Listing not found');
      err.statusCode = 404;
      throw err;
    }
    if (listing.seller.toString() === buyerId.toString()) {
      const err = new Error('Cannot make an offer on your own listing');
      err.statusCode = 400;
      throw err;
    }

    const fortyEightHours = 48 * 60 * 60 * 1000;
    const offerEntry = {
      from: buyerId,
      amount,
      currency: listing.currency || 'USD',
      message,
      status: 'pending',
      expiresAt: new Date(Date.now() + fortyEightHours)
    };

    // Check for existing open offer
    let offer = await Offer.findOne({ listing: listingId, buyer: buyerId, status: 'open' });

    if (offer) {
      // Add as counter-offer entry
      const latest = offer.getLatestOffer();
      if (latest) latest.status = 'countered';
      offer.offerChain.push(offerEntry);
      offer.currentAmount = amount;
    } else {
      offer = new Offer({
        listing: listingId,
        buyer: buyerId,
        seller: listing.seller,
        offerChain: [offerEntry],
        currentAmount: amount,
        status: 'open'
      });
      // Increment listing offerCount fire-and-forget
      C2CListing.findByIdAndUpdate(listingId, { $inc: { offerCount: 1 } })
        .catch(err => logger.error('Failed to increment offerCount:', err));
    }

    await offer.save();

    // Get or create conversation
    const conversation = await this._getOrCreateConversationInternal(
      [buyerId, listing.seller],
      'c2c_offer',
      { listingId }
    );

    // Update conversation with offer reference
    conversation.relatedOffer = offer._id;
    await conversation.save();

    // Send system message with offer card
    await Message.create({
      conversation: conversation._id,
      sender: buyerId,
      content: `Offer of ${listing.currency || 'USD'} ${amount}${message ? ': ' + message : ''}`,
      contentType: 'offer_card',
      offerRef: offer._id
    });

    await Conversation.findByIdAndUpdate(conversation._id, {
      $inc: { messageCount: 1 },
      lastMessage: { content: `Offer: ${amount}`, sender: buyerId, sentAt: new Date() }
    });

    offer.conversation = conversation._id;
    await offer.save();

    return { offer, conversation };
  }

  async respondToOffer(offerId, userId, response, counterAmount, message) {
    const offer = await Offer.findById(offerId);
    if (!offer) {
      const err = new Error('Offer not found');
      err.statusCode = 404;
      throw err;
    }

    const isBuyer = offer.buyer.toString() === userId.toString();
    const isSeller = offer.seller.toString() === userId.toString();

    if (!isBuyer && !isSeller) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }

    const latest = offer.getLatestOffer();
    if (!latest) {
      const err = new Error('No offer entries found');
      err.statusCode = 400;
      throw err;
    }

    if (['accept', 'reject'].includes(response)) {
      // The recipient (not sender) must respond
      if (latest.from.toString() === userId.toString()) {
        const err = new Error('Cannot accept or reject your own offer');
        err.statusCode = 400;
        throw err;
      }

      latest.status = response === 'accept' ? 'accepted' : 'rejected';
      latest.respondedAt = new Date();

      if (response === 'accept') {
        offer.status = 'accepted';
        offer.acceptedAt = new Date();
        offer.acceptedAmount = latest.amount;
      } else {
        offer.status = 'rejected';
      }
    } else if (response === 'counter') {
      if (!counterAmount && counterAmount !== 0) {
        const err = new Error('counterAmount is required for counter offers');
        err.statusCode = 400;
        throw err;
      }
      latest.status = 'countered';
      latest.respondedAt = new Date();

      const fortyEightHours = 48 * 60 * 60 * 1000;
      offer.offerChain.push({
        from: userId,
        amount: counterAmount,
        currency: latest.currency || 'USD',
        message,
        status: 'pending',
        expiresAt: new Date(Date.now() + fortyEightHours)
      });
      offer.currentAmount = counterAmount;
    } else {
      const err = new Error('Invalid response. Must be accept, reject, or counter');
      err.statusCode = 400;
      throw err;
    }

    await offer.save();

    // Send message in conversation
    if (offer.conversation) {
      const content = response === 'counter'
        ? `Counter offer: ${counterAmount}${message ? ' - ' + message : ''}`
        : `Offer ${response}ed`;

      await Message.create({
        conversation: offer.conversation,
        sender: userId,
        content,
        contentType: response === 'counter' ? 'offer_card' : 'system',
        offerRef: offer._id
      });

      await Conversation.findByIdAndUpdate(offer.conversation, {
        $inc: { messageCount: 1 },
        lastMessage: { content, sender: userId, sentAt: new Date() }
      });
    }

    return offer;
  }

  async getMyListings(sellerId, status, page = 1, limit = 20) {
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = { seller: sellerId };
    if (status) query.status = status;

    const [listings, total] = await Promise.all([
      C2CListing.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      C2CListing.countDocuments(query)
    ]);

    return { listings, total, page, limit };
  }

  async getListingOffers(listingId, userId) {
    const offers = await Offer.find({
      listing: listingId,
      $or: [{ buyer: userId }, { seller: userId }]
    }).populate('buyer', 'name').populate('seller', 'name');

    return offers;
  }

  // Internal helper for creating conversations without going through messagingService
  async _getOrCreateConversationInternal(participants, type, relatedData = {}) {
    const participantIds = participants.map(p => p.toString()).sort();

    const query = {
      participants: { $all: participantIds, $size: participantIds.length }
    };
    if (relatedData.listingId) query.relatedListing = relatedData.listingId;

    let conversation = await Conversation.findOne(query);
    if (!conversation) {
      conversation = await Conversation.create({
        participants,
        type,
        relatedListing: relatedData.listingId,
        relatedAuction: relatedData.auctionId,
        relatedOffer: relatedData.offerId
      });
    }
    return conversation;
  }
}

module.exports = new C2CService();
