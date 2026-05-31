const Joi = require('joi');

/**
 * Validation schemas for escrow endpoints
 */

exports.createEscrow = {
  body: Joi.object({
    buyer: Joi.string().hex().length(24).required()
      .messages({
        'string.hex': 'Buyer must be a valid user ID',
        'string.length': 'Buyer must be a valid user ID',
        'any.required': 'Buyer is required'
      }),
    seller: Joi.string().hex().length(24).required()
      .messages({
        'string.hex': 'Seller must be a valid user ID',
        'string.length': 'Seller must be a valid user ID',
        'any.required': 'Seller is required'
      }),
    orderId: Joi.string().hex().length(24).optional()
      .messages({
        'string.hex': 'Order ID must be valid',
        'string.length': 'Order ID must be valid'
      }),
    title: Joi.string().min(3).max(200).required()
      .messages({
        'string.min': 'Title must be at least 3 characters',
        'string.max': 'Title must not exceed 200 characters',
        'any.required': 'Title is required'
      }),
    description: Joi.string().max(2000).optional()
      .messages({
        'string.max': 'Description must not exceed 2000 characters'
      }),
    amount: Joi.number().positive().required()
      .messages({
        'number.positive': 'Amount must be positive',
        'any.required': 'Amount is required'
      }),
    cryptocurrency: Joi.string().valid('BTC', 'ETH', 'USDT', 'LTC', 'XRP').required()
      .messages({
        'any.only': 'Cryptocurrency must be one of: BTC, ETH, USDT, LTC, XRP',
        'any.required': 'Cryptocurrency is required'
      }),
    amountUSD: Joi.number().positive().required()
      .messages({
        'number.positive': 'USD amount must be positive',
        'any.required': 'USD amount is required'
      }),
    depositAddress: Joi.string().required()
      .messages({
        'any.required': 'Deposit address is required'
      }),
    releaseAddress: Joi.string().optional(),
    refundAddress: Joi.string().optional(),
    releaseType: Joi.string().valid('automatic', 'manual', 'milestone_based', 'time_based', 'mutual').required()
      .messages({
        'any.only': 'Release type must be one of: automatic, manual, milestone_based, time_based, mutual',
        'any.required': 'Release type is required'
      }),
    releaseConditions: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('time_based', 'milestone_based', 'mutual_agreement', 'delivery_confirmation', 'inspection_period').required(),
        value: Joi.alternatives().try(
          Joi.string(),
          Joi.number(),
          Joi.date(),
          Joi.boolean()
        ).required()
      })
    ).optional(),
    milestones: Joi.array().items(
      Joi.object({
        title: Joi.string().required(),
        description: Joi.string().optional(),
        amount: Joi.number().positive().required()
      })
    ).optional(),
    metadata: Joi.object({
      terms: Joi.string().optional(),
      notes: Joi.string().optional(),
      inspectionPeriodDays: Joi.number().integer().min(0).optional(),
      autoReleaseAfterDays: Joi.number().integer().min(1).optional()
    }).optional()
  })
};

exports.fundEscrow = {
  body: Joi.object({
    transactionHash: Joi.string().required()
      .messages({
        'any.required': 'Transaction hash is required'
      })
  })
};

exports.refundEscrow = {
  body: Joi.object({
    reason: Joi.string().min(10).max(500).required()
      .messages({
        'string.min': 'Refund reason must be at least 10 characters',
        'string.max': 'Refund reason must not exceed 500 characters',
        'any.required': 'Refund reason is required'
      })
  })
};

exports.fileDispute = {
  body: Joi.object({
    reason: Joi.string().min(10).max(200).required()
      .messages({
        'string.min': 'Dispute reason must be at least 10 characters',
        'string.max': 'Dispute reason must not exceed 200 characters',
        'any.required': 'Dispute reason is required'
      }),
    description: Joi.string().min(20).max(2000).required()
      .messages({
        'string.min': 'Description must be at least 20 characters',
        'string.max': 'Description must not exceed 2000 characters',
        'any.required': 'Description is required'
      }),
    evidence: Joi.array().items(
      Joi.object({
        url: Joi.string().uri().required(),
        uploadedAt: Joi.date().optional()
      })
    ).optional()
  })
};

exports.resolveDispute = {
  body: Joi.object({
    type: Joi.string().valid('buyer_favor', 'seller_favor', 'partial_refund', 'custom').required()
      .messages({
        'any.only': 'Resolution type must be one of: buyer_favor, seller_favor, partial_refund, custom',
        'any.required': 'Resolution type is required'
      }),
    details: Joi.string().max(1000).optional()
      .messages({
        'string.max': 'Details must not exceed 1000 characters'
      })
  })
};
