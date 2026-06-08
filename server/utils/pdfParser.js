const PDFParser = require('pdf2json');
const { sanitizeCategory } = require('./importSecurity');

const VALID_UPI_APPS = ['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Other'];

const detectUpiApp = (text) => {
  const sample = text.slice(0, 4000).toLowerCase();

  if (sample.includes('phonepe')) return 'PhonePe';
  if (sample.includes('paytm')) return 'Paytm';
  if (sample.includes('bhim')) return 'BHIM';
  if (sample.includes('google pay') || sample.includes('gpay') || sample.includes('tez')) {
    return 'Google Pay';
  }

  return 'Other';
};

const categorizeTransaction = (description) => {
  const desc = description.toLowerCase();

  if (desc.match(/food|restaurant|cafe|grocery|store|market|pizza|burger|meal|lunch|dinner|zomato|swiggy/)) {
    return 'Food';
  }
  if (desc.match(/uber|ola|taxi|transport|metro|bus|auto|travel|flight|hotel|petrol|fuel/)) {
    return 'Travel';
  }
  if (desc.match(/electric|water|gas|utility|bill|isp|phone|internet|recharge|jio|airtel/)) {
    return 'Bills';
  }
  if (desc.match(/shopping|mall|cloth|dress|shoes|apparel|amazon|flipkart|myntra/)) {
    return 'Shopping';
  }

  return 'Other';
};

const parseDate = (dateStr, timeStr) => {
  try {
    const base = new Date(dateStr);
    if (Number.isNaN(base.getTime())) return null;

    if (timeStr) {
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (match) {
        let hours = Number(match[1]);
        const minutes = Number(match[2]);
        const meridiem = match[3].toUpperCase();

        if (meridiem === 'PM' && hours < 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;

        base.setHours(hours, minutes, 0, 0);
      }
    }

    return base;
  } catch (error) {
    return null;
  }
};

const extractTransactionId = (text) => {
  const patterns = [
    /Transaction\s*ID[:\s]+([A-Z0-9]+)/i,
    /UPI\s*Ref(?:erence)?\s*(?:No\.?|ID)?[:\s]+([A-Z0-9]+)/i,
    /UTR[:\s]+([A-Z0-9]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
};

const extractTransactionData = (text, upiApp) => {
  try {
    // Use specific phrases requiring a name after the keyword.
    // Bare "Debit"/"Credit" words appear as column headers in PDFs and must NOT
    // be used alone — they would misclassify every transaction in the block.
    const isPaid     = /(?:Paid\s+to|Sent\s+to|Payment\s+to|Debited\s+to)\s+\S/i.test(text);
    const isReceived = /(?:Received\s+from|Money\s+received\s+from|Credited\s+(?:by|from))\s+\S/i.test(text);

    // Fallback: use bare Debit/Credit only when exactly ONE of them appears
    // (header rows that list both "Debit Credit" are skipped automatically).
    const hasBareDebit  = /\bDebit\b/i.test(text);
    const hasBareCredit = /\bCredit\b/i.test(text);
    const useFallback   = !isPaid && !isReceived && (hasBareDebit !== hasBareCredit);

    if (!isPaid && !isReceived && !useFallback) {
      return null;
    }

    const direction =
      isReceived || (!isPaid && useFallback && hasBareCredit) ? 'credit' : 'debit';

    const dateTimePattern = /(\d{1,2}\s+\w{3,9},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*(\d{1,2}:\d{2}\s*(?:AM|PM))?/i;
    const amountPattern = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)/i;

    const dateMatch = text.match(dateTimePattern);
    if (!dateMatch) return null;

    const transactionDate = parseDate(dateMatch[1], dateMatch[2]);
    if (!transactionDate) return null;

    const merchantPatterns = direction === 'credit'
      ? [
          /(?:Received from|Credit from|Money received from)\s+(.+?)(?:\s+UPI|\s+Transaction|\s+₹|\s+Rs)/i,
          /(?:From)\s*[:\-]?\s*(.+?)(?:\s+UPI|\s+₹|\s+Rs)/i
        ]
      : [
          /(?:Paid to|Sent to|Payment to|Debit to)\s+(.+?)(?:\s+UPI|\s+Transaction|\s+₹|\s+Rs)/i,
          /(?:Merchant|To)\s*[:\-]?\s*(.+?)(?:\s+UPI|\s+₹|\s+Rs)/i
        ];

    let merchant = direction === 'credit' ? 'Received' : 'Transaction';
    for (const pattern of merchantPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        merchant = match[1].trim();
        break;
      }
    }

    merchant = merchant
      .replace(/\s{2,}/g, ' ')
      .split(/Transaction ID|UPI Ref|UTR/i)[0]
      .trim();

    const amountMatch = text.match(amountPattern);
    if (!amountMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (!amount || amount <= 0) return null;

    const transactionId = extractTransactionId(text);
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
      transactionTime: dateMatch[2] ? transactionDate : null
    };
  } catch (error) {
    return null;
  }
};

const splitTransactionBlocks = (text) => {
  const patterns = [
    /(?=\d{1,2}\s+\w{3,9},?\s+\d{4})/,
    /(?=\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/
  ];

  for (const pattern of patterns) {
    const blocks = text.split(pattern).filter((block) => block.trim().length >= 20);
    if (blocks.length > 1) return blocks;
  }

  return [text];
};

const parsePDFTransactions = async (pdfBuffer) => {
  return new Promise((resolve, reject) => {
    try {
      const pdfParser = new PDFParser();

      pdfParser.on('pdfParser_dataError', (errData) => {
        reject(new Error('Unable to read PDF file'));
      });

      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        try {
          let text = '';

          if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
            pdfData.Pages.forEach((page) => {
              if (page.Texts && Array.isArray(page.Texts)) {
                page.Texts.forEach((textItem) => {
                  try {
                    text += `${decodeURIComponent(textItem.R[0].T)} `;
                  } catch (error) {
                    // Skip malformed PDF text nodes
                  }
                });
              }
            });
          }

          if (!text || text.length < 50) {
            reject(new Error('Could not extract sufficient text from PDF'));
            return;
          }

          const upiApp = detectUpiApp(text);
          const transactionBlocks = splitTransactionBlocks(text);
          const seen = new Set();
          const transactions = [];

          transactionBlocks.forEach((block) => {
            const transaction = extractTransactionData(block, upiApp);
            if (!transaction) return;

            const dedupeKey = transaction.transactionId
              || `${transaction.direction}|${transaction.title}|${transaction.amount}|${transaction.date.toISOString()}`;

            if (seen.has(dedupeKey)) return;
            seen.add(dedupeKey);
            transactions.push(transaction);
          });

          resolve({ transactions, upiApp });
        } catch (error) {
          reject(new Error('Unable to parse transactions from PDF'));
        }
      });

      pdfParser.parseBuffer(pdfBuffer);
    } catch (error) {
      reject(new Error('Unable to read PDF file'));
    }
  });
};

module.exports = {
  parsePDFTransactions,
  extractTransactionData,
  parseDate,
  categorizeTransaction,
  detectUpiApp
};
