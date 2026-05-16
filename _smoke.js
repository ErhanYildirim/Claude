const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = 'C:/Users/erhan/Downloads/Claude/cbam-risk-calculator.html';
const html = fs.readFileSync(path, 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'file:///C:/Users/erhan/Downloads/Claude/cbam-risk-calculator.html',
  resources: 'usable',
});
const w = dom.window;
w.addEventListener('error', e => console.error('WINERR:', e.error && e.error.stack || e.message));

const fallback = setTimeout(() => {
  console.error('TIMEOUT: load event did not fire within 30s — cbam-defaults.js yüklenemedi');
  process.exit(1);
}, 30000);

w.addEventListener('load', () => {
  clearTimeout(fallback);
  const c = w.document.getElementById('country');
  const cat = w.document.getElementById('category');
  const p = w.document.getElementById('product');
  console.log('country opts:', c ? c.options.length : 'null', 'value:', c && c.value);
  console.log('category opts:', cat ? cat.options.length : 'null');
  console.log('product opts:', p ? p.options.length : 'null');
  console.log('country[0..2]:', c && Array.from(c.options).slice(0,3).map(o=>o.value+'/'+o.textContent.slice(0,20)).join(' | '));
  console.log('product[0..2]:', p && Array.from(p.options).slice(0,3).map(o=>o.value+'/'+o.textContent.slice(0,40)).join(' | '));
  const countryCount = c ? c.options.length : 0;
  const productCount = p ? p.options.length : 0;
  if (countryCount === 0 || productCount === 0) {
    console.error('FAIL: dropdown\'lar boş — CBAM_DATA yüklenemedi');
    process.exit(1);
  }
  console.log('OK: smoke test passed');
  process.exit(0);
});
