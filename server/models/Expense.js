const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },

    title: {
      type: String,
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    category: {
      type: String,
      required: true
    },

    date: {
      type: Date,
      default: Date.now
    },

    // UPI Payment Fields
    paymentMethod: {
      type: String,
      enum: ['UPI', 'Card', 'Cash', 'Bank Transfer', 'Other'],
      default: 'Cash'
    },

    direction: {
      type: String,
      enum: ['debit', 'credit'],
      default: 'debit',
      index: true
    },

    recipient: {
      type: String,
      default: null
    },

    upiApp: {
      type: String,
      enum: ['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Other'],
      default: null
    },

    transactionId: {
      type: String,
      default: null,
      unique: false
    },

    transactionTime: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate UPI imports per user when a transaction ID is present
expenseSchema.index({ user: 1, transactionId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Expense', expenseSchema);
