// Makes the guide screenshots in guide/img. Each one opens the game in an exact
// state by saving a round the way the game does, then reopening the page.
// Run from the repo root: node tools/screenshots.js. Needs Playwright; set CHROME_PATH to use an installed Chrome.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const OUT = path.join(ROOT, 'guide', 'img'); const URL = 'http://127.0.0.1:8779/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, rel === '/' ? 'index.html' : rel); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const MINUS = '−';
const errors = [];

// o: { year, area, mode, streak, progress, build, args, title, seed, sentence, step, fill, wrong, selected, theme, cvd }
//  build/args: an engine builder. title (+ seed): the first problem with that title made from that seed, so a shot never changes.
//  sentence: a buildSentence spec.
//  step: a step number, or 'last'. fill (tests): 'all' fills every box from the
//  worked answer, an object fills those boxes. wrong: { id: value } overrides.
async function open(page, o) {
  await page.goto(URL);
  await page.evaluate(o => {
    const E = window.DigitStackEngine;
    const empty = () => { const m = {}; E.AREAS.forEach(a => { m[a] = []; }); return m; };
    const all = () => { const m = {}; E.AREAS.forEach(a => { m[a] = [1, 2, 3, 4, 5, 6, 7]; }); return m; };
    const progress = { schoolYear: o.year, passed: empty(), learned: empty(), watched: o.unwatched ? empty() : all() };
    Object.keys(o.progress || {}).forEach(k => { progress[k] = o.progress[k]; });
    if (o.mode === 'test' && progress.learned[o.area].indexOf(o.year) === -1) progress.learned[o.area].push(o.year);
    localStorage.clear();
    localStorage.setItem('digitstack.progress.v1', JSON.stringify(progress));
    if (o.theme) localStorage.setItem('digitstack.theme.v1', o.theme);
    if (o.cvd) localStorage.setItem('digitstack.cvd.v1', 'on');
    if (!o.area) return;
    let round = null;
    if (o.title && !o.build) {
      o.problem = E.withSeed(o.seed || 1, () => { for (let i = 0; i < 20000; i++) { const p = E.generateProblem(o.area, o.year); if (p.title === o.title) return p; } throw new Error('no ' + o.title); });
    }
    if (o.sentence) o.problem = E.buildSentence(o.sentence);
    if (o.build || o.problem) {
      const problem = o.problem || E[o.build].apply(null, o.args);
      if (o.mode === 'test') {
        const values = E.solutionOf(problem).values;
        const entries = o.fill === 'all' ? Object.assign({}, values) : Object.assign({}, o.fill || {});
        Object.keys(o.wrong || {}).forEach(id => { entries[id] = o.wrong[id]; });
        round = { problem: problem, entries: entries, selectedCellId: o.selected || null };
      } else {
        const index = o.step === 'last' ? problem.actions.length - 1 : (o.step || 0);
        round = { problem: problem, actionIndex: index, roundClean: true, fixes: 0 };
      }
    }
    const areas = {};
    areas[o.area] = { year: o.year, mode: o.mode || 'guided', cleanStreak: o.streak || 0, round: round };
    localStorage.setItem('digitstack.play.v1', JSON.stringify({ version: 2, operation: o.area, areas: areas }));
  }, o);
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}
const state = page => page.evaluate(() => window.__digitStack.getState());
async function finish(page) { const s = await state(page); await page.keyboard.press(s.action.value === MINUS ? '-' : String(s.action.value)); await page.waitForTimeout(700); }
// Saved as WebP, encoded by the browser itself, at about a fifth of the PNG size.
// A cropped element keeps a 12 px margin, so a sheet shows its cover-colour frame.
async function shot(page, name, target) {
  let png;
  if (target) {
    const box = await page.locator(target).boundingBox();
    // fullPage lets a tall element (the ten books) be captured past the bottom of the window. Its clip is measured from the top of the
    // page, while boundingBox is measured from the top of the window, so add how far the game has scrolled (it scrolls to the active box
    // on a tall sheet).
    const [sx, sy] = await page.evaluate(() => [window.scrollX, window.scrollY]);
    png = await page.screenshot({ fullPage: true, clip: { x: Math.max(0, box.x + sx - 12), y: Math.max(0, box.y + sy - 12), width: box.width + 24, height: box.height + 24 } });
  } else {
    png = await page.screenshot();
  }
  const webp = await page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return { url: canvas.toDataURL('image/webp', 0.9), width: img.naturalWidth, height: img.naturalHeight };
  }, png.toString('base64'));
  if (!webp.url.startsWith('data:image/webp')) throw new Error('This browser cannot encode WebP');
  fs.writeFileSync(path.join(OUT, name + '.webp'), Buffer.from(webp.url.split(',')[1], 'base64'));
  return name + ' ' + webp.width + 'x' + webp.height;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise(r => server.listen(8779, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 820 } })).newPage();
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  [desk, phone].forEach(p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); });
  const made = [];
  const add789 = { area: 'add', year: 3, build: 'buildAddition', args: [789, 642, 3] };
  const sub932 = { area: 'subtract', year: 3, build: 'buildSubtraction', args: [932, 457, 3] };

  // Start screens.
  await open(desk, { year: 3 }); made.push(await shot(desk, 'start'));
  await open(desk, { year: 4, progress: { passed: { divide: [], multiply: [4, 5], add: [], subtract: [], number: [4], fractions: [], measures: [], shape: [], data: [4, 5], algebra: [], words: [] },
    learned: { divide: [], multiply: [4, 5, 6], add: [4], subtract: [], number: [4, 5], fractions: [4], measures: [], shape: [], data: [4, 5], algebra: [], words: [4] } } });
  made.push(await shot(desk, 'start-progress', '.mode-panel'));

  // Learning.
  await open(desk, Object.assign({ streak: 2, step: 1 }, add789)); made.push(await shot(desk, 'learn-carry'));
  await open(desk, { area: 'add', year: 3, streak: 2, build: 'buildAddition', args: [465, 372, 3], step: 2 }); made.push(await shot(desk, 'learn-zero'));
  await open(desk, Object.assign({ streak: 1, step: 1 }, sub932)); made.push(await shot(desk, 'learn-exchange'));
  await open(desk, Object.assign({ streak: 2, step: 1 }, add789));
  await desk.keyboard.press('0'); await desk.waitForTimeout(700); made.push(await shot(desk, 'mistake'));
  await open(desk, Object.assign({ streak: 4, step: 'last' }, add789)); await finish(desk); made.push(await shot(desk, 'learning-done'));

  // Tests.
  await open(desk, Object.assign({ mode: 'test', streak: 1, fill: { 'ex-c2': '12', 'ex-c1': '2', 'diff-c2': '5' }, selected: 'diff-c1' }, sub932)); made.push(await shot(desk, 'test-open'));
  await open(desk, { area: 'multiply', year: 3, mode: 'test', streak: 2, build: 'buildMultiplication', args: [342, 7, 3], fill: { 'p0-c3': '4', 'p0-c2': '8', 'p0-c1': '3', 'p0-c0': '2' } });
  await desk.keyboard.press('Enter'); await desk.waitForTimeout(700); made.push(await shot(desk, 'test-wrong'));
  // Enter then walks through the same problem, one box per step with its reason.
  await desk.keyboard.press('Enter'); await desk.waitForTimeout(300);
  for (let k = 0; k < 3; k++) { await desk.keyboard.press('ArrowRight'); await desk.waitForTimeout(150); }
  await desk.waitForTimeout(500); made.push(await shot(desk, 'walkthrough'));
  await open(desk, Object.assign({ mode: 'test', streak: 4, fill: 'all' }, add789));
  await desk.keyboard.press('Enter'); await desk.waitForTimeout(700); made.push(await shot(desk, 'year-passed'));

  // Pause, with the clean count and the saving note.
  await open(desk, Object.assign({ streak: 3, step: 3 }, add789));
  await desk.keyboard.press('Escape'); await desk.waitForTimeout(400); made.push(await shot(desk, 'pause'));

  // Each written method, finished.
  for (const [name, o] of [
    ['method-add', add789],
    ['method-subtract', sub932],
    ['method-short-multiply', { area: 'multiply', year: 3, build: 'buildMultiplication', args: [342, 7, 3] }],
    ['method-long-multiply', { area: 'multiply', year: 5, build: 'buildMultiplication', args: [124, 26, 5] }],
    ['method-short-divide', { area: 'divide', year: 4, build: 'buildShortDivision', args: [432, 5, 4] }],
    ['method-long-divide', { area: 'divide', year: 5, build: 'buildDivision', args: [432, 15, 5] }],
    ['early-picture', { area: 'multiply', year: 1, build: 'buildPicture', args: ['multiply', 4, 5, null, 1] }],
    ['early-fact', { area: 'multiply', year: 2, build: 'buildFact', args: ['multiply', 3, 8, 2, 'a'] }],
    ['below-zero', { area: 'subtract', year: 5, build: 'buildSumSentence', args: [{ area: 'subtract', terms: [6, 14], ops: [MINUS], year: 5, signBox: true, brackets: false }] }]
  ]) {
    await open(desk, Object.assign({ step: 'last' }, o)); await finish(desk); made.push(await shot(desk, name, '#sheet'));
  }

  // A worked example, three steps in, on a year's first visit.
  await open(desk, { area: 'add', year: 3, unwatched: true });
  for (let k = 0; k < 3; k++) { await desk.keyboard.press('ArrowRight'); await desk.waitForTimeout(150); }
  await desk.waitForTimeout(400); made.push(await shot(desk, 'tutorial-step'));

  // Display settings: dark, and colour-blind friendly colours on a marked test.
  await open(desk, { year: 3, theme: 'dark' }); made.push(await shot(desk, 'dark-start'));
  await open(desk, Object.assign({ streak: 2, step: 1, theme: 'dark' }, add789)); made.push(await shot(desk, 'dark-learn'));
  await open(desk, { area: 'multiply', year: 3, mode: 'test', streak: 2, cvd: true, build: 'buildMultiplication', args: [342, 7, 3], fill: { 'p0-c3': '4', 'p0-c2': '8', 'p0-c1': '3', 'p0-c0': '2' } });
  await desk.keyboard.press('Enter'); await desk.waitForTimeout(700); made.push(await shot(desk, 'cvd-test-wrong', '#sheet'));

  // The other areas: pictures, fractions, comparisons and choices.
  const topic = (o) => Object.assign({ step: 0 }, o);
  for (const [name, o, target] of [
    ['topic-fraction', topic({ area: 'fractions', year: 6, title: 'Adding fractions', seed: 3, step: 'last' }), '#sheet'],
    ['topic-clock', topic({ area: 'measures', year: 2, title: 'Telling the time', seed: 5 }), '#sheet'],
    ['topic-angle', topic({ area: 'shape', year: 5, title: 'Measuring angles', seed: 2 }), '#sheet'],
    ['topic-compare', topic({ area: 'number', year: 3, title: 'Compare', seed: 1, step: 'last' }), '#sheet'],
    ['topic-chart', topic({ area: 'data', year: 3, title: 'Bar charts', seed: 4 }), null],
    ['topic-choice', topic({ area: 'shape', year: 4, title: 'Quadrilaterals', seed: 6 }), null]
  ]) {
    await open(desk, o); if (o.step === 'last') await finish(desk); made.push(await shot(desk, name, target));
  }
  for (const [name, o] of [
    ['method-decimal', { area: 'divide', year: 6, build: 'buildDecimalDivision', args: ['432', 15, 1, 6], step: 'last' }],
    ['remainder-fraction', { area: 'divide', year: 6, step: 'last', sentence: { area: 'divide', year: 6, title: 'Remainder as a fraction', stage: 'FRACTION',
      prompt: '432 ÷ 15 = 28 r 12. Write the answer as a mixed number, in its simplest form.', why: 'The remainder 12 is 12/15 of another 15. Divide the top and bottom by 3: 12/15 = 4/5. So 432 ÷ 15 = 28 4/5.',
      tokens: [{ n: 432 }, { s: '÷' }, { n: 15 }, { s: '=' }, { n: 28 }, { frac: [{ ask: 4 }, { ask: 5 }] }], check: { kind: 'statement', simplest: true } } }]
  ]) {
    await open(desk, o); await finish(desk); made.push(await shot(desk, name, '#sheet'));
  }

  // Drawing: a reflection part way through (the first corner plotted, the pencil on its way to the second), and an angle being turned.
  const drawSome = async (page, fraction) => {
    const keys = await page.evaluate(() => { const s = window.__digitStack.getState(); return window.DigitStackEngine.drawing.plan(s.problem, s.board, s.actionIndex); });
    for (const k of keys.slice(0, Math.floor(keys.length * fraction))) await page.keyboard.press(k === ' ' ? 'Space' : k);
    await page.waitForTimeout(300);
  };
  await open(desk, { area: 'shape', year: 5, title: 'Drawing reflections', seed: 3, step: 1 }); await drawSome(desk, 0.5); made.push(await shot(desk, 'draw-reflect'));
  await open(desk, { area: 'shape', year: 5, title: 'Drawing angles', seed: 5 }); await drawSome(desk, 0.8); made.push(await shot(desk, 'draw-angle', '#sheet'));
  // A perpendicular bisector, finished: both arcs and the ruler line.
  await desk.evaluate(() => {
    const E = window.DigitStackEngine; const all = {}; E.AREAS.forEach(a => { all[a] = [1, 2, 3, 4, 5, 6, 7]; });
    const p = E.withSeed(11, () => { for (let i = 0; i < 400; i++) { const q = E.drawing.kinds.construct(7); if (q && q.board.kind === 'bisector') return q; } return null; });
    localStorage.setItem('digitstack.progress.v1', JSON.stringify({ schoolYear: 7, watched: all }));
    localStorage.setItem('digitstack.play.v1', JSON.stringify({ version: 2, operation: 'shape', areas: { shape: { year: 7, mode: 'guided', cleanStreak: 0, round: { problem: p, actionIndex: 2, roundClean: true, fixes: 0 } } } }));
  });
  await desk.reload(); await desk.evaluate(() => document.fonts.ready); await desk.waitForTimeout(400);
  await drawSome(desk, 1); made.push(await shot(desk, 'draw-construct', '#sheet'));

  // The mixed test: settings, a question part way through, and marked results.
  await open(desk, { year: 4 });
  await desk.keyboard.press('r'); await desk.waitForTimeout(250);
  for (const k of ['ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight']) await desk.keyboard.press(k);
  await desk.waitForTimeout(150); made.push(await shot(desk, 'mixed-setup'));
  await desk.evaluate(() => {
    const E = window.DigitStackEngine; const now = Date.now();
    const m = { version: 2, seed: 4242, fingerprint: E.fingerprint(), year: 4, count: 20, minutes: 30, difficulty: 'medium', index: 2, answers: [], current: null, startedAt: now - 260000, deadline: now - 260000 + 1800000, finished: false, timeUp: false, endedAt: null, open: true };
    let list = []; E.withSeed(99, () => { while (list.length < 20) list = list.concat(E.kit.shuffle(E.AREAS)); list = E.kit.shuffle(list.slice(0, 20)); }); m.areas = list;
    const q = i => E.withSeed((m.seed + i * 7919) >>> 0, () => E.generateProblem(m.areas[i], m.year, m.difficulty));
    for (let i = 0; i < 2; i++) m.answers.push(E.solutionOf(q(i)).values);
    localStorage.setItem('digitstack.mixed.v1', JSON.stringify(m));
  });
  await desk.reload(); await desk.evaluate(() => document.fonts.ready); await desk.waitForTimeout(400); made.push(await shot(desk, 'mixed-question'));
  await desk.evaluate(() => {
    const E = window.DigitStackEngine; const m = JSON.parse(localStorage.getItem('digitstack.mixed.v1'));
    const q = i => E.withSeed((m.seed + i * 7919) >>> 0, () => E.generateProblem(m.areas[i], m.year, m.difficulty));
    m.answers = []; for (let i = 0; i < 20; i++) { const v = Object.assign({}, E.solutionOf(q(i)).values); if (i === 3 || i === 8 || i === 15) { const k = Object.keys(v).find(id => /^\d$/.test(v[id])); if (k) v[k] = String((Number(v[k]) + 1) % 10); } m.answers.push(v); }
    m.index = 20; m.finished = true; m.open = false; m.endedAt = m.startedAt + 1416000;
    localStorage.setItem('digitstack.mixed.v1', JSON.stringify(m));
  });
  await desk.reload(); await desk.waitForTimeout(300); await desk.keyboard.press('r'); await desk.waitForTimeout(400);
  await desk.keyboard.press('ArrowRight'); await desk.keyboard.press('ArrowRight'); await desk.keyboard.press('ArrowRight'); await desk.waitForTimeout(250);
  made.push(await shot(desk, 'mixed-results'));

  // Phone, with the on-screen keypad.
  await open(phone, { area: 'multiply', year: 4, streak: 1, build: 'buildMultiplication', args: [2741, 6, 4], step: 3 }); made.push(await shot(phone, 'phone'));

  await browser.close(); server.close();
  for (const entry of made) { const [name, size] = entry.split(' '); console.log(String(fs.statSync(path.join(OUT, name + '.webp')).size).padStart(8) + '  ' + size.padEnd(10) + ' guide/img/' + name + '.webp'); }
  if (errors.length) { console.error('page errors: ' + errors.join(' | ')); process.exitCode = 1; }
})().catch(e => { console.error('HARNESS ERROR', e); server.close(); process.exit(2); });
