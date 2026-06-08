const express = require('express');
const Budget = require('../models/Budget');
const Expense = require('../models/Expense');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

// Set or update monthly budget
router.post('/', protect, async (req, res) => {
  try {
    const { amount, month, year } = req.body;

    const now = new Date();
    const budgetMonth = month || now.getMonth() + 1;
    const budgetYear  = year  || now.getFullYear();

    const budget = await Budget.findOneAndUpdate(
      { user: req.user._id, month: budgetMonth, year: budgetYear },
      { amount, user: req.user._id, month: budgetMonth, year: budgetYear },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(budget);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get budget status — supports ?month=&year= (defaults to current month)
// GET /api/budget/current
// GET /api/budget/current?month=5&year=2026
router.get('/current', protect, async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year  = parseInt(req.query.year)  || now.getFullYear();

    const budget = await Budget.findOne({ user: req.user._id, month, year });

    const startOfMonth     = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    const result = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: startOfMonth, $lt: startOfNextMonth }
        }
      },
      {
        $group: {
          _id: { $ifNull: ['$direction', 'debit'] },
          totalSpent: { $sum: '$amount' }
        }
      }
    ]);

    const debits   = result.find((row) => row._id !== 'credit')?.totalSpent || 0;
    const credits  = result.find((row) => row._id === 'credit')?.totalSpent || 0;
    const totalSpent = debits - credits;
    const budgetAmount = budget ? budget.amount : 0;

    res.json({
      month,
      year,
      budget: budgetAmount,
      debits,
      credits,
      totalSpent,
      netFlow: credits - debits,
      remaining: budgetAmount - totalSpent
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
