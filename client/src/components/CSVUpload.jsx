import React, { useMemo, useState } from 'react';
import '../styles/CSVUpload.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const formatMoney = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
const formatSignedMoney = (value, direction) => `${direction === 'credit' ? '+' : '-'} Rs ${Number(value || 0).toLocaleString('en-IN')}`;

const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const PDFUpload = ({ token, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showInfo, setShowInfo] = useState(false);
  const [preview, setPreview] = useState(null);
  // Map of transaction.index -> boolean (selected)
  const [selected, setSelected] = useState({});
  // Default filter: show all, debits only, or credits only
  const [directionFilter, setDirectionFilter] = useState('all');

  const resetPreview = () => {
    setPreview(null);
    setFile(null);
    setSelected({});
    setDirectionFilter('all');
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
      setFile(selectedFile);
      setPreview(null);
      setSelected({});
      setMessage({ type: '', text: '' });
    } else {
      setMessage({ type: 'error', text: 'Please select a valid PDF file' });
      setFile(null);
    }
  };

  const handlePreview = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file' });
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/expenses/import/pdf/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Preview failed');

      setPreview(data);
      // Pre-select everything that is not a duplicate
      const initial = {};
      data.transactions.forEach((t) => { if (!t.isDuplicate) initial[t.index] = true; });
      setSelected(initial);
      setMessage({
        type: 'success',
        text: `Found ${data.summary.importable} new transaction${data.summary.importable === 1 ? '' : 's'} (${data.summary.debits || 0} debits · ${data.summary.credits || 0} credits) from ${data.upiApp}`
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      setPreview(null);
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
      if (directionFilter === 'all') return true;
      return (t.direction || 'debit') === directionFilter;
    });
  }, [preview, directionFilter]);

  const selectableInView = useMemo(
    () => visibleTransactions.filter((t) => !t.isDuplicate),
    [visibleTransactions]
  );
  const allInViewSelected = selectableInView.length > 0 && selectableInView.every((t) => selected[t.index]);
  const noneInViewSelected = selectableInView.every((t) => !selected[t.index]);

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
  const selectedDebits = useMemo(
    () => preview?.transactions.filter((t) => selected[t.index] && (t.direction || 'debit') === 'debit').length || 0,
    [preview, selected]
  );
  const selectedCredits = useMemo(
    () => preview?.transactions.filter((t) => selected[t.index] && t.direction === 'credit').length || 0,
    [preview, selected]
  );

  const handleConfirm = async () => {
    if (!preview?.sessionId) return;
    if (selectedCount === 0) {
      setMessage({ type: 'error', text: 'Select at least one transaction to import' });
      return;
    }
    setConfirming(true);
    setMessage({ type: '', text: '' });
    const selectedIndices = Object.keys(selected).filter((k) => selected[k]).map((k) => Number(k));

    try {
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
      setMessage({ type: 'success', text: `${data.message} (${breakdown})` });
      resetPreview();
      if (onUploadSuccess) onUploadSuccess(data.expenses);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="csv-upload-container">
      <h3>Import UPI Statement</h3>
      <p className="subtitle">Securely import Google Pay, PhonePe, Paytm, or BHIM PDF statements</p>

      <div className="security-note">
        Your PDF is parsed in memory only. Nothing is saved until you confirm the preview.
      </div>

      {!preview ? (
        <>
          <div className="upload-box">
            <input type="file" accept=".pdf,application/pdf" onChange={handleFileChange} disabled={loading} id="pdf-input" />
            <label htmlFor="pdf-input" className="file-label">
              {file ? `📄 ${file.name}` : 'Click to select PDF file'}
            </label>
          </div>
          <div className="button-group">
            <button onClick={handlePreview} disabled={!file || loading} className="btn-upload">
              {loading ? 'Parsing...' : 'Preview Transactions'}
            </button>
            <button onClick={() => setShowInfo(!showInfo)} className="btn-template" type="button">
              {showInfo ? 'Hide' : 'Show'} Info
            </button>
          </div>
        </>
      ) : (
        <div className="preview-panel">
          <div className="preview-header">
            <div>
              <strong>{preview.upiApp}</strong>
              <p>
                {preview.summary.importable} new · {preview.summary.duplicates} duplicates
                {' '}· {preview.summary.debits || 0} debits · {preview.summary.credits || 0} credits
              </p>
            </div>
            <button className="btn-template" type="button" onClick={resetPreview}>Change File</button>
          </div>

          {/* Direction quick filters + bulk add helpers */}
          <div className="preview-toolbar">
            <div className="direction-tabs">
              <button type="button" className={directionFilter === 'all' ? 'dir-tab active' : 'dir-tab'} onClick={() => setDirectionFilter('all')}>
                All
              </button>
              <button type="button" className={directionFilter === 'debit' ? 'dir-tab active' : 'dir-tab'} onClick={() => setDirectionFilter('debit')}>
                Debits ({preview.summary.debits || 0})
              </button>
              <button type="button" className={directionFilter === 'credit' ? 'dir-tab active' : 'dir-tab'} onClick={() => setDirectionFilter('credit')}>
                Credits ({preview.summary.credits || 0})
              </button>
            </div>
            <div className="bulk-actions">
              <button type="button" className="link-button" onClick={toggleAllInView} disabled={selectableInView.length === 0}>
                {allInViewSelected ? 'Deselect all in view' : 'Select all in view'}
              </button>
              {preview.summary.debits > 0 && (
                <button type="button" className="link-button" onClick={() => selectAllOfKind('debit')}>+ All debits</button>
              )}
              {preview.summary.credits > 0 && (
                <button type="button" className="link-button" onClick={() => selectAllOfKind('credit')}>+ All credits</button>
              )}
              {preview.summary.credits > 0 && (
                <button type="button" className="link-button" onClick={() => deselectAllOfKind('credit')}>− All credits</button>
              )}
            </div>
          </div>

          <div className="preview-list">
            {visibleTransactions.length === 0 && (
              <p className="muted-copy">No transactions match the current filter.</p>
            )}
            {visibleTransactions.map((transaction) => {
              const isCredit = (transaction.direction || 'debit') === 'credit';
              const isSelected = !!selected[transaction.index];
              return (
                <label
                  key={`${transaction.index}-${transaction.title}`}
                  className={`preview-row ${transaction.isDuplicate ? 'duplicate' : ''} ${isSelected ? 'selected' : ''} ${isCredit ? 'credit-row' : 'debit-row'}`}
                >
                  <input
                    type="checkbox"
                    className="row-check"
                    checked={isSelected}
                    onChange={() => toggleOne(transaction.index)}
                    disabled={transaction.isDuplicate}
                  />
                  <div className="preview-main">
                    <div className="preview-top">
                      <strong>{transaction.title}</strong>
                      <span className={`dir-badge ${isCredit ? 'dir-credit' : 'dir-debit'}`}>
                        {isCredit ? '↙ Credit' : '↗ Debit'}
                      </span>
                    </div>
                    <p className="preview-meta">
                      <span className={isCredit ? 'cat-income' : ''}>{transaction.category}</span>
                      {' · '}{formatDate(transaction.date)}
                      {transaction.transactionId ? ` · ${transaction.transactionId}` : ''}
                    </p>
                  </div>
                  <div className="preview-amount">
                    <span className={isCredit ? 'amount-credit' : 'amount-debit'}>{formatSignedMoney(transaction.amount, transaction.direction)}</span>
                    {transaction.isDuplicate && <em className="dup-tag">Duplicate</em>}
                  </div>
                </label>
              );
            })}
          </div>

          <div className="selection-summary">
            Selected: <strong>{selectedCount}</strong> ({selectedDebits} debit{selectedDebits === 1 ? '' : 's'} · {selectedCredits} credit{selectedCredits === 1 ? '' : 's'})
          </div>

          <div className="button-group">
            <button
              onClick={handleConfirm}
              disabled={confirming || selectedCount === 0}
              className="btn-upload"
              type="button"
            >
              {confirming ? 'Importing...' : `Import ${selectedCount} Selected Transaction${selectedCount === 1 ? '' : 's'}`}
            </button>
            <button onClick={resetPreview} className="btn-template" type="button" disabled={confirming}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showInfo && (
        <div className="template-info">
          <p><strong>Security:</strong></p>
          <ul>
            <li>Login required for every import</li>
            <li>PDF validated before parsing</li>
            <li>Preview before anything is saved</li>
            <li>Duplicate UPI transaction IDs are skipped</li>
            <li>Both debits (paid) and credits (received) are detected</li>
          </ul>
          <p style={{ fontSize: '0.85em', marginTop: '10px' }}>
            <strong>How to export:</strong><br />
            1. Open your UPI app<br />
            2. Go to Transactions / History<br />
            3. Export the statement as PDF<br />
            4. Preview here, pick which ones to import, then confirm
          </p>
        </div>
      )}

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.message ? message.message : message.text}
        </div>
      )}
    </div>
  );
};

export default PDFUpload;
