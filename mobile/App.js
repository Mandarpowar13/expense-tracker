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

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const categories = ['Food', 'Travel', 'Shopping', 'Bills', 'Other'];
const getToday = () => new Date().toISOString().split('T')[0];
const toInputDate = (date) => (date ? new Date(date).toISOString().split('T')[0] : getToday());
const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);

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
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const budget = budgetStatus?.budget || 0;
  const totalSpent = budgetStatus?.totalSpent || 0;
  const remaining = budgetStatus?.remaining || 0;
  const hasBudget = budget > 0;
  const spentPercent = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;

  const resetExpenseForm = () => {
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseDate(getToday());
    setExpenseCategory('Food');
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
    const data = await response.json();
    setBudgetStatus(data);
  };

  const fetchExpenses = async () => {
    const response = await fetch(`${API_URL}/expenses`, { headers: authHeaders });
    const data = await response.json();
    setExpenses(data);
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
        Alert.alert('Success', 'Registered successfully. Please login.');
        setIsLogin(true);
      }
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
          category: expenseCategory,
          date: expenseDate
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
    } finally {
      setBusy(false);
    }
  };

  const handleEditExpense = (expense) => {
    setEditingExpenseId(expense._id);
    setExpenseTitle(expense.title);
    setExpenseAmount(String(expense.amount));
    setExpenseCategory(expense.category);
    setExpenseDate(toInputDate(expense.date));
  };

  const handleDeleteExpense = async (id) => {
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
  };

  const handleLogout = async () => {
    setUser(null);
    setToken('');
    setBudgetStatus(null);
    setExpenses([]);
    setEmail('');
    setPassword('');
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
        <StatusBar barStyle="dark-content" />
        <View style={styles.authWrap}>
          <View style={styles.authIntro}>
            <Text style={styles.eyebrow}>Expense Tracker</Text>
            <Text style={styles.authTitle}>Spend with a plan.</Text>
            <Text style={styles.authSubtitle}>Track your budget, spending, and balance in one simple mobile dashboard.</Text>
          </View>

          <View style={styles.authCard}>
            <Text style={styles.cardTitle}>{isLogin ? 'Welcome back' : 'Create account'}</Text>
            <Text style={styles.cardSub}>{isLogin ? 'Login to continue.' : 'Start tracking your month.'}</Text>

            {!isLogin && <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />}
            <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

            <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} disabled={busy}>
              <Text style={styles.primaryButtonText}>{busy ? 'Please wait...' : isLogin ? 'Login' : 'Register'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
              <Text style={styles.linkText}>{isLogin ? 'Need an account? Register' : 'Already have an account? Login'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.dashboard}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Personal finance</Text>
            <Text style={styles.title}>Expense Tracker</Text>
            <Text style={styles.subtitle}>Welcome, {user.name}</Text>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.summaryLabel}>Remaining this month</Text>
          <Text style={styles.heroAmount}>Rs {remaining}</Text>
          <Text style={styles.heroNote}>from your Rs {budget} budget</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${spentPercent}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(spentPercent)}% spent</Text>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Budget</Text>
            <Text style={styles.summaryValue}>Rs {budget}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Spent</Text>
            <Text style={styles.summaryValue}>Rs {totalSpent}</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeading}>
            <Text style={styles.panelTitle}>{hasBudget ? 'Monthly Budget' : 'Set Monthly Budget'}</Text>
            {hasBudget && !isEditingBudget && (
              <TouchableOpacity style={styles.smallButton} onPress={() => { setBudgetAmount(String(budget)); setIsEditingBudget(true); }}>
                <Text style={styles.smallButtonText}>Change</Text>
              </TouchableOpacity>
            )}
          </View>

          {hasBudget && !isEditingBudget ? (
            <View style={styles.budgetCurrent}>
              <Text style={styles.emptyText}>Budget for this month is already set.</Text>
              <Text style={styles.budgetCurrentAmount}>Rs {budget}</Text>
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
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{editingExpenseId ? 'Edit Expense' : 'Add Expense'}</Text>
          <TextInput style={styles.input} placeholder="Title" value={expenseTitle} onChangeText={setExpenseTitle} />
          <TextInput style={styles.input} placeholder="Amount" value={expenseAmount} onChangeText={setExpenseAmount} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="Date YYYY-MM-DD" value={expenseDate} onChangeText={setExpenseDate} />

          <View style={styles.chipRow}>
            {categories.map((category) => (
              <TouchableOpacity key={category} style={[styles.chip, expenseCategory === category && styles.activeChip]} onPress={() => setExpenseCategory(category)}>
                <Text style={[styles.chipText, expenseCategory === category && styles.activeChipText]}>{category}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveExpense} disabled={busy}>
            <Text style={styles.primaryButtonText}>{editingExpenseId ? 'Save Changes' : 'Add Expense'}</Text>
          </TouchableOpacity>
          {editingExpenseId && (
            <TouchableOpacity style={styles.subtleButton} onPress={resetExpenseForm}>
              <Text style={styles.subtleButtonText}>Cancel Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeading}>
            <Text style={styles.panelTitle}>Recent Expenses</Text>
            <Text style={styles.countText}>{expenses.length} items</Text>
          </View>

          {expenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No expenses yet</Text>
              <Text style={styles.emptyText}>Add your first expense to begin tracking.</Text>
            </View>
          ) : (
            <FlatList
              data={expenses}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.expenseItem}>
                  <View style={styles.expenseLeft}>
                    <Text style={styles.expenseTitle}>{item.title}</Text>
                    <Text style={styles.expenseCategory}>{item.category} - {formatDate(item.date)}</Text>
                  </View>
                  <View style={styles.expenseRight}>
                    <Text style={styles.expenseAmount}>Rs {item.amount}</Text>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef3f8' },
  centerScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef3f8' },
  loadingText: { color: '#475569', fontWeight: '700' },
  authWrap: { flex: 1, padding: 18, justifyContent: 'center' },
  authIntro: { backgroundColor: '#ffffff', borderRadius: 8, padding: 24, marginBottom: 14, borderWidth: 1, borderColor: '#dbe4ee' },
  authTitle: { fontSize: 36, lineHeight: 40, color: '#111827', fontWeight: '800' },
  authSubtitle: { marginTop: 10, color: '#64748b', lineHeight: 22 },
  authCard: { backgroundColor: '#ffffff', borderRadius: 8, padding: 22, borderWidth: 1, borderColor: '#dbe4ee', shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 18, elevation: 4 },
  eyebrow: { color: '#0f766e', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  cardTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  cardSub: { marginTop: 6, marginBottom: 18, color: '#64748b' },
  input: { minHeight: 48, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d9e1ea', borderRadius: 8, paddingHorizontal: 14, marginBottom: 12, fontSize: 15, color: '#172033' },
  primaryButton: { backgroundColor: '#2563eb', minHeight: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  subtleButton: { backgroundColor: '#f1f5f9', minHeight: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  subtleButtonText: { color: '#334155', fontWeight: '800' },
  linkText: { marginTop: 16, textAlign: 'center', color: '#2563eb', fontWeight: '800' },
  dashboard: { padding: 16, paddingBottom: 38 },
  header: { marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 4, color: '#64748b' },
  logoutButton: { marginTop: 14, backgroundColor: '#111827', minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  logoutButtonText: { color: '#ffffff', fontWeight: '800' },
  heroCard: { backgroundColor: '#ffffff', borderRadius: 8, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#dbe4ee' },
  heroAmount: { marginTop: 4, fontSize: 42, lineHeight: 48, fontWeight: '800', color: '#0f172a' },
  heroNote: { marginTop: 4, color: '#64748b' },
  progressBar: { height: 12, overflow: 'hidden', backgroundColor: '#e2e8f0', borderRadius: 99, marginTop: 18 },
  progressFill: { height: '100%', backgroundColor: '#16a34a', borderRadius: 99 },
  progressText: { marginTop: 8, textAlign: 'right', color: '#475569', fontWeight: '800' },
  summaryGrid: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  summaryCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#dbe4ee' },
  summaryLabel: { color: '#64748b', fontWeight: '800' },
  summaryValue: { marginTop: 6, fontSize: 20, fontWeight: '800', color: '#111827' },
  panel: { backgroundColor: '#ffffff', borderRadius: 8, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#dbe4ee', shadowColor: '#000000', shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  panelHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 14 },
  countText: { color: '#64748b', fontWeight: '800' },
  smallButton: { backgroundColor: '#eff6ff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  smallButtonText: { color: '#1d4ed8', fontWeight: '800' },
  budgetCurrent: { padding: 14, borderWidth: 1, borderColor: '#dbe4ee', borderRadius: 8, backgroundColor: '#f8fafc' },
  budgetCurrentAmount: { marginTop: 6, color: '#047857', fontSize: 24, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f1f5f9' },
  activeChip: { backgroundColor: '#dbeafe' },
  chipText: { color: '#334155', fontWeight: '800' },
  activeChipText: { color: '#1d4ed8' },
  emptyState: { borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 8, padding: 18, backgroundColor: '#f8fafc' },
  emptyTitle: { color: '#111827', fontWeight: '800' },
  emptyText: { color: '#64748b', marginTop: 4 },
  expenseItem: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 14, marginBottom: 10, backgroundColor: '#ffffff' },
  expenseLeft: { marginBottom: 10 },
  expenseTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  expenseCategory: { color: '#64748b', marginTop: 4 },
  expenseRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  expenseAmount: { flex: 1, fontSize: 16, fontWeight: '800', color: '#111827' },
  editButton: { backgroundColor: '#ecfdf5', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8 },
  editButtonText: { color: '#047857', fontWeight: '800' },
  deleteButton: { backgroundColor: '#fee2e2', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8 },
  deleteButtonText: { color: '#b91c1c', fontWeight: '800' }
});

