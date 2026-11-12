// Keypad width and fix-note placement at 390, 860 and 1280 px.
// Run from the repo root: node tests/layout.check.js [screenshot-dir]. Needs Playwright; set CHROME_PATH to use an installed Chrome.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const SHOTS = process.argv[2] || path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, rel === '/' ? 'index.html' : rel); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const out = []; const errors = [];
(async () => {
  await new Promise(r => server.listen(8773, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  for (const [w, h] of [[390, 844], [860, 900], [1280, 860]]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:8773/'); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('digitstack.progress.v1', JSON.stringify({ schoolYear: 1, watched: { divide: [1, 2, 3, 4, 5, 6, 7], multiply: [1, 2, 3, 4, 5, 6, 7], add: [1, 2, 3, 4, 5, 6, 7], subtract: [1, 2, 3, 4, 5, 6, 7] } })); }); await page.reload();
    for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');           // school year 3
    await page.keyboard.press('1'); await page.waitForTimeout(80);                  // short division, no carries
    const a = (await page.evaluate(() => window.__digitStack.getState())).action;
    await page.keyboard.press(String((a.value + 1) % 10)); await page.waitForTimeout(80);   // a miss, so the fix note shows
    const m = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      const main = r('#consoleMain'), pad = r('#keypad'), note = r('#fixNote'), sub = r('#subprompt');
      return { mainW: Math.round(main.width), padW: Math.round(pad.width), noteTop: Math.round(note.top), subBottom: Math.round(sub.bottom),
               noteInMain: note.left >= main.left - 1 && note.right <= main.right + 1, over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    await page.screenshot({ path: SHOTS + '/layout-' + w + '.png' });
    const padOk = w <= 760 ? m.padW >= 0.9 * m.mainW : m.padW > 150;
    out.push(`${w}px: keypad ${m.padW}/${m.mainW}px ${padOk ? 'PASS' : 'FAIL'}; fix note below subprompt ${m.noteTop >= m.subBottom ? 'PASS' : 'FAIL'}; inside console ${m.noteInMain ? 'PASS' : 'FAIL'}; page overflow ${m.over}px ${m.over <= 0 ? 'PASS' : 'FAIL'}`);
  }
  out.push('console errors: ' + (errors.length ? 'FAIL ' + errors.join(' | ') : 'PASS none'));
  await browser.close(); server.close(); console.log(out.join('\n')); if (out.some(x => /\bFAIL\b/.test(x))) process.exitCode = 1;
})().catch(e => { console.error(e); server.close(); process.exit(2); });
