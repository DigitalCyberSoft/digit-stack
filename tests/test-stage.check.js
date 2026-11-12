// Test stage: right and wrong hand-ins across layouts, marking, the worked answer on a miss, keyboard movement.
// Run from the repo root: node tests/test-stage.check.js [screenshot-dir]. Needs Playwright; set CHROME_PATH to use an installed Chrome.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const SHOTS = process.argv[2] || path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true }); const URL = 'http://127.0.0.1:8776/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, rel === '/' ? 'index.html' : rel); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const out = []; const errors = []; const MINUS = '−';
const check = (n, ok, d) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d !== undefined ? ' :: ' + d : ''));
const st = page => page.evaluate(() => window.__digitStack.getState());
const sheet = page => page.evaluate(() => { const s = window.__digitStack.getState(); const sol = window.DigitStackEngine.solutionOf(s.problem);
  const marked = s.problem.rows.filter(r => s.problem.markRowIds.includes(r.id)).flatMap(r => r.cells.filter(c => c && c.kind === 'input').map(c => ({ id: c.id, value: sol.values[c.id], sign: Boolean(c.signBox) })));
  return { marked, sol }; });
async function goTo(page, id) {
  for (let i = 0; i < 80; i++) { if ((await st(page)).selectedCellId === id) return true; await page.keyboard.press('Tab'); }
  return false;
}
// Fill only the answer boxes, reaching each one by keyboard.
async function answer(page, wrongFirst) {
  const { marked } = await sheet(page);
  let first = true;
  for (const box of marked) {
    if (box.sign) { if (box.value === MINUS) await page.keyboard.press('-'); continue; }
    if (!(await goTo(page, box.id))) return false;
    const digit = wrongFirst && first ? String((Number(box.value) + 1) % 10) : box.value;
    await page.keyboard.press(digit); first = false;
    if (wrongFirst) break;   // leave the rest empty
  }
  return true;
}
async function fresh(page, learnedYear) { await page.goto(URL); await page.evaluate(y => { localStorage.clear(); const all = ['divide', 'multiply', 'add', 'subtract']; const p = { schoolYear: y || 1, passed: {}, learned: {}, watched: {} }; all.forEach(a => { p.passed[a] = []; p.learned[a] = y ? [y] : []; p.watched[a] = [1, 2, 3, 4, 5, 6, 7]; }); localStorage.setItem('digitstack.progress.v1', JSON.stringify(p)); }, learnedYear || 0); await page.goto(URL); await page.waitForTimeout(40); }
// A year the child has already learned opens in its test.
async function startTest(page, year, key) {
  await fresh(page, year);
  await page.keyboard.press(key); await page.waitForTimeout(60);
}
(async () => {
  await new Promise(r => server.listen(8776, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await startTest(page, 3, '4');
  check('a learned year opens in test mode', (await st(page)).mode === 'test');

  // Every layout: correct answers, reached by keyboard, count as a clean round.
  const methodsSeen = new Set();
  const cases = [[3, '2', 'short', 'short multiplication'], [5, '2', 'long', 'long multiplication'], [4, '1', 'short', 'short division'], [6, '1', 'long', 'long division'], [3, '3', 'column', 'column addition'], [3, '4', 'column', 'column subtraction'], [5, '4', 'fact', 'below-zero sentence'], [2, '2', 'fact', 'table fact'], [1, '2', 'fact', 'Year 1 picture or fact'], [2, '4', 'fact', 'Year 2 sentence or columns']];
  for (const [year, key, method, label] of cases) {
    await startTest(page, year, key);
    let s = await st(page);
    for (let i = 0; i < 40 && s.problem.method !== method; i++) { await startTest(page, year, key); s = await st(page); }
    if (label === 'below-zero sentence') for (let i = 0; i < 60 && !s.problem.signBox; i++) { await startTest(page, year, key); s = await st(page); }
    const reached = await answer(page, false);
    await page.keyboard.press('Enter'); await page.waitForTimeout(60);
    s = await st(page);
    methodsSeen.add(s.problem.operation + ':' + s.problem.method);
    check('test ' + label + ': answer boxes reachable and a right answer counts', reached && s.screen === 'won' && s.cleanStreak === 1, s.screen + ' streak ' + s.cleanStreak);
    if (label === 'long division') await page.screenshot({ path: SHOTS + '/tm-long-division-correct.png' });
    if (label === 'table fact' || label === 'long division') {
      await startTest(page, year, key);
      check('Hand in button is visible for ' + label, await page.locator('#handInBtn').isVisible());
    }
  }
  check('test mode covers short and long multiplication and division', ['multiply:short', 'multiply:long', 'divide:short', 'divide:long'].every(m => methodsSeen.has(m)), [...methodsSeen].join(','));

  // Navigation, editing, exchange boxes and crossing out.
  await startTest(page, 3, '4');
  let s = await st(page);
  const start = s.selectedCellId;
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  s = await st(page);
  check('arrows reach the exchange boxes above the top number', s.selectedCellId.startsWith('ex-'), s.selectedCellId);
  await page.keyboard.press('1'); await page.keyboard.press('2');
  s = await st(page);
  const col = s.selectedCellId.split('-c')[1];
  check('an exchange box takes two digits and crosses out the top digit', s.entries[s.selectedCellId] === '12' && await page.locator('[data-cell-id="a-c' + col + '"].crossed').count() === 1);
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  s = await st(page);
  check('Backspace clears it and removes the cross', !s.entries[s.selectedCellId] && await page.locator('[data-cell-id="a-c' + col + '"].crossed').count() === 0);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  s = await st(page);
  check('arrows come back down to the answer row', s.selectedCellId.startsWith('diff-'), s.selectedCellId);
  await page.keyboard.press('7');
  s = await st(page);
  check('typing in a column answer moves left', s.selectedCellId !== start || Object.keys(s.entries).length === 1);

  // Wrong answer: warning for empty boxes, then marking, proper working, next round.
  // Use a subtraction with an exchange, so there is working to show.
  await startTest(page, 3, '4');
  for (let i = 0; i < 60 && !(await st(page)).problem.actions.some(a => a.choice === 'exchange' && a.value === 1); i++) await startTest(page, 3, '4');
  const before = JSON.stringify((await st(page)).problem.operands);
  const expectedWorking = await page.evaluate(() => { const s = window.__digitStack.getState(); const sol = window.DigitStackEngine.solutionOf(s.problem);
    const marked = new Set(s.problem.rows.filter(r => s.problem.markRowIds.includes(r.id)).flatMap(r => r.cells.filter(c => c && c.kind === 'input').map(c => c.id)));
    return Object.keys(sol.values).filter(id => !marked.has(id)).length; });
  await answer(page, true);
  await page.keyboard.press('Enter'); await page.waitForTimeout(40);
  s = await st(page);
  check('handing in with empty answer boxes asks first', s.screen === 'playing' && s.handInWarned && /empty/.test(await page.locator('#fixNote').innerText()));
  await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  s = await st(page);
  const wrong = await page.locator('.cell.mark-wrong').count();
  const shownRight = await page.evaluate(() => Array.from(document.querySelectorAll('.cell.mark-wrong')).every(el => el.textContent.length > 0));
  check('a wrong answer shows the proper answer in the marked boxes', s.screen === 'testFailed' && wrong >= 1 && shownRight, wrong);
  const revealed = await page.locator('.cell.solution').count();
  check('the proper working is shown too (every working value, and at least one)', expectedWorking > 0 && revealed === expectedWorking, revealed + ' of ' + expectedWorking);
  check('the end panel offers only the next problem', /Not quite/.test(await page.locator('#endKicker').innerText()) && await page.locator('#endActions .end-btn').count() === 2 && /Next problem/.test(await page.locator('#endActions').innerText()));
  await page.screenshot({ path: SHOTS + '/tm-wrong.png' });
  await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  s = await st(page);
  check('Enter goes to the next round with the count at 0', s.screen === 'playing' && s.cleanStreak === 0 && s.mode === 'test', s.screen);

  // Sign box toggle.
  await startTest(page, 5, '3');
  s = await st(page);
  for (let i = 0; i < 60 && !s.problem.signBox; i++) { await startTest(page, 5, '3'); s = await st(page); }
  const signId = s.problem.rows[0].cells.find(c => c && c.signBox).id;
  await page.keyboard.press('-'); s = await st(page);
  const on = s.entries[signId] === MINUS;
  await page.keyboard.press('-'); s = await st(page);
  check('minus toggles the sign box', on && !s.entries[signId]);

  // A year check can be passed in test mode, and only that area moves.
  await startTest(page, 3, '4');
  s = await st(page);
  const target = s.cleanTarget;
  for (let r = 1; r <= target; r++) { await answer(page, false); await page.keyboard.press('Enter'); await page.waitForTimeout(60); s = await st(page); if (r < target) { await page.keyboard.press('Enter'); await page.waitForTimeout(60); } }
  check('test mode passes the Year 3 Subtract check (' + target + ' in a row)', s.screen === 'won' && s.progress.passed.subtract.includes(3) && s.progress.passed.add.length === 0);

  // Phone.
  await page.setViewportSize({ width: 390, height: 844 });
  await fresh(page, 6);
  let over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('phone setup with the mode switch has no overflow', over <= 0, over);
  await page.screenshot({ path: SHOTS + '/tm-setup-phone.png', fullPage: true });
  await startTest(page, 6, '1');
  over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('phone test sheet has no overflow and shows Hand in', over <= 0 && await page.locator('#handInBtn').isVisible(), over);
  await page.screenshot({ path: SHOTS + '/tm-phone-long-division.png' });

  check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' failed of ' + out.length); if (out.some(x => x.startsWith('FAIL'))) process.exitCode = 1;
})().catch(e => { console.error('HARNESS ERROR', e); server.close(); process.exit(2); });
