const MultiSigWallet = require('../models/MultiSigWallet');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { isValidBitcoinAddress } = require('../utils/addressValidation');

/**
 * Create a new multi-signature wallet
 * POST /api/wallets/multi-sig
 * @access Private
 */
exports.createWallet = asyncHandler(async (req, res, next) => {
  const { name, cryptocurrency, address, signers, requiredSignatures, description } = req.body;
  
  // Validate signers
  if (!signers || signers.length < 2) {
    return next(new AppError('At least 2 signers are required for multi-signature wallet', 400));
  }
  
  if (requiredSignatures < 2 || requiredSignatures > signers.length) {
    return next(new AppError('Required signatures must be between 2 and the number of signers', 400));
  }
  
  // Validate Bitcoin address if cryptocurrency is BTC
  if (cryptocurrency === 'BTC' && !isValidBitcoinAddress(address)) {
    return next(new AppError('Invalid Bitcoin address format', 400));
  }
  
  // Check if wallet address already exists
  const existingWallet = await MultiSigWallet.findOne({ address });
  if (existingWallet) {
    return next(new AppError('Wallet address already exists', 400));
  }
  
  // Validate and enrich signer information
  const enrichedSigners = [];
  for (const signer of signers) {
    const user = await User.findOne({ email: signer.email });
    if (!user) {
      return next(new AppError(`User with email ${signer.email} not found`, 404));
    }
    
    enrichedSigners.push({
      user: user._id,
      email: user.email,
      name: user.name,
      publicKey: signer.publicKey || null
    });
  }
  
  // Create wallet
  const wallet = await MultiSigWallet.create({
    name,
    owner: req.user.id,
    cryptocurrency,
    address,
    signers: enrichedSigners,
    requiredSignatures,
    description
  });
  
  await wallet.populate('owner', 'name email');
  await wallet.populate('signers.user', 'name email');
  
  // Enhanced security logging for wallet creation
  logger.logMultiSigOperation('wallet_created', {
    walletId: wallet._id,
    ownerId: req.user.id,
    ownerEmail: req.user.email,
    name: wallet.name,
    cryptocurrency: wallet.cryptocurrency,
    address: wallet.address,
    signersCount: enrichedSigners.length,
    requiredSignatures: requiredSignatures,
    signerEmails: enrichedSigners.map(s => s.email)
  });
  
  res.status(201).json({
    success: true,
    data: wallet
  });
});

/**
 * Get all wallets for the current user
 * GET /api/wallets/multi-sig
 * @access Private
 */
exports.getWallets = asyncHandler(async (req, res, next) => {
  const { isActive, cryptocurrency } = req.query;
  
  // Build query - find wallets where user is owner or signer
  const query = {
    $or: [
      { owner: req.user.id },
      { 'signers.user': req.user.id }
    ]
  };
  
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }
  
  if (cryptocurrency) {
    query.cryptocurrency = cryptocurrency.toUpperCase();
  }
  
  const wallets = await MultiSigWallet.find(query)
    .populate('owner', 'name email')
    .populate('signers.user', 'name email')
    .sort('-createdAt');
  
  res.json({
    success: true,
    count: wallets.length,
    data: wallets
  });
});

/**
 * Get a specific wallet
 * GET /api/wallets/multi-sig/:id
 * @access Private
 */
exports.getWallet = asyncHandler(async (req, res, next) => {
  const wallet = await MultiSigWallet.findById(req.params.id)
    .populate('owner', 'name email')
    .populate('signers.user', 'name email');
  
  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }
  
  // Check if user has access to this wallet
  if (!wallet.hasAccess(req.user.id)) {
    return next(new AppError('You do not have access to this wallet', 403));
  }
  
  res.json({
    success: true,
    data: wallet
  });
});

/**
 * Update a wallet
 * PUT /api/wallets/multi-sig/:id
 * @access Private (Owner only)
 */
exports.updateWallet = asyncHandler(async (req, res, next) => {
  const wallet = await MultiSigWallet.findById(req.params.id);
  
  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }
  
  // Only owner can update wallet
  if (wallet.owner.toString() !== req.user.id) {
    return next(new AppError('Only wallet owner can update wallet settings', 403));
  }
  
  const { name, description, isActive } = req.body;
  
  if (name) wallet.name = name;
  if (description !== undefined) wallet.description = description;
  if (isActive !== undefined) wallet.isActive = isActive;
  
  await wallet.save();
  await wallet.populate('owner', 'name email');
  await wallet.populate('signers.user', 'name email');
  
  logger.info(`Multi-sig wallet updated: ${wallet._id}`);
  
  res.json({
    success: true,
    data: wallet
  });
});

/**
 * Add a signer to wallet
 * POST /api/wallets/multi-sig/:id/signers
 * @access Private (Owner only)
 */
exports.addSigner = asyncHandler(async (req, res, next) => {
  const wallet = await MultiSigWallet.findById(req.params.id);
  
  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }
  
  // Only owner can add signers
  if (wallet.owner.toString() !== req.user.id) {
    return next(new AppError('Only wallet owner can add signers', 403));
  }
  
  const { email, publicKey } = req.body;
  
  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  // Check if user is already a signer
  if (wallet.isSigner(user._id)) {
    return next(new AppError('User is already a signer for this wallet', 400));
  }
  
  wallet.signers.push({
    user: user._id,
    email: user.email,
    name: user.name,
    publicKey: publicKey || null
  });
  
  await wallet.save();
  await wallet.populate('owner', 'name email');
  await wallet.populate('signers.user', 'name email');
  
  logger.info(`Signer added to wallet ${wallet._id}: ${user.email}`);
  
  res.json({
    success: true,
    data: wallet
  });
});

/**
 * Remove a signer from wallet
 * DELETE /api/wallets/multi-sig/:id/signers/:signerId
 * @access Private (Owner only)
 */
exports.removeSigner = asyncHandler(async (req, res, next) => {
  const wallet = await MultiSigWallet.findById(req.params.id);
  
  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }
  
  // Only owner can remove signers
  if (wallet.owner.toString() !== req.user.id) {
    return next(new AppError('Only wallet owner can remove signers', 403));
  }
  
  const signerIndex = wallet.signers.findIndex(
    s => s.user.toString() === req.params.signerId
  );
  
  if (signerIndex === -1) {
    return next(new AppError('Signer not found in wallet', 404));
  }
  
  // Check if removing signer would violate required signatures
  if (wallet.signers.length - 1 < wallet.requiredSignatures) {
    return next(new AppError(
      'Cannot remove signer: would result in fewer signers than required signatures',
      400
    ));
  }
  
  wallet.signers.splice(signerIndex, 1);
  await wallet.save();
  await wallet.populate('owner', 'name email');
  await wallet.populate('signers.user', 'name email');
  
  logger.info(`Signer removed from wallet ${wallet._id}: ${req.params.signerId}`);
  
  res.json({
    success: true,
    data: wallet
  });
});

/**
 * Delete a wallet
 * DELETE /api/wallets/multi-sig/:id
 * @access Private (Owner only)
 */
exports.deleteWallet = asyncHandler(async (req, res, next) => {
  const wallet = await MultiSigWallet.findById(req.params.id);
  
  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }
  
  // Only owner can delete wallet
  if (wallet.owner.toString() !== req.user.id) {
    return next(new AppError('Only wallet owner can delete wallet', 403));
  }
  
  // Soft delete by deactivating
  wallet.isActive = false;
  await wallet.save();
  
  logger.info(`Multi-sig wallet deactivated: ${wallet._id}`);
  
  res.json({
    success: true,
    message: 'Wallet deactivated successfully'
  });
});
