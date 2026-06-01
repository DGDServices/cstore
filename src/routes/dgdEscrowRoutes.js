'use strict';
/**
 * DGD non-custodial escrow signing routes.
 * All routes require authentication (the bearer token to dgd-core is held
 * server-side in the DgdCoreClient — it never reaches the browser).
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/dgdEscrowController');

// All routes require a logged-in user
router.use(protect);

router.post  ('/:orderId/open',           ctrl.openEscrow);
router.get   ('/:orderId',                ctrl.getEscrow);
router.post  ('/:orderId/check-funding',  ctrl.checkFunding);
router.post  ('/:orderId/propose-release',ctrl.proposeRelease);
router.get   ('/:orderId/payout-psbt',    ctrl.getPayoutPsbt);
router.post  ('/:orderId/sign-payout',    ctrl.signPayout);
router.post  ('/:orderId/open-dispute',   ctrl.openDispute);
router.post  ('/:orderId/refund',         ctrl.refund);
router.post  ('/:orderId/mediate',        ctrl.mediate);

module.exports = router;
