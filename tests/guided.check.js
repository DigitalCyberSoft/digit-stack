// Guided learning: learn, test, next year; zero rule decisions; gates; phone fit.
// Run from the repo root: node tests/guided.check.js [screenshot-dir]. Needs Playwright; set CHROME_PATH to use an installed Chrome.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const SHOTS = process.argv[2] || path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true }); const URL = 'http://127.0.0.1:8777/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, rel === '/' ? 'index.html' : rel); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const out = []; const errors = []; const MINUS = '−';
const check = (n, ok, d) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d !== undefined ? ' :: ' + d : ''));
const st = page => page.evaluate(() => window.__digitStack.getState());
const text = (page, id) => page.evaluate(i => { const el = document.querySelector('[data-cell-id="' + i + '"]'); return el ? el.textContent : null; }, id);
async function act(page, a) {
  if (a.kind === 'digit') await page.keyboard.press(String(a.value));
  else if (a.kind === 'sign') await page.keyboard.press(a.value === MINUS ? '-' : String(a.firstDigit));
  else await page.waitForTimeout(560);
  await page.waitForTimeout(8);
}
async function solveGuided(page, onAction) {
  for (let i = 0; i < 900; i++) { const s = await st(page); if (s.screen !== 'playing') return s; if (onAction && await onAction(s)) continue; await act(page, s.action); }
  throw new Error('timeout');
}
async function solveTest(page) {
  const marked = await page.evaluate(() => { const s = window.__digitStack.getState(); const sol = window.DigitStackEngine.solutionOf(s.problem);
    return s.problem.rows.filter(r => s.problem.markRowIds.includes(r.id)).flatMap(r => r.cells.filter(c => c && c.kind === 'input').map(c => ({ id: c.id, v: sol.values[c.id], sign: Boolean(c.signBox) }))); });
  for (const b of marked) {
    if (b.sign) { if (b.v === MINUS) await page.keyboard.press('-'); continue; }
    for (let i = 0; i < 80 && (await st(page)).selectedCellId !== b.id; i++) await page.keyboard.press('Tab');
    await page.keyboard.press(b.v);
  }
  await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  return st(page);
}
async function fresh(page, progress) { await page.goto(URL); await page.evaluate(p => { localStorage.clear(); if (p) localStorage.setItem('digitstack.progress.v1', JSON.stringify(p)); }, progress || null); await page.goto(URL); await page.waitForTimeout(40); }
async function setYear(page, y) { let c = (await st(page)).schoolYear; while (c !== y) { await page.keyboard.press(c < y ? 'ArrowRight' : 'ArrowLeft'); c = (await st(page)).schoolYear; } }
async function find(page, year, key, want, then, limit = 200) {
  await fresh(page); await setYear(page, year); await page.keyboard.press(key); await page.waitForTimeout(50);
  for (let r = 0; r < limit; r++) {
    let s = await st(page);
    if (s.year !== year || s.mode !== 'guided') { await fresh(page); await setYear(page, year); await page.keyboard.press(key); await page.waitForTimeout(50); s = await st(page); }
    if (want(s.problem)) { await then(s); return true; }
    const e = await solveGuided(page); await page.keyboard.press(e.screen === 'fixed' ? 'n' : 'Enter'); await page.waitForTimeout(30);
  }
  return false;
}
(async () => {
  await new Promise(r => server.listen(8777, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // Learn, then test, then the next year.
  await fresh(page); await setYear(page, 3); await page.keyboard.press('4'); await page.waitForTimeout(60);
  let s = await st(page);
  check('a new year starts in guided learning', s.mode === 'guided' && s.year === 3 && !(await page.locator('#handInBtn').isVisible()));
  for (let r = 1; r <= s.cleanTarget; r++) { s = await solveGuided(page); if (r < s.cleanTarget) { await page.keyboard.press('Enter'); await page.waitForTimeout(40); } }
  check('enough clean learning rounds unlock the test, not the year', s.screen === 'won' && s.pendingTest && /Learning done/.test(await page.locator('#endKicker').innerText()) && s.progress.learned.subtract.includes(3) && !s.progress.passed.subtract.includes(3));
  await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  s = await st(page);
  check('the test starts by itself at the same year', s.mode === 'test' && s.year === 3 && s.cleanStreak === 0 && await page.locator('#handInBtn').isVisible());
  for (let r = 1; r <= s.cleanTarget; r++) { s = await solveTest(page); if (r < s.cleanTarget) { await page.keyboard.press('Enter'); await page.waitForTimeout(40); } }
  check('enough clean tests pass the year', s.screen === 'won' && /Year 3 check passed/.test(await page.locator('#endKicker').innerText()) && s.progress.passed.subtract.includes(3));
  await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  s = await st(page);
  check('the next year starts in learning again', s.year === 4 && s.mode === 'guided');
  await page.keyboard.press('Escape'); await page.waitForTimeout(60); await page.keyboard.press('q'); await page.waitForTimeout(60);
  check('setup shows each area\'s year and stage', /^Year 4 \(1 ahead\), learning/.test(await page.locator('#subtractShape').innerText()) && /^Year 3, learning/.test(await page.locator('#addShape').innerText()));
  await page.reload(); s = await st(page);
  check('reload keeps learned and passed years', s.progress.learned.subtract.includes(3) && s.progress.passed.subtract.includes(3));
  const learned = { schoolYear: 5, passed: { divide: [], multiply: [], add: [], subtract: [] }, learned: { divide: [], multiply: [], add: [], subtract: [5] } };
  await fresh(page, learned); await page.keyboard.press('4'); await page.waitForTimeout(50);
  check('a year already learned opens straight into its test', (await st(page)).mode === 'test');

  // Zero rule: both wrong choices, the stop is always the small box, Space does nothing.
  const okEx = await find(page, 3, '4', p => p.actions.some(a => a.choice === 'exchange' && a.value === 1) && p.actions.some(a => a.choice === 'exchange' && a.value === 0), async () => {
    let sawOne = false, sawZero = false, stopsOnBox = true, restored = null, spaceIgnored = null;
    const end = await solveGuided(page, async (cur) => {
      const a = cur.action;
      if (a.choice === 'exchange') {
        const row = await page.evaluate(() => document.querySelector('.cell.active').closest('.row').dataset.rowId);
        if (row !== 'ex') stopsOnBox = false;
        if (spaceIgnored === null) { await page.keyboard.press('Space'); await page.waitForTimeout(30); const n = await st(page); spaceIgnored = n.actionIndex === cur.actionIndex && n.roundClean === cur.roundClean; }
        const before = await text(page, a.cellId);
        if (a.value === 1 && !sawOne) {
          sawOne = true; await page.keyboard.press('0'); await page.waitForTimeout(30);
          check('typing 0 when an exchange is due is a fix', /exchange: type 1/.test(await page.locator('#fixNote').innerText()));
          await page.keyboard.press('1'); await page.waitForTimeout(30);
          const col = a.cellId.split('-c')[1];
          check('typing 1 shows the new value and crosses out the top digit', (await text(page, a.cellId)) === a.shown && await page.locator('[data-cell-id="a-c' + col + '"].crossed').count() === 1);
          if (before) restored = (await text(page, a.cellId)) === a.shown;
          return true;
        }
        if (a.value === 0 && !sawZero) {
          sawZero = true; await page.keyboard.press('1'); await page.waitForTimeout(30);
          check('typing 1 when no exchange is needed is a fix', /works without exchanging/.test(await page.locator('#fixNote').innerText()));
          await page.keyboard.press('0'); await page.waitForTimeout(30);
          const after = await text(page, a.cellId);
          check('typing 0 writes nothing and keeps what the box held', after === before && (before ? true : await page.locator('[data-cell-id="' + a.cellId + '"].zeroed').count() === 1), before + ' -> ' + after);
          return true;
        }
      }
      return false;
    });
    check('every exchange decision stops on the small box', stopsOnBox);
    check('Space does nothing in guided play', spaceIgnored === true);
    check('round with fixes ends on the fixed screen', end.screen === 'fixed');
  });
  check('found a subtraction with both exchange decisions', okEx);
  const okKeep = await find(page, 3, '4', p => { const seen = new Set(); return p.actions.some(a => { const hit = a.choice === 'exchange' && seen.has(a.cellId); seen.add(a.cellId); return hit; }); }, async () => {
    const typedBefore = new Set(); let done = false;
    await solveGuided(page, async (cur) => {
      const a = cur.action;
      if (!done && a.choice === 'exchange' && typedBefore.has(a.cellId)) {
        done = true; const before = await text(page, a.cellId);
        await page.keyboard.press(String((a.value + 2) % 10)); await page.waitForTimeout(30);
        await page.keyboard.press(String(a.value)); await page.waitForTimeout(30);
        const after = await text(page, a.cellId);
        check('a wrong digit over a box that already shows a value does not lose it', after === (a.shown === null ? before : a.shown), before + ' -> ' + after);
        return true;
      }
      if (a.cellId.startsWith('ex-')) typedBefore.add(a.cellId);
      return false;
    });
  });
  check('found an exchange box decided after it gave a ten', okKeep);
  const okCarry0 = await find(page, 3, '3', p => p.actions.some(a => a.choice === 'carry' && a.value === 0), async () => {
    let zeroBox = null;
    const end = await solveGuided(page, async (cur) => { if (cur.action.choice === 'carry' && cur.action.value === 0 && !zeroBox) zeroBox = cur.action.cellId; return false; });
    check('a 0 carry leaves its box empty and greyed', end.screen === 'won' && (await text(page, zeroBox)) === '' && await page.locator('[data-cell-id="' + zeroBox + '"].zeroed').count() === 1);
    await page.screenshot({ path: SHOTS + '/z-add.png' });
  });
  check('found an addition with a 0 carry', okCarry0);
  const okLeft = await find(page, 4, '1', p => p.actions.some(a => a.choice === 'leftover' && a.value === 0) && p.actions.some(a => a.choice === 'leftover' && a.value > 0), async () => {
    const end = await solveGuided(page);
    check('short division with and without left-overs solves by digits alone', end.screen === 'won');
    await page.screenshot({ path: SHOTS + '/z-short-division.png' });
  });
  check('found a short division with both left-over decisions', okLeft);
  check('found and solved multiplication carries', await find(page, 5, '2', p => p.method === 'long', async () => { const e = await solveGuided(page); check('long multiplication solves by digits alone', e.screen === 'won'); await page.screenshot({ path: SHOTS + '/z-long-mult.png' }); }));

  for (const [y, key, want] of [[6, '1', 3], [1, '3', 10], [4, '2', 5], [3, '2', 5]]) {
    await fresh(page); await setYear(page, y); await page.keyboard.press(key); await page.waitForTimeout(50);
    s = await st(page);
    check('Year ' + y + ' key ' + key + ' needs ' + want + ' in a row', s.cleanTarget === want && await page.locator('#streakMeter span').count() === want, s.cleanTarget);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await fresh(page);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('phone setup has no overflow', over <= 0, over);
  await page.screenshot({ path: SHOTS + '/z-setup-phone.png', fullPage: true });
  const fit = async name => { const m = await page.evaluate(() => { const w = document.querySelector('.worksheet').getBoundingClientRect(); return { l: w.left, r: w.right, vw: window.innerWidth, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; }); check('phone fit ' + name, m.over <= 0 && m.l >= 0 && m.r <= m.vw, JSON.stringify(m)); };
  check('found a 7-digit subtraction', await find(page, 7, '4', p => p.method === 'column' && p.width === 7, async () => fit('7-digit subtraction')));
  check('found an 11-cell sentence', await find(page, 2, '3', p => p.width === 11, async () => fit('11-cell sentence')));

  const body = await page.locator('body').innerText();
  check('no "Space", "borrow" or decimal text on screen', !/\bSpace\b/.test(body) && !/borrow/i.test(body) && !/\d+\.\d+/.test(body));
  check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' failed of ' + out.length); if (out.some(x => x.startsWith('FAIL'))) process.exitCode = 1;
})().catch(e => { console.error('HARNESS ERROR', e); server.close(); process.exit(2); });
