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

// Get logged-in user's expenses
router.get('/', protect, async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user._id }).sort({ date: -1 });

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Monthly summary
router.get('/summary/monthly', protect, async (req, res) => {
  try {
    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const result = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          date: {
            $gte: startOfMonth,
            $lt: startOfNextMonth
          }
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

    expense.title = title;
    expense.amount = amount;
    expense.category = category;
    expense.date = date || expense.date;

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

