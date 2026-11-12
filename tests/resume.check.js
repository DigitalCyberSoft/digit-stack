// Closing and reopening: each area's place, the round in progress, fixes that must still count, stage and year changes, bad saved data, and blocked storage.
// Run from the repo root: node tests/resume.check.js. Needs Playwright; set CHROME_PATH to use an installed Chrome.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const URL = 'http://127.0.0.1:8778/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, rel === '/' ? 'index.html' : rel); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const out = []; const errors = []; const MINUS = '−'; const PLAY = 'digitstack.play.v1'; const PROGRESS = 'digitstack.progress.v1';
const check = (n, ok, d) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d !== undefined ? ' :: ' + d : ''));
const st = page => page.evaluate(() => window.__digitStack.getState());
const wait = page => page.waitForTimeout(50);
const prog = (year, learned = {}, passed = {}) => ({ schoolYear: year, passed: Object.assign({ divide: [], multiply: [], add: [], subtract: [] }, passed), learned: Object.assign({ divide: [], multiply: [], add: [], subtract: [] }, learned) });
const play = (operation, areas, version = 1) => ({ version, operation, areas });
async function fresh(page, progress, saved) {
  await page.goto(URL);
  await page.evaluate(([p, q, keys]) => { localStorage.clear(); localStorage.setItem(keys[1], JSON.stringify(Object.assign({ schoolYear: 1 }, p || {}, { watched: { divide: [1, 2, 3, 4, 5, 6, 7], multiply: [1, 2, 3, 4, 5, 6, 7], add: [1, 2, 3, 4, 5, 6, 7], subtract: [1, 2, 3, 4, 5, 6, 7] } }))); if (q !== null) localStorage.setItem(keys[0], typeof q === 'string' ? q : JSON.stringify(q)); }, [progress || null, saved === undefined ? null : saved, [PLAY, PROGRESS]]);
  await page.goto(URL); await wait(page);
}
async function reopen(page) { await page.reload(); await wait(page); return st(page); }
async function setYear(page, y) { let c = (await st(page)).schoolYear; while (c !== y) { await page.keyboard.press(c < y ? 'ArrowRight' : 'ArrowLeft'); c = (await st(page)).schoolYear; } }
async function act(page, a) {
  if (a.kind === 'digit') await page.keyboard.press(String(a.value));
  else if (a.kind === 'sign') await page.keyboard.press(a.value === MINUS ? '-' : String(a.firstDigit));
  else await page.waitForTimeout(560);
  await page.waitForTimeout(8);
}
async function solveGuided(page) { for (let i = 0; i < 900; i++) { const s = await st(page); if (s.screen !== 'playing') return s; await act(page, s.action); } throw new Error('timeout'); }
async function stepTo(page, index) { for (let i = 0; i < 900; i++) { const s = await st(page); if (s.actionIndex >= index || s.screen !== 'playing') return s; await act(page, s.action); } throw new Error('timeout'); }
const markedBoxes = page => page.evaluate(() => { const s = window.__digitStack.getState(); const sol = window.DigitStackEngine.solutionOf(s.problem);
  return s.problem.rows.filter(r => s.problem.markRowIds.includes(r.id)).flatMap(r => r.cells.filter(c => c && c.kind === 'input').map(c => ({ id: c.id, v: sol.values[c.id], sign: Boolean(c.signBox) }))); });
async function typeInto(page, id, digits) { for (let i = 0; i < 80 && (await st(page)).selectedCellId !== id; i++) await page.keyboard.press('Tab'); for (const d of digits) await page.keyboard.press(d); }
async function solveTest(page) {
  for (const b of await markedBoxes(page)) { if (b.sign) { if (b.v === MINUS && (await st(page)).entries[b.id] !== MINUS) await page.keyboard.press('-'); continue; } await typeInto(page, b.id, [b.v]); }
  await page.keyboard.press('Enter'); await page.waitForTimeout(60); return st(page);
}
// What the sheet shows: every box's text and the classes that carry meaning.
const snapshot = page => page.evaluate(() => Array.from(document.querySelectorAll('#worksheet [data-cell-id]')).map(el => el.dataset.cellId + '=' + el.textContent +
  ['filled', 'crossed', 'zeroed', 'auto-filled', 'revealed', 'skipped', 'pending'].filter(c => el.classList.contains(c)).map(c => '.' + c).join('')));
const diff = (a, b) => a.map((x, i) => x === b[i] ? null : x + ' -> ' + b[i]).filter(Boolean).slice(0, 4).join(' | ') || 'lengths ' + a.length + '/' + b.length;
const statusText = page => page.evaluate(() => document.getElementById('sheetStatus').textContent);

(async () => {
  await new Promise(r => server.listen(8778, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // Mid-round in learning: a subtraction stopped just after an exchange.
  let s;
  for (let r = 0; r < 40; r++) {
    await fresh(page); await setYear(page, 3); await page.keyboard.press('4'); await wait(page); s = await st(page);
    if (s.problem.actions.some(a => a.choice === 'exchange' && a.value === 1)) break;
  }
  check('found a subtraction with an exchange', s.problem.actions.some(a => a.choice === 'exchange' && a.value === 1));
  const streakBefore = s.cleanStreak;
  s = await stepTo(page, s.problem.actions.findIndex(a => a.choice === 'exchange' && a.value === 1) + 2);
  const sheetBefore = await snapshot(page);
  let r1 = await reopen(page);
  check('reopening resumes the same area, year and problem', r1.screen === 'playing' && r1.operation === 'subtract' && r1.year === 3 && r1.mode === 'guided' && r1.problem.question === s.problem.question, r1.screen + ' ' + r1.operation);
  check('reopening resumes at the same step and clean count', r1.actionIndex === s.actionIndex && r1.action.cellId === s.action.cellId && r1.cleanStreak === streakBefore && r1.roundClean);
  const sheetAfter = await snapshot(page);
  check('reopening redraws every box, crossing out and exchange as it was', JSON.stringify(sheetAfter) === JSON.stringify(sheetBefore), diff(sheetBefore, sheetAfter));
  let e = await solveGuided(page);
  check('the resumed round finishes clean and counts', e.screen === 'won' && e.cleanStreak === streakBefore + 1, e.screen + ' ' + e.cleanStreak);

  // Between rounds: the result is kept and the next problem starts.
  r1 = await reopen(page);
  check('reopening after a clean round keeps the count and starts the next problem', r1.screen === 'playing' && r1.operation === 'subtract' && r1.cleanStreak === streakBefore + 1 && r1.actionIndex === 0);

  // A mistake made before closing still counts.
  await page.keyboard.press(String((r1.action.value + 1) % 10)); await wait(page);
  s = await st(page);
  r1 = await reopen(page);
  check('a mistake made before closing still counts after reopening', !s.roundClean && !r1.roundClean && r1.fixes === 1 && r1.cleanStreak === 0 && r1.problem.question === s.problem.question && r1.actionIndex === s.actionIndex, JSON.stringify([r1.roundClean, r1.fixes, r1.cleanStreak]));
  check('the reopened round says it had a fix', await statusText(page) === 'fixed, keep going', await statusText(page));
  e = await solveGuided(page);
  check('the reopened round ends as a round with a fix', e.screen === 'fixed');

  // Quitting to the start keeps the area's place; the start screen reopens.
  await page.keyboard.press('n'); await wait(page);
  s = await stepTo(page, 2);
  await page.keyboard.press('Escape'); await wait(page); await page.keyboard.press('q'); await wait(page);
  r1 = await reopen(page);
  check('quitting to the start, then reopening, opens the start screen', r1.screen === 'setup' && r1.operation === null);
  await page.keyboard.press('4'); await wait(page); r1 = await st(page);
  check('choosing the area again picks up its round', r1.screen === 'playing' && r1.problem.question === s.problem.question && r1.actionIndex === s.actionIndex);

  // Test stage: typed boxes, a two-digit exchange box and the selected box.
  await fresh(page, prog(3, { subtract: [3] })); await page.keyboard.press('4'); await wait(page);
  s = await st(page);
  check('a learned year opens in its test', s.mode === 'test' && s.year === 3);
  const exRow = s.problem.rows.find(r => r.id === 'ex');
  const exCell = exRow.cells.filter(Boolean).pop();
  await page.click('[data-cell-id="' + exCell.id + '"]'); await page.keyboard.press('1'); await page.keyboard.press('2');
  const boxes = (await markedBoxes(page)).filter(b => !b.sign);
  for (const b of boxes.slice(-2)) await typeInto(page, b.id, [b.v]);
  s = await st(page);
  r1 = await reopen(page);
  const sorted = o => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
  check('reopening a test keeps every typed box and the selected box', r1.mode === 'test' && r1.problem.question === s.problem.question && sorted(r1.entries) === sorted(s.entries) && r1.selectedCellId === s.selectedCellId && Object.keys(s.entries).length === 3, sorted(s.entries) + ' vs ' + sorted(r1.entries));
  const shown = await page.evaluate(ids => ids.map(id => document.querySelector('[data-cell-id="' + id + '"]').textContent), Object.keys(s.entries));
  const topCrossed = await page.evaluate(col => document.querySelector('[data-cell-id="a-c' + col + '"]').classList.contains('crossed'), exCell.col);
  check('the reopened test shows the typed digits and the crossed-out top digit', JSON.stringify(shown) === JSON.stringify(Object.values(s.entries)) && r1.entries[exCell.id] === '12' && topCrossed, JSON.stringify(shown) + ' crossed=' + topCrossed);
  e = await solveTest(page);
  check('the reopened test can be handed in', e.screen === 'won' && e.cleanStreak === 1);

  // Learning gate, then reopening: the test is next.
  const addTarget = await page.evaluate(() => window.DigitStackEngine.cleanRounds('add', 3));
  await fresh(page, prog(3), play('add', { add: { year: 3, mode: 'guided', cleanStreak: addTarget - 1, round: null } }));
  s = await st(page);
  check('a saved place opens straight into its area with its clean count', s.screen === 'playing' && s.operation === 'add' && s.cleanStreak === addTarget - 1 && s.mode === 'guided');
  e = await solveGuided(page);
  r1 = await reopen(page);
  check('closing on "Learning done" reopens in that year\'s test', e.screen === 'won' && e.pendingTest && r1.mode === 'test' && r1.year === 3 && r1.cleanStreak === 0 && r1.progress.learned.add.includes(3));

  // Passing the test, then reopening: the next year starts in learning.
  await fresh(page, prog(3, { add: [3] }), play('add', { add: { year: 3, mode: 'test', cleanStreak: addTarget - 1, round: null } }));
  e = await solveTest(page);
  r1 = await reopen(page);
  check('closing on a passed check reopens the next year in learning', e.screen === 'won' && e.pendingYear === 4 && r1.year === 4 && r1.mode === 'guided' && r1.cleanStreak === 0 && r1.progress.passed.add.includes(3));

  // A new school year drops a place saved for the old one.
  await fresh(page, prog(3), play(null, { add: { year: 3, mode: 'guided', cleanStreak: 2, round: null } }));
  check('a saved place is not opened until its area is chosen', (await st(page)).screen === 'setup');
  await page.keyboard.press('3'); await wait(page);
  check('choosing the area uses its saved count', (await st(page)).cleanStreak === 2);
  await page.keyboard.press('Escape'); await wait(page); await page.keyboard.press('q'); await wait(page);
  await setYear(page, 4); await page.keyboard.press('3'); await wait(page); s = await st(page);
  check('a new school year starts the area afresh', s.year === 4 && s.cleanStreak === 0);

  // Bad saved data.
  await fresh(page, prog(3), '{not json');
  check('unreadable saved play opens the start screen', (await st(page)).screen === 'setup');
  await fresh(page, prog(3), play('add', { add: { year: 3, mode: 'guided', cleanStreak: 2, round: null } }, 0));
  check('saved play from another version is ignored', (await st(page)).screen === 'setup');
  await fresh(page, prog(3), play('add', { add: { year: 3, mode: 'guided', cleanStreak: 99, round: null } }));
  check('an impossible clean count is not used', (await st(page)).cleanStreak === 0);
  const before = errors.length;
  const badProblem = { operation: 'add', year: 3, question: 'q', rows: [], markRowIds: [], answerRowIds: [], groups: [], answer: { value: 1, expression: '1' },
    actions: [{ kind: 'digit', cellId: 'missing', rowId: 'missing', value: 1, stage: 'ADD', prompt: 'p', subprompt: 's' }] };
  await fresh(page, prog(3), play('add', { add: { year: 3, mode: 'guided', cleanStreak: 1, round: { problem: badProblem, actionIndex: 0, roundClean: true, fixes: 0 } } }));
  await page.waitForTimeout(100); s = await st(page);
  const reported = errors.slice(before);
  check('a saved round that cannot be drawn is replaced and the error reported', s.screen === 'playing' && s.operation === 'add' && s.problem.question !== 'q' && s.cleanStreak === 1 && reported.length === 1 && /Missing cell/.test(reported[0]), JSON.stringify(reported));
  errors.splice(before, reported.length);
  r1 = await reopen(page);
  check('the replacement round is saved, so the error does not repeat', errors.length === before && r1.problem.question === s.problem.question);

  // Saving status on screen.
  await fresh(page);
  check('the not-saving notice is hidden when saving works', (await st(page)).saving && !(await page.locator('#saveNote').isVisible()));
  for (const [label, script] of [
    ['writes are blocked', () => { Storage.prototype.setItem = function () { throw new DOMException('Blocked for the test', 'SecurityError'); }; }],
    ['there is no store', () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { return null; } }); }]
  ]) {
    const blocked = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await blocked.addInitScript(script);
    const bp = await blocked.newPage(); const bErrors = [];
    bp.on('pageerror', x => bErrors.push(x.message)); bp.on('console', m => { if (m.type() === 'error') bErrors.push(m.text()); });
    await bp.goto(URL); await wait(bp);
    const shownNote = await bp.locator('#saveNote').isVisible();
    // Year 3 addition takes at least 5 presses, so one press leaves the round open.
    // With nothing saved, the year opens on its worked example; skip it.
    await setYear(bp, 3); await bp.keyboard.press('3'); await wait(bp);
    if ((await st(bp)).screen === 'tutorial') { await bp.keyboard.press('n'); await wait(bp); }
    const a = (await st(bp)).action; await act(bp, a);
    const bs = await st(bp);
    await bp.keyboard.press('Escape'); await wait(bp);
    const note = await bp.locator('#pauseNote').innerText();
    check('when ' + label + ', the start screen says so and the game still plays', shownNote && !bs.saving && bs.screen === 'playing' && bs.actionIndex >= 1 && /not saving/.test(note) && bErrors.length === 0, JSON.stringify({ shownNote, saving: bs.saving, screen: bs.screen, actionIndex: bs.actionIndex, note, bErrors }));
    await blocked.close();
  }

  check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' failed of ' + out.length); if (out.some(x => x.startsWith('FAIL'))) process.exitCode = 1;
})().catch(e => { console.error('HARNESS ERROR', e); server.close(); process.exit(2); });
