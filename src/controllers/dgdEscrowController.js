'use strict';
/**
 * DGD non-custodial escrow signing controller.
 *
 * Every action here calls dgd-core via the graft client.  The server holds the
 * DGD_CORE_AUTH_TOKEN; the browser never sees it.  Funds move only through
 * party-owned multisig escrow — the app never holds a private key.
 *
 * Spec: artifacts/Client_Signing_UI_Spec.md (digitalgold.co repo)
 */

const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { DgdCoreClient } = require('../services/dgdCoreClient');
const {
  DGD_CORE_URL, DGD_CORE_AUTH_TOKEN,
  DGD_ARBITRATOR_PUBKEY, DGD_ARBITRATOR_PAYOUT_ADDRESS,
} = require('../config/dgd');

// Single shared client (connection-agnostic, stateless)
const dgd = new DgdCoreClient({ baseUrl: DGD_CORE_URL, authToken: DGD_CORE_AUTH_TOKEN });

// ── helpers ───────────────────────────────────────────────────────────────────

/** Resolve the dgd-core escrow id for an order (= order._id by convention). */
const escrowId = (order) => order.dgdEscrowId || order._id.toString();

/** Find an order by id and verify the requesting user is the buyer or seller. */
const findOrderForUser = async (orderId, userId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  const buyer = order.user?.toString();
  const seller = order.seller?.toString?.() || order.sellerId?.toString?.();
  if (buyer !== userId && seller !== userId) {
    throw new AppError('Not authorised to act on this order', 403);
  }
  return order;
};

/** Resolve the seller User id for an order from its first item's product. */
const resolveSellerId = async (order) => {
  const productId = order.items?.[0]?.product;
  if (productId) {
    const product = await Product.findById(productId).select('seller');
    if (product?.seller) return product.seller;
  }
  if (process.env.DEFAULT_PLATFORM_SELLER_ID) return process.env.DEFAULT_PLATFORM_SELLER_ID;
  const admin = await User.findOne({ role: 'admin' }).select('_id');
  return admin?._id || null;
};

// ── endpoints ─────────────────────────────────────────────────────────────────

/**
 * POST /api/dgd-escrow/:orderId/open
 * Open (or re-fetch) the dgd-core escrow for an order.
 *
 * Key resolution (request body overrides everything, for platform tooling / demo):
 *   - buyer:      request body → buyer's own saved profile keys.
 *   - seller:     request body → the product seller's saved profile keys.
 *   - arbitrator: request body → platform config (DGD_ARBITRATOR_*); present → 2-of-3.
 *
 * Body (all optional): { buyerPubkey, buyerPayoutAddress, sellerPubkey,
 *   sellerPayoutAddress, arbitratorPubkey, arbitratorPayoutAddress, buyerDepositSats,
 *   sellerDepositSats, platformFeeSats, feeAddress, networkFeeReserveSats, amountSats }
 */
exports.openEscrow = asyncHandler(async (req, res, next) => {
  const order = await findOrderForUser(req.params.orderId, req.user.id);
  const {
    buyerPubkey: bPk, buyerPayoutAddress: bAddr,
    sellerPubkey: sPk, sellerPayoutAddress: sAddr,
    arbitratorPubkey: aPk, arbitratorPayoutAddress: aAddr,
    buyerDepositSats, sellerDepositSats,
    platformFeeSats, feeAddress, networkFeeReserveSats,
    amountSats
  } = req.body;

  // Buyer keys: request body → buyer's saved profile.
  const buyerUser = await User.findById(order.user).select('dgdPubkey dgdPayoutAddress');
  const buyerPubkey        = bPk   || buyerUser?.dgdPubkey;
  const buyerPayoutAddress = bAddr || buyerUser?.dgdPayoutAddress;
  if (!buyerPubkey || !buyerPayoutAddress) {
    return next(new AppError('Buyer DGD pubkey + payout address required (provide them or set them in your profile)', 400));
  }

  // Seller keys: request body → product seller's saved profile.
  let sellerPubkey = sPk;
  let sellerPayoutAddress = sAddr;
  if (!sellerPubkey || !sellerPayoutAddress) {
    const sellerId = await resolveSellerId(order);
    const sellerUser = sellerId ? await User.findById(sellerId).select('dgdPubkey dgdPayoutAddress') : null;
    sellerPubkey        = sellerPubkey        || sellerUser?.dgdPubkey;
    sellerPayoutAddress = sellerPayoutAddress || sellerUser?.dgdPayoutAddress;
  }
  if (!sellerPubkey || !sellerPayoutAddress) {
    return next(new AppError('Seller has not configured DGD escrow keys; cannot open escrow', 409));
  }

  // Arbitrator: request body → platform config. Present → 2-of-3 (mediatable).
  const arbitratorPubkey        = aPk   || DGD_ARBITRATOR_PUBKEY;
  const arbitratorPayoutAddress = aAddr || DGD_ARBITRATOR_PAYOUT_ADDRESS;
  const hasArbitrator = Boolean(arbitratorPubkey && arbitratorPayoutAddress);

  const orderId = escrowId(order);
  const escrow = await dgd.openEscrow({
    orderId,
    buyer:  { pubkey: buyerPubkey,  payoutAddress: buyerPayoutAddress },
    seller: { pubkey: sellerPubkey, payoutAddress: sellerPayoutAddress },
    ...(hasArbitrator ? { arbitrator: { pubkey: arbitratorPubkey, payoutAddress: arbitratorPayoutAddress } } : {}),
    amountSats:             String(amountSats || order.dgdExpectedSats || '0'),
    buyerDepositSats:       buyerDepositSats  ? String(buyerDepositSats)  : undefined,
    sellerDepositSats:      sellerDepositSats ? String(sellerDepositSats) : undefined,
    platformFeeSats:        platformFeeSats   ? String(platformFeeSats)   : undefined,
    feeAddress,
    networkFeeReserveSats:  networkFeeReserveSats ? String(networkFeeReserveSats) : undefined,
  });

  // Persist the escrow address + state on the order
  order.dgdEscrowId      = orderId;
  order.dgdEscrowAddress = escrow?.multisig?.address;
  order.dgdEscrowState   = escrow?.state || 'created';
  await order.save();

  logger.info(`DGD escrow opened for order ${orderId}: ${order.dgdEscrowAddress}`);
  res.json({ ok: true, escrow });
});

/**
 * GET /api/dgd-escrow/:orderId
 * Fetch the current escrow state and update the cached state on the Order.
 */
exports.getEscrow = asyncHandler(async (req, res, next) => {
  const order = await findOrderForUser(req.params.orderId, req.user.id);
  const escrow = await dgd.getEscrow(escrowId(order));
  if (escrow?.state && order.dgdEscrowState !== escrow.state) {
    order.dgdEscrowState = escrow.state;
    await order.save();
  }
  res.json({ ok: true, escrow });
});

/**
 * POST /api/dgd-escrow/:orderId/check-funding
 * Poll the chain; escrow transitions to `funded` when confirmed.
 */
exports.checkFunding = asyncHandler(async (req, res, next) => {
  const order = await findOrderForUser(req.params.orderId, req.user.id);
  const escrow = await dgd.checkFunding(escrowId(order), req.body?.minConf);
  if (escrow?.state) {
    order.dgdEscrowState = escrow.state;
    if (escrow.state === 'funded') order.status = 'paid';
    await order.save();
  }
  res.json({ ok: true, escrow });
});

/**
 * POST /api/dgd-escrow/:orderId/propose-release
 * Set the agreed happy-path payout (buyer or seller).
 * Body: { role: 'buyer'|'seller' }
 */
exports.proposeRelease = asyncHandler(async (req, res, next) => {
  const order = await findOrderForUser(req.params.orderId, req.user.id);
  const { role } = req.body;
  if (!['buyer', 'seller'].includes(role)) {
    return next(new AppError('role must be buyer or seller', 400));
  }
  const escrow = await dgd.proposeRelease(escrowId(order), role);
  res.json({ ok: true, escrow });
});

/**
 * GET /api/dgd-escrow/:orderId/payout-psbt
 * Fetch the unsigned payout PSBT for the active proposal.
 * The party signs this in their OWN wallet (DGD-QT) — never in the app.
 */
exports.getPayoutPsbt = asyncHandler(async (req, res, next) => {
  const order = await findOrderForUser(req.params.orderId, req.user.id);
  const result = await dgd.getPayoutPsbt(escrowId(order));
  res.json({ ok: true, psbt: result.psbt });
});

/**
 * POST /api/dgd-escrow/:orderId/sign-payout
 * Submit a party's externally-signed PSBT.
 * Body: { role: 'buyer'|'seller'|'arbitrator', signedPsbt: string }
 */
exports.signPayout = asyncHandler(async (req, res, next) => {
  const order = await findOrderForUser(req.params.orderId, req.user.id);
  const { role, signedPsbt } = req.body;
  if (!role || !signedPsbt) {
    return next(new AppError('role and signedPsbt are required', 400));
  }
  // Stable idempotency key — a retry replays the first result
  const idemKey = `${order._id}:${role}:sign`;
  const escrow = await dgd.signPayout(escrowId(order), role, signedPsbt, idemKey);
  if (escrow?.state) {
    order.dgdEscrowState = escrow.state;
    if (escrow.state === 'released' || escrow.state === 'resolved') {
      order.status = 'delivered'; // escrow settled → order complete
    }
    await order.save();
  }
  res.json({ ok: true, escrow });
});

/**
 * POST /api/dgd-escrow/:orderId/open-dispute
 * Open a dispute on a funded escrow.
 * Body: { role: 'buyer'|'seller', reason?: string }
 */
exports.openDispute = asyncHandler(async (req, res, next) => {
  const order = await findOrderForUser(req.params.orderId, req.user.id);
  const { role, reason } = req.body;
  if (!['buyer', 'seller'].includes(role)) {
    return next(new AppError('role must be buyer or seller', 400));
  }
  const escrow = await dgd.openDispute(escrowId(order), role, reason);
  if (escrow?.state) {
    order.dgdEscrowState = escrow.state;
    await order.save();
  }
  res.json({ ok: true, escrow });
});
