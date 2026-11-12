// Full rounds by keyboard in nine area and year cases, Year 1 to Year 7, must finish clean.
// Run from the repo root: node tests/solve-all.check.js [screenshot-dir]. Needs Playwright; set CHROME_PATH to use an installed Chrome.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const URL = 'http://127.0.0.1:8775/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, rel === '/' ? 'index.html' : rel); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const out = []; const errors = []; const MINUS = '−';
const check = (n, ok, d) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d !== undefined ? ' :: ' + d : ''));
const st = page => page.evaluate(() => window.__digitStack.getState());
async function solve(page) {
  for (let i = 0; i < 900; i++) {
    const s = await st(page); if (s.screen !== 'playing') return s; const a = s.action;
    if (a.kind === 'digit') await page.keyboard.press(String(a.value));
    else if (a.kind === 'sign') await page.keyboard.press(a.value === MINUS ? '-' : String(a.firstDigit));
    else await page.waitForTimeout(560);
    await page.waitForTimeout(8);
  }
  throw new Error('timeout');
}
(async () => {
  await new Promise(r => server.listen(8775, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  for (const [year, key, rounds, label] of [[1, '2', 3, 'Y1 multiply pictures/facts'], [1, '1', 3, 'Y1 divide'], [2, '2', 3, 'Y2 multiply facts'], [2, '4', 4, 'Y2 subtract'], [5, '2', 2, 'Y5 long multiplication'], [6, '1', 2, 'Y6 long division'], [7, '1', 2, 'Y7 long division'], [7, '2', 1, 'Y7 long multiplication'], [6, '3', 3, 'Y6 add']]) {
    await page.goto(URL); await page.evaluate(() => localStorage.clear()); await page.goto(URL);
    let cur = (await st(page)).schoolYear; while (cur !== year) { await page.keyboard.press('ArrowRight'); cur = (await st(page)).schoolYear; }
    await page.keyboard.press(key); await page.waitForTimeout(60);
    let ok = true; const methods = new Set();
    for (let r = 0; r < rounds; r++) {
      methods.add((await st(page)).problem.method);
      const e = await solve(page); if (e.screen !== 'won') { ok = false; break; }
      await page.keyboard.press('Enter'); await page.waitForTimeout(40);
    }
    check(label + ' solves clean by keyboard (' + [...methods].join(',') + ')', ok);
  }
  check('no console or page errors', errors.length === 0, errors.join(' | '));
  await browser.close(); server.close(); console.log(out.join('\n')); if (out.some(x => x.startsWith('FAIL'))) process.exitCode = 1;
})().catch(e => { console.error(e); server.close(); process.exit(2); });
