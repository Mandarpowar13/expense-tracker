const crypto = require('crypto');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_TRANSACTIONS = 500;
const MAX_AMOUNT = 10_000_000;
const MAX_TITLE_LENGTH = 200;
const VALID_CATEGORIES = ['Food', 'Travel', 'Shopping', 'Bills', 'Other', 'Income'];

const PDF_MAGIC = Buffer.from('%PDF-');

const validatePdfBuffer = (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid file upload');
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('PDF file must be 5 MB or smaller');
  }

  if (buffer.length < PDF_MAGIC.length || !buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    throw new Error('File is not a valid PDF');
  }
};

const sanitizeTitle = (value) => {
  if (typeof value !== 'string') return 'Transaction';

  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, MAX_TITLE_LENGTH) || 'Transaction';
};

const sanitizeAmount = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return null;
  }

  return Math.round(amount * 100) / 100;
};

const sanitizeCategory = (value) => {
  if (VALID_CATEGORIES.includes(value)) return value;
  return 'Other';
};

const sanitizeDirection = (value) => {
  return value === 'credit' ? 'credit' : 'debit';
};

const sanitizeTransactionId = (value) => {
  if (!value || typeof value !== 'string') return null;

  const cleaned = value.replace(/[^\w-]/g, '').slice(0, 64);
  return cleaned || null;
};

const normalizeTransaction = (transaction) => {
  const amount = sanitizeAmount(transaction.amount);
  const date = transaction.date ? new Date(transaction.date) : null;

  if (!amount || !date || Number.isNaN(date.getTime())) {
    return null;
  }

  const direction = sanitizeDirection(transaction.direction);
  const category = direction === 'credit'
    ? 'Income'
    : sanitizeCategory(transaction.category);

  return {
    title: sanitizeTitle(transaction.title),
    amount,
    category,
    date,
    direction,
    recipient: sanitizeTitle(transaction.recipient || transaction.title),
    upiApp: transaction.upiApp || 'Other',
    paymentMethod: 'UPI',
    transactionId: sanitizeTransactionId(transaction.transactionId),
    transactionTime: transaction.transactionTime ? new Date(transaction.transactionTime) : null
  };
};

const normalizeTransactions = (transactions) => {
  if (!Array.isArray(transactions)) {
    throw new Error('Could not parse transactions from PDF');
  }

  const normalized = transactions
    .map(normalizeTransaction)
    .filter(Boolean);

  if (normalized.length === 0) {
    throw new Error('No valid transactions found in PDF');
  }

  if (normalized.length > MAX_TRANSACTIONS) {
    throw new Error(`PDF contains too many transactions (max ${MAX_TRANSACTIONS})`);
  }

  return normalized;
};

const hashBuffer = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

module.exports = {
  MAX_FILE_SIZE,
  MAX_TRANSACTIONS,
  VALID_CATEGORIES,
  validatePdfBuffer,
  sanitizeTitle,
  sanitizeAmount,
  sanitizeCategory,
  sanitizeDirection,
  sanitizeTransactionId,
  normalizeTransaction,
  normalizeTransactions,
  hashBuffer
};
