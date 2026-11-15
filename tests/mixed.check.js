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

// What a question holds: its typed boxes, or for a drawing its board (the test's seed is random, so any question can be a drawing).
const held = s => s.problem.method === 'draw' ? { board: s.board } : s.entries;

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

  // Grade bands: A from 90%, B from 80%, C from 70% and D from 60%, + for the top three points of each ten and − for the
  // bottom three, and under 60% is always F. Both sides of every boundary.
  await fresh(page, 4);
  const bands = await page.evaluate(() => [100, 97, 96, 93, 92, 90, 89, 87, 86, 83, 82, 80, 79, 77, 76, 73, 72, 70, 69, 67, 66, 63, 62, 60, 59, 50, 49, 0]
    .map(p => p + ':' + window.__digitStack.gradeFor(p)).join(' '));
  check('grade bands run A+ to D− in steps of three or four points, and under 60% is F', bands ===
    '100:A+ 97:A+ 96:A 93:A 92:A− 90:A− 89:B+ 87:B+ 86:B 83:B 82:B− 80:B− 79:C+ 77:C+ 76:C 73:C 72:C− 70:C− 69:D+ 67:D+ 66:D 63:D 62:D− 60:D− 59:F 50:F 49:F 0:F', bands);
  // With 30 questions each one missed after the first is a grade lower (the percentage is rounded as on the results).
  const ladder = await page.evaluate(() => [30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17].map(k => k + ':' + window.__digitStack.gradeFor(Math.round(100 * k / 30))).join(' '));
  check('out of 30, each question missed after the first drops a grade: 22 right is a C', ladder === '30:A+ 29:A+ 28:A 27:A− 26:B+ 25:B 24:B− 23:C+ 22:C 21:C− 20:D+ 19:D 18:D− 17:F', ladder);

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
  check('going back shows the answer typed before', JSON.stringify(held(await st(page))) === JSON.stringify(firstAnswer) && Object.keys(firstAnswer).length > 0, JSON.stringify(firstAnswer));
  await page.keyboard.press('n'); await wait(page);
  check('N goes on to the next question', (await st(page)).mixed.index === 1);
  check('the areas\' saved places are not touched by the test', (await stored(page, 'digitstack.play.v1')) === before);

  // Closing mid-question: the typed boxes and the clock come back.
  const boxes = await answerBoxes(page);
  // A box in front of a number may have nothing in the worked answer; take the first that has a digit.
  const firstDigit = boxes.find(b => !b.sign && !b.compare && !b.option && b.v);
  if (firstDigit) { await page.click('[data-cell-id="' + firstDigit.id + '"]'); await page.keyboard.press(firstDigit.key[0]); }
  const typed = (await st(page)).entries;
  await page.reload(); await wait(page, 80);
  s = await st(page);
  check('reopening the game carries on with the same question and its typed boxes', s.screen === 'playing' && s.mixed.index === 1 && JSON.stringify(s.entries) === JSON.stringify(typed));
  check('the deadline does not move when the game is closed', s.mixed.deadline === deadline);
  await page.keyboard.press('p'); await wait(page);
  const backAfterReload = held(await st(page));
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
  check('the grade follows the score (7 of 10 is 70%: C' + MINUS + ')', s.mixed.grade === 'C' + MINUS && /7 out of 10/.test(await page.locator('#endTitle').innerText()) &&
    (await page.locator('#endAnswer').textContent()) === 'Grade C' + MINUS, await page.locator('#endAnswer').textContent());
  check('each question has a chip, right or not', (await page.locator('.question-chip').count()) === 10 && (await page.locator('.question-chip.is-missed').count()) === 3);
  // What to practise next: the areas of the three questions not right (each area had one question, so they tie and keep the areas'
  // order), each with the key that opens it.
  const KEYS = { divide: '1', multiply: '2', add: '3', subtract: '4', number: '5', fractions: '6', measures: '7', shape: '8', data: '9', algebra: '0', words: 'W' };
  const missedAreas = AREAS.filter(a => s.mixed.results.some((r, k) => !r.correct && s.mixed.areas[k] === a));
  const advice = await page.locator('#endFocus .end-focus-item').evaluateAll(items => items.map(i => i.dataset.area + ' ' + i.querySelector('kbd').textContent + ' ' + i.querySelector('.end-focus-what').textContent));
  check('the results say which three areas to practise next, worst first, with their keys', advice.length === 3 &&
    advice.every((a, k) => a.startsWith(missedAreas[k] + ' ' + KEYS[missedAreas[k]] + ' ') && /: 0 of 1 right\.$/.test(a)) && /Practise next/.test(await page.locator('#endFocus').innerText()), JSON.stringify(advice));
  check('the advice says each area had only one question', /Each area had one question, so take these as pointers/.test(await page.locator('.end-focus-note').innerText()));
  check('the summary read aloud says what to practise', /Practise next: /.test(await page.locator('#liveRegion').textContent()));
  await page.keyboard.press('ArrowRight'); await wait(page);
  s = await st(page);
  const question2 = s.problem.question + ' ' + s.problem.line;
  const reviewLine = await page.locator('#reviewLine').innerText();
  // A wrong answer box is marked, or a wrong drawing gets the proper one drawn over it.
  const shownWrong = (await page.locator('.cell.mark-wrong').count()) + (await page.locator('#worksheet [class*="pic-solution"]').count());
  check('the arrows step through the marked questions, a wrong one showing its answer', s.reviewIndex === 1 && /not quite/.test(reviewLine) && /The answer is/.test(reviewLine) && shownWrong > 0, reviewLine);
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
  // The advice stays on the start screen: the mixed card names the areas, and their books say what to practise.
  const NAMES = { divide: 'Divide', multiply: 'Multiply', add: 'Add', subtract: 'Subtract', number: 'Number', fractions: 'Fractions', measures: 'Measures', shape: 'Shape', data: 'Data', algebra: 'Algebra', words: 'Word problems' };
  const startNote = await page.locator('#mixedNote').innerText();
  const tagged = await page.evaluate(() => Array.from(document.querySelectorAll('[data-mode]')).filter(b => { const t = b.querySelector('.mode-focus'); return t && !t.hidden; }).map(b => b.dataset.mode));
  check('the start screen keeps the advice: the mixed card names the areas and their books are tagged',
    startNote.includes('practise ' + NAMES[missedAreas[0]] + ', ' + NAMES[missedAreas[1]] + ' and ' + NAMES[missedAreas[2]] + ' next') &&
    JSON.stringify(tagged.slice().sort()) === JSON.stringify(missedAreas.slice().sort()), startNote + ' | ' + tagged.join(','));

  // A time limit that has run out ends the test at once: what was typed counts, the rest is not answered.
  await fresh(page, 3);
  await page.keyboard.press('r'); await wait(page); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await wait(page, 80);
  await answer(page, false);
  await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('digitstack.mixed.v1')); m.deadline = Date.now() - 1000; localStorage.setItem('digitstack.mixed.v1', JSON.stringify(m)); });
  await page.reload(); await wait(page, 100);
  s = await st(page);
  const kicker = await page.locator('#endKicker').innerText();
  check('a test whose time ran out opens on its results', s.screen === 'mixedResults' && s.mixed.timeUp && /Time is up/.test(kicker), kicker);
  // A test saved before the questions changed (another fingerprint) cannot be rebuilt: it is cleared, and the card says why.
  const savedTest = await stored(page, 'digitstack.mixed.v1');
  await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('digitstack.mixed.v1')); m.fingerprint = 'older'; localStorage.setItem('digitstack.mixed.v1', JSON.stringify(m)); });
  await page.reload(); await wait(page, 100);
  const clearedNote = await page.locator('#mixedNote').innerText();
  check('a saved test from before an update is cleared, and the card says so', (await st(page)).screen === 'setup' && !(await st(page)).mixed &&
    (await stored(page, 'digitstack.mixed.v1')) === null && /before the game was updated/.test(clearedNote), clearedNote);
  // Put the marked test back; marked results wait on the start screen until R.
  await page.evaluate(t => localStorage.setItem('digitstack.mixed.v1', t), savedTest);
  await page.reload(); await wait(page, 100);
  await page.keyboard.press('r'); await wait(page, 100);
  s = await st(page);
  check('only the answered question counts: 1 of 20 is 5%, an F', s.mixed.results.filter(r => r.correct).length === 1 && s.mixed.results.filter(r => !r.answered).length === 19 && s.mixed.grade === 'F');
  const failDetail = await page.locator('#endDetail').textContent();
  check('an F says it is under 60% and not a pass yet', failDetail.startsWith('5%, under 60%: not a pass yet.'), failDetail);
  check('the advice says time ran out, and counts questions not answered', /Time ran out with 19 questions not answered\./.test(await page.locator('.end-focus-note').innerText()) &&
    /not answered\./.test(await page.locator('.end-focus-what').first().innerText()), await page.locator('#endFocus').innerText());
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

  // A finished test with every answer right says so, names nothing to practise, and suggests a hard test next.
  await page.goto(URL);
  await page.evaluate(() => {
    const E = window.DigitStackEngine; const now = Date.now();
    localStorage.clear();
    const m = { version: 2, seed: 777, fingerprint: E.fingerprint(), year: 3, count: 10, minutes: 0, difficulty: 'medium', index: 10, answers: [], current: null,
      startedAt: now - 60000, deadline: null, finished: true, timeUp: false, endedAt: now, open: false };
    E.withSeed(5, () => { m.areas = E.kit.shuffle(E.AREAS).slice(0, 10); });
    for (let i = 0; i < 10; i++) {
      const p = E.withSeed((m.seed + i * 7919) >>> 0, () => E.generateProblem(m.areas[i], m.year, m.difficulty));
      m.answers.push(p.method === 'draw' ? { board: E.drawing.solved(p) } : Object.assign({}, E.solutionOf(p).values));
    }
    localStorage.setItem('digitstack.mixed.v1', JSON.stringify(m));
  });
  await page.goto(URL); await wait(page, 100);
  await page.keyboard.press('r'); await wait(page, 100);
  s = await st(page);
  const allRight = await page.locator('#endFocus').innerText();
  check('a test with every answer right says so and suggests a hard test next', s.screen === 'mixedResults' && s.mixed.results.every(r => r.correct) &&
    /Every question was right/.test(allRight) && /try a hard test/.test(allRight) && (await page.locator('#endFocus .end-focus-item').count()) === 0, allRight);

  // 22 of 30 right (the last 8 left blank) is 73%: a C, where it used to be a B−.
  await page.goto(URL);
  await page.evaluate(() => {
    const E = window.DigitStackEngine; const now = Date.now();
    localStorage.clear();
    const m = { version: 2, seed: 2230, fingerprint: E.fingerprint(), year: 4, count: 30, minutes: 0, difficulty: 'medium', index: 30, answers: [], current: null,
      startedAt: now - 60000, deadline: null, finished: true, timeUp: false, endedAt: now, open: false };
    E.withSeed(7, () => { let list = []; while (list.length < 30) list = list.concat(E.kit.shuffle(E.AREAS)); m.areas = E.kit.shuffle(list.slice(0, 30)); });
    for (let i = 0; i < 22; i++) {
      const p = E.withSeed((m.seed + i * 7919) >>> 0, () => E.generateProblem(m.areas[i], m.year, m.difficulty));
      m.answers.push(p.method === 'draw' ? { board: E.drawing.solved(p) } : Object.assign({}, E.solutionOf(p).values));
    }
    localStorage.setItem('digitstack.mixed.v1', JSON.stringify(m));
  });
  await page.goto(URL); await wait(page, 100);
  await page.keyboard.press('r'); await wait(page, 100);
  s = await st(page);
  const shown = [await page.locator('#endTitle').textContent(), await page.locator('#endAnswer').textContent(), (await page.locator('#endDetail').textContent()).split(' Time')[0]].join(' | ');
  check('22 of 30 right is 73%, grade C', s.screen === 'mixedResults' && s.mixed.results.filter(r => r.correct).length === 22 && s.mixed.grade === 'C' &&
    shown === '22 out of 30 | Grade C | 73%.', shown);

  check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' failed of ' + out.length); if (out.some(x => x.startsWith('FAIL'))) process.exitCode = 1;
})().catch(e => { console.error('HARNESS ERROR', e); server.close(); process.exit(2); });
