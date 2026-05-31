const mongoose = require('mongoose');
const { isValidBitcoinAddress } = require('../utils/addressValidation');
const { NON_LIGHTNING_CRYPTO_SYMBOLS } = require('../config/cryptocurrencies');

const signerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true
  },
  name: String,
  publicKey: String,
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const multiSigWalletSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Wallet name is required'],
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cryptocurrency: {
    type: String,
    required: true,
    enum: NON_LIGHTNING_CRYPTO_SYMBOLS
  },
  address: {
    type: String,
    required: [true, 'Wallet address is required'],
    validate: {
      validator: function(address) {
        // Only validate Bitcoin addresses for BTC cryptocurrency
        if (this.cryptocurrency === 'BTC') {
          return isValidBitcoinAddress(address);
        }
        // For other cryptocurrencies, just ensure address is not empty
        return address && address.length > 0;
      },
      message: 'Invalid Bitcoin address format'
    }
  },
  signers: {
    type: [signerSchema],
    validate: {
      validator: function(signers) {
        return signers && signers.length >= 2;
      },
      message: 'At least 2 signers are required for multi-signature wallet'
    }
  },
  requiredSignatures: {
    type: Number,
    required: true,
    min: 2,
    validate: {
      validator: function(value) {
        return value <= this.signers.length;
      },
      message: 'Required signatures cannot exceed number of signers'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: String,
  metadata: {
    contractAddress: String,
    deployedAt: Date,
    network: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
multiSigWalletSchema.index({ owner: 1, isActive: 1 });
multiSigWalletSchema.index({ address: 1 }, { unique: true });
multiSigWalletSchema.index({ 'signers.user': 1 });

// Method to check if user is a signer
multiSigWalletSchema.methods.isSigner = function(userId) {
  return this.signers.some(signer => 
    signer.user.toString() === userId.toString()
  );
};

// Method to check if user is owner or signer
multiSigWalletSchema.methods.hasAccess = function(userId) {
  return this.owner.toString() === userId.toString() || this.isSigner(userId);
};

module.exports = mongoose.model('MultiSigWallet', multiSigWalletSchema);
