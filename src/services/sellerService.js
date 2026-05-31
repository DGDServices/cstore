const Seller = require('../models/Seller');
const SellerProduct = require('../models/SellerProduct');
const logger = require('../utils/logger');

class SellerService {
  async createSellerAccount(userId, sellerData) {
    const existing = await Seller.findOne({ user: userId });
    if (existing) {
      throw new Error('User already has a seller account');
    }

    let slug = sellerData.displayName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const slugExists = await Seller.findOne({ slug });
    if (slugExists) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
    }

    const seller = await Seller.create({
      ...sellerData,
      user: userId,
      slug
    });

    logger.info(`Seller account created for user ${userId}`);
    return seller;
  }

  async updateSellerProfile(sellerId, userId, updates) {
    const seller = await Seller.findById(sellerId);
    if (!seller) throw new Error('Seller not found');

    if (seller.user.toString() !== userId.toString()) {
      throw new Error('Not authorized to update this seller profile');
    }

    const allowed = [
      'displayName',
      'businessName',
      'description',
      'logo',
      'banner',
      'website',
      'returnPolicy',
      'shipsFrom',
      'shippingCarriers',
      'processingTime'
    ];

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        seller[key] = updates[key];
      }
    }

    await seller.save();
    return seller;
  }

  async submitVerification(sellerId, verificationData) {
    const seller = await Seller.findById(sellerId);
    if (!seller) throw new Error('Seller not found');

    seller.verificationStatus = 'pending';
    seller.verificationSubmittedAt = new Date();

    if (verificationData && verificationData.taxInfo) {
      seller.taxInfo = {
        ...seller.taxInfo,
        ...verificationData.taxInfo,
        submittedAt: new Date()
      };
    }

    await seller.save();
    logger.info(`Seller ${sellerId} submitted verification`);
    return seller;
  }

  async approveVerification(sellerId, adminUserId, kycLevel) {
    const seller = await Seller.findById(sellerId);
    if (!seller) throw new Error('Seller not found');

    seller.verificationStatus = 'verified';
    seller.verificationApprovedAt = new Date();
    seller.verifiedBy = adminUserId;
    if (kycLevel !== undefined) seller.kycLevel = kycLevel;

    await seller.save();
    logger.info(`Seller ${sellerId} verified by admin ${adminUserId}`);
    return seller;
  }

  async issueViolation(sellerId, violation, adminUserId) {
    const seller = await Seller.findById(sellerId);
    if (!seller) throw new Error('Seller not found');

    seller.violations.push({
      type: violation.type,
      description: violation.description,
      severity: violation.severity,
      issuedAt: new Date(),
      issuedBy: adminUserId
    });
    seller.strikeCount += 1;

    if (violation.severity === 'suspension') {
      seller.isSuspended = true;
      seller.suspendedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      seller.suspensionReason = violation.description;
    } else if (violation.severity === 'ban') {
      seller.verificationStatus = 'banned';
      seller.isSuspended = true;
      seller.isActive = false;
    }

    await seller.save();
    logger.info(`Violation issued to seller ${sellerId} by admin ${adminUserId}`);
    return seller;
  }

  async updatePerformanceMetrics(sellerId) {
    const seller = await Seller.findById(sellerId);
    if (!seller) throw new Error('Seller not found');

    seller.performanceMetrics.lastCalculatedAt = new Date();
    await seller.save();
    return seller;
  }

  async getSellerStorefront(slug) {
    const seller = await Seller.findOne({ slug, isActive: true, isSuspended: false });
    if (!seller) throw new Error('Storefront not found');

    const products = await SellerProduct.find({ seller: seller._id, isActive: true }).populate('product');

    return { seller, products };
  }

  async getPendingVerifications() {
    return Seller.find({ verificationStatus: 'pending' }).sort({ verificationSubmittedAt: 1 });
  }
}

module.exports = new SellerService();
