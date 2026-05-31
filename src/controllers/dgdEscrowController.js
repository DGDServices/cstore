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
const { asyncHandler } = require('../middleware/errorHandler');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { DgdCoreClient } = require('../services/dgdCoreClient');
const { DGD_CORE_URL, DGD_CORE_AUTH_TOKEN } = require('../config/dgd');

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

// ── endpoints ─────────────────────────────────────────────────────────────────

/**
 * POST /api/dgd-escrow/:orderId/open
 * Open (or re-fetch) the dgd-core escrow for an order.
 * Body: { buyerPubkey, buyerPayoutAddress, sellerPubkey, sellerPayoutAddress,
 *         arbitratorPubkey?, arbitratorPayoutAddress?, buyerDepositSats?,
 *         sellerDepositSats?, platformFeeSats?, feeAddress?, networkFeeReserveSats? }
 */
exports.openEscrow = asyncHandler(async (req, res, next) => {
  const order = await findOrderForUser(req.params.orderId, req.user.id);
  const {
    buyerPubkey, buyerPayoutAddress,
    sellerPubkey, sellerPayoutAddress,
    arbitratorPubkey, arbitratorPayoutAddress,
    buyerDepositSats, sellerDepositSats,
    platformFeeSats, feeAddress, networkFeeReserveSats,
    amountSats
  } = req.body;

  if (!buyerPubkey || !buyerPayoutAddress || !sellerPubkey || !sellerPayoutAddress) {
    return next(new AppError('buyerPubkey, buyerPayoutAddress, sellerPubkey, sellerPayoutAddress are required', 400));
  }

  const orderId = escrowId(order);
  const escrow = await dgd.openEscrow({
    orderId,
    buyer:  { pubkey: buyerPubkey,  payoutAddress: buyerPayoutAddress },
    seller: { pubkey: sellerPubkey, payoutAddress: sellerPayoutAddress },
    ...(arbitratorPubkey ? { arbitrator: { pubkey: arbitratorPubkey, payoutAddress: arbitratorPayoutAddress } } : {}),
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
