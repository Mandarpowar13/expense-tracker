const fs = require('fs');
const PDFParser = require('pdf2json');

const buf = fs.readFileSync('c:\\Users\\manda\\Downloads\\gpay_statement_sample1.pdf');
const p = new PDFParser();

p.on('pdfParser_dataReady', (data) => {
  let text = '';
  if(data.Pages) {
    data.Pages.forEach(pg => {
      if(pg.Texts) {
        pg.Texts.forEach(t => {
          try {
            text += decodeURIComponent(t.R[0].T) + ' ';
          } catch(e){}
        });
      }
    });
  }
  console.log('Extracted text length:', text.length);
  console.log('\nFirst 1000 characters:');
  console.log(text.substring(0, 1000));
  console.log('\n---\n');
  console.log('Full text:');
  console.log(text);
});

p.on('pdfParser_dataError', (err) => {
  console.error('PDF parsing error:', err);
});

p.parseBuffer(buf);
