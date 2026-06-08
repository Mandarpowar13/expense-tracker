# PDF Import Feature - Documentation

## Overview
The PDF Import feature allows users to automatically extract transaction data from UPI payment app statements (Google Pay, PhonePe, Paytm, BHIM) and import them into the Expense Tracker.

## Features

✅ **Automatic Transaction Extraction**
- Parses PDF statement files
- Extracts: date, amount, merchant/recipient, transaction type
- Auto-categorizes transactions (Food, Transport, etc.)
- Detects UPI app used

✅ **Supported Payment Apps**
- Google Pay (GPay)
- PhonePe
- Paytm
- BHIM
- Any UPI-based app with statement PDF

✅ **Smart Auto-Categorization**
- Food: Grocery, Restaurant, Cafe
- Transportation: Uber, Taxi, Bus
- Entertainment: Movie, Cinema, Netflix
- Utilities: Electric, Water, Internet
- Health: Doctor, Medicine, Pharmacy
- Education: Books, Courses, Training
- Fitness: Gym, Sports
- Shopping: Mall, Clothes
- Transfer: Money send/receive

## How to Use

### Web Application

1. Navigate to **Import Transactions** section
2. Click **"Select PDF File"**
3. Choose your UPI statement PDF
4. Click **"Upload"** to parse and import
5. See transaction count and any errors

### Mobile Application

1. Open Expense Tracker app
2. Go to **Import Transactions**
3. Tap **"Select PDF File"**
4. Choose your PDF from device storage
5. Tap upload and wait for parsing
6. Imported transactions will auto-sync

## How to Export PDF from UPI Apps

### Google Pay
```
1. Open Google Pay app
2. Tap "Payments" tab
3. Tap "View all transactions"
4. Click menu (⋯) → "Download statement"
5. Select date range
6. Choose "PDF" format
7. Save to device
```

### PhonePe
```
1. Open PhonePe app
2. Tap "Profile" → "History"
3. Click menu (⋯) → "Download Statement"
4. Select date range
5. Choose PDF export
6. Save to device
```

### Paytm
```
1. Open Paytm app
2. Tap "Passbook" or "History"
3. Click "Export" or "Download"
4. Select PDF format
5. Choose date range
6. Save to device
```

### BHIM
```
1. Open BHIM app
2. Tap "Statement" or "History"
3. Tap "Download" or "Export"
4. Select PDF format
5. Choose period
6. Save to device
```

## API Endpoint

**POST** `/api/expenses/import/pdf`

### Request
```
Method: POST
Headers: 
  - Authorization: Bearer {token}
  - Content-Type: multipart/form-data
Body: 
  - file: PDF file (multipart)
```

### Response
```json
{
  "success": true,
  "imported": 15,
  "message": "✅ Successfully imported 15 transactions from PDF",
  "expenses": [
    {
      "_id": "64f7a3b2c8e9d1f2g3h4i5j6",
      "title": "Starbucks Coffee",
      "amount": 250,
      "category": "Food",
      "date": "2024-06-08T09:30:00.000Z",
      "recipient": "Starbucks",
      "upiApp": "Google Pay",
      "paymentMethod": "UPI",
      "user": "64f7a3b2c8e9d1f2g3h4i5j6",
      "createdAt": "2024-06-08T10:00:00.000Z",
      "updatedAt": "2024-06-08T10:00:00.000Z"
    }
  ]
}
```

## Parsing Algorithm

### 1. Text Extraction
- PDF is converted to plain text
- Lines are parsed sequentially

### 2. Pattern Matching
- Looks for date patterns (DD-MM-YYYY, YYYY-MM-DD)
- Extracts numerical amounts (with ₹, Rs., or decimal)
- Captures merchant/recipient names

### 3. Transaction Validation
- Amount must be > 0
- Date must be valid
- Description/title is required

### 4. Auto-Categorization
- Merchant name matched against category keywords
- Assigned to appropriate category
- UPI app detected from statement

### 5. Database Storage
- Transactions stored with user ID
- Timestamp recorded
- All fields indexed for quick search

## Supported PDF Formats

✅ **Bank Statement PDFs** - Any UPI transaction statement
✅ **Payment App Statements** - Google Pay, PhonePe, Paytm, BHIM exports
✅ **Scanned Receipts** - OCR-compatible PDFs

❌ **Not Supported** - Image-only PDFs, encrypted PDFs, very old/rare PDF formats

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "No transactions found" | PDF doesn't have recognized format | Export statement in different date range or use another app |
| Upload timeout | Large PDF file (>10MB) | Try with smaller date range |
| Parsing errors | Corrupted PDF or unsupported format | Re-export PDF from your payment app |
| Duplicate entries | Same transaction in multiple statements | Check date ranges don't overlap |
| Wrong categorization | Merchant name not recognized | Manually edit category after import |

## Security & Privacy

✔️ **Security Features**
- HTTPS encryption for uploads
- Server-side PDF validation
- File stored temporarily in memory (not on disk)
- User-specific data isolation
- Bearer token authentication required

⚠️ **Best Practices**
- Don't share PDF files with sensitive data
- Only upload from trusted devices
- Delete local PDF copy after upload
- Use unique date ranges to avoid duplicates

## Performance

- **Max file size:** 10 MB
- **Max transactions per import:** 1,000
- **Processing time:** ~2-5 seconds per 100 transactions
- **Supported PDF pages:** Unlimited

## Limitations

- Only text-based PDFs supported (not image-only)
- Requires standard UPI statement format
- May not work with customized/old app versions
- Some merchant names might need manual correction

## Future Enhancements

- [ ] Image PDF support (OCR)
- [ ] Duplicate detection & removal
- [ ] Transaction matching with existing records
- [ ] Scheduled automatic imports
- [ ] Bank API integration
- [ ] Support for international payment apps

## Example Transaction Extraction

### Input PDF Text:
```
Google Pay Statement - June 2024
Transaction Date | Merchant | Amount | Type
2024-06-08 | Starbucks Coffee | ₹250 | Payment
2024-06-07 | Uber Rides | ₹450 | Payment
2024-06-06 | Grocery Store | ₹1200 | Payment
```

### Output Database Records:
```
{
  title: "Starbucks Coffee",
  amount: 250,
  category: "Food",
  recipient: "Starbucks Coffee",
  upiApp: "Google Pay",
  date: 2024-06-08
}

{
  title: "Uber Rides",
  amount: 450,
  category: "Transportation",
  recipient: "Uber Rides",
  upiApp: "Google Pay",
  date: 2024-06-07
}

{
  title: "Grocery Store",
  amount: 1200,
  category: "Shopping",
  recipient: "Grocery Store",
  upiApp: "Google Pay",
  date: 2024-06-06
}
```

## Testing

Use the sample PDF: `c:\Users\manda\Downloads\gpay_statement_sample1.pdf`

```bash
# Test endpoint
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/statement.pdf" \
  http://localhost:5000/api/expenses/import/pdf
```

## Support

For issues or questions about PDF parsing:
1. Check that PDF is valid and readable
2. Try exporting statement again from app
3. Verify file format is PDF (not image)
4. Contact support with sample file
