import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import './App.css';
import PDFUpload from './components/CSVUpload';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const categories = ['Food', 'Travel', 'Shopping', 'Bills', 'Other'];

const CATEGORY_COLORS = {
  Food: '#f97316', Travel: '#3b82f6', Shopping: '#a855f7',
  Bills: '#ef4444', Other: '#6b7280', Income: '#10b981'
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const getToday = () => new Date().toISOString().split('T')[0];
const toInputDate = (date) => (date ? new Date(date).toISOString().split('T')[0] : getToday());
const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No date';
const formatShortDate = (dateStr) => new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const formatMoney = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
const formatSignedMoney = (value, direction) => `${direction === 'credit' ? '+' : '-'} Rs ${Number(value || 0).toLocaleString('en-IN')}`;
const formatDateTime = (date) => date ? new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No date';

const BarTooltip = ({ active, payload, label }) => active && payload?.length ? (
  <div className="chart-tooltip"><p className="ct-label">{formatShortDate(label)}</p><p className="ct-value">Rs {payload[0].value.toLocaleString('en-IN')}</p></div>
) : null;

const PieTooltip = ({ active, payload }) => active && payload?.length ? (
  <div className="chart-tooltip"><p className="ct-label">{payload[0].name}</p><p className="ct-value">Rs {payload[0].value.toLocaleString('en-IN')}</p><p className="ct-pct">{payload[0].payload.pct}%</p></div>
) : null;

function AdminLogin({ onBack, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { setMessage(data.message || 'Admin login failed'); return; }
      onLogin(data);
    } catch { setMessage('Unable to connect to admin service'); }
    finally { setBusy(false); }
  };
  return (
    <div className="app auth-page admin-auth-page">
      <div className="auth-shell admin-auth-shell">
        <section className="auth-intro admin-auth-intro">
          <span className="eyebrow">Admin Console</span>
          <h1>Operate the tracker from one control room.</h1>
          <p>Review app data, watch system health, and understand how users are spending across the platform.</p>
        </section>
        <section className="auth-card">
          <h2>Admin login</h2>
          <p>Use the server admin credentials configured in your environment.</p>
          {message && <div className="inline-alert">{message}</div>}
          <form onSubmit={handleSubmit}>
            <input type="email" placeholder="Admin email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Admin password" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit" disabled={busy}>{busy ? 'Checking...' : 'Login as Admin'}</button>
          </form>
          <button className="link-button" type="button" onClick={onBack}>Back to user login</button>
        </section>
      </div>
    </div>
  );
}

function AdminDashboard({ admin, token, onLogout }) {
  const [overview, setOverview] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const adminHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const fetchOverview = async () => {
    setLoading(true); setMessage('');
    try {
      const res = await fetch(`${API_URL}/admin/overview`, { headers: adminHeaders });
      const data = await res.json();
      if (!res.ok) { setMessage(data.message || 'Unable to load admin data'); return; }
      setOverview(data);
    } catch { setMessage('Unable to connect to admin service'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchOverview(); }, []);
  const maxActivity = Math.max(...(overview?.dailyActivity || []).map(d => d.count), 1);
  const maxCategory = Math.max(...(overview?.categoryWise || []).map(c => c.totalSpent), 1);
  return (
    <div className="app dashboard-page admin-page">
      <main className="dashboard admin-dashboard">
        <header className="dashboard-header admin-header">
          <div>
            <span className="eyebrow">Admin Console</span>
            <h1>App Operations</h1>
            <p>Signed in as {admin?.email}.</p>
          </div>
          <div className="admin-header-actions">
            <button className="small-button" onClick={fetchOverview} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
            <button className="secondary-button" onClick={onLogout}>Logout</button>
          </div>
        </header>
        {message && <div className="toast">{message}</div>}
        {!overview ? (
          <div className="analytics-loading"><div className="spinner" /><p>Loading...</p></div>
        ) : (
          <>
            <section className="admin-hero hero-panel">
              <div>
                <p className="section-label">System status</p>
                <h2>{overview.health.status}</h2>
                <p>Database is {overview.health.database}. Uptime is {Math.floor(overview.health.uptimeSeconds / 60)} min.</p>
              </div>
              <div className="health-stack">
                <span>{overview.health.nodeEnv}</span>
                <strong>{formatDateTime(overview.generatedAt)}</strong>
              </div>
            </section>
            <section className="analytics-summary">
              <div className="an-card"><p>Users</p><h3>{overview.totals.users}</h3></div>
              <div className="an-card"><p>Expenses</p><h3>{overview.totals.expenses}</h3></div>
              <div className="an-card"><p>This Month Spent</p><h3>{formatMoney(overview.totals.monthSpend)}</h3></div>
              <div className="an-card"><p>This Month Income</p><h3>{formatMoney(overview.totals.monthIncome || 0)}</h3></div>
              <div className="an-card"><p>All-time Spend</p><h3>{formatMoney(overview.totals.allTimeSpend)}</h3></div>
            </section>
            <section className="charts-row">
              <div className="chart-panel">
                <h3>Category Spend</h3>
                <div className="cat-table">
                  {overview.categoryWise.length === 0 ? <p className="muted-copy">No category spending this month.</p> :
                    overview.categoryWise.map(category => {
                      const color = CATEGORY_COLORS[category.category] || '#94a3b8';
                      const width = Math.round((category.totalSpent / maxCategory) * 100);
                      return (
                        <div key={category.category} className="cat-row">
                          <div className="cat-dot" style={{ background: color }} />
                          <div className="cat-info">
                            <div className="cat-top"><span className="cat-name">{category.category}</span><span className="cat-amt">{formatMoney(category.totalSpent)}</span></div>
                            <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: `${width}%`, background: color }} /></div>
                          </div>
                          <span className="cat-count">{category.count} items</span>
                        </div>
                      );
                    })}
                </div>
              </div>
              <div className="chart-panel">
                <h3>Activity This Month</h3>
                <div className="admin-bars">
                  {overview.dailyActivity.length === 0 ? <p className="muted-copy">No activity.</p> :
                    overview.dailyActivity.map(day => (
                      <div className="admin-bar-row" key={day.date}>
                        <span>{formatShortDate(day.date)}</span>
                        <div><i style={{ width: `${Math.max((day.count / maxActivity) * 100, 6)}%` }} /></div>
                        <strong>{day.count}</strong>
                      </div>
                    ))}
                </div>
              </div>
            </section>
            <section className="chart-panel">
              <h3>Recent Transactions</h3>
              <div className="admin-expense-table">
                {overview.recentExpenses.length === 0 ? <p className="muted-copy">No transactions.</p> :
                  overview.recentExpenses.map(expense => (
                    <div className="admin-expense-row" key={expense.id}>
                      <strong>{formatSignedMoney(expense.amount, expense.direction)}</strong>
                      <div><span>{expense.title}</span><p>{expense.category} · {formatDate(expense.date)}</p></div>
                      <em>{expense.user?.name || 'Unknown user'}</em>
                    </div>
                  ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function AnalyticsView({ authHeaders, refreshTick }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(false);
  const years = useMemo(() => Array.from({ length: 3 }, (_, i) => now.getFullYear() - i), []);
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch(`${API_URL}/expenses/analytics?month=${month}&year=${year}`, { headers: authHeaders }),
        fetch(`${API_URL}/budget/current?month=${month}&year=${year}`, { headers: authHeaders }),
      ]);
      setData(await a.json());
      setBudgetData(await b.json());
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchAnalytics(); }, [month, year, refreshTick]);
  const expenseCategories = useMemo(() => (data?.categoryWise || []).filter(c => (c.direction || 'debit') === 'debit'), [data]);
  const pieData = useMemo(() => {
    if (!expenseCategories.length) return [];
    const total = expenseCategories.reduce((s, c) => s + c.totalSpent, 0);
    return expenseCategories.map(c => ({ name: c.category, value: c.totalSpent, pct: total > 0 ? Math.round((c.totalSpent / total) * 100) : 0 }));
  }, [expenseCategories]);
  const barData = useMemo(() => (data?.dayWise || []).map(d => ({ date: d.date, spent: d.totalSpent || 0 })), [data]);
  const budget = budgetData?.budget || 0;
  const debits = data?.debits || 0;
  const credits = data?.credits || 0;
  const totalSpent = data?.totalSpent || 0;
  const remaining = budget - totalSpent;
  const pct = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
  const txCount = data?.dayWise?.reduce((s, d) => s + d.expenses.length, 0) || 0;
  return (
    <div className="analytics-view">
      <div className="analytics-picker">
        <div className="picker-group">
          <label>Month</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="picker-group">
          <label>Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="picker-title"><span>{MONTH_NAMES[month - 1]} {year}</span></div>
      </div>
      {loading ? <div className="analytics-loading"><div className="spinner" /><p>Loading analytics…</p></div> :
       !data ? null : (
        <>
          <div className="analytics-summary">
            <div className="an-card"><p>Total Spent</p><h3>Rs {debits.toLocaleString('en-IN')}</h3></div>
            <div className="an-card income-card"><p>Total Income</p><h3>Rs {credits.toLocaleString('en-IN')}</h3></div>
            <div className="an-card"><p>Monthly Budget</p><h3>{budget > 0 ? `Rs ${budget.toLocaleString('en-IN')}` : '—'}</h3></div>
            <div className={`an-card ${remaining < 0 ? 'danger' : ''}`}><p>Remaining</p><h3>{budget > 0 ? `Rs ${remaining.toLocaleString('en-IN')}` : '—'}</h3></div>
            <div className="an-card"><p>Transactions</p><h3>{txCount}</h3></div>
          </div>
          {budget > 0 && (
            <div className="an-budget-bar">
              <div className="abb-labels"><span>Budget usage (net of credits)</span><span>{Math.round(pct)}%</span></div>
              <div className="abb-track"><div className="abb-fill" style={{ width: `${pct}%`, background: pct > 90 ? '#ef4444' : pct > 70 ? '#f97316' : '#22c55e' }} /></div>
            </div>
          )}
          {data.dayWise.length === 0 ? <div className="an-empty"><p>No transactions found for {MONTH_NAMES[month - 1]} {year}.</p></div> : (
            <>
              <div className="chart-panel">
                <h3>Day-wise Spending</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} barSize={28} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <XAxis dataKey="date" tickFormatter={v => new Date(v + 'T00:00:00').getDate()} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${v / 1000}k` : v} />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--bar-hover)' }} />
                    <Bar dataKey="spent" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="charts-row">
                <div className="chart-panel pie-panel">
                  <h3>Category Breakdown (Spend)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                        {pieData.map(entry => <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#94a3b8'} />)}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-panel category-table-panel">
                  <h3>By Category</h3>
                  <div className="cat-table">
                    {expenseCategories
.map(c => {
                      const total = expenseCategories.reduce((s, x) => s + x.totalSpent, 0);
                      const pctC = total > 0 ? Math.round((c.totalSpent / total) * 100) : 0;
                      return (
                        <div key={c.category} className="cat-row">
                          <div className="cat-dot" style={{ background: CATEGORY_COLORS[c.category] || '#94a3b8' }} />
                          <div className="cat-info">
                            <div className="cat-top"><span className="cat-name">{c.category}</span><span className="cat-amt">Rs {c.totalSpent.toLocaleString('en-IN')}</span></div>
                            <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: `${pctC}%`, background: CATEGORY_COLORS[c.category] || '#94a3b8' }} /></div>
                          </div>
                          <span className="cat-count">{c.count} item{c.count !== 1 ? 's' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="chart-panel">
                <h3>Transactions by Day</h3>
                <div className="daywise-list">
                  {data.dayWise.map(day => (
                    <div key={day.date} className="day-group">
                      <div className="day-header">
                        <span className="day-label">{formatShortDate(day.date)}</span>
                        <span className="day-total">Spent Rs {day.debits.toLocaleString('en-IN')}{day.credits > 0 ? ` · +Rs ${day.credits.toLocaleString('en-IN')}` : ''}</span>
                      </div>
                      <div className="day-expenses">
                        {day.expenses.map(exp => (
                          <div key={exp._id} className="day-exp-row">
                            <div className="dep-dot" style={{ background: CATEGORY_COLORS[exp.category] || '#94a3b8' }} />
                            <span className="dep-title">{exp.title}</span>
                            <span className="dep-cat">{exp.category}</span>
                            <span className="dep-amt">{formatSignedMoney(exp.amount, exp.direction)}</span>
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

function App() {
  const [isLogin, setIsLogin] = useState(false);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const [adminSession, setAdminSession] = useState(() => {
    const savedAdmin = localStorage.getItem('admin');
    const savedToken = localStorage.getItem('adminToken');
    return savedAdmin && savedToken ? { admin: JSON.parse(savedAdmin), token: savedToken } : null;
  });
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetStatus, setBudgetStatus] = useState(null);

  const [expenses, setExpenses] = useState([]);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(getToday());
  const [expenseCategory, setExpenseCategory] = useState('Food');
  const [expenseDirection, setExpenseDirection] = useState('debit');
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [animatedWidth, setAnimatedWidth] = useState(0);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const budget = budgetStatus?.budget || 0;
  const debits = budgetStatus?.debits || 0;
  const credits = budgetStatus?.credits || 0;
  const totalSpent = budgetStatus?.totalSpent || 0;
  const remaining = budgetStatus?.remaining ?? (budget - totalSpent);
  const hasBudget = budget > 0;
  const spentPercent = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(spentPercent), 100);
    return () => clearTimeout(timer);
  }, [spentPercent]);

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 2500);
  };

  const resetExpenseForm = () => {
    setExpenseTitle(''); setExpenseAmount(''); setExpenseDate(getToday());
    setExpenseCategory('Food'); setExpenseDirection('debit'); setEditingExpenseId(null);
  };

  const fetchBudgetStatus = async () => {
    console.log(authHeaders);
    const res = await fetch(`${API_URL}/budget/current`, { headers: authHeaders });
    setBudgetStatus(await res.json());
  };
  const fetchExpenses = async () => {
    const res = await fetch(`${API_URL}/expenses`, { headers: authHeaders });
    setExpenses(await res.json());
  };
  const refreshAll = async () => {
    await Promise.all([fetchExpenses(), fetchBudgetStatus()]);
    setRefreshTick(t => t + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsBusy(true);
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    const body = isLogin ? { email, password } : { name, email, password };
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { showMessage(data.message || 'Something went wrong'); return; }
      if (isLogin) {
        setUser(data.user); setToken(data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
      } else { showMessage('Account created. Please login.'); setIsLogin(true); }
    } finally { setIsBusy(false); }
  };

  const handleSetBudget = async (e) => {
    e.preventDefault();
    setIsBusy(true);
    try {
      const res = await fetch(`${API_URL}/budget`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(budgetAmount) })
      });
      const data = await res.json();
      if (!res.ok) { showMessage(data.message || 'Something went wrong'); return; }
      setBudgetAmount(''); setIsEditingBudget(false);
      showMessage(hasBudget ? 'Budget updated' : 'Budget saved');
      fetchBudgetStatus();
    } finally { setIsBusy(false); }
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    setIsBusy(true);
    const url = editingExpenseId ? `${API_URL}/expenses/${editingExpenseId}` : `${API_URL}/expenses`;
    try {
      const res = await fetch(url, {
        method: editingExpenseId ? 'PUT' : 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: expenseTitle, amount: Number(expenseAmount),
          category: expenseDirection === 'credit' ? 'Income' : expenseCategory,
          date: expenseDate, direction: expenseDirection
        })
      });
      const data = await res.json();
      if (!res.ok) { showMessage(data.message || 'Something went wrong'); return; }
      resetExpenseForm();
      showMessage(editingExpenseId ? 'Transaction updated' : `Transaction added (${expenseDirection})`);
      fetchExpenses(); fetchBudgetStatus();
    } finally { setIsBusy(false); }
  };

  const handleEditExpense = (expense) => {
    setEditingExpenseId(expense._id);
    setExpenseTitle(expense.title); setExpenseAmount(String(expense.amount));
    setExpenseCategory(expense.category); setExpenseDirection(expense.direction || 'debit');
    setExpenseDate(toInputDate(expense.date));
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExpense = async (id) => {
    const res = await fetch(`${API_URL}/expenses/${id}`, { method: 'DELETE', headers: authHeaders });
    const data = await res.json();
    if (!res.ok) { showMessage(data.message || 'Something went wrong'); return; }
    if (editingExpenseId === id) resetExpenseForm();
    showMessage('Transaction deleted');
    fetchExpenses(); fetchBudgetStatus();
  };

  const handleLogout = () => {
    setUser(null); setToken(''); setEmail(''); setPassword('');
    setBudgetStatus(null); setExpenses([]); resetExpenseForm();
    localStorage.removeItem('user'); localStorage.removeItem('token');
  };

  const handleAdminLogin = (data) => {
    setAdminSession({ admin: data.admin, token: data.token });
    setShowAdminLogin(false);
    localStorage.setItem('admin', JSON.stringify(data.admin));
    localStorage.setItem('adminToken', data.token);
  };
  const handleAdminLogout = () => {
    setAdminSession(null);
    localStorage.removeItem('admin'); localStorage.removeItem('adminToken');
  };

  useEffect(() => { if (token) { fetchBudgetStatus(); fetchExpenses(); } }, [token]);

  if (adminSession) return <AdminDashboard admin={adminSession.admin} token={adminSession.token} onLogout={handleAdminLogout} />;
  if (showAdminLogin) return <AdminLogin onBack={() => setShowAdminLogin(false)} onLogin={handleAdminLogin} />;

  if (!user) {
    return (
      <div className="app auth-page">
        {message && <div className="toast">{message}</div>}
        <div className="auth-shell">
          <section className="auth-intro">
            <span className="eyebrow">Expense Tracker</span>
            <h1>Track spending and income without losing the plot.</h1>
            <p>Set a budget, record debits and credits, and see your remaining balance clearly.</p>
          </section>
          <section className="auth-card">
            <h2>{isLogin ? 'Welcome back' : 'Create account'}</h2>
            <p>{isLogin ? 'Login to continue to your dashboard.' : 'Start tracking your monthly budget.'}</p>
            <form onSubmit={handleSubmit}>
              {!isLogin && <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />}
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="submit" disabled={isBusy}>{isLogin ? 'Login' : 'Register'}</button>
            </form>
            <button className="link-button" type="button" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
            </button>
            <button className="admin-link-button" type="button" onClick={() => setShowAdminLogin(true)}>Admin login</button>
          </section>
        </div>
      </div>
    );
  }

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

        <div className="tab-nav">
          <button className={activeTab === 'dashboard' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button className={activeTab === 'analytics' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('analytics')}>Analytics</button>
        </div>

        {activeTab === 'analytics' && <AnalyticsView authHeaders={authHeaders} refreshTick={refreshTick} />}

        {activeTab === 'dashboard' && (
          <>
            <section className="hero-panel">
              <div>
                <p className="section-label">This month (net)</p>
                <h2>Rs {Number(remaining).toLocaleString('en-IN')}</h2>
                <p>remaining from your Rs {Number(budget).toLocaleString('en-IN')} monthly budget · Income Rs {credits.toLocaleString('en-IN')}</p>
              </div>
              <div className="progress-wrap">
                <div className="progress-bar"><span style={{ width: `${animatedWidth}%` }} /></div>
                <p>{Math.round(spentPercent)}% spent</p>
              </div>
            </section>

            <section className="summary-grid">
              <div className="summary-card"><p>Monthly Budget</p><h2>Rs {budget}</h2></div>
              <div className="summary-card"><p>Debits</p><h2>Rs {debits.toLocaleString('en-IN')}</h2></div>
              <div className="summary-card"><p>Credits</p><h2>Rs {credits.toLocaleString('en-IN')}</h2></div>
              <div className="summary-card alert-card"><p>Net Spent</p><h2>Rs {totalSpent.toLocaleString('en-IN')}</h2></div>
              <div className="summary-card alert-card"><p>Remaining</p><h2>Rs {Number(remaining).toLocaleString('en-IN')}</h2></div>
            </section>

            <PDFUpload token={token} onUploadSuccess={() => { refreshAll(); showMessage('UPI transactions imported'); }} />

            <section className="content-grid">
              <div className="panel">
                <div className="panel-heading compact-heading">
                  <h2>{hasBudget ? 'Monthly Budget' : 'Set Monthly Budget'}</h2>
                  {hasBudget && !isEditingBudget && (
                    <button className="small-button" type="button" onClick={() => { setBudgetAmount(String(budget)); setIsEditingBudget(true); }}>Change</button>
                  )}
                </div>
                {hasBudget && !isEditingBudget ? (
                  <div className="budget-current"><p>Budget for this month is already set.</p><strong>Rs {budget}</strong></div>
                ) : (
                  <form onSubmit={handleSetBudget}>
                    <input type="number" placeholder="Budget amount" value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)} required />
                    <div className="form-actions">
                      <button type="submit" disabled={isBusy}>{hasBudget ? 'Update Budget' : 'Save Budget'}</button>
                      {hasBudget && <button className="subtle-button" type="button" onClick={() => setIsEditingBudget(false)}>Cancel</button>}
                    </div>
                  </form>
                )}
              </div>

              <div className="panel">
                <h2>{editingExpenseId ? 'Edit Transaction' : 'Add Transaction'}</h2>
                <form onSubmit={handleSaveExpense}>
                  <input type="text" placeholder="Title" value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} required />
                  <input type="number" placeholder="Amount" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} required />
                  <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required />
                  <div className="chip-row">
                    <button type="button" className={expenseDirection === 'debit' ? 'chip active' : 'chip'} onClick={() => setExpenseDirection('debit')}>Debit</button>
                    <button type="button" className={expenseDirection === 'credit' ? 'chip active income-chip' : 'chip'} onClick={() => setExpenseDirection('credit')}>Credit / Income</button>
                  </div>
                  {expenseDirection === 'debit' && (
                    <div className="chip-row">
                      {categories.map(category => (
                        <button key={category} type="button" className={expenseCategory === category ? 'chip active' : 'chip'} onClick={() => setExpenseCategory(category)}>{category}</button>
                      ))}
                    </div>
                  )}
                  <div className="form-actions">
                    <button type="submit" disabled={isBusy}>{editingExpenseId ? 'Save Changes' : expenseDirection === 'credit' ? 'Add Credit' : 'Add Debit'}</button>
                    {editingExpenseId && <button className="subtle-button" type="button" onClick={resetExpenseForm}>Cancel Edit</button>}
                  </div>
                </form>
              </div>
            </section>

            <section className="panel expense-panel">
              <div className="panel-heading">
                <h2>Recent Transactions</h2><span>{expenses.length} items</span></div>
              {expenses.length === 0 ? (
                <div className="empty-state"><h3>No transactions yet</h3><p>Add your first transaction or import a UPI statement.</p></div>
              ) : (
                <div className="expense-list">
                  {expenses.map(expense => {
                    const isCredit = (expense.direction || 'debit') === 'credit';
                    return (
                      <div className={isCredit ? 'expense-item income-item' : 'expense-item'} key={expense._id}>
                        <div className="expense-amount">{formatSignedMoney(expense.amount, expense.direction)}</div>
                        <div className="expense-details">
                          <strong>{expense.title}</strong>
                          <p>{expense.category} · {formatDate(expense.date)}{isCredit ? ' · Credit' : ''}</p>
                        </div>
                        <div className="expense-actions">
                          <button className="edit-button" onClick={() => handleEditExpense(expense)}>Edit</button>
                          <button className="delete-button" onClick={() => handleDeleteExpense(expense._id)}>Delete</button>
                        </div>
                      </div>
                    );
                  })}
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


