// The mixed test: setting it up by keyboard, questions from every area with no marking until the end, saving and resuming (the clock keeps
// running), quitting and carrying on, a time limit running out, ending early, the score, grade bands and the review of every answer. Also the
// test-mode boxes the new areas use: <, > and =, a choice by number, two sign boxes, and a fraction's top and bottom.
// Run from the repo root: node tests/mixed.check.js. Needs Playwright; set CHROME_PATH to use an installed Chrome.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const URL = 'http://127.0.0.1:8796/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, rel === '/' ? 'index.html' : rel); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const out = []; const errors = []; const MINUS = '−';
const AREAS = ['divide', 'multiply', 'add', 'subtract', 'number', 'fractions', 'measures', 'shape', 'data', 'algebra'];
const check = (n, ok, d) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d !== undefined ? ' :: ' + d : ''));
const st = page => page.evaluate(() => window.__digitStack.getState());
const wait = (page, ms) => page.waitForTimeout(ms || 50);
const stored = (page, key) => page.evaluate(k => localStorage.getItem(k), key);

async function fresh(page, year) {
  await page.goto(URL);
  await page.evaluate(([areas, year]) => { const watched = {}; areas.forEach(a => { watched[a] = [1, 2, 3, 4, 5, 6, 7]; }); localStorage.clear(); localStorage.setItem('digitstack.progress.v1', JSON.stringify({ schoolYear: year, watched })); }, [AREAS, year || 4]);
  await page.goto(URL); await wait(page);
}

// The marked boxes of the question on screen, with what each must hold and the key that types it.
const answerBoxes = page => page.evaluate(() => {
  const s = window.__digitStack.getState(); const sol = window.DigitStackEngine.solutionOf(s.problem).values;
  return s.problem.rows.filter(r => s.problem.markRowIds.includes(r.id)).flatMap(r => r.cells.filter(c => c && c.kind === 'input').map(c => {
    const v = sol[c.id] || '';
    let key = v;
    if (c.option) key = String(s.problem.options.find(o => o[1] === v)[0]);
    return { id: c.id, v, key, sign: Boolean(c.signBox), compare: Boolean(c.compare), option: Boolean(c.option) };
  }));
});

// Types the right answer, or a wrong one in the first box when `wrong` is set, then hands in.
async function answer(page, wrong) {
  const boxes = await answerBoxes(page);
  let first = true;
  for (const b of boxes) {
    await page.click('[data-cell-id="' + b.id + '"]');
    if (b.sign) { if (b.v === MINUS) await page.keyboard.press('-'); continue; }
    if (wrong && first && !b.compare && !b.option) { await page.keyboard.press(String((Number(b.v) + 1) % 10)); first = false; continue; }
    if (wrong && first && b.option) { const s = await st(page); const other = s.problem.options.find(o => o[1] !== b.v); await page.keyboard.press(String(other[0])); first = false; continue; }
    if (wrong && first && b.compare) { await page.keyboard.press(b.v === '<' ? '>' : '<'); first = false; continue; }
    for (const ch of b.key) await page.keyboard.press(ch);
  }
  await page.keyboard.press('Enter'); await wait(page, 60);
}

(async () => {
  await new Promise(r => server.listen(8796, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // Grade bands: 5 points each from 50%, and under 50% is always F.
  await fresh(page, 4);
  const bands = await page.evaluate(() => [100, 95, 94, 90, 89, 85, 80, 79, 75, 70, 65, 60, 55, 54, 50, 49, 30, 0].map(p => p + ':' + window.__digitStack.gradeFor(p)).join(' '));
  check('grade bands run A+ to D in 5-point steps, and under 50% is F', bands === '100:A+ 95:A+ 94:A 90:A 89:A− 85:A− 80:B+ 79:B 75:B 70:B− 65:C+ 60:C 55:C− 54:D 50:D 49:F 30:F 0:F', bands);

  // Setting up by keyboard.
  const before = await stored(page, 'digitstack.play.v1');
  await page.keyboard.press('r'); await wait(page);
  let s = await st(page);
  check('R opens the mixed test settings: 20 questions, no time limit, medium', s.mixedOpen && s.mixedSetup.count === 20 && s.mixedSetup.minutes === 0 && s.mixedSetup.difficulty === 'medium');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight');
  s = await st(page);
  check('arrows choose 10 questions, 15 minutes and hard', s.mixedSetup.count === 10 && s.mixedSetup.minutes === 15 && s.mixedSetup.difficulty === 'hard', JSON.stringify(s.mixedSetup));
  const summary = await page.locator('#mixedSummary').innerText();
  check('the summary says what was chosen', summary === '10 questions from Year 4, hard, 15 minutes.', summary);
  await page.keyboard.press('Escape'); await wait(page); s = await st(page);
  check('Esc closes the settings without starting', !s.mixedOpen && s.screen === 'setup' && !s.mixed);
  await page.keyboard.press('r'); await wait(page); await page.keyboard.press('Enter'); await wait(page, 80);
  s = await st(page);
  check('Enter starts the test with the chosen settings', s.screen === 'playing' && s.mode === 'test' && s.mixed && s.mixed.count === 10 && s.mixed.minutes === 15 && s.mixed.difficulty === 'hard' && s.mixed.year === 4);
  check('ten questions take one from each of the ten areas', JSON.stringify(s.mixed.areas.slice().sort()) === JSON.stringify(AREAS.slice().sort()), s.mixed.areas.join(','));
  const deadline = s.mixed.deadline;
  check('a 15-minute limit sets a deadline about 15 minutes away', deadline - Date.now() > 14.9 * 60000 && deadline - Date.now() <= 15 * 60000);
  const header = await page.locator('#modeChip').innerText();
  check('the header says mixed test and the question number', /Mixed test/.test(header) && /Question 1 of 10/.test(header), header);

  // No marks until the end; an empty hand-in warns first.
  await page.keyboard.press('Enter'); await wait(page);
  s = await st(page);
  check('handing in empty boxes warns first', s.mixed.index === 0 && s.handInWarned);
  await answer(page, false);
  s = await st(page);
  check('a hand-in goes straight to the next question with no marks', s.screen === 'playing' && s.mixed.index === 1 && (await page.locator('.cell.mark-right, .cell.mark-wrong').count()) === 0);
  check('the areas\' saved places are not touched by the test', (await stored(page, 'digitstack.play.v1')) === before);

  // Closing mid-question: the typed boxes and the clock come back.
  const boxes = await answerBoxes(page);
  const firstDigit = boxes.find(b => !b.sign && !b.compare && !b.option);
  if (firstDigit) { await page.click('[data-cell-id="' + firstDigit.id + '"]'); await page.keyboard.press(firstDigit.key[0]); }
  const typed = (await st(page)).entries;
  await page.reload(); await wait(page, 80);
  s = await st(page);
  check('reopening the game carries on with the same question and its typed boxes', s.screen === 'playing' && s.mixed.index === 1 && JSON.stringify(s.entries) === JSON.stringify(typed));
  check('the deadline does not move when the game is closed', s.mixed.deadline === deadline);

  // Pausing does not stop the clock; quitting keeps the test for later.
  await page.keyboard.press('Escape'); await wait(page);
  const pauseLabels = await page.locator('.pause-stat-label').allInnerTexts();
  check('the pause panel shows the question and the time left', JSON.stringify(pauseLabels) === '["School year","Question","Time left"]' && await page.locator('#pauseEnd').isVisible(), JSON.stringify(pauseLabels));
  await page.keyboard.press('q'); await wait(page);
  s = await st(page);
  const note = await page.locator('#mixedNote').innerText();
  check('quitting goes to the start, and the card says the test is waiting', s.screen === 'setup' && /question 2 of 10/.test(note) && /Press R to carry on/.test(note), note);
  await page.reload(); await wait(page);
  check('a test left from the start screen does not reopen by itself', (await st(page)).screen === 'setup');
  await page.keyboard.press('r'); await wait(page, 80); s = await st(page);
  check('R carries on with the same question', s.screen === 'playing' && s.mixed.index === 1 && s.mixed.deadline === deadline);

  // Answer the rest: questions 2, 4 and 6 wrong, the others right.
  for (let q = 1; q < 10; q++) await answer(page, q === 1 || q === 3 || q === 5);
  s = await st(page);
  const right = s.mixed && s.mixed.results ? s.mixed.results.filter(r => r.correct).length : -1;
  check('after the last question the results show', s.screen === 'mixedResults' && s.mixed.finished && right === 7, 'right=' + right);
  check('the grade follows the score (7 of 10 is 70%: B' + MINUS + ')', s.mixed.grade === 'B' + MINUS && /7 out of 10/.test(await page.locator('#endTitle').innerText()) && /Grade B/.test(await page.locator('#endAnswer').innerText()));
  check('each question has a chip, right or not', (await page.locator('.question-chip').count()) === 10 && (await page.locator('.question-chip.is-missed').count()) === 3);
  await page.keyboard.press('ArrowRight'); await wait(page);
  s = await st(page);
  const reviewLine = await page.locator('#reviewLine').innerText();
  check('the arrows step through the marked questions, a wrong one showing its answer', s.reviewIndex === 1 && /not quite/.test(reviewLine) && /The answer is/.test(reviewLine) && (await page.locator('.cell.mark-wrong').count()) > 0, reviewLine);
  await page.reload(); await wait(page);
  check('marked results wait on the start screen after closing', (await st(page)).screen === 'setup' && /results/.test(await page.locator('#mixedNote').innerText()));
  await page.keyboard.press('r'); await wait(page, 80);
  await page.keyboard.press('Enter'); await wait(page);
  s = await st(page);
  check('Enter on the results finishes and clears the test', s.screen === 'setup' && !s.mixed && (await stored(page, 'digitstack.mixed.v1')) === null);

  // A time limit that has run out ends the test at once: what was typed counts, the rest is not answered.
  await fresh(page, 3);
  await page.keyboard.press('r'); await wait(page); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await wait(page, 80);
  await answer(page, false);
  await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('digitstack.mixed.v1')); m.deadline = Date.now() - 1000; localStorage.setItem('digitstack.mixed.v1', JSON.stringify(m)); });
  await page.reload(); await wait(page, 100);
  s = await st(page);
  const kicker = await page.locator('#endKicker').innerText();
  check('a test whose time ran out opens on its results', s.screen === 'mixedResults' && s.mixed.timeUp && /Time is up/.test(kicker), kicker);
  check('only the answered question counts: 1 of 20 is 5%, an F', s.mixed.results.filter(r => r.correct).length === 1 && s.mixed.results.filter(r => !r.answered).length === 19 && s.mixed.grade === 'F');
  await page.keyboard.press('Enter'); await wait(page);

  // Ending early from the pause panel.
  await page.keyboard.press('r'); await wait(page); await page.keyboard.press('Enter'); await wait(page, 80);
  await answer(page, false); await answer(page, false);
  await page.keyboard.press('Escape'); await wait(page); await page.keyboard.press('e'); await wait(page, 80);
  s = await st(page);
  check('E in the pause panel ends the test and marks it', s.screen === 'mixedResults' && s.mixed.results.filter(r => r.correct).length === 2 && !s.mixed.timeUp);
  await page.keyboard.press('Enter'); await wait(page);

  // The new boxes in a test: <, > and =; a choice by number; two sign boxes; a fraction's top and bottom.
  const tryKind = async (area, year, title, typeIt) => {
    await page.goto(URL);
    await page.evaluate(([areas, area, year, title]) => {
      const watched = {}; const learned = {}; areas.forEach(a => { watched[a] = [1, 2, 3, 4, 5, 6, 7]; learned[a] = [year]; });
      localStorage.clear(); localStorage.setItem('digitstack.progress.v1', JSON.stringify({ schoolYear: year, watched, learned }));
      let p; for (let i = 0; i < 6000; i++) { p = window.DigitStackEngine.generateProblem(area, year); if (p.title === title) break; }
      const saved = {}; saved[area] = { year, mode: 'test', cleanStreak: 0, round: { problem: p, entries: {}, selectedCellId: null } };
      localStorage.setItem('digitstack.play.v1', JSON.stringify({ version: 2, operation: area, areas: saved }));
    }, [AREAS, area, year, title]);
    await page.goto(URL); await wait(page, 80);
    return typeIt();
  };
  let r = await tryKind('number', 3, 'Compare', async () => {
    const b = (await answerBoxes(page))[0];
    await page.click('[data-cell-id="' + b.id + '"]'); await page.keyboard.press(b.v === '<' ? ',' : (b.v === '>' ? '.' : '='));
    const shownText = await page.locator('[data-cell-id="' + b.id + '"]').innerText();
    await page.keyboard.press('Enter'); await wait(page, 60);
    return { ok: shownText === b.v && (await st(page)).roundClean, shownText };
  });
  check('a comparison box takes <, > and = (and , and . for them) and marks right', r.ok, JSON.stringify(r));
  r = await tryKind('shape', 4, 'Quadrilaterals', async () => {
    const b = (await answerBoxes(page))[0];
    await page.click('[data-cell-id="' + b.id + '"]'); await page.keyboard.press(b.key);
    const shownText = await page.locator('[data-cell-id="' + b.id + '"]').innerText();
    await page.keyboard.press('Enter'); await wait(page, 60);
    return { ok: shownText === b.v && (await st(page)).roundClean, shownText, want: b.v };
  });
  check('a choice box shows the name of the number typed and marks right', r.ok, JSON.stringify(r));
  r = await tryKind('shape', 6, 'Coordinates', async () => {
    const boxes = await answerBoxes(page);
    // Minus is pressed with the number's own digit box selected, before its digit.
    for (let k = 0; k < boxes.length; k++) {
      const b = boxes[k]; if (b.sign) continue;
      await page.click('[data-cell-id="' + b.id + '"]');
      const signBox = k > 0 && boxes[k - 1].sign ? boxes[k - 1] : null;
      if (signBox && signBox.v === MINUS) await page.keyboard.press('-');
      await page.keyboard.press(b.key);
    }
    const s1 = await st(page);
    const signs = boxes.filter(b => b.sign).map(b => (s1.entries[b.id] || '') === (b.v || ''));
    await page.keyboard.press('Enter'); await wait(page, 60);
    return { ok: signs.length === 2 && signs.every(Boolean) && (await st(page)).roundClean, signs };
  });
  check('minus goes in the sign box of the number being typed, with two sign boxes in a pair of coordinates', r.ok, JSON.stringify(r));
  r = await tryKind('fractions', 6, 'Simplify', async () => {
    const boxes = await answerBoxes(page);
    const top = boxes.find(b => b.id.startsWith('top-')); const bottom = boxes.find(b => b.id.startsWith('bottom-'));
    await page.click('[data-cell-id="' + top.id + '"]'); for (const ch of top.key) await page.keyboard.press(ch);
    await page.click('[data-cell-id="' + top.id + '"]'); await page.keyboard.press('ArrowDown');
    const moved = (await st(page)).selectedCellId;
    for (const ch of bottom.key) await page.keyboard.press(ch);
    await page.keyboard.press('Enter'); await wait(page, 60);
    return { ok: moved.startsWith('bottom-') && (await st(page)).roundClean, moved };
  });
  check('a fraction takes its top, then the down arrow goes to its bottom', r.ok, JSON.stringify(r));

  check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' failed of ' + out.length); if (out.some(x => x.startsWith('FAIL'))) process.exitCode = 1;
})().catch(e => { console.error('HARNESS ERROR', e); server.close(); process.exit(2); });
