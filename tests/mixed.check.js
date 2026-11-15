// The mixed test: setting it up by keyboard, questions from every area with no marking until the end, going back and forth between
// questions and changing answers, the hand-in check, saving and resuming (the clock keeps running), quitting and carrying on, a time limit
// running out, ending early, the score, grade bands and the review of every answer. Also the
// test-mode boxes the new areas use: <, > and =, a choice by number, two sign boxes, and a fraction's top and bottom.
// Run from the repo root: node tests/mixed.check.js. Needs Playwright; set CHROME_PATH to use an installed Chrome.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const URL = 'http://127.0.0.1:8796/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, rel === '/' ? 'index.html' : rel); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const out = []; const errors = []; const MINUS = '−';
const AREAS = ['divide', 'multiply', 'add', 'subtract', 'number', 'fractions', 'measures', 'shape', 'data', 'algebra', 'words'];
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

// Draws the right drawing by keyboard (Tab between a test's angles), or one key away from it when `wrong` is set.
async function drawAnswer(page, wrong) {
  const keys = await page.evaluate(() => { const s = window.__digitStack.getState(); const D = window.DigitStackEngine.drawing;
    let b = s.board; const out = [];
    s.problem.steps.forEach((step, k) => { D.plan(s.problem, b, k).forEach(key => { b = D.press(s.problem, b, key, {}).state; out.push(key); });
      if (s.problem.board.tool === 'angle' && k < s.problem.steps.length - 1) { b = D.press(s.problem, b, 'Tab', {}).state; out.push('Tab'); } });
    return out; });
  for (const k of keys) await page.keyboard.press(k === ' ' ? 'Space' : k);
  if (wrong) {
    const tool = (await st(page)).problem.board.tool;
    // One change that keeps something drawn: a moved hand or mark, a cleared square, a corner moved over.
    if (tool === 'grid') { await page.keyboard.press('Backspace'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space'); }
    else if (tool === 'shade') await page.keyboard.press('Space');
    else if (tool === 'line') await page.keyboard.press('ArrowRight');
    else await page.keyboard.press('ArrowUp');
  }
  await page.keyboard.press('Enter'); await wait(page, 60);
}

// Types the right answer, or a wrong one in the first box when `wrong` is set, then hands in.
async function answer(page, wrong) {
  if ((await st(page)).problem.method === 'draw') return drawAnswer(page, wrong);
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
  // Eleven areas and ten questions: every question from a different area, one area left out.
  check('ten questions come from ten different areas', s.mixed.areas.length === 10 && new Set(s.mixed.areas).size === 10 && s.mixed.areas.every(a => AREAS.includes(a)), s.mixed.areas.join(','));
  const deadline = s.mixed.deadline;
  check('a 15-minute limit sets a deadline about 15 minutes away', deadline - Date.now() > 14.9 * 60000 && deadline - Date.now() <= 15 * 60000);
  const header = await page.locator('#modeChip').innerText();
  check('the header says mixed test and the question number', /Mixed test/.test(header) && /Question 1 of 10/.test(header), header);

  // Questions can be left empty, visited in any order and changed; nothing is marked until the test is handed in.
  await page.keyboard.press('Enter'); await wait(page);
  s = await st(page);
  check('Enter on an empty question goes on to the next one, with no warning', s.mixed.index === 1 && !s.handInWarned, JSON.stringify({ index: s.mixed.index, warned: s.handInWarned }));
  await page.keyboard.press('p'); await wait(page);
  check('P goes back to the question before', (await st(page)).mixed.index === 0);
  await page.keyboard.press('p'); await wait(page);
  check('P on the first question stays there', (await st(page)).mixed.index === 0);
  await answer(page, false);
  s = await st(page);
  check('Enter goes on to the next question with no marks', s.screen === 'playing' && s.mixed.index === 1 && (await page.locator('.cell.mark-right, .cell.mark-wrong').count()) === 0);
  const chipState = await page.locator('.question-chip').evaluateAll(cs => cs.map(c => (c.classList.contains('is-answered') ? 'a' : '-') + (c.classList.contains('is-active') ? '*' : '')).join(' '));
  check('the question strip has a chip per question: the first answered, the second current', chipState === 'a -* - - - - - - - -', chipState);
  check('the progress bar counts answered questions', s.mixed.answered === 1 && (await page.locator('#streakMeter').getAttribute('aria-valuenow')) === '1');
  const firstAnswer = (await page.evaluate(() => JSON.parse(localStorage.getItem('digitstack.mixed.v1')).answers[0]));
  await page.keyboard.press('p'); await wait(page);
  check('going back shows the answer typed before', JSON.stringify((await st(page)).entries) === JSON.stringify(firstAnswer) && Object.keys(firstAnswer).length > 0, JSON.stringify(firstAnswer));
  await page.keyboard.press('n'); await wait(page);
  check('N goes on to the next question', (await st(page)).mixed.index === 1);
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
  await page.keyboard.press('p'); await wait(page);
  const backAfterReload = (await st(page)).entries;
  await page.keyboard.press('n'); await wait(page);
  s = await st(page);
  check('after reopening, both questions keep what was typed in them', JSON.stringify(backAfterReload) === JSON.stringify(firstAnswer) && s.mixed.index === 1 && JSON.stringify(s.entries) === JSON.stringify(typed));

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

  // Answer the rest: questions 2, 4, 6 and 7 wrong, the others right.
  for (let q = 1; q < 10; q++) await answer(page, q === 1 || q === 3 || q === 5 || q === 6);
  s = await st(page);
  let handInNote = await page.locator('#fixNote').innerText();
  check('Enter on the last question asks before handing in, and says all are answered', s.screen === 'playing' && s.handInWarned && !s.mixed.finished && /All 10 questions are answered/.test(handInNote), handInNote);
  // Change an answer: question 7 goes from wrong to right through its chip.
  await page.locator('.question-chip').nth(6).click(); await wait(page);
  s = await st(page);
  check('a question\'s chip goes to that question, and the hand-in check is put away', s.mixed.index === 6 && !s.handInWarned && !(await page.locator('#fixNote').isVisible()));
  await answer(page, false);
  check('after changing question 7, Enter goes on to question 8', (await st(page)).mixed.index === 7);
  await page.keyboard.press('e'); await wait(page);
  check('E asks before handing in', (await st(page)).handInWarned && !(await st(page)).mixed.finished);
  await page.keyboard.press('e'); await wait(page, 80);
  s = await st(page);
  const right = s.mixed && s.mixed.results ? s.mixed.results.filter(r => r.correct).length : -1;
  check('E again hands the test in, and the changed answer counts: 7 right', s.screen === 'mixedResults' && s.mixed.finished && right === 7, 'right=' + right);
  check('the grade follows the score (7 of 10 is 70%: B' + MINUS + ')', s.mixed.grade === 'B' + MINUS && /7 out of 10/.test(await page.locator('#endTitle').innerText()) && /Grade B/.test(await page.locator('#endAnswer').innerText()));
  check('each question has a chip, right or not', (await page.locator('.question-chip').count()) === 10 && (await page.locator('.question-chip.is-missed').count()) === 3);
  await page.keyboard.press('ArrowRight'); await wait(page);
  s = await st(page);
  const question2 = s.problem.question + ' ' + s.problem.line;
  const reviewLine = await page.locator('#reviewLine').innerText();
  check('the arrows step through the marked questions, a wrong one showing its answer', s.reviewIndex === 1 && /not quite/.test(reviewLine) && /The answer is/.test(reviewLine) && (await page.locator('.cell.mark-wrong').count()) > 0, reviewLine);
  await page.reload(); await wait(page);
  check('marked results wait on the start screen after closing', (await st(page)).screen === 'setup' && /results/.test(await page.locator('#mixedNote').innerText()));
  await page.keyboard.press('r'); await wait(page, 80);
  // The questions that were not right (2, 4 and 6) are gone over, one after another, before finishing.
  const offer = await page.locator('#endActions').innerText();
  check('the results offer to go over the 3 missed questions, or finish with F', /Go over the 3 I missed/.test(offer) && /Finish/.test(offer), offer);
  await page.keyboard.press('Enter'); await wait(page, 80);
  s = await st(page);
  check('Enter goes over the missed questions in order, starting with question 2', s.screen === 'tutorial' && s.tutorial.kind === 'mixed' &&
    JSON.stringify(s.tutorial.questions) === '[1,3,5]' && s.problem.question + ' ' + s.problem.line === question2, JSON.stringify(s.tutorial && s.tutorial.questions));
  const shownQuestions = new Set();
  for (let i = 0; i < 300 && (await st(page)).screen === 'tutorial'; i++) { shownQuestions.add((await st(page)).tutorial.index); await page.keyboard.press('ArrowRight'); await wait(page, 10); }
  s = await st(page);
  const after = await page.locator('#endActions').innerText();
  check('each missed question is gone over, then the results come back with Finish on Enter', shownQuestions.size === 3 && s.screen === 'mixedResults' && /Go over them again/.test(after), after);
  await page.keyboard.press('Enter'); await wait(page);
  s = await st(page);
  check('Enter on the results then finishes and clears the test', s.screen === 'setup' && !s.mixed && (await stored(page, 'digitstack.mixed.v1')) === null);

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
  await page.keyboard.press('f'); await wait(page);
  check('F on the results finishes without going over the questions', (await st(page)).screen === 'setup' && (await stored(page, 'digitstack.mixed.v1')) === null);

  // Handing in early: the check lists what is not answered, and keeping going puts it away.
  await page.keyboard.press('r'); await wait(page); await page.keyboard.press('Enter'); await wait(page, 80);
  await answer(page, false); await answer(page, false);
  await page.keyboard.press('e'); await wait(page);
  handInNote = await page.locator('#fixNote').innerText();
  check('E part way through lists the questions not answered', (await st(page)).handInWarned && /18 questions are not answered, starting with 3, 4, 5, 6 and 7\./.test(handInNote), handInNote);
  await page.keyboard.press('n'); await wait(page);
  s = await st(page);
  check('N keeps going: the check is put away and the next question shows', !s.handInWarned && s.mixed.index === 3 && !(await page.locator('#fixNote').isVisible()));
  // Ending early from the pause panel.
  await page.keyboard.press('Escape'); await wait(page);
  const endLabel = await page.locator('#pauseEnd').innerText();
  await page.keyboard.press('e'); await wait(page, 80);
  s = await st(page);
  check('E in the pause panel hands the test in at once and marks it', s.screen === 'mixedResults' && s.mixed.results.filter(r => r.correct).length === 2 && !s.mixed.timeUp && /Hand in the test now/.test(endLabel), endLabel);
  await page.keyboard.press('f'); await wait(page);

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
