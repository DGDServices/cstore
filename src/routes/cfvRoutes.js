const express = require('express');
const {
  getAllCFVCoins,
  getCFVCoinBySymbol,
  getCFVSummary
} = require('../controllers/cfvController');

const router = express.Router();

router.get('/coins', getAllCFVCoins);
router.get('/coins/:symbol', getCFVCoinBySymbol);
router.get('/summary', getCFVSummary);

module.exports = router;
