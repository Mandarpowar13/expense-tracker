import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const categories = ['Food', 'Travel', 'Shopping', 'Bills', 'Other'];

function App() {
  const [isLogin, setIsLogin] = useState(false);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

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
  const [expenseCategory, setExpenseCategory] = useState('Food');

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const budget = budgetStatus?.budget || 0;
  const totalSpent = budgetStatus?.totalSpent || 0;
  const remaining = budgetStatus?.remaining || 0;
  const spentPercent = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 2500);
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
      showMessage('Budget saved');
      fetchBudgetStatus();
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setIsBusy(true);

    try {
      const response = await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: expenseTitle,
          amount: Number(expenseAmount),
          category: expenseCategory
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(data.message || 'Something went wrong');
        return;
      }

      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseCategory('Food');
      showMessage('Expense added');
      fetchExpenses();
      fetchBudgetStatus();
    } finally {
      setIsBusy(false);
    }
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
              <h2>Set Monthly Budget</h2>
              <form onSubmit={handleSetBudget}>
                <input
                  type="number"
                  placeholder="Budget amount"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  required
                />
                <button type="submit" disabled={isBusy}>Save Budget</button>
              </form>
            </div>

            <div className="panel">
              <h2>Add Expense</h2>
              <form onSubmit={handleAddExpense}>
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
                <button type="submit" disabled={isBusy}>Add Expense</button>
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
                      <p>{expense.category}</p>
                    </div>
                    <div className="expense-actions">
                      <strong>Rs {expense.amount}</strong>
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
