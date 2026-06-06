import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const categories = ['Food', 'Travel', 'Shopping', 'Bills', 'Other'];

const getToday = () => new Date().toISOString().split('T')[0];

const toInputDate = (date) => {
  if (!date) return getToday();
  return new Date(date).toISOString().split('T')[0];
};

const formatDate = (date) => {
  if (!date) return 'No date';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

function App() {
  const [isLogin, setIsLogin] = useState(false);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);

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
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const budget = budgetStatus?.budget || 0;
  const totalSpent = budgetStatus?.totalSpent || 0;
  const remaining = budgetStatus?.remaining || 0;
  const hasBudget = budget > 0;
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
    const response = await fetch(`${API_URL}/budget/current`, { headers: authHeaders });
    const data = await response.json();
    setBudgetStatus(data);
  };

  const fetchExpenses = async () => {
    const response = await fetch(`${API_URL}/expenses`, { headers: authHeaders });
    const data = await response.json();
    setExpenses(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsBusy(true);

    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    const body = isLogin ? { email, password } : { name, email, password };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(data.message || 'Something went wrong');
        return;
      }

      if (isLogin) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
      } else {
        showMessage('Account created. Please login.');
        setIsLogin(true);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleSetBudget = async (e) => {
    e.preventDefault();
    setIsBusy(true);

    try {
      const response = await fetch(`${API_URL}/budget`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(budgetAmount) })
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(data.message || 'Something went wrong');
        return;
      }

      setBudgetAmount('');
      setIsEditingBudget(false);
      showMessage(hasBudget ? 'Budget updated' : 'Budget saved');
      fetchBudgetStatus();
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    setIsBusy(true);

    const url = editingExpenseId
      ? `${API_URL}/expenses/${editingExpenseId}`
      : `${API_URL}/expenses`;

    try {
      const response = await fetch(url, {
        method: editingExpenseId ? 'PUT' : 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: expenseTitle,
          amount: Number(expenseAmount),
          category: expenseCategory,
          date: expenseDate
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(data.message || 'Something went wrong');
        return;
      }

      resetExpenseForm();
      showMessage(editingExpenseId ? 'Expense updated' : 'Expense added');
      fetchExpenses();
      fetchBudgetStatus();
    } finally {
      setIsBusy(false);
    }
  };

  const handleEditExpense = (expense) => {
    setEditingExpenseId(expense._id);
    setExpenseTitle(expense.title);
    setExpenseAmount(String(expense.amount));
    setExpenseCategory(expense.category);
    setExpenseDate(toInputDate(expense.date));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExpense = async (id) => {
    const response = await fetch(`${API_URL}/expenses/${id}`, {
      method: 'DELETE',
      headers: authHeaders
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(data.message || 'Something went wrong');
      return;
    }

    if (editingExpenseId === id) {
      resetExpenseForm();
    }

    showMessage('Expense deleted');
    fetchExpenses();
    fetchBudgetStatus();
  };

  const handleLogout = () => {
    setUser(null);
    setToken('');
    setEmail('');
    setPassword('');
    setBudgetStatus(null);
    setExpenses([]);
    resetExpenseForm();
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  useEffect(() => {
    if (token) {
      fetchBudgetStatus();
      fetchExpenses();
    }
  }, [token]);

  if (user) {
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
                  <button
                    className="small-button"
                    type="button"
                    onClick={() => {
                      setBudgetAmount(String(budget));
                      setIsEditingBudget(true);
                    }}
                  >
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
                  <input
                    type="number"
                    placeholder="Budget amount"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    required
                  />
                  <div className="form-actions">
                    <button type="submit" disabled={isBusy}>{hasBudget ? 'Update Budget' : 'Save Budget'}</button>
                    {hasBudget && (
                      <button className="subtle-button" type="button" onClick={() => setIsEditingBudget(false)}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>

            <div className="panel">
              <h2>{editingExpenseId ? 'Edit Expense' : 'Add Expense'}</h2>
              <form onSubmit={handleSaveExpense}>
                <input
                  type="text"
                  placeholder="Title"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  required
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  required
                />
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                />
                <div className="chip-row">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={expenseCategory === category ? 'chip active' : 'chip'}
                      onClick={() => setExpenseCategory(category)}
                    >
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
                {expenses.map((expense) => (
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
        </main>
      </div>
    );
  }

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
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
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

export default App;

