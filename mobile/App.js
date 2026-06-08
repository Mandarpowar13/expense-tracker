import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PDFImportMobile from './components/PDFImportMobile';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';
const categories = ['Food', 'Travel', 'Shopping', 'Bills', 'Other'];

const CATEGORY_COLORS = {
  Food: '#f97316',
  Travel: '#3b82f6',
  Shopping: '#a855f7',
  Bills: '#ef4444',
  Other: '#6b7280',
  Income: '#10b981'
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const getToday = () => new Date().toISOString().split('T')[0];
const toInputDate = (date) => (date ? new Date(date).toISOString().split('T')[0] : getToday());

const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const formatShortDate = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const formatMoney = (amount) => `Rs ${Number(amount || 0).toLocaleString('en-IN')}`;
const formatSignedMoney = (amount, direction) => `${direction === 'credit' ? '+' : '-'} Rs ${Number(amount || 0).toLocaleString('en-IN')}`;

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function AnalyticsView({ authHeaders }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(false);

  const years = useMemo(() => Array.from({ length: 3 }, (_, index) => now.getFullYear() - index), []);

  const fetchAnalytics = async () => {
    setLoading(true);

    try {
      const [analyticsResponse, budgetResponse] = await Promise.all([
        fetch(`${API_URL}/expenses/analytics?month=${month}&year=${year}`, { headers: authHeaders }),
        fetch(`${API_URL}/budget/current?month=${month}&year=${year}`, { headers: authHeaders })
      ]);

      setData(await analyticsResponse.json());
      setBudgetData(await budgetResponse.json());
    } catch (error) {
      Alert.alert('Error', 'Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [month, year]);

  const budget = budgetData?.budget || 0;
  const debits = data?.debits || 0;
  const credits = data?.credits || 0;
  const totalSpent = data?.totalSpent || 0;
  const remaining = budget - totalSpent;
  const budgetPercent = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
  const transactionCount = data?.dayWise?.reduce((sum, day) => sum + day.expenses.length, 0) || 0;
  const maxDaySpend = Math.max(...(data?.dayWise || []).map((day) => day.totalSpent), 1);

  return (
    <View style={styles.analyticsView}>
      <Card style={styles.analyticsPicker}>
        <Text style={styles.pickerLabel}>Month</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
          {MONTH_NAMES.map((monthName, index) => (
            <TouchableOpacity
              key={monthName}
              style={[styles.pickerChip, month === index + 1 && styles.pickerChipActive]}
              onPress={() => setMonth(index + 1)}
            >
              <Text style={[styles.pickerChipText, month === index + 1 && styles.pickerChipTextActive]}>
                {monthName.slice(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.yearRow}>
          {years.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.yearChip, year === item && styles.yearChipActive]}
              onPress={() => setYear(item)}
            >
              <Text style={[styles.yearChipText, year === item && styles.yearChipTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.pickerTitle}>{MONTH_NAMES[month - 1]} {year}</Text>
      </Card>

      {loading ? (
        <View style={styles.loadingPanel}>
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      ) : !data ? null : (
        <>
          <View style={styles.analyticsSummary}>
            <Card style={styles.analyticsCard}>
              <Text style={styles.analyticsCardLabel}>Total Spent</Text>
              <Text style={styles.analyticsCardValue}>{formatMoney(debits)}</Text>
            </Card>
            <Card style={styles.analyticsCard}>
              <Text style={styles.analyticsCardLabel}>Total Income</Text>
              <Text style={styles.analyticsCardValue}>{formatMoney(credits)}</Text>
            </Card>
            <Card style={styles.analyticsCard}>
              <Text style={styles.analyticsCardLabel}>Monthly Budget</Text>
              <Text style={styles.analyticsCardValue}>{budget > 0 ? formatMoney(budget) : '-'}</Text>
            </Card>
            <Card style={styles.analyticsCard}>
              <Text style={styles.analyticsCardLabel}>Remaining</Text>
              <Text style={[styles.analyticsCardValue, remaining < 0 && styles.dangerText]}>
                {budget > 0 ? formatMoney(remaining) : '-'}
              </Text>
            </Card>
            <Card style={styles.analyticsCard}>
              <Text style={styles.analyticsCardLabel}>Transactions</Text>
              <Text style={styles.analyticsCardValue}>{transactionCount}</Text>
            </Card>
          </View>

          {budget > 0 && (
            <Card>
              <View style={styles.budgetLabels}>
                <Text style={styles.budgetLabel}>Budget usage</Text>
                <Text style={styles.budgetLabel}>{Math.round(budgetPercent)}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${budgetPercent}%`,
                      backgroundColor: budgetPercent > 90 ? '#ef4444' : budgetPercent > 70 ? '#f97316' : '#22c55e'
                    }
                  ]}
                />
              </View>
            </Card>
          )}

          {data.dayWise.length === 0 ? (
            <Card style={styles.emptyAnalytics}>
              <Text style={styles.emptyText}>No expenses found for {MONTH_NAMES[month - 1]} {year}.</Text>
            </Card>
          ) : (
            <>
              <Card>
                <Text style={styles.chartTitle}>Day-wise Spending</Text>
                <View style={styles.barChart}>
                  {data.dayWise.map((day) => {
                    const height = Math.max((day.totalSpent / maxDaySpend) * 120, 8);
                    return (
                      <View key={day.date} style={styles.barCol}>
                        <View style={[styles.bar, { height }]} />
                        <Text style={styles.barLabel}>{new Date(`${day.date}T00:00:00`).getDate()}</Text>
                      </View>
                    );
                  })}
                </View>
              </Card>

              <Card>
                <Text style={styles.chartTitle}>By Category</Text>
                <View style={styles.categoryTable}>
                  {data.categoryWise.map((item) => {
                    const percent = data.totalSpent > 0 ? Math.round((item.totalSpent / data.totalSpent) * 100) : 0;
                    const color = CATEGORY_COLORS[item.category] || '#94a3b8';

                    return (
                      <View key={item.category} style={styles.categoryRow}>
                        <View style={[styles.categoryDot, { backgroundColor: color }]} />
                        <View style={styles.categoryInfo}>
                          <View style={styles.categoryTop}>
                            <Text style={styles.categoryName}>{item.category}</Text>
                            <Text style={styles.categoryAmount}>{formatMoney(item.totalSpent)}</Text>
                          </View>
                          <View style={styles.categoryTrack}>
                            <View style={[styles.categoryFill, { width: `${percent}%`, backgroundColor: color }]} />
                          </View>
                        </View>
                        <Text style={styles.categoryCount}>{item.count} item{item.count !== 1 ? 's' : ''}</Text>
                      </View>
                    );
                  })}
                </View>
              </Card>

              <Card>
                <Text style={styles.chartTitle}>Expenses by Day</Text>
                {data.dayWise.map((day) => (
                  <View key={day.date} style={styles.dayGroup}>
                    <View style={styles.dayHeader}>
                      <Text style={styles.dayLabel}>{formatShortDate(day.date)}</Text>
                      <Text style={styles.dayTotal}>{formatMoney(day.totalSpent)}</Text>
                    </View>
                    {day.expenses.map((expense) => (
                      <View key={expense._id} style={styles.dayExpenseRow}>
                        <View style={[styles.dayDot, { backgroundColor: CATEGORY_COLORS[expense.category] || '#94a3b8' }]} />
                        <Text style={styles.dayExpenseTitle} numberOfLines={1}>{expense.title}</Text>
                        <Text style={styles.dayExpenseCategory}>{expense.category}</Text>
                        <Text style={styles.dayExpenseAmount}>{formatMoney(expense.amount)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </View>
  );
}

export default function App() {
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');

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

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const budget = budgetStatus?.budget || 0;
  const debits = budgetStatus?.debits || 0;
  const credits = budgetStatus?.credits || 0;
  const totalSpent = budgetStatus?.totalSpent || 0;
  const remaining = budgetStatus?.remaining ?? (budget - totalSpent);
  const hasBudget = budget > 0;
  const spentPercent = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;

  const resetExpenseForm = () => {
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseDate(getToday());
    setExpenseCategory('Food');
    setExpenseDirection('debit');
    setEditingExpenseId(null);
  };

  const loadSavedLogin = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('user');
      const savedToken = await AsyncStorage.getItem('token');

      if (savedUser && savedToken) {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetStatus = async () => {
    const response = await fetch(`${API_URL}/budget/current`, { headers: authHeaders });
    setBudgetStatus(await response.json());
  };

  const fetchExpenses = async () => {
    const response = await fetch(`${API_URL}/expenses`, { headers: authHeaders });
    setExpenses(await response.json());
  };

  const handleAuth = async () => {
    setBusy(true);
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
        Alert.alert('Error', data.message || 'Something went wrong');
        return;
      }

      if (isLogin) {
        setUser(data.user);
        setToken(data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        await AsyncStorage.setItem('token', data.token);
      } else {
        Alert.alert('Success', 'Account created. Please login.');
        setIsLogin(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to connect to the server.');
    } finally {
      setBusy(false);
    }
  };

  const handleSetBudget = async () => {
    setBusy(true);

    try {
      const response = await fetch(`${API_URL}/budget`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(budgetAmount) })
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data.message || 'Something went wrong');
        return;
      }

      setBudgetAmount('');
      setIsEditingBudget(false);
      fetchBudgetStatus();
    } catch (error) {
      Alert.alert('Error', 'Unable to save budget.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveExpense = async () => {
    setBusy(true);
    const url = editingExpenseId ? `${API_URL}/expenses/${editingExpenseId}` : `${API_URL}/expenses`;

    try {
      const response = await fetch(url, {
        method: editingExpenseId ? 'PUT' : 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: expenseTitle,
          amount: Number(expenseAmount),
          category: expenseDirection === 'credit' ? 'Income' : expenseCategory,
          date: expenseDate,
          direction: expenseDirection
        })
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data.message || 'Something went wrong');
        return;
      }

      resetExpenseForm();
      fetchExpenses();
      fetchBudgetStatus();
    } catch (error) {
      Alert.alert('Error', 'Unable to save expense.');
    } finally {
      setBusy(false);
    }
  };

  const handleEditExpense = (expense) => {
    setEditingExpenseId(expense._id);
    setExpenseTitle(expense.title);
    setExpenseAmount(String(expense.amount));
    setExpenseCategory(expense.category);
    setExpenseDirection(expense.direction || 'debit');
    setExpenseDate(toInputDate(expense.date));
    setActiveTab('dashboard');
  };

  const handleDeleteExpense = async (id) => {
    try {
      const response = await fetch(`${API_URL}/expenses/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data.message || 'Something went wrong');
        return;
      }

      if (editingExpenseId === id) {
        resetExpenseForm();
      }

      fetchExpenses();
      fetchBudgetStatus();
    } catch (error) {
      Alert.alert('Error', 'Unable to delete expense.');
    }
  };

  const handleLogout = async () => {
    setUser(null);
    setToken('');
    setBudgetStatus(null);
    setExpenses([]);
    setEmail('');
    setPassword('');
    setActiveTab('dashboard');
    resetExpenseForm();
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('token');
  };

  useEffect(() => {
    loadSavedLogin();
  }, []);

  useEffect(() => {
    if (token) {
      fetchBudgetStatus();
      fetchExpenses();
    }
  }, [token]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Text style={styles.loadingText}>Loading your tracker...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#eef3f8" />
        <ScrollView contentContainerStyle={styles.authPage}>
          <View style={styles.authIntro}>
            <Text style={styles.eyebrow}>Expense Tracker</Text>
            <Text style={styles.authTitle}>Track spending without losing the plot.</Text>
            <Text style={styles.authSubtitle}>
              Set a budget, record expenses, and see your remaining balance clearly.
            </Text>
          </View>

          <Card style={styles.authCard}>
            <Text style={styles.cardTitle}>{isLogin ? 'Welcome back' : 'Create account'}</Text>
            <Text style={styles.cardSub}>
              {isLogin ? 'Login to continue to your dashboard.' : 'Start tracking your monthly budget.'}
            </Text>

            {!isLogin && <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />}
            <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

            <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} disabled={busy}>
              <Text style={styles.primaryButtonText}>{busy ? 'Please wait...' : isLogin ? 'Login' : 'Register'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => setIsLogin(!isLogin)}>
              <Text style={styles.linkButtonText}>{isLogin ? 'Need an account? Register' : 'Already have an account? Login'}</Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fbff" />
      <ScrollView contentContainerStyle={styles.dashboard}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>Personal finance</Text>
            <Text style={styles.title}>Expense Tracker</Text>
            <Text style={styles.subtitle}>Welcome back, {user.name}. Keep the month under control.</Text>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabNav}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'dashboard' && styles.tabButtonActive]}
            onPress={() => setActiveTab('dashboard')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'dashboard' && styles.tabButtonTextActive]}>Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'analytics' && styles.tabButtonActive]}
            onPress={() => setActiveTab('analytics')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'analytics' && styles.tabButtonTextActive]}>Analytics</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'analytics' ? (
          <AnalyticsView authHeaders={authHeaders} />
        ) : (
          <>
            <Card style={styles.heroCard}>
              <Text style={styles.sectionLabel}>This month</Text>
              <Text style={styles.heroAmount}>{formatMoney(remaining)}</Text>
              <Text style={styles.heroNote}>remaining from your {formatMoney(budget)} monthly budget</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${spentPercent}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(spentPercent)}% spent</Text>
            </Card>

            <View style={styles.summaryGrid}>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Monthly Budget</Text>
                <Text style={styles.summaryValue}>{formatMoney(budget)}</Text>
              </Card>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Spent</Text>
                <Text style={styles.summaryValue}>{formatMoney(totalSpent)}</Text>
              </Card>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Remaining</Text>
                <Text style={[styles.summaryValue, styles.remainingValue]}>{formatMoney(remaining)}</Text>
              </Card>
            </View>

            <PDFImportMobile
              token={token}
              onUploadSuccess={() => {
                fetchExpenses();
                fetchBudgetStatus();
              }}
            />

            <Card>
              <View style={styles.panelHeading}>
                <Text style={styles.panelTitle}>{hasBudget ? 'Monthly Budget' : 'Set Monthly Budget'}</Text>
                {hasBudget && !isEditingBudget && (
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => {
                      setBudgetAmount(String(budget));
                      setIsEditingBudget(true);
                    }}
                  >
                    <Text style={styles.smallButtonText}>Change</Text>
                  </TouchableOpacity>
                )}
              </View>

              {hasBudget && !isEditingBudget ? (
                <View style={styles.budgetCurrent}>
                  <Text style={styles.emptyText}>Budget for this month is already set.</Text>
                  <Text style={styles.budgetCurrentAmount}>{formatMoney(budget)}</Text>
                </View>
              ) : (
                <>
                  <TextInput style={styles.input} placeholder="Budget amount" value={budgetAmount} onChangeText={setBudgetAmount} keyboardType="numeric" />
                  <TouchableOpacity style={styles.primaryButton} onPress={handleSetBudget} disabled={busy}>
                    <Text style={styles.primaryButtonText}>{hasBudget ? 'Update Budget' : 'Save Budget'}</Text>
                  </TouchableOpacity>
                  {hasBudget && (
                    <TouchableOpacity style={styles.subtleButton} onPress={() => setIsEditingBudget(false)}>
                      <Text style={styles.subtleButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </Card>

            <Card>
              <Text style={styles.panelTitle}>{editingExpenseId ? 'Edit Expense' : 'Add Expense'}</Text>
              <TextInput style={styles.input} placeholder="Title" value={expenseTitle} onChangeText={setExpenseTitle} />
              <TextInput style={styles.input} placeholder="Amount" value={expenseAmount} onChangeText={setExpenseAmount} keyboardType="numeric" />
              <TextInput style={styles.input} placeholder="Date YYYY-MM-DD" value={expenseDate} onChangeText={setExpenseDate} />

              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, expenseDirection === 'debit' && styles.activeChip]}
                  onPress={() => setExpenseDirection('debit')}
                >
                  <Text style={[styles.chipText, expenseDirection === 'debit' && styles.activeChipText]}>Debit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, expenseDirection === 'credit' && styles.activeChip]}
                  onPress={() => setExpenseDirection('credit')}
                >
                  <Text style={[styles.chipText, expenseDirection === 'credit' && styles.activeChipText]}>Credit / Income</Text>
                </TouchableOpacity>
              </View>
              {expenseDirection === 'debit' && (
                <View style={styles.chipRow}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[styles.chip, expenseCategory === category && styles.activeChip]}
                      onPress={() => setExpenseCategory(category)}
                    >
                      <Text style={[styles.chipText, expenseCategory === category && styles.activeChipText]}>{category}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.primaryButton} onPress={handleSaveExpense} disabled={busy}>
                <Text style={styles.primaryButtonText}>{editingExpenseId ? 'Save Changes' : (expenseDirection === 'credit' ? 'Add Credit' : 'Add Debit')}</Text>
              </TouchableOpacity>
              {editingExpenseId && (
                <TouchableOpacity style={styles.subtleButton} onPress={resetExpenseForm}>
                  <Text style={styles.subtleButtonText}>Cancel Edit</Text>
                </TouchableOpacity>
              )}
            </Card>

            <Card style={styles.expensePanel}>
              <View style={styles.panelHeading}>
                <Text style={styles.panelTitle}>Recent Expenses</Text>
                <Text style={styles.countText}>{expenses.length} items</Text>
              </View>

              {expenses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No expenses yet</Text>
                  <Text style={styles.emptyText}>Add your first expense to start tracking your month.</Text>
                </View>
              ) : (
                <FlatList
                  data={expenses}
                  keyExtractor={(item) => item._id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <View style={styles.expenseItem}>
                      <Text style={styles.expenseAmount}>{formatSignedMoney(item.amount, item.direction)}</Text>

                      <View style={styles.expenseDetails}>
                        <Text style={styles.expenseTitle}>{item.title}</Text>
                        <Text style={styles.expenseMeta}>{item.category} - {formatDate(item.date)}</Text>
                      </View>

                      <View style={styles.expenseActions}>
                        <TouchableOpacity style={styles.editButton} onPress={() => handleEditExpense(item)}>
                          <Text style={styles.editButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteExpense(item._id)}>
                          <Text style={styles.deleteButtonText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eef3f8'
  },
  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef3f8'
  },
  loadingText: {
    color: '#475569',
    fontWeight: '700'
  },
  authPage: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 18,
    backgroundColor: '#eef3f8'
  },
  authIntro: {
    minHeight: 260,
    justifyContent: 'flex-end',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 28,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 4
  },
  authTitle: {
    marginTop: 4,
    fontSize: 38,
    lineHeight: 42,
    color: '#111827',
    fontWeight: '800'
  },
  authSubtitle: {
    marginTop: 14,
    color: '#536173',
    lineHeight: 23,
    fontSize: 16
  },
  authCard: {
    marginBottom: 10
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    shadowColor: '#1f2937',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 3
  },
  eyebrow: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 3
  },
  sectionLabel: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827'
  },
  cardSub: {
    marginTop: 6,
    marginBottom: 18,
    color: '#64748b'
  },
  input: {
    minHeight: 48,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d9e1ea',
    borderRadius: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
    fontSize: 15,
    color: '#172033'
  },
  primaryButton: {
    backgroundColor: '#625f98',
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15
  },
  subtleButton: {
    backgroundColor: '#f1f5f9',
    minHeight: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  },
  subtleButtonText: {
    color: '#334155',
    fontWeight: '800'
  },
  linkButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  linkButtonText: {
    color: '#1d4ed8',
    fontWeight: '800'
  },
  dashboard: {
    padding: 16,
    paddingBottom: 38,
    backgroundColor: '#f8fbff'
  },
  header: {
    marginBottom: 16
  },
  headerText: {
    marginBottom: 14
  },
  title: {
    fontSize: 36,
    lineHeight: 39,
    fontWeight: '800',
    color: '#111827'
  },
  subtitle: {
    marginTop: 6,
    color: '#64748b',
    lineHeight: 20
  },
  logoutButton: {
    backgroundColor: '#111827',
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoutButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  },
  tabNav: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    borderRadius: 10,
    padding: 4,
    marginBottom: 18
  },
  tabButton: {
    minHeight: 36,
    paddingHorizontal: 18,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  tabButtonText: {
    color: '#64748b',
    fontWeight: '800'
  },
  tabButtonTextActive: {
    color: '#0f172a'
  },
  heroCard: {
    padding: 24
  },
  heroAmount: {
    marginTop: 2,
    fontSize: 52,
    lineHeight: 58,
    fontWeight: '800',
    color: '#423f73'
  },
  heroNote: {
    marginTop: 6,
    color: '#64748b'
  },
  progressBar: {
    height: 12,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    borderRadius: 99,
    marginTop: 18
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 99
  },
  progressText: {
    marginTop: 8,
    textAlign: 'right',
    color: '#475569',
    fontWeight: '800'
  },
  summaryGrid: {
    gap: 14,
    marginBottom: 0
  },
  summaryCard: {
    marginBottom: 0
  },
  summaryLabel: {
    color: '#64748b',
    fontWeight: '800'
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a'
  },
  remainingValue: {
    color: '#047857'
  },
  panelHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827'
  },
  countText: {
    color: '#64748b',
    fontWeight: '800'
  },
  smallButton: {
    minHeight: 34,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  smallButtonText: {
    color: '#423f73',
    fontWeight: '800'
  },
  budgetCurrent: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    borderRadius: 8,
    backgroundColor: '#f8fafc'
  },
  budgetCurrentAmount: {
    marginTop: 6,
    color: '#047857',
    fontSize: 24,
    fontWeight: '800'
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10
  },
  chip: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  },
  activeChip: {
    backgroundColor: '#dbeafe'
  },
  chipText: {
    color: '#334155',
    fontWeight: '800'
  },
  activeChipText: {
    color: '#423f73'
  },
  emptyState: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 18,
    backgroundColor: '#f8fafc'
  },
  emptyTitle: {
    color: '#111827',
    fontWeight: '800'
  },
  emptyText: {
    color: '#64748b',
    marginTop: 4
  },
  expensePanel: {
    marginBottom: 24
  },
  expenseItem: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 18,
    marginBottom: 10,
    backgroundColor: '#ffffff'
  },
  expenseAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#423f73'
  },
  expenseDetails: {
    marginTop: 10
  },
  expenseTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a'
  },
  expenseMeta: {
    color: '#64748b',
    marginTop: 4
  },
  expenseActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14
  },
  editButton: {
    flex: 1,
    backgroundColor: '#ecfdf5',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  editButtonText: {
    color: '#047857',
    fontWeight: '800'
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#fee2e2',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  deleteButtonText: {
    color: '#b91c1c',
    fontWeight: '800'
  },
  analyticsView: {
    gap: 0
  },
  analyticsPicker: {
    paddingBottom: 18
  },
  pickerLabel: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8
  },
  pickerRow: {
    gap: 8,
    paddingRight: 10
  },
  pickerChip: {
    minHeight: 38,
    minWidth: 52,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pickerChipActive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe'
  },
  pickerChipText: {
    color: '#64748b',
    fontWeight: '800'
  },
  pickerChipTextActive: {
    color: '#0f172a'
  },
  yearRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12
  },
  yearChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  yearChipActive: {
    backgroundColor: '#111827'
  },
  yearChipText: {
    color: '#64748b',
    fontWeight: '800'
  },
  yearChipTextActive: {
    color: '#ffffff'
  },
  pickerTitle: {
    marginTop: 14,
    color: '#64748b',
    fontWeight: '800'
  },
  loadingPanel: {
    paddingVertical: 64,
    alignItems: 'center'
  },
  analyticsSummary: {
    gap: 14
  },
  analyticsCard: {
    marginBottom: 0
  },
  analyticsCardLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  analyticsCardValue: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    color: '#0f172a'
  },
  dangerText: {
    color: '#b91c1c'
  },
  budgetLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  budgetLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  emptyAnalytics: {
    alignItems: 'center',
    paddingVertical: 42
  },
  chartTitle: {
    marginBottom: 16,
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  barChart: {
    minHeight: 158,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8
  },
  barCol: {
    flex: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: '#6366f1'
  },
  barLabel: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700'
  },
  categoryTable: {
    gap: 14
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  categoryDot: {
    width: 9,
    height: 9,
    borderRadius: 99
  },
  categoryInfo: {
    flex: 1
  },
  categoryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6
  },
  categoryName: {
    color: '#0f172a',
    fontWeight: '800'
  },
  categoryAmount: {
    color: '#0f172a',
    fontWeight: '800'
  },
  categoryTrack: {
    height: 4,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0'
  },
  categoryFill: {
    height: '100%',
    borderRadius: 99
  },
  categoryCount: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700'
  },
  dayGroup: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    marginBottom: 10
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  dayLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  dayTotal: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800'
  },
  dayExpenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  dayDot: {
    width: 7,
    height: 7,
    borderRadius: 99
  },
  dayExpenseTitle: {
    flex: 1,
    color: '#172033',
    fontWeight: '700'
  },
  dayExpenseCategory: {
    color: '#64748b',
    fontSize: 11
  },
  dayExpenseAmount: {
    color: '#0f172a',
    fontWeight: '800'
  }
});
