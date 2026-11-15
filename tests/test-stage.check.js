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
// A problem's identity: its question text can be shared ("What number goes in the box?" is 1 in 5 Year 3 subtraction problems).
const ident = p => JSON.stringify([p.question, p.line || null, p.operands || null, p.target || null]);
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
    // A box in front of the number that the answer does not reach is left empty, as on paper.
    if (box.value === undefined) continue;
    if (!(await goTo(page, box.id))) return false;
    const digit = wrongFirst && first ? String((Number(box.value) + 1) % 10) : box.value;
    await page.keyboard.press(digit); first = false;
    if (wrongFirst) break;   // leave the rest empty
  }
  return true;
}
async function fresh(page, learnedYear) { await page.goto(URL); await page.evaluate(y => { localStorage.clear(); const all = window.DigitStackEngine.AREAS; const p = { schoolYear: y || 1, passed: {}, learned: {}, watched: {} }; all.forEach(a => { p.passed[a] = []; p.learned[a] = y ? [y] : []; p.watched[a] = [1, 2, 3, 4, 5, 6, 7]; }); localStorage.setItem('digitstack.progress.v1', JSON.stringify(p)); }, learnedYear || 0); await page.goto(URL); await page.waitForTimeout(40); }
// Opens a problem built here as the round in progress: in a test, or in learning. `build` is an engine builder and its arguments.
async function openRound(page, area, year, mode, build) {
  await page.goto(URL);
  await page.evaluate(([area, year, mode, build]) => {
    const E = window.DigitStackEngine; const p = E[build[0]].apply(null, build.slice(1));
    localStorage.clear();
    const prog = { schoolYear: year, passed: {}, learned: {}, watched: {} };
    E.AREAS.forEach(a => { prog.passed[a] = []; prog.learned[a] = mode === 'test' ? [year] : []; prog.watched[a] = [1, 2, 3, 4, 5, 6, 7]; });
    localStorage.setItem('digitstack.progress.v1', JSON.stringify(prog));
    const round = mode === 'test' ? { problem: p, entries: {}, selectedCellId: null } : { problem: p, actionIndex: 0, roundClean: true, fixes: 0 };
    localStorage.setItem('digitstack.play.v1', JSON.stringify({ version: 2, operation: area, areas: { [area]: { year, mode, cleanStreak: 0, round } } }));
  }, [area, year, mode, build]);
  await page.goto(URL); await page.waitForTimeout(60);
}
async function typeAt(page, id, digits) { await page.click('[data-cell-id="' + id + '"]'); for (const d of digits) await page.keyboard.press(d); }
const cellText = (page, id) => page.locator('[data-cell-id="' + id + '"]').innerText();

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

  // Navigation, editing, exchange boxes and crossing out. Year 3 subtraction also asks missing-number and estimate sentences,
  // so start again until the test is a column subtraction.
  await startTest(page, 3, '4');
  for (let i = 0; i < 60 && !(await st(page)).problem.rows.some(r => r.id === 'ex'); i++) await startTest(page, 3, '4');
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
  const endText = await page.locator('#endActions').innerText();
  check('the end panel offers to show how to solve it, or the next problem', /Not quite/.test(await page.locator('#endKicker').innerText()) &&
    await page.locator('#endActions .end-btn').count() === 3 && /Show me how/.test(endText) && /Next problem/.test(endText), endText);
  await page.screenshot({ path: SHOTS + '/tm-wrong.png' });

  // Enter walks through the missed problem: the same problem, one box per step with the game's reason, then the next problem.
  const missed = ident((await st(page)).problem);
  await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  s = await st(page);
  check('Enter walks through the missed problem', s.screen === 'tutorial' && s.tutorial.kind === 'walkthrough' && ident(s.problem) === missed && s.tutorial.step === 0,
    JSON.stringify({ screen: s.screen, kind: s.tutorial && s.tutorial.kind }));
  const walkSteps = s.problem.actions.length; const reasons = [];
  for (let k = 1; k <= walkSteps; k++) {
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(15);
    reasons.push(await page.evaluate(k => { const s = window.__digitStack.getState(); const a = s.problem.actions[k - 1];
      return document.getElementById('subprompt').textContent === a.why && document.querySelector('[data-cell-id="' + a.cellId + '"]').classList.contains('tutor-step'); }, k));
  }
  const unfilled = await page.evaluate(() => { const s = window.__digitStack.getState(); const sol = window.DigitStackEngine.solutionOf(s.problem).values;
    return Object.keys(sol).filter(id => (document.querySelector('[data-cell-id="' + id + '"]') || {}).textContent !== sol[id]); });
  check('each step of the walkthrough fills its box and gives its reason, and every box ends with the worked answer',
    reasons.length === walkSteps && reasons.every(Boolean) && unfilled.length === 0, JSON.stringify(reasons) + ' ' + unfilled.join(','));
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(40);
  check('the walkthrough ends on the answer', /The answer|=/.test(await page.locator('#prompt').innerText()) && /next problem/i.test(await page.locator('#subprompt').innerText()));
  await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  s = await st(page);
  check('then Enter goes to the next round with the count at 0', s.screen === 'playing' && s.cleanStreak === 0 && s.mode === 'test' && ident(s.problem) !== missed, s.screen);

  // N skips the walkthrough and goes straight on.
  await answer(page, true); await page.keyboard.press('Enter'); await page.waitForTimeout(40);
  if ((await st(page)).handInWarned) { await page.keyboard.press('Enter'); await page.waitForTimeout(60); }
  const missedAgain = ident((await st(page)).problem);
  const failedAgain = (await st(page)).screen === 'testFailed';
  await page.keyboard.press('n'); await page.waitForTimeout(80);
  s = await st(page);
  check('N after a missed test problem goes straight to the next one', failedAgain && s.screen === 'playing' && s.mode === 'test' && ident(s.problem) !== missedAgain, s.screen + ' failed first: ' + failedAgain);

  // Drawing in a test: the board takes the keys, Enter hands in, a wrong drawing shows the proper one, and Enter then walks through it.
  const drawPlan = () => page.evaluate(() => { const s = window.__digitStack.getState(); const D = window.DigitStackEngine.drawing;
    let b = s.board; const keys = [];
    s.problem.steps.forEach((step, k) => { const ks = D.plan(s.problem, b, k); ks.forEach(key => { b = D.press(s.problem, b, key, {}).state; }); keys.push(...ks);
      if (s.problem.board.tool === 'angle' && k < s.problem.steps.length - 1) { b = D.press(s.problem, b, 'Tab', {}).state; keys.push('Tab'); } });
    return keys; });
  const findTest = async (year, key, title) => { for (let i = 0; i < 120; i++) { await startTest(page, year, key); if ((await st(page)).problem.title === title) return true; } return false; };
  check('a drawing comes up in a test', await findTest(2, '7', 'Drawing the time'));
  await page.keyboard.press('Enter'); await page.waitForTimeout(40);
  s = await st(page);
  check('handing in an empty drawing asks first', s.screen === 'playing' && s.handInWarned && /Nothing is drawn yet/.test(await page.locator('#fixNote').innerText()));
  for (const k of await drawPlan()) await page.keyboard.press(k === ' ' ? 'Space' : k);
  await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  s = await st(page);
  check('a right drawing in a test counts as a clean round', s.screen === 'won' && s.cleanStreak === 1, s.screen);
  check('angles come up in a test', await findTest(5, '8', 'Drawing angles'));
  for (const k of await drawPlan()) await page.keyboard.press(k === ' ' ? 'Space' : k);
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  s = await st(page);
  check('a drawing 1° out is marked wrong, with the proper arm shown', s.screen === 'testFailed' && (await page.locator('#worksheet .pic-solution-line').count()) === 1 && /Not quite/.test(await page.locator('#endKicker').innerText()));
  const missedDrawing = s.problem.question;
  await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  s = await st(page);
  check('Enter walks through the missed drawing', s.screen === 'tutorial' && s.tutorial.kind === 'walkthrough' && s.problem.question === missedDrawing);
  for (let i = 0; i < 10 && (await st(page)).tutorial.step <= s.problem.steps.length; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(15); }
  const shown = await page.evaluate(() => { const s = window.__digitStack.getState(); return JSON.stringify(s.board) === JSON.stringify(window.DigitStackEngine.drawing.solved(s.problem)); });
  check('the walkthrough ends with the proper drawing on the board', shown);
  await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  const afterWalk = await st(page);
  // The game may set the same question again (about 1 time in 240 here), so a repeat counts when its board starts empty.
  const freshBoard = await page.evaluate(() => { const s = window.__digitStack.getState(); return s.problem.method === 'draw' && JSON.stringify(s.board) === JSON.stringify(window.DigitStackEngine.drawing.start(s.problem)); });
  check('then Enter goes on to the next problem', afterWalk.screen === 'playing' && afterWalk.mode === 'test' && (afterWalk.problem.question !== missedDrawing || freshBoard), afterWalk.screen + ' / ' + afterWalk.problem.question + ' / ' + missedDrawing);

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

  // Boxes in front of a number. The answer row of 389 + 442 has a box for a carry in front; 831 leaves it empty.
  await openRound(page, 'add', 3, 'test', ['buildAddition', 389, 442, 3]);
  s = await st(page);
  check('column addition has a box in front even when nothing carries', s.problem.rows.find(r => r.id === 'sum').cells.filter(Boolean).length === 4);
  await typeAt(page, 'sum-c3', ['1']); await typeAt(page, 'sum-c2', ['3']); await typeAt(page, 'sum-c1', ['8']);
  await page.keyboard.press('Enter'); await page.waitForTimeout(60); s = await st(page);
  check('the box in front left empty is right, with no "empty box" warning', s.screen === 'won' && s.cleanStreak === 1, s.screen);
  await openRound(page, 'add', 3, 'test', ['buildAddition', 389, 442, 3]);
  await typeAt(page, 'sum-c3', ['1']); await typeAt(page, 'sum-c2', ['3']); await typeAt(page, 'sum-c1', ['8']); await typeAt(page, 'sum-c0', ['0']);
  await page.keyboard.press('Enter'); await page.waitForTimeout(60); s = await st(page);
  const front = await page.evaluate(() => { const el = document.querySelector('[data-cell-id="sum-c0"]'); return { text: el.textContent, zeroed: el.classList.contains('zeroed') }; });
  check('a 0 typed in front is right and is not written on the marked sheet', s.screen === 'won' && front.text === '' && front.zeroed, JSON.stringify(front) + ' ' + s.screen);
  await openRound(page, 'add', 3, 'test', ['buildAddition', 389, 442, 3]);
  await typeAt(page, 'sum-c3', ['1']); await typeAt(page, 'sum-c2', ['3']); await typeAt(page, 'sum-c1', ['8']); await typeAt(page, 'sum-c0', ['1']);
  await page.keyboard.press('Enter'); await page.waitForTimeout(60); s = await st(page);
  check('a digit written in front of 831 is marked wrong', s.screen === 'testFailed', s.screen);
  await openRound(page, 'add', 3, 'test', ['buildAddition', 789, 642, 3]);
  await typeAt(page, 'sum-c3', ['1']); await typeAt(page, 'sum-c2', ['3']); await typeAt(page, 'sum-c1', ['4']);
  await page.keyboard.press('Enter'); await page.waitForTimeout(60); s = await st(page);
  check('789 + 642 without the 1 in front is not taken as right', s.screen === 'testFailed', s.screen);

  // Division: an R box from Year 4 even with nothing left over, and a remainder read wherever it is typed after R.
  await openRound(page, 'divide', 4, 'test', ['buildShortDivision', 864, 4, 4]);
  s = await st(page);
  check('a Year 4 division with nothing left over still has an R and its box', s.problem.rows.find(r => r.id === 'q').cells.some(c => c && c.remainderLabel) && /remainder after R/.test(s.problem.question));
  await typeAt(page, 'q-c0', ['2', '1', '6']);
  await page.keyboard.press('Enter'); await page.waitForTimeout(60); s = await st(page);
  check('216 with nothing after R is right for 864 ÷ 4', s.screen === 'won', s.screen);
  await openRound(page, 'divide', 6, 'test', ['buildDivision', 437, 15, 6]);
  await typeAt(page, 'q-c1', ['2', '9']); await typeAt(page, 'q-c4', ['2']);
  await page.keyboard.press('Enter'); await page.waitForTimeout(60); s = await st(page);
  check('a remainder of 2 typed in the first of its two boxes is right', s.screen === 'won' && await cellText(page, 'q-c5') === '2', s.screen);
  await openRound(page, 'divide', 6, 'test', ['buildDivision', 437, 15, 6]);
  await typeAt(page, 'q-c0', ['2', '9']); await typeAt(page, 'q-c4', ['2']);
  await page.keyboard.press('Enter'); await page.waitForTimeout(60); s = await st(page);
  check('29 started over the 4 leaves the ones box empty, and the hand-in asks first', s.screen === 'playing' && s.handInWarned && /1 answer box is empty/.test(await page.locator('#fixNote').innerText()), s.screen);
  await page.keyboard.press('Enter'); await page.waitForTimeout(60); s = await st(page);
  check('the answer started over the 4 (15 does not fit into 4) is marked wrong', s.screen === 'testFailed', s.screen);

  check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' failed of ' + out.length); if (out.some(x => x.startsWith('FAIL'))) process.exitCode = 1;
})().catch(e => { console.error('HARNESS ERROR', e); server.close(); process.exit(2); });
