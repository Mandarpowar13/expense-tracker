import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const categories = ['Food', 'Travel', 'Shopping', 'Bills', 'Other'];

const CATEGORY_COLORS = {
  Food: '#f97316',
  Travel: '#3b82f6',
  Shopping: '#a855f7',
  Bills: '#ef4444',
  Other: '#6b7280',
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const getToday = () => new Date().toISOString().split('T')[0];

const toInputDate = (date) => {
  if (!date) return getToday();
  return new Date(date).toISOString().split('T')[0];
};

const formatDate = (date) => {
  if (!date) return 'No date';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

const formatShortDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// ─── Custom Tooltip for Bar Chart ────────────────────────────────────────────
const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="ct-label">{formatShortDate(label)}</p>
      <p className="ct-value">Rs {payload[0].value.toLocaleString('en-IN')}</p>
    </div>
  );
};

// ─── Custom Tooltip for Pie Chart ─────────────────────────────────────────────
const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="ct-label">{payload[0].name}</p>
      <p className="ct-value">Rs {payload[0].value.toLocaleString('en-IN')}</p>
      <p className="ct-pct">{payload[0].payload.pct}%</p>
    </div>
  );
};

// ─── Analytics View ───────────────────────────────────────────────────────────
function AnalyticsView({ token, authHeaders }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [data, setData]   = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(false);

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [analyticsRes, budgetRes] = await Promise.all([
        fetch(`${API_URL}/expenses/analytics?month=${month}&year=${year}`, { headers: authHeaders }),
        fetch(`${API_URL}/budget/current?month=${month}&year=${year}`, { headers: authHeaders }),
      ]);
      console.log(authHeaders)
      setData(await analyticsRes.json());
      setBudgetData(await budgetRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, [month, year]);

  const pieData = useMemo(() => {
    if (!data?.categoryWise?.length) return [];
    return data.categoryWise.map(c => ({
      name: c.category,
      value: c.totalSpent,
      pct: data.totalSpent > 0 ? Math.round((c.totalSpent / data.totalSpent) * 100) : 0,
    }));
  }, [data]);

  const barData = useMemo(() => {
    if (!data?.dayWise?.length) return [];
    return data.dayWise.map(d => ({ date: d.date, spent: d.totalSpent }));
  }, [data]);

  const budget    = budgetData?.budget    || 0;
  const totalSpent= data?.totalSpent      || 0;
  const remaining = budget - totalSpent;
  const pct       = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;

  return (
    <div className="analytics-view">
      {/* Month/Year Picker */}
      <div className="analytics-picker">
        <div className="picker-group">
          <label>Month</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="picker-group">
          <label>Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="picker-title">
          <span>{MONTH_NAMES[month - 1]} {year}</span>
        </div>
      </div>

      {loading ? (
        <div className="analytics-loading">
          <div className="spinner" />
          <p>Loading analytics…</p>
        </div>
      ) : !data ? null : (
        <>
          {/* Summary cards */}
          <div className="analytics-summary">
            <div className="an-card">
              <p>Total Spent</p>
              <h3>Rs {totalSpent.toLocaleString('en-IN')}</h3>
            </div>
            <div className="an-card">
              <p>Monthly Budget</p>
              <h3>{budget > 0 ? `Rs ${budget.toLocaleString('en-IN')}` : '—'}</h3>
            </div>
            <div className={`an-card ${remaining < 0 ? 'danger' : ''}`}>
              <p>Remaining</p>
              <h3>{budget > 0 ? `Rs ${remaining.toLocaleString('en-IN')}` : '—'}</h3>
            </div>
            <div className="an-card">
              <p>Transactions</p>
              <h3>{data.dayWise.reduce((s, d) => s + d.expenses.length, 0)}</h3>
            </div>
          </div>

          {/* Budget progress */}
          {budget > 0 && (
            <div className="an-budget-bar">
              <div className="abb-labels">
                <span>Budget usage</span>
                <span>{Math.round(pct)}%</span>
              </div>
              <div className="abb-track">
                <div className="abb-fill" style={{ width: `${pct}%`, background: pct > 90 ? '#ef4444' : pct > 70 ? '#f97316' : '#22c55e' }} />
              </div>
            </div>
          )}

          {data.dayWise.length === 0 ? (
            <div className="an-empty">
              <p>No expenses found for {MONTH_NAMES[month - 1]} {year}.</p>
            </div>
          ) : (
            <>
              {/* Bar Chart */}
              <div className="chart-panel">
                <h3>Day-wise Spending</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} barSize={28} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={v => new Date(v + 'T00:00:00').getDate()}
                      tick={{ fontSize: 11, fill: 'var(--muted)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--muted)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${v / 1000}k` : v}
                    />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--bar-hover)' }} />
                    <Bar dataKey="spent" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart + Category table */}
              <div className="charts-row">
                <div className="chart-panel pie-panel">
                  <h3>Category Breakdown</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-panel category-table-panel">
                  <h3>By Category</h3>
                  <div className="cat-table">
                    {data.categoryWise.map(c => {
                      const pctC = data.totalSpent > 0 ? Math.round((c.totalSpent / data.totalSpent) * 100) : 0;
                      return (
                        <div key={c.category} className="cat-row">
                          <div className="cat-dot" style={{ background: CATEGORY_COLORS[c.category] || '#94a3b8' }} />
                          <div className="cat-info">
                            <div className="cat-top">
                              <span className="cat-name">{c.category}</span>
                              <span className="cat-amt">Rs {c.totalSpent.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="cat-bar-track">
                              <div className="cat-bar-fill" style={{ width: `${pctC}%`, background: CATEGORY_COLORS[c.category] || '#94a3b8' }} />
                            </div>
                          </div>
                          <span className="cat-count">{c.count} item{c.count !== 1 ? 's' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Day-wise grouped expenses */}
              <div className="chart-panel">
                <h3>Expenses by Day</h3>
                <div className="daywise-list">
                  {data.dayWise.map(day => (
                    <div key={day.date} className="day-group">
                      <div className="day-header">
                        <span className="day-label">{formatShortDate(day.date)}</span>
                        <span className="day-total">Rs {day.totalSpent.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="day-expenses">
                        {day.expenses.map(exp => (
                          <div key={exp._id} className="day-exp-row">
                            <div className="dep-dot" style={{ background: CATEGORY_COLORS[exp.category] || '#94a3b8' }} />
                            <span className="dep-title">{exp.title}</span>
                            <span className="dep-cat">{exp.category}</span>
                            <span className="dep-amt">Rs {exp.amount.toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function App() {
  const [isLogin, setIsLogin] = useState(false);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'analytics'

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [token, setToken] = useState(() => localStorage.getItem('token') || '');

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetStatus, setBudgetStatus] = useState(null);

  const [expenses, setExpenses]               = useState([]);
  const [expenseTitle, setExpenseTitle]       = useState('');
  const [expenseAmount, setExpenseAmount]     = useState('');
  const [expenseDate, setExpenseDate]         = useState(getToday());
  const [expenseCategory, setExpenseCategory] = useState('Food');
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const budget      = budgetStatus?.budget      || 0;
  const totalSpent  = budgetStatus?.totalSpent  || 0;
  const remaining   = budgetStatus?.remaining   || 0;
  const hasBudget   = budget > 0;
  const spentPercent = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 2500);
  };

  const resetExpenseForm = () => {
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseDate(getToday());
    setExpenseCategory('Food');
    setEditingExpenseId(null);
  };

  const fetchBudgetStatus = async () => {
    const res = await fetch(`${API_URL}/budget/current`, { headers: authHeaders });
    setBudgetStatus(await res.json());
  };

  const fetchExpenses = async () => {
    const res = await fetch(`${API_URL}/expenses`, { headers: authHeaders });
    setExpenses(await res.json());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsBusy(true);
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    const body = isLogin ? { email, password } : { name, email, password };
    try {
      const res  = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { showMessage(data.message || 'Something went wrong'); return; }
      if (isLogin) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
      } else {
        showMessage('Account created. Please login.');
        setIsLogin(true);
      }
    } finally { setIsBusy(false); }
  };

  const handleSetBudget = async (e) => {
    e.preventDefault();
    setIsBusy(true);
    try {
      const res  = await fetch(`${API_URL}/budget`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(budgetAmount) })
      });
      const data = await res.json();
      if (!res.ok) { showMessage(data.message || 'Something went wrong'); return; }
      setBudgetAmount('');
      setIsEditingBudget(false);
      showMessage(hasBudget ? 'Budget updated' : 'Budget saved');
      fetchBudgetStatus();
    } finally { setIsBusy(false); }
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    setIsBusy(true);
    const url = editingExpenseId
      ? `${API_URL}/expenses/${editingExpenseId}`
      : `${API_URL}/expenses`;
    try {
      const res  = await fetch(url, {
        method: editingExpenseId ? 'PUT' : 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: expenseTitle, amount: Number(expenseAmount),
          category: expenseCategory, date: expenseDate
        })
      });
      const data = await res.json();
      if (!res.ok) { showMessage(data.message || 'Something went wrong'); return; }
      resetExpenseForm();
      showMessage(editingExpenseId ? 'Expense updated' : 'Expense added');
      fetchExpenses();
      fetchBudgetStatus();
    } finally { setIsBusy(false); }
  };

  const handleEditExpense = (expense) => {
    setEditingExpenseId(expense._id);
    setExpenseTitle(expense.title);
    setExpenseAmount(String(expense.amount));
    setExpenseCategory(expense.category);
    setExpenseDate(toInputDate(expense.date));
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExpense = async (id) => {
    const res  = await fetch(`${API_URL}/expenses/${id}`, { method: 'DELETE', headers: authHeaders });
    const data = await res.json();
    if (!res.ok) { showMessage(data.message || 'Something went wrong'); return; }
    if (editingExpenseId === id) resetExpenseForm();
    showMessage('Expense deleted');
    fetchExpenses();
    fetchBudgetStatus();
  };

  const handleLogout = () => {
    setUser(null); setToken(''); setEmail(''); setPassword('');
    setBudgetStatus(null); setExpenses([]); resetExpenseForm();
    localStorage.removeItem('user'); localStorage.removeItem('token');
  };

  useEffect(() => {
    if (token) { fetchBudgetStatus(); fetchExpenses(); }
  }, [token]);

  // ── Auth screen ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="app auth-page">
        {message && <div className="toast">{message}</div>}
        <div className="auth-shell">
          <section className="auth-intro">
            <span className="eyebrow">Expense Tracker</span>
            <h1>Track spending without losing the plot.</h1>
            <p>Set a budget, record expenses, and see your remaining balance clearly.</p>
          </section>
          <section className="auth-card">
            <h2>{isLogin ? 'Welcome back' : 'Create account'}</h2>
            <p>{isLogin ? 'Login to continue to your dashboard.' : 'Start tracking your monthly budget.'}</p>
            <form onSubmit={handleSubmit}>
              {!isLogin && (
                <input type="text" placeholder="Name" value={name}
                  onChange={e => setName(e.target.value)} required />
              )}
              <input type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password}
                onChange={e => setPassword(e.target.value)} required />
              <button type="submit" disabled={isBusy}>{isLogin ? 'Login' : 'Register'}</button>
            </form>
            <button className="link-button" type="button" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
            </button>
          </section>
        </div>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  return (
    <div className="app dashboard-page">
      {message && <div className="toast">{message}</div>}

      <main className="dashboard">
        <header className="dashboard-header">
          <div>
            <span className="eyebrow">Personal finance</span>
            <h1>Expense Tracker</h1>
            <p>Welcome back, {user.name}. Keep the month under control.</p>
          </div>
          <button className="secondary-button" onClick={handleLogout}>Logout</button>
          
        </header>

        {/* Tab navigation */}
        <div className="tab-nav">
          <button
            className={activeTab === 'dashboard' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={activeTab === 'analytics' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
        </div>

        {/* ── Analytics Tab ─────────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <AnalyticsView token={token} authHeaders={authHeaders} />
        )}

        {/* ── Dashboard Tab ─────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <>
            <section className="hero-panel">
              <div>
                <p className="section-label">This month</p>
                <h2>Rs {remaining}</h2>
                <p>remaining from your Rs {budget} monthly budget</p>
              </div>
              <div className="progress-wrap">
                <div className="progress-bar">
                  <span style={{ width: `${spentPercent}%` }} />
                </div>
                <p>{Math.round(spentPercent)}% spent</p>
              </div>
            </section>

            <section className="summary-grid">
              <div className="summary-card">
                <p>Monthly Budget</p>
                <h2>Rs {budget}</h2>
              </div>
              <div className="summary-card">
                <p>Total Spent</p>
                <h2>Rs {totalSpent}</h2>
              </div>
              <div className="summary-card alert-card">
                <p>Remaining</p>
                <h2>Rs {remaining}</h2>
              </div>
            </section>

            <section className="content-grid">
              <div className="panel">
                <div className="panel-heading compact-heading">
                  <h2>{hasBudget ? 'Monthly Budget' : 'Set Monthly Budget'}</h2>
                  {hasBudget && !isEditingBudget && (
                    <button className="small-button" type="button"
                      onClick={() => { setBudgetAmount(String(budget)); setIsEditingBudget(true); }}>
                      Change
                    </button>
                  )}
                </div>
                {hasBudget && !isEditingBudget ? (
                  <div className="budget-current">
                    <p>Budget for this month is already set.</p>
                    <strong>Rs {budget}</strong>
                  </div>
                ) : (
                  <form onSubmit={handleSetBudget}>
                    <input type="number" placeholder="Budget amount" value={budgetAmount}
                      onChange={e => setBudgetAmount(e.target.value)} required />
                    <div className="form-actions">
                      <button type="submit" disabled={isBusy}>{hasBudget ? 'Update Budget' : 'Save Budget'}</button>
                      {hasBudget && (
                        <button className="subtle-button" type="button" onClick={() => setIsEditingBudget(false)}>Cancel</button>
                      )}
                    </div>
                  </form>
                )}
              </div>

              <div className="panel">
                <h2>{editingExpenseId ? 'Edit Expense' : 'Add Expense'}</h2>
                <form onSubmit={handleSaveExpense}>
                  <input type="text" placeholder="Title" value={expenseTitle}
                    onChange={e => setExpenseTitle(e.target.value)} required />
                  <input type="number" placeholder="Amount" value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)} required />
                  <input type="date" value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)} required />
                  <div className="chip-row">
                    {categories.map(category => (
                      <button key={category} type="button"
                        className={expenseCategory === category ? 'chip active' : 'chip'}
                        onClick={() => setExpenseCategory(category)}>
                        {category}
                      </button>
                    ))}
                  </div>
                  <div className="form-actions">
                    <button type="submit" disabled={isBusy}>{editingExpenseId ? 'Save Changes' : 'Add Expense'}</button>
                    {editingExpenseId && (
                      <button className="subtle-button" type="button" onClick={resetExpenseForm}>Cancel Edit</button>
                    )}
                  </div>
                </form>
              </div>
            </section>

            <section className="panel expense-panel">
              <div className="panel-heading">
                <h2>Recent Expenses</h2>
                <span>{expenses.length} items</span>
              </div>
              {expenses.length === 0 ? (
                <div className="empty-state">
                  <h3>No expenses yet</h3>
                  <p>Add your first expense to start tracking your month.</p>
                </div>
              ) : (
                <div className="expense-list">
                  {expenses.map(expense => (
                    <div className="expense-item" key={expense._id}>
                      <div>
                        <strong>{expense.title}</strong>
                        <p>{expense.category} • {formatDate(expense.date)}</p>
                      </div>
                      <div className="expense-actions">
                        <strong>Rs {expense.amount}</strong>
                        <button className="edit-button" onClick={() => handleEditExpense(expense)}>Edit</button>
                        <button onClick={() => handleDeleteExpense(expense._id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;

