# CSV Import Feature - Documentation

## Overview
The CSV Import feature allows users to bulk import UPI transaction data from various payment apps (Google Pay, PhonePe, Paytm, BHIM, etc.) directly into the Expense Tracker database.

## How to Use

### Web Application
1. Navigate to the **Import Transactions** section
2. Click **"Show Template"** to see the required CSV format
3. Click **"Download Template"** to get a sample CSV file
4. Edit the template with your transaction data
5. Click **"Select CSV File"** to upload
6. Click **"Upload"** to import

### Mobile Application
1. Open the app and navigate to **Import Transactions**
2. Tap **"Select CSV File"**
3. Choose your CSV file from device storage
4. Confirm upload
5. See import status with success/error count

## CSV Format

### Required Columns
- **title**: Name/description of the transaction (e.g., "Groceries", "Restaurant")
- **amount**: Transaction amount as a number (e.g., 500, 100.50)
- **category**: Expense category (e.g., "Food", "Transportation", "Utilities")

### Optional Columns
- **date**: Transaction date (format: YYYY-MM-DD, defaults to today)
- **recipient**: Merchant/recipient name (e.g., "Starbucks", "Uber")
- **upiApp**: Payment app used (Google Pay, PhonePe, Paytm, BHIM, Other)

### Example CSV

```csv
title,amount,category,date,recipient,upiApp
Groceries,500,Food,2024-06-08,Market,Google Pay
Coffee,100,Food,2024-06-08,Cafe,PhonePe
Electricity Bill,2000,Utilities,2024-06-05,Power Company,Bank Transfer
Movie Tickets,800,Entertainment,2024-06-07,Cinema,Google Pay
```

## How to Get CSV from Payment Apps

### Google Pay
1. Open Google Pay → Transactions tab
2. Select transactions → Share/Export
3. Save as CSV

### PhonePe
1. Open PhonePe → History
2. Tap Menu → Download Statement
3. Choose Date Range & Export as CSV

### Paytm
1. Open Paytm → Profile → All Payments
2. Download Statement (CSV format)

### BHIM
1. Open BHIM → Statement
2. Select period → Download/Export

### Manual Entry
If your app doesn't support CSV export, you can:
- Create a spreadsheet with transaction data
- Save as CSV file
- Upload using this feature

## Validation Rules

✅ **Valid:**
- Amount must be greater than 0
- Date format: YYYY-MM-DD or MM/DD/YYYY
- Required fields are not empty
- CSV file with valid encoding

❌ **Invalid:**
- Missing required fields (title, amount, category)
- Negative or zero amounts
- Invalid date format
- Non-CSV files
- Empty rows

## Security & Privacy

✔️ **Security Features:**
- HTTPS encryption for file upload
- Authentication required (Bearer token)
- File validated on server-side
- CSV stored temporarily in memory (not on disk)
- User can only import to their own account

⚠️ **Best Practices:**
- Remove sensitive data (full card numbers, passwords)
- Only share CSV with authorized devices
- Don't leave CSV files on shared devices
- Delete local copy after uploading

## API Endpoint

**POST** `/api/expenses/import/csv`

### Request
- Method: POST
- Headers: `Authorization: Bearer {token}`
- Body: Form-data with `file` (CSV file)

### Response
```json
{
  "success": true,
  "imported": 10,
  "failed": 2,
  "expenses": [...],
  "errors": [
    { "row": 5, "error": "Invalid amount" },
    { "row": 8, "error": "Missing required fields" }
  ]
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Only CSV files allowed" | Ensure file is saved as .csv format |
| "Missing required fields" | Check title, amount, category are present |
| "Invalid amount" | Amount must be a number > 0 |
| Upload timeout | Try with smaller files (< 5MB) |
| Duplicate entries | Check date & recipient combination |

## Sample CSV Template

Download from: `/server/templates/sample_expenses.csv`

## Performance

- **Max file size:** 5 MB
- **Max records per upload:** 10,000
- **Processing time:** ~1-2 seconds for 1,000 records

## Future Enhancements

- [ ] Auto-categorization using AI
- [ ] Duplicate detection & merging
- [ ] Bank API integration (Open Banking)
- [ ] Automatic SMS parsing (Android)
- [ ] Multi-file batch import
- [ ] Scheduled automatic sync
