const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/Users');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const protectAdmin = require('../middleware/adminMiddleware');

const router = express.Router();

const getMonthRange = () => {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1)
  };
};

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      return res.status(500).json({ message: 'Admin credentials are not configured on the server' });
    }

    if (email !== adminEmail || password !== adminPassword) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const token = jwt.sign(
      { role: 'admin', email: adminEmail },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Admin login successful',
      token,
      admin: { email: adminEmail }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/overview', protectAdmin, async (req, res) => {
  try {
    const { month, year, start, end } = getMonthRange();
    const startedAt = global.__serverStartedAt || Date.now();

    const [
      totalUsers,
      totalExpenses,
      totalBudgets,
      totalSpendResult,
      monthSpendResult,
      recentUsers,
      recentExpenses,
      categoryWise,
      dailyActivity,
      topUsers
    ] = await Promise.all([
      User.countDocuments(),
      Expense.countDocuments(),
      Budget.countDocuments(),
      Expense.aggregate([{ $group: { _id: null, amount: { $sum: '$amount' } } }]),
      Expense.aggregate([
        { $match: { date: { $gte: start, $lt: end } } },
        { $group: { _id: null, amount: { $sum: '$amount' } } }
      ]),
      User.find().select('name email createdAt').sort({ createdAt: -1 }).limit(8),
      Expense.find()
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(10),
      Expense.aggregate([
        { $match: { date: { $gte: start, $lt: end } } },
        { $group: { _id: '$category', totalSpent: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { totalSpent: -1 } },
        { $project: { _id: 0, category: '$_id', totalSpent: 1, count: 1 } }
      ]),
      Expense.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            totalSpent: { $sum: '$amount' }
          }
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1, totalSpent: 1 } }
      ]),
      Expense.aggregate([
        { $match: { date: { $gte: start, $lt: end } } },
        { $group: { _id: '$user', totalSpent: { $sum: '$amount' }, expenses: { $sum: 1 } } },
        { $sort: { totalSpent: -1 } },
        { $limit: 8 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            name: '$user.name',
            email: '$user.email',
            totalSpent: 1,
            expenses: 1
          }
        }
      ])
    ]);

    res.json({
      generatedAt: new Date().toISOString(),
      month,
      year,
      health: {
        status: 'operational',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        nodeEnv: process.env.NODE_ENV || 'development'
      },
      totals: {
        users: totalUsers,
        expenses: totalExpenses,
        budgets: totalBudgets,
        allTimeSpend: totalSpendResult[0]?.amount || 0,
        monthSpend: monthSpendResult[0]?.amount || 0
      },
      recentUsers,
      recentExpenses: recentExpenses.map((expense) => ({
        id: expense._id,
        title: expense.title,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        createdAt: expense.createdAt,
        user: expense.user
      })),
      categoryWise,
      dailyActivity,
      topUsers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
