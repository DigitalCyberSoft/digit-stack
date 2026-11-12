// Tutorials: each year's worked examples. The engine gives one example per layout the year uses, with a reason for every step; the game plays
// it on a year's first visit, steps forward and back, skips, replays with W while learning (back to the same step), refuses during a test, and
// shows the next year's example on moving up.
// Run from the repo root: node tests/tutorial.check.js. Needs Playwright; set CHROME_PATH to use an installed Chrome.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'));
const ROOT = path.resolve(__dirname, '..'); const URL = 'http://127.0.0.1:8786/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, rel === '/' ? 'index.html' : rel); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const out = []; const errors = [];
const check = (n, ok, d) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d !== undefined ? ' :: ' + d : ''));
const st = page => page.evaluate(() => window.__digitStack.getState());
const wait = (page, ms) => page.waitForTimeout(ms || 60);
const empty = () => ({ divide: [], multiply: [], add: [], subtract: [] });
async function fresh(page, progress, saved) {
  await page.goto(URL);
  await page.evaluate(([p, q]) => { localStorage.clear(); if (p) localStorage.setItem('digitstack.progress.v1', JSON.stringify(p)); if (q) localStorage.setItem('digitstack.play.v1', JSON.stringify(q)); }, [progress || null, saved || null]);
  await page.goto(URL); await wait(page);
}
async function setYear(page, y) { let c = (await st(page)).schoolYear; while (c !== y) { await page.keyboard.press(c < y ? 'ArrowRight' : 'ArrowLeft'); c = (await st(page)).schoolYear; } }
const snapshot = page => page.evaluate(() => Array.from(document.querySelectorAll('#worksheet [data-cell-id]')).map(el => el.dataset.cellId + '=' + el.textContent +
  ['filled', 'crossed', 'zeroed', 'auto-filled', 'revealed', 'skipped'].filter(c => el.classList.contains(c)).map(c => '.' + c).join('')));

(async () => {
  // Engine: one example per layout, shortest first, and a reason for every step.
  const gaps = [];
  for (const area of E.AREAS) for (const year of E.YEARS) {
    const examples = E.tutorialProblems(area, year);
    const layouts = new Set(); for (let i = 0; i < 600; i++) layouts.add(E.generateProblem(area, year).title);
    const titles = examples.map(p => p.title);
    if (titles.length !== layouts.size || !titles.every(t => layouts.has(t))) gaps.push(area + ' Y' + year + ' layouts ' + titles.join('/') + ' vs ' + [...layouts].join('/'));
    if (examples.some((p, i) => i && p.actions.length < examples[i - 1].actions.length)) gaps.push(area + ' Y' + year + ' not shortest first');
    examples.forEach(p => p.actions.forEach(a => { if (!a.prompt || !a.why) gaps.push(area + ' Y' + year + ' step without a reason'); }));
  }
  check('every year has one example per layout it uses, shortest first, with a reason for every step', gaps.length === 0, gaps.slice(0, 3).join(' | '));
  const both = (p, choice) => p.actions.some(a => a.choice === choice && a.value > 0) && p.actions.some(a => a.choice === choice && a.value === 0);
  const showsBoth = [['add', 3, 'carry'], ['subtract', 3, 'exchange'], ['multiply', 3, 'carry'], ['divide', 4, 'leftover']].filter(([a, y, c]) => !both(E.tutorialProblems(a, y)[0], c));
  check('examples show a decision both ways (carry and no carry, exchange and none, left over and none)', showsBoth.length === 0, JSON.stringify(showsBoth));

  await new Promise(r => server.listen(8786, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // First visit: the example plays before learning.
  await fresh(page); await setYear(page, 3); await page.keyboard.press('3'); await wait(page);
  let s = await st(page);
  check('a year opens on its worked example the first time', s.screen === 'tutorial' && s.tutorial.step === 0 && /^Watch an example/.test(await page.locator('#prompt').innerText()) && !(await page.locator('#keypad').isVisible()));
  const steps = s.tutorial.examples[0].steps;
  const whyOk = []; let before1 = null;
  for (let k = 1; k <= steps; k++) {
    await page.keyboard.press('ArrowRight'); await wait(page, 30);
    const now = await page.evaluate(k => { const s = window.__digitStack.getState(); const a = s.problem.actions[k - 1];
      return { why: a.why, shown: document.getElementById('subprompt').textContent, marked: document.querySelector('[data-cell-id="' + a.cellId + '"]').classList.contains('tutor-step') }; }, k);
    whyOk.push(now.shown === now.why && now.marked);
    if (k === 1) before1 = await snapshot(page);
  }
  check('each step highlights its box and gives the reason the game uses', whyOk.length === steps && whyOk.every(Boolean), JSON.stringify(whyOk));
  const filled = await page.evaluate(() => { const s = window.__digitStack.getState(); const sol = window.DigitStackEngine.solutionOf(s.problem).values;
    return Object.keys(sol).filter(id => (document.querySelector('[data-cell-id="' + id + '"]') || {}).textContent !== sol[id]); });
  check('after the last step every box holds the worked answer', filled.length === 0, filled.join(','));
  for (let k = steps; k > 1; k--) { await page.keyboard.press('ArrowLeft'); await wait(page, 30); }
  const back1 = await snapshot(page);
  check('stepping back returns the sheet to how it was', (await st(page)).tutorial.step === 1 && JSON.stringify(back1) === JSON.stringify(before1));
  // From step 1, one press per step reaches the answer card (step count + 1).
  for (let k = 1; k <= steps; k++) { await page.keyboard.press('ArrowRight'); await wait(page, 20); }
  const answerShown = await page.locator('#prompt').innerText();
  const answerWanted = (await st(page)).problem.answer.expression;
  check('the last step shows the answer', answerShown === answerWanted, answerShown + ' vs ' + answerWanted);
  await page.keyboard.press('Enter'); await wait(page);
  s = await st(page);
  check('finishing starts learning at the same year, with the example marked watched', s.screen === 'playing' && s.mode === 'guided' && s.year === 3 && s.operation === 'add' && s.progress.watched.add.includes(3) && s.cleanStreak === 0);
  await page.reload(); await wait(page);
  check('reopening goes straight back to learning', (await st(page)).screen === 'playing');

  // W replays the example and comes back to the same step.
  s = await st(page); await page.keyboard.press(String(s.action.value)); await wait(page, 40);
  s = await st(page); await page.keyboard.press(String(s.action.value)); await wait(page, 40);
  const round = await st(page);
  await page.keyboard.press('w'); await wait(page);
  const watching = await st(page);
  await page.keyboard.press('Escape'); await wait(page);
  const pauseCheck = await page.locator('#pauseCheck').innerText();
  await page.keyboard.press('Escape'); await wait(page);
  await page.keyboard.press('n'); await wait(page);
  s = await st(page);
  check('W replays the example during learning', watching.screen === 'tutorial' && pauseCheck === 'Watching');
  check('after the replay the round carries on from the same step', s.screen === 'playing' && s.problem.question === round.problem.question && s.actionIndex === round.actionIndex && s.actionIndex === 2);

  // N skips on a first visit, and still records the example as watched.
  await page.keyboard.press('Escape'); await wait(page); await page.keyboard.press('q'); await wait(page);
  await page.keyboard.press('4'); await wait(page);
  const skipFrom = await st(page); await page.keyboard.press('n'); await wait(page); s = await st(page);
  check('N skips to learning and the example counts as watched', skipFrom.screen === 'tutorial' && s.screen === 'playing' && s.progress.watched.subtract.includes(3));

  // No example during a test.
  await fresh(page, { schoolYear: 3, passed: empty(), learned: Object.assign(empty(), { add: [3] }), watched: empty() });
  await page.keyboard.press('3'); await wait(page); await page.keyboard.press('w'); await wait(page); s = await st(page);
  check('a test opens without an example, and W does nothing there', s.screen === 'playing' && s.mode === 'test');

  // Moving up a year shows the new year's example first.
  const target = E.cleanRounds('add', 3);
  const problem = E.buildAddition(789, 642, 3);
  const values = E.solutionOf(problem).values;
  await fresh(page, { schoolYear: 3, passed: empty(), learned: Object.assign(empty(), { add: [3] }), watched: Object.assign(empty(), { add: [3] }) },
    { version: 1, operation: 'add', areas: { add: { year: 3, mode: 'test', cleanStreak: target - 1, round: { problem, entries: values, selectedCellId: null } } } });
  await page.keyboard.press('Enter'); await wait(page, 120);
  const passed = await st(page);
  await page.keyboard.press('Enter'); await wait(page); s = await st(page);
  check('passing a year opens the next year on its example', passed.pendingYear === 4 && s.screen === 'tutorial' && s.year === 4);

  // A year with two layouts shows both, shortest first.
  await fresh(page, { schoolYear: 4, passed: empty(), learned: empty(), watched: empty() });
  await page.keyboard.press('2'); await wait(page); s = await st(page);
  const titles = s.tutorial.examples.map(e => e.title);
  for (let k = 0; k <= s.tutorial.examples[0].steps + 1; k++) { await page.keyboard.press('ArrowRight'); await wait(page, 20); }
  const second = await st(page);
  check('Year 4 multiply shows short then long multiplication', JSON.stringify(titles) === '["Short multiplication","Long multiplication"]' && second.tutorial.index === 1 && second.tutorial.step === 0);
  await page.locator('#tutorSkip').click(); await wait(page); s = await st(page);
  check('the Skip button starts learning', s.screen === 'playing' && s.mode === 'guided');

  check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' failed of ' + out.length); if (out.some(x => x.startsWith('FAIL'))) process.exitCode = 1;
})().catch(e => { console.error('HARNESS ERROR', e); server.close(); process.exit(2); });
