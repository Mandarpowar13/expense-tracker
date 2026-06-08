import React, { useMemo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  ScrollView
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const formatMoney = (amount) => `Rs ${Number(amount || 0).toLocaleString('en-IN')}`;
const formatSignedMoney = (amount, direction) => `${direction === 'credit' ? '+' : '-'} Rs ${Number(amount || 0).toLocaleString('en-IN')}`;

const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const PDFImportMobile = ({ token, onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState({});
  const [filter, setFilter] = useState('all');

  const resetPreview = () => {
    setPreview(null);
    setSelected({});
    setFilter('all');
  };

  const fetchPreview = async (uri, name, mime) => {
    const formData = new FormData();
    formData.append('file', { uri, type: mime || 'application/pdf', name });
    const response = await fetch(`${API_URL}/expenses/import/pdf/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Preview failed');
    return data;
  };

  const handlePickFile = async () => {
    try {
      setLoading(true);
      setPreview(null);
      setSelected({});

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file.name.endsWith('.pdf') && file.mimeType !== 'application/pdf') {
        Alert.alert('Error', 'Please select a valid PDF file');
        return;
      }

      const data = await fetchPreview(file.uri, file.name, file.mimeType);
      setPreview(data);
      const initial = {};
      data.transactions.forEach((t) => { if (!t.isDuplicate) initial[t.index] = true; });
      setSelected(initial);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleOne = (index) => {
    setSelected((s) => ({ ...s, [index]: !s[index] }));
  };

  const visibleTransactions = useMemo(() => {
    if (!preview) return [];
    return preview.transactions.filter((t) => {
      if (filter === 'all') return true;
      return (t.direction || 'debit') === filter;
    });
  }, [preview, filter]);

  const selectableInView = useMemo(
    () => visibleTransactions.filter((t) => !t.isDuplicate),
    [visibleTransactions]
  );
  const allInViewSelected = selectableInView.length > 0 && selectableInView.every((t) => selected[t.index]);

  const toggleAllInView = () => {
    setSelected((s) => {
      const next = { ...s };
      if (allInViewSelected) {
        selectableInView.forEach((t) => { next[t.index] = false; });
      } else {
        selectableInView.forEach((t) => { next[t.index] = true; });
      }
      return next;
    });
  };

  const selectAllOfKind = (kind) => {
    setSelected((s) => {
      const next = { ...s };
      preview.transactions.forEach((t) => {
        if (!t.isDuplicate && (t.direction || 'debit') === kind) next[t.index] = true;
      });
      return next;
    });
  };

  const deselectAllOfKind = (kind) => {
    setSelected((s) => {
      const next = { ...s };
      preview.transactions.forEach((t) => {
        if ((t.direction || 'debit') === kind) next[t.index] = false;
      });
      return next;
    });
  };

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const handleConfirm = async () => {
    if (!preview?.sessionId) return;
    if (selectedCount === 0) {
      Alert.alert('Nothing selected', 'Please select at least one transaction to import.');
      return;
    }
    try {
      setConfirming(true);
      const selectedIndices = Object.keys(selected).filter((k) => selected[k]).map((k) => Number(k));
      const response = await fetch(`${API_URL}/expenses/import/pdf/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: preview.sessionId, selectedIndices })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Import failed');

      const breakdown = `${data.debits || 0} debit${data.debits === 1 ? '' : 's'}${data.credits ? ` · ${data.credits} credit${data.credits === 1 ? '' : 's'}` : ''}`;
      Alert.alert('Imported', `${data.message} (${breakdown})`);
      resetPreview();
      if (onUploadSuccess) onUploadSuccess(data.expenses);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Import UPI Statement</Text>
        <Text style={styles.subtitle}>Preview first, pick which ones to import, then confirm securely</Text>

        {!preview ? (
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handlePickFile}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#667eea" size="small" />
                <Text style={styles.buttonText}>  Parsing PDF...</Text>
              </>
            ) : (
              <Text style={styles.buttonText}>Select PDF File</Text>
            )}
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.previewTitle}>{preview.upiApp}</Text>
                <Text style={styles.previewSummary}>
                  {preview.summary.importable} new · {preview.summary.duplicates} duplicates
                </Text>
                <Text style={styles.previewSummary}>
                  {preview.summary.debits || 0} debits · {preview.summary.credits || 0} credits
                </Text>
              </View>
              <TouchableOpacity onPress={resetPreview} disabled={confirming}>
                <Text style={styles.secondaryButtonText}>Change</Text>
              </TouchableOpacity>
            </View>

            {/* Direction filter tabs */}
            <View style={styles.directionTabs}>
              {[
                { key: 'all', label: `All (${preview.transactions.length})` },
                { key: 'debit', label: `Debits (${preview.summary.debits || 0})` },
                { key: 'credit', label: `Credits (${preview.summary.credits || 0})` }
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.dirTab, filter === opt.key && styles.dirTabActive]}
                  onPress={() => setFilter(opt.key)}
                >
                  <Text style={[styles.dirTabText, filter === opt.key && styles.dirTabTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Bulk action row */}
            <View style={styles.bulkRow}>
              <TouchableOpacity onPress={toggleAllInView} disabled={selectableInView.length === 0}>
                <Text style={styles.bulkText}>{allInViewSelected ? 'Deselect all in view' : 'Select all in view'}</Text>
              </TouchableOpacity>
              {preview.summary.debits > 0 && (
                <TouchableOpacity onPress={() => selectAllOfKind('debit')}>
                  <Text style={styles.bulkText}>+ All debits</Text>
                </TouchableOpacity>
              )}
              {preview.summary.credits > 0 && (
                <TouchableOpacity onPress={() => selectAllOfKind('credit')}>
                  <Text style={styles.bulkText}>+ All credits</Text>
                </TouchableOpacity>
              )}
              {preview.summary.credits > 0 && (
                <TouchableOpacity onPress={() => deselectAllOfKind('credit')}>
                  <Text style={styles.bulkText}>− All credits</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.previewList} nestedScrollEnabled>
              {visibleTransactions.length === 0 && (
                <Text style={styles.mutedCopy}>No transactions match the current filter.</Text>
              )}
              {visibleTransactions.map((transaction) => {
                const isCredit = (transaction.direction || 'debit') === 'credit';
                const isSelected = !!selected[transaction.index];
                return (
                  <TouchableOpacity
                    key={`${transaction.index}-${transaction.title}`}
                    style={[
                      styles.previewRow,
                      isCredit ? styles.creditRow : styles.debitRow,
                      isSelected && styles.previewRowSelected,
                      transaction.isDuplicate && styles.duplicateRow
                    ]}
                    onPress={() => !transaction.isDuplicate && toggleOne(transaction.index)}
                    disabled={transaction.isDuplicate}
                  >
                    <View style={styles.checkboxWrap}>
                      <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                        {isSelected && <Text style={styles.checkboxTick}>✓</Text>}
                      </View>
                    </View>
                    <View style={styles.previewMain}>
                      <View style={styles.previewTop}>
                        <Text style={styles.previewName} numberOfLines={1}>{transaction.title}</Text>
                        <View style={[styles.dirBadge, isCredit ? styles.dirBadgeCredit : styles.dirBadgeDebit]}>
                          <Text style={styles.dirBadgeText}>{isCredit ? 'CREDIT' : 'DEBIT'}</Text>
                        </View>
                      </View>
                      <Text style={[styles.previewMeta, isCredit && styles.catIncome]}>
                        {transaction.category} · {formatDate(transaction.date)}
                        {transaction.transactionId ? ` · ${transaction.transactionId}` : ''}
                      </Text>
                      {transaction.isDuplicate && <Text style={styles.dupTag}>Already imported</Text>}
                    </View>
                    <View>
                      <Text style={[styles.previewAmount, isCredit ? styles.amountCredit : styles.amountDebit]}>
                        {formatSignedMoney(transaction.amount, transaction.direction)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.selectionSummary}>
              <Text style={styles.selectionSummaryText}>
                Selected: {selectedCount} of {preview.transactions.length}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.button, (confirming || selectedCount === 0) && styles.buttonDisabled]}
              onPress={handleConfirm}
              disabled={confirming || selectedCount === 0}
            >
              <Text style={styles.buttonText}>
                {confirming ? 'Importing...' : `Import ${selectedCount} Selected Transaction${selectedCount === 1 ? '' : 's'}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={resetPreview} disabled={confirming}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Security</Text>
          <Text style={styles.infoText}>• Login required</Text>
          <Text style={styles.infoText}>• PDF validated before parsing</Text>
          <Text style={styles.infoText}>• Preview before saving</Text>
          <Text style={styles.infoText}>• Duplicate UPI IDs skipped</Text>
          <Text style={styles.infoText}>• Both debits and credits are detected</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 0, marginVertical: 12 },
  card: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5
  },
  title: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.9)', marginBottom: 16 },
  button: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 12
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#667eea', fontSize: 14, fontWeight: '600' },
  secondaryButton: { alignItems: 'center', marginBottom: 12 },
  secondaryButtonText: { color: '#fff', fontWeight: '600' },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  previewTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  previewSummary: { color: 'rgba(255, 255, 255, 0.9)', marginTop: 2, fontSize: 12 },
  directionTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 999,
    padding: 3,
    marginBottom: 10
  },
  dirTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center'
  },
  dirTabActive: { backgroundColor: 'rgba(255,255,255,0.95)' },
  dirTabText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },
  dirTabTextActive: { color: '#4f46e5' },
  bulkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  bulkText: { color: '#fff', fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' },
  previewList: { maxHeight: 300, marginBottom: 12 },
  previewRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  creditRow: { borderLeftWidth: 3, borderLeftColor: '#10b981' },
  debitRow: { borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  previewRowSelected: { backgroundColor: 'rgba(255, 255, 255, 0.28)' },
  duplicateRow: { opacity: 0.6 },
  checkboxWrap: { paddingHorizontal: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  checkboxTick: { color: '#fff', fontWeight: '900', fontSize: 14 },
  previewMain: { flex: 1, minWidth: 0 },
  previewTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  previewName: { color: '#fff', fontWeight: '700' },
  dirBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  dirBadgeDebit: { backgroundColor: 'rgba(239,68,68,0.4)' },
  dirBadgeCredit: { backgroundColor: 'rgba(16,185,129,0.4)' },
  dirBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  previewMeta: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 11, marginTop: 4 },
  catIncome: { color: '#bbf7d0', fontWeight: '700' },
  dupTag: { color: '#fde68a', fontSize: 10, fontWeight: '700', marginTop: 2 },
  previewAmount: { fontSize: 13, fontWeight: '800' },
  amountDebit: { color: '#fecaca' },
  amountCredit: { color: '#bbf7d0' },
  mutedCopy: { color: 'rgba(255,255,255,0.85)', textAlign: 'center', padding: 14, fontSize: 12 },
  selectionSummary: { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 8, padding: 8, marginBottom: 10, alignItems: 'center' },
  selectionSummaryText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  infoBox: { backgroundColor: 'rgba(0, 0, 0, 0.15)', borderRadius: 8, padding: 12, marginTop: 6 },
  infoTitle: { color: '#fff', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  infoText: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 12, marginBottom: 4 }
});

export default PDFImportMobile;