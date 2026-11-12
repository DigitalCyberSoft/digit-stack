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

// o: { year, area, mode, streak, progress, build, args, step, fill, wrong, selected, theme, cvd }
//  step: a step number, or 'last'. fill (tests): 'all' fills every box from the
//  worked answer, an object fills those boxes. wrong: { id: value } overrides.
async function open(page, o) {
  await page.goto(URL);
  await page.evaluate(o => {
    const E = window.DigitStackEngine;
    const empty = () => ({ divide: [], multiply: [], add: [], subtract: [] });
    const all = () => ({ divide: [1, 2, 3, 4, 5, 6, 7], multiply: [1, 2, 3, 4, 5, 6, 7], add: [1, 2, 3, 4, 5, 6, 7], subtract: [1, 2, 3, 4, 5, 6, 7] });
    const progress = { schoolYear: o.year, passed: empty(), learned: empty(), watched: o.unwatched ? empty() : all() };
    Object.keys(o.progress || {}).forEach(k => { progress[k] = o.progress[k]; });
    if (o.mode === 'test' && progress.learned[o.area].indexOf(o.year) === -1) progress.learned[o.area].push(o.year);
    localStorage.clear();
    localStorage.setItem('digitstack.progress.v1', JSON.stringify(progress));
    if (o.theme) localStorage.setItem('digitstack.theme.v1', o.theme);
    if (o.cvd) localStorage.setItem('digitstack.cvd.v1', 'on');
    if (!o.area) return;
    let round = null;
    if (o.build) {
      const problem = E[o.build].apply(null, o.args);
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
    localStorage.setItem('digitstack.play.v1', JSON.stringify({ version: 1, operation: o.area, areas: areas }));
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
    png = await page.screenshot({ clip: { x: Math.max(0, box.x - 12), y: Math.max(0, box.y - 12), width: box.width + 24, height: box.height + 24 } });
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
  await open(desk, { year: 4, progress: { passed: { divide: [], multiply: [4, 5], add: [], subtract: [] }, learned: { divide: [], multiply: [4, 5, 6], add: [4], subtract: [] } } });
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

  // Phone, with the on-screen keypad.
  await open(phone, { area: 'multiply', year: 4, streak: 1, build: 'buildMultiplication', args: [2741, 6, 4], step: 3 }); made.push(await shot(phone, 'phone'));

  await browser.close(); server.close();
  for (const entry of made) { const [name, size] = entry.split(' '); console.log(String(fs.statSync(path.join(OUT, name + '.webp')).size).padStart(8) + '  ' + size.padEnd(10) + ' guide/img/' + name + '.webp'); }
  if (errors.length) { console.error('page errors: ' + errors.join(' | ')); process.exitCode = 1; }
})().catch(e => { console.error('HARNESS ERROR', e); server.close(); process.exit(2); });
