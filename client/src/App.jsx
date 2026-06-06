import { useEffect, useState } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
function App() {
  const [isLogin, setIsLogin] = useState(false);

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('token') || '';
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetStatus, setBudgetStatus] = useState(null);

  const [expenses, setExpenses] = useState([]);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Food');

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  const fetchBudgetStatus = async () => {
    const response = await fetch(`${API_URL}/budget/current`, {
      headers: authHeaders
    });

    const data = await response.json();
    setBudgetStatus(data);
  };

  const fetchExpenses = async () => {
    const response = await fetch(`${API_URL}/expenses`, {
      headers: authHeaders
    });

    const data = await response.json();
    setExpenses(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const endpoint = isLogin ? '/auth/login' : '/auth/register';

    const body = isLogin
      ? { email, password }
      : { name, email, password };

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);
      return;
    }

    alert(data.message);

    if (isLogin) {
      setUser(data.user);
      setToken(data.token);

      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
    } else {
      setIsLogin(true);
    }
  };

  const handleSetBudget = async (e) => {
    e.preventDefault();

    const response = await fetch(`${API_URL}/budget`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Number(budgetAmount)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);
      return;
    }

    setBudgetAmount('');
    fetchBudgetStatus();
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();

    const response = await fetch(`${API_URL}/expenses`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: expenseTitle,
        amount: Number(expenseAmount),
        category: expenseCategory
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);
      return;
    }

    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseCategory('Food');

    fetchExpenses();
    fetchBudgetStatus();
  };

  const handleDeleteExpense = async (id) => {
    const response = await fetch(`${API_URL}/expenses/${id}`, {
      method: 'DELETE',
      headers: authHeaders
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);
      return;
    }

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
      <div className="app">
        <div className="dashboard">
          <div className="dashboard-header">
            <div>
              <h1>Expense Tracker</h1>
              <p>Welcome, {user.name}</p>
            </div>
            <button onClick={handleLogout}>Logout</button>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <p>Monthly Budget</p>
              <h2>₹{budgetStatus?.budget || 0}</h2>
            </div>

            <div className="summary-card">
              <p>Total Spent</p>
              <h2>₹{budgetStatus?.totalSpent || 0}</h2>
            </div>

            <div className="summary-card">
              <p>Remaining</p>
              <h2>₹{budgetStatus?.remaining || 0}</h2>
            </div>
          </div>

          <div className="content-grid">
            <div className="panel">
              <h2>Set Monthly Budget</h2>
              <form onSubmit={handleSetBudget}>
                <input
                  type="number"
                  placeholder="Budget amount"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                />
                <button type="submit">Save Budget</button>
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
                />

                <input
                  type="number"
                  placeholder="Amount"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />

                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                >
                  <option>Food</option>
                  <option>Travel</option>
                  <option>Shopping</option>
                  <option>Bills</option>
                  <option>Other</option>
                </select>

                <button type="submit">Add Expense</button>
              </form>
            </div>
          </div>

          <div className="panel">
            <h2>Expenses</h2>

            {expenses.length === 0 ? (
              <p>No expenses added yet.</p>
            ) : (
              <div className="expense-list">
                {expenses.map((expense) => (
                  <div className="expense-item" key={expense._id}>
                    <div>
                      <strong>{expense.title}</strong>
                      <p>{expense.category}</p>
                    </div>

                    <div className="expense-actions">
                      <strong>₹{expense.amount}</strong>
                      <button onClick={() => handleDeleteExpense(expense._id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="auth-card">
        <h1>Expense Tracker</h1>
        <p>{isLogin ? 'Login to your account' : 'Create your account'}</p>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit">
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <button
          className="link-button"
          type="button"
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin
            ? 'Need an account? Register'
            : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
}

export default App;