const express = require('express');
const Expense = require('../models/Expense');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

// Add expense
router.post('/', protect, async (req, res) => {
  try {
    const { title, amount, category, date } = req.body;

    if (!title || !amount || Number(amount) <= 0 || !category) {
      return res.status(400).json({ message: 'Please enter title, amount, and category' });
    }

    const expense = await Expense.create({
      user: req.user._id,
      title,
      amount,
      category,
      date: date || Date.now()
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get logged-in user's expenses (optionally filter by month & year)
// GET /api/expenses?month=6&year=2026
router.get('/', protect, async (req, res) => {
  try {
    const { month, year } = req.query;

    let filter = { user: req.user._id };

    if (month && year) {
      const m = parseInt(month);
      const y = parseInt(year);
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

// Monthly summary — current month
router.get('/summary/monthly', protect, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const result = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: startOfMonth, $lt: startOfNextMonth }
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

// ─── NEW: Full monthly analytics ─────────────────────────────────────────────
// GET /api/expenses/analytics?month=6&year=2026
// Returns: totalSpent, dayWise, categoryWise
router.get('/analytics', protect, async (req, res) => {
  try {
    
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year  = parseInt(req.query.year)  || now.getFullYear();

    const startOfMonth    = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    const matchStage = {
      $match: {
        user: req.user._id,
        date: { $gte: startOfMonth, $lt: startOfNextMonth }
      }
    };

    // 1. Total spent
    const totalResult = await Expense.aggregate([
      matchStage,
      { $group: { _id: null, totalSpent: { $sum: '$amount' } } }
    ]);
    const totalSpent = totalResult.length > 0 ? totalResult[0].totalSpent : 0;

    // 2. Day-wise grouped spending
    const dayWise = await Expense.aggregate([
      matchStage,
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          totalSpent: { $sum: '$amount' },
          expenses: {
            $push: {
              _id: '$_id',
              title: '$title',
              amount: '$amount',
              category: '$category'
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
          expenses: 1
        }
      }
    ]);

    // 3. Category-wise breakdown
    const categoryWise = await Expense.aggregate([
      matchStage,
      {
        $group: {
          _id: '$category',
          totalSpent: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      {
        $project: {
          _id: 0,
          category: '$_id',
          totalSpent: 1,
          count: 1
        }
      }
    ]);

    res.json({
      month,
      year,
      totalSpent,
      dayWise,
      categoryWise
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// Update expense
router.put('/:id', protect, async (req, res) => {
  try {
    const { title, amount, category, date } = req.body;

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

    expense.title    = title;
    expense.amount   = amount;
    expense.category = category;
    expense.date     = date || expense.date;

    const updatedExpense = await expense.save();
    res.json(updatedExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete expense
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