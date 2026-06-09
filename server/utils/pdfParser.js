// PDF parser for UPI statements (PhonePe, Google Pay, Paytm, BHIM).
//
// We use Mozilla's pdfjs-dist (instead of pdf2json) because pdf2json fails
// to decode the custom Type3 fonts that PhonePe and some other UPI apps use
// for their labels — every word comes out as garbage like "G a t e" for
// "Date". pdfjs-dist (the same engine that powers Firefox's PDF viewer)
// properly decodes these custom fonts.

const { sanitizeCategory } = require('./importSecurity');

const VALID_UPI_APPS = ['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Other'];

// Lazy-load pdfjs-dist so serverless cold-starts don't pay for it on non-PDF routes.
let pdfjsLib = null;
const getPdfjs = async () => {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsLib;
};

const detectUpiApp = (text) => {
  const sample = (text || '').slice(0, 8000).toLowerCase();

  if (sample.includes('phonepe')) return 'PhonePe';
  if (sample.includes('paytm')) return 'Paytm';
  if (sample.includes('bhim')) return 'BHIM';
  if (sample.includes('google pay') || sample.includes('gpay') || sample.includes('tez')) {
    return 'Google Pay';
  }

  return 'Other';
};

const categorizeTransaction = (description) => {
  const desc = (description || '').toLowerCase();

  if (desc.match(/food|restaurant|cafe|grocery|store|market|pizza|burger|meal|lunch|dinner|zomato|swiggy|chicken|sweet|bakery|hotel|wines|corner/)) {
    return 'Food';
  }
  if (desc.match(/uber|ola|taxi|transport|metro|bus|auto|travel|flight|petrol|fuel|auto centre/)) {
    return 'Travel';
  }
  if (desc.match(/electric|water|gas|utility|bill|isp|phone|internet|recharge|jio|airtel|zee5|spotify|crunchyroll/)) {
    return 'Bills';
  }
  if (desc.match(/shopping|mall|cloth|dress|shoes|apparel|amazon|flipkart|myntra|fashion|retail/)) {
    return 'Shopping';
  }

  return 'Other';
};

const parseDate = (dateStr, timeStr) => {
  try {
    if (!dateStr) return null;
    const base = new Date(dateStr);
    if (Number.isNaN(base.getTime())) return null;

    if (timeStr) {
      // Time formats we may see: "12:05 am", "12:05 AM", "12:05am", "00:05"
      const cleaned = timeStr.replace(/\s+/g, ' ').trim();
      const match12 = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
      if (match12) {
        let hours = Number(match12[1]);
        const minutes = Number(match12[2]);
        const meridiem = match12[3].toUpperCase();
        if (meridiem === 'PM' && hours < 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
        base.setHours(hours, minutes, 0, 0);
      } else if (match24) {
        base.setHours(Number(match24[1]), Number(match24[2]), 0, 0);
      }
    }

    return base;
  } catch (error) {
    return null;
  }
};

const extractTransactionId = (text) => {
  if (!text) return null;
  const patterns = [
    /Transaction\s*ID[:\s]+([A-Z0-9]+)/i,
    /UPI\s*Ref(?:erence)?\s*(?:No\.?|ID)?[:\s]+([A-Z0-9]+)/i,
    /UTR(?:\s*No\.?)?[:\s]+([A-Z0-9]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
};

// Extract a clean, readable text string from pdfjs-dist's textContent.items.
// We rebuild a string per page that preserves natural word spacing.
const itemsToText = (items) => {
  if (!Array.isArray(items) || items.length === 0) return '';

  // Group items by their Y coordinate (each line of the PDF is a row).
  const rows = [];
  for (const item of items) {
    if (!item || !item.str) continue;
    const transform = item.transform || [];
    const y = Math.round(transform[5] || 0);
    const x = transform[4] || 0;
    const text = item.str;
    if (!text.trim()) continue;

    let row = rows.find((r) => Math.abs(r.y - y) <= 2);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, text });
  }

  // Sort rows top-to-bottom (higher y in pdfjs means further up the page).
  rows.sort((a, b) => b.y - a.y);
  // Within each row, sort left-to-right.
  rows.forEach((r) => r.parts.sort((a, b) => a.x - b.x));

  // Reassemble into readable text. Use a single space between parts in the
  // same row when the gap is significant, otherwise join directly.
  return rows
    .map((r) => {
      let line = '';
      let prevEnd = -Infinity;
      for (const p of r.parts) {
        if (line === '') {
          line = p.text;
        } else {
          // Approximate character width: assume ~5px per char; if the gap is
          // wider than ~2 chars, insert a space.
          const gap = p.x - prevEnd;
          if (gap > 8) line += ' ';
          line += p.text;
        }
        prevEnd = p.x + p.text.length * 5;
      }
      return line;
    })
    .join('\n');
};

const extractTextFromPDF = async (pdfBuffer) => {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjs.getDocument({
    data,
    // PhonePe PDFs use a custom Type3 font that pdfjs can decode on the fly
    // but only when it lazily initializes the standard font data.
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0
  });
  const pdf = await loadingTask.promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(itemsToText(content.items));
  }
  return pages.join('\n\n');
};

// ---- Transaction extraction -------------------------------------------------

// Many UPI statements repeat the column header "Date Transaction Details Type
// Amount" on every page. We strip those header rows so they don't get matched
// as transactions.
const stripHeaderRows = (text) => {
  return text
    .split('\n')
    .filter((line) => !/^\s*(date|transaction\s+details|type|amount)\s*$/i.test(line.trim()))
    .join('\n');
};

// Split the full text into per-transaction blocks. PhonePe statements put the
// date on the SAME line as the merchant/amount (e.g. "Jun 05, 2026  Paid to
// PAYWITHRING  DEBIT  Γé╣4,777"). So we look for a date pattern anywhere in
// the line, then take everything from that point until the next date or the
// next page header.
const splitTransactionBlocks = (text) => {
  // Match the date in any of these forms:
  //   "Jun 05, 2026", "Jun 5 2026", "5 Jun 2026", "5/6/2026", "5-6-26"
  const dateRe = /\b(?:\d{1,2}\s+[A-Za-z]{3,9}\s*,?\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2}\s*,?\s+\d{2,4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/;
  const lines = text.split('\n');
  const blocks = [];
  let current = null;

  const isHeaderLine = (line) =>
    /^\s*(Date|Transaction\s+Details|Type|Amount|Page\s+\d+\s+of\s+\d+|This\s+is\s+a\s+system|This\s+is\s+an\s+automatically|Disclaimer\s*:|PhonePe\s+in\s+case|For\s+any\s+queries|through\s+SMS|Customer\(?s?\)?\s+are\s+requested)/i.test(
      line.trim()
    );

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isHeaderLine(line)) continue;

    if (dateRe.test(line)) {
      // Start a new block at the date occurrence (drop any preface on the
      // same line before the date).
      if (current && current.length) blocks.push(current.join('\n'));
      const dateMatch = line.match(dateRe);
      const dateStart = dateMatch.index;
      const dateStr = dateMatch[0];
      const afterDate = line.slice(dateStart + dateStr.length).trim();
      // The "time" (e.g. "12:05 am") may be appended to the same date line.
      const timeMatch = afterDate.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      if (timeMatch) {
        current = [dateStr, timeMatch[1], afterDate.slice(timeMatch[0].length).trim()];
      } else {
        current = [dateStr, afterDate];
      }
    } else if (current) {
      current.push(line);
    }
  }
  if (current && current.length) blocks.push(current.join('\n'));

  return blocks.filter((b) => b.length >= 30);
};

const extractTransactionData = (block, upiApp) => {
  if (!block) return null;

  const lines = block
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  // Line 0 is the date (e.g. "Jun 05, 2026"). Line 1 is usually the time
  // ("12:05 am"). The remaining lines describe the transaction.
  const dateLine = lines[0];
  const timeLine = lines[1] && /\d{1,2}:\d{2}/.test(lines[1]) ? lines[1] : null;
  const body = timeLine ? lines.slice(2) : lines.slice(1);

  // Re-join body to a single string for regex matching.
  const bodyText = body.join(' ').replace(/\s+/g, ' ').trim();

  // Direction detection
  // PhonePe format: "DEBIT ₹4,777 Paid to PAYWITHRING ..."
  //                "DEBIT ₹49  Mobile recharged 7020833202 ..."
  //                "DEBIT ₹1 Payment to Crunchyroll ..."
  const hasDebit = /\bDEBIT\b/i.test(bodyText);
  const hasCredit = /\bCREDIT\b/i.test(bodyText);
  const isPaid = /(?:Paid\s+to|Payment\s+to|Sent\s+to)\s+\S/i.test(bodyText);
  const isReceived = /(?:Received\s+from|Money\s+received\s+from|Credit\s+from)\s+\S/i.test(bodyText);

  let direction = null;
  if (isReceived || hasCredit) direction = 'credit';
  else if (isPaid || hasDebit) direction = 'debit';
  if (!direction) return null;

  // Amount
  const amountMatch = bodyText.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  // Recipient / merchant
  // Priority of patterns:
  // 1) "Mobile recharged <number>" — special PhonePe format for recharges
  // 2) "Paid to <name>"
  // 3) "Payment to <name>"
  // 4) "Sent to <name>"
  // 5) "Received from <name>"
  let merchant = null;

  // Strip the leading date/time portion of the same line (PhonePe puts the
  // date, merchant, DEBIT, amount and time all on the same row).
  const afterDateAndTime = bodyText
    .replace(/^\d{1,2}:\d{2}\s*(?:AM|PM)\s*/i, '')
    .replace(/^(?:DEBIT|CREDIT)\s*/i, '')
    .replace(/^(?:Γé╣|Γé£|₹|Rs\.?|INR)\s*[\d,]+(?:\.\d{1,2})?\s*/i, '')
    .replace(/^\d{1,2}:\d{2}\s*(?:AM|PM)\s*/i, '')
    .trim();

  const rechargeMatch = afterDateAndTime.match(/Mobile\s+recharged\s+(\d{6,15})/i);
  if (rechargeMatch) {
    merchant = `Mobile Recharge ${rechargeMatch[1]}`;
  } else if (isPaid) {
    const m = afterDateAndTime.match(/(?:Paid\s+to|Payment\s+to|Sent\s+to)\s+(.+?)(?:\s+Transaction\s+ID|\s+UPI\s+Ref|\s+UTR|\s+Jio\s+Prepaid|\s+Paid\s+by|$)/i);
    if (m) merchant = m[1].trim();
  } else if (isReceived) {
    const m = afterDateAndTime.match(/(?:Received\s+from|Credit\s+from|Money\s+received\s+from)\s+(.+?)(?:\s+Transaction\s+ID|\s+UPI\s+Ref|\s+UTR|\s+Paid\s+by|$)/i);
    if (m) merchant = m[1].trim();
  }

  if (!merchant) {
    merchant = direction === 'credit' ? 'Received' : 'UPI Transaction';
  }

  // Clean the merchant: collapse whitespace, drop trailing punctuation,
  // strip the DEBIT/amount/time artefacts that may have leaked in.
  merchant = merchant
    .replace(/\s{2,}/g, ' ')
    .replace(/[.,;:\-]+\s*$/g, '')
    .replace(/\s+(?:DEBIT|CREDIT)\s+(?:Γé╣|Γé£|₹|Rs\.?|INR)\s*[\d,]+(?:\.\d{1,2})?.*$/i, '')
    .replace(/\s+\d{1,2}:\d{2}\s*(?:AM|PM)\s*$/i, '')
    .trim();

  const transactionDate = parseDate(dateLine, timeLine);
  if (!transactionDate) return null;

  const transactionId = extractTransactionId(bodyText);
  const category = direction === 'credit' ? 'Income' : sanitizeCategory(categorizeTransaction(merchant));

  return {
    title: merchant,
    amount,
    category,
    date: transactionDate,
    recipient: merchant,
    upiApp: VALID_UPI_APPS.includes(upiApp) ? upiApp : 'Other',
    paymentMethod: 'UPI',
    direction,
    transactionId,
    transactionTime: timeLine || null
  };
};

const parsePDFTransactions = async (pdfBuffer) => {
  const fullText = await extractTextFromPDF(pdfBuffer);
  if (!fullText || fullText.length < 30) {
    throw new Error('Could not extract text from PDF (the file may be empty or scanned).');
  }

  const upiApp = detectUpiApp(fullText);
  const cleaned = stripHeaderRows(fullText);
  const blocks = splitTransactionBlocks(cleaned);

  const seen = new Set();
  const transactions = [];

  for (const block of blocks) {
    const tx = extractTransactionData(block, upiApp);
    if (!tx) continue;
    const dedupeKey = tx.transactionId
      || `${tx.direction}|${tx.title}|${tx.amount}|${tx.date.toISOString()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    transactions.push(tx);
  }

  return { transactions, upiApp, rawTextLength: fullText.length };
};

module.exports = {
  parsePDFTransactions,
  extractTransactionData,
  parseDate,
  categorizeTransaction,
  detectUpiApp
};
