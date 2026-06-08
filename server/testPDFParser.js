const fs = require('fs');
const path = require('path');
const { parsePDFTransactions } = require('./utils/pdfParser');

// Test PDF parsing
async function testPDFParsing() {
  try {
    console.log('📋 Testing PDF Parser with Sample File...\n');

    // Read sample PDF
    const pdfPath = 'c:\\Users\\manda\\Downloads\\gpay_statement_sample1.pdf';
    
    if (!fs.existsSync(pdfPath)) {
      console.error(`❌ PDF file not found: ${pdfPath}`);
      return;
    }

    console.log(`📁 Reading PDF: ${pdfPath}`);
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`📊 File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);

    // Parse transactions
    console.log('⏳ Parsing transactions...\n');
    const transactions = await parsePDFTransactions(pdfBuffer);

    if (transactions.length === 0) {
      console.warn('⚠️  No transactions found in PDF');
      return;
    }

    console.log(`✅ Found ${transactions.length} transactions\n`);
    console.log('─'.repeat(80));

    // Display each transaction
    transactions.forEach((tx, index) => {
      console.log(`\n📌 Transaction ${index + 1}:`);
      console.log(`   Title:        ${tx.title}`);
      console.log(`   Amount:       ₹${tx.amount}`);
      console.log(`   Category:     ${tx.category}`);
      console.log(`   Recipient:    ${tx.recipient || 'N/A'}`);
      console.log(`   UPI App:      ${tx.upiApp || 'N/A'}`);
      console.log(`   Date:         ${tx.date.toLocaleDateString()}`);
      console.log(`   Payment:      ${tx.paymentMethod}`);
    });

    console.log('\n' + '─'.repeat(80));
    console.log('\n📊 Summary:');
    console.log(`   Total Transactions: ${transactions.length}`);
    
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    console.log(`   Total Amount: ₹${totalAmount.toFixed(2)}`);

    // Category breakdown
    const categoryBreakdown = {};
    transactions.forEach(tx => {
      categoryBreakdown[tx.category] = (categoryBreakdown[tx.category] || 0) + 1;
    });

    console.log('\n   Categories:');
    Object.entries(categoryBreakdown).forEach(([cat, count]) => {
      console.log(`   - ${cat}: ${count}`);
    });

    console.log('\n✨ PDF parsing test completed successfully!\n');

  } catch (error) {
    console.error('❌ Error during PDF parsing:', error.message);
    console.error(error);
  }
}

// Run test
testPDFParsing();
