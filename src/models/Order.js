const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  priceUSD: {
    type: Number,
    required: true,
  },
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    customerEmail: {
      type: String,
      required: [true, 'Customer email is required'],
      lowercase: true,
      trim: true,
    },
    items: [orderItemSchema],
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPriceUSD: {
      type: Number,
      required: true,
      min: 0,
    },
    // The marketplace settles in DGD only. `totalPrice` is DGD at the single
    // Explorer price; `totalPriceUSD` is a display value derived from it.
    settlementAsset: {
      type: String,
      default: 'DGD',
      enum: ['DGD'],
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
    },
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    trackingNumber: String,
    notes: String,
    paidAt: Date,
    deliveryConfirmedAt: Date,

    // DGD non-custodial escrow fields (set when the order settles through dgd-core).
    // `dgdEscrowState` is the source of truth for where the funds are; `status`
    // is the fulfilment view derived from it plus admin updates.
    dgdEscrowId: {
      type: String, // orderId key used in dgd-core (defaults to order._id.toString())
      index: true,
    },
    dgdEscrowAddress: {
      type: String, // multisig address the buyer funds
    },
    dgdExpectedSats: {
      type: String, // expected DGD in sats (string to preserve precision)
    },
    dgdEscrowState: {
      type: String,
      enum: ['created', 'funded', 'released', 'disputed', 'resolved', 'refunded', 'expired', null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ customerEmail: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ dgdEscrowState: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
