const express = require('express');
const multer = require('multer');
const Expense = require('../models/Expense');
const protect = require('../middleware/authMiddleware');
const importRateLimit = require('../middleware/importRateLimit');
const { parsePDFTransactions } = require('../utils/pdfParser');
const {
  validatePdfBuffer,
  normalizeTransactions,
  hashBuffer,
  MAX_FILE_SIZE
} = require('../utils/importSecurity');
const { createSession, getSession, deleteSession } = require('../utils/importSessionStore');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/x-pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      return cb(new Error('Only PDF files are allowed'));
    }

    cb(null, true);
  }
});

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'PDF file must be 5 MB or smaller' });
    }
    return res.status(400).json({ message: 'Invalid file upload' });
  }

  if (err) {
    return res.status(400).json({ message: err.message || 'Invalid file upload' });
  }

  next();
};

const findDuplicateTransactionIds = async (userId, transactions) => {
  const transactionIds = transactions
    .map((transaction) => transaction.transactionId)
    .filter(Boolean);

  if (transactionIds.length === 0) {
    return new Set();
  }

  const existing = await Expense.find({
    user: userId,
    transactionId: { $in: transactionIds }
  }).select('transactionId');

  return new Set(existing.map((expense) => expense.transactionId));
};

const buildImportPreview = (transactions, duplicateIds) => {
  const preview = transactions.map((transaction, index) => ({
    index,
    title: transaction.title,
    amount: transaction.amount,
    category: transaction.category,
    date: transaction.date,
    recipient: transaction.recipient,
    upiApp: transaction.upiApp,
    transactionId: transaction.transactionId,
    direction: transaction.direction,
    isDuplicate: Boolean(transaction.transactionId && duplicateIds.has(transaction.transactionId))
  }));

  const importable = preview.filter((item) => !item.isDuplicate);
  const debitCount = importable.filter((item) => (item.direction || 'debit') === 'debit').length;
  const creditCount = importable.filter((item) => (item.direction || 'debit') === 'credit').length;

  return {
    preview,
    summary: {
      total: preview.length,
      importable: importable.length,
      duplicates: preview.length - importable.length,
      debits: debitCount,
      credits: creditCount
    }
  };
};

// Add expense
router.post('/', protect, async (req, res) => {
  try {
    const { title, amount, category, date, direction } = req.body;

    if (!title || !amount || Number(amount) <= 0 || !category) {
      return res.status(400).json({ message: 'Please enter title, amount, and category' });
    }

    const expense = await Expense.create({
      user: req.user._id,
      title,
      amount,
      category,
      date: date || Date.now(),
      direction: direction === 'credit' ? 'credit' : 'debit'
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get logged-in user's expenses (optionally filter by month & year)
router.get('/', protect, async (req, res) => {
  try {
    const { month, year } = req.query;

    const filter = { user: req.user._id };

    if (month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      filter.date = {
        $gte: new Date(y, m - 1, 1),
        $lt: new Date(y, m, 1)
      };
    }

    const expenses = await Expense.find(filter).sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/summary/monthly', protect, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const result = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: startOfMonth, $lt: startOfNextMonth },
          direction: { $ne: 'credit' }
        }
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      totalSpent: result.length > 0 ? result[0].totalSpent : 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/analytics', protect, async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();

    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    const matchStage = {
      $match: {
        user: req.user._id,
        date: { $gte: startOfMonth, $lt: startOfNextMonth }
      }
    };

    const totalResult = await Expense.aggregate([
      matchStage,
      {
        $group: {
          _id: '$direction',
          totalSpent: { $sum: '$amount' }
        }
      }
    ]);

    const debits = totalResult.find((row) => row._id !== 'credit')?.totalSpent || 0;
    const credits = totalResult.find((row) => row._id === 'credit')?.totalSpent || 0;
    const totalSpent = debits - credits;

    const dayWise = await Expense.aggregate([
      matchStage,
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'credit'] }, { $multiply: ['$amount', -1] }, '$amount']
            }
          },
          debits: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'credit'] }, 0, '$amount']
            }
          },
          credits: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0]
            }
          },
          expenses: {
            $push: {
              _id: '$_id',
              title: '$title',
              amount: '$amount',
              category: '$category',
              direction: { $ifNull: ['$direction', 'debit'] }
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          totalSpent: 1,
          debits: 1,
          credits: 1,
          expenses: 1
        }
      }
    ]);

    const categoryWise = await Expense.aggregate([
      matchStage,
      {
        $group: {
          _id: { category: '$category', direction: { $ifNull: ['$direction', 'debit'] } },
          totalSpent: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      {
        $project: {
          _id: 0,
          category: '$_id.category',
          direction: '$_id.direction',
          totalSpent: 1,
          count: 1
        }
      }
    ]);

    res.json({
      month,
      year,
      totalSpent,
      debits,
      credits,
      netFlow: credits - debits,
      dayWise,
      categoryWise
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Secure UPI import — step 1: preview parsed transactions (no DB write)
router.post(
  '/import/pdf/preview',
  protect,
  importRateLimit,
  upload.single('file'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      validatePdfBuffer(req.file.buffer);

      const { transactions: parsedTransactions, upiApp } = await parsePDFTransactions(req.file.buffer);
      const transactions = normalizeTransactions(parsedTransactions);
      const duplicateIds = await findDuplicateTransactionIds(req.user._id, transactions);
      const { preview, summary } = buildImportPreview(transactions, duplicateIds);

      if (summary.importable === 0) {
        return res.status(400).json({
          message: 'All transactions in this PDF are already imported'
        });
      }

      const { sessionId, expiresIn } = createSession({
        userId: req.user._id,
        transactions,
        fileHash: hashBuffer(req.file.buffer),
        upiApp
      });

      res.json({
        success: true,
        sessionId,
        expiresIn,
        upiApp,
        transactions: preview,
        summary
      });
    } catch (error) {
      res.status(400).json({ message: error.message || 'Unable to import PDF' });
    }
  }
);

// Secure UPI import — step 2: confirm and save only server-validated transactions
router.post('/import/pdf/confirm', protect, importRateLimit, async (req, res) => {
  try {
    const { sessionId, selectedIndices } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ message: 'Import session is required' });
    }

    const session = getSession(sessionId, req.user._id);

    if (!session) {
      return res.status(400).json({ message: 'Import session expired or invalid. Please upload again.' });
    }

    // Build a Set of allowed indices (when caller passes selectedIndices)
    const allowedIndices = Array.isArray(selectedIndices)
      ? new Set(selectedIndices.filter((n) => Number.isInteger(n) && n >= 0 && n < session.transactions.length))
      : null;

    const duplicateIds = await findDuplicateTransactionIds(req.user._id, session.transactions);
    const toImport = session.transactions
      .map((transaction, originalIndex) => ({ transaction, originalIndex }))
      .filter(({ transaction, originalIndex }) => {
        if (allowedIndices && !allowedIndices.has(originalIndex)) return false;
        if (transaction.transactionId && duplicateIds.has(transaction.transactionId)) return false;
        return true;
      })
      .map(({ transaction }) => ({
        ...transaction,
        user: req.user._id
      }));

    if (toImport.length === 0) {
      deleteSession(sessionId);
      return res.status(400).json({ message: 'No new transactions to import' });
    }

    const inserted = [];
    const skipped = [];

    for (const expense of toImport) {
      try {
        const created = await Expense.create(expense);
        inserted.push(created);
      } catch (error) {
        if (error.code === 11000) {
          skipped.push(expense.transactionId || expense.title);
          continue;
        }
        throw error;
      }
    }

    deleteSession(sessionId);

    res.json({
      success: true,
      imported: inserted.length,
      skipped: skipped.length,
      debits: inserted.filter((item) => (item.direction || 'debit') === 'debit').length,
      credits: inserted.filter((item) => item.direction === 'credit').length,
      upiApp: session.upiApp,
      expenses: inserted,
      message: `Successfully imported ${inserted.length} UPI transaction${inserted.length === 1 ? '' : 's'}`
    });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to confirm import' });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const { title, amount, category, date, direction } = req.body;

    if (!title || !amount || Number(amount) <= 0 || !category) {
      return res.status(400).json({ message: 'Please enter title, amount, and category' });
    }

    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    expense.title = title;
    expense.amount = amount;
    expense.category = category;
    expense.date = date || expense.date;
    if (direction) {
      expense.direction = direction === 'credit' ? 'credit' : 'debit';
    }

    const updatedExpense = await expense.save();
    res.json(updatedExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await expense.deleteOne();
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
