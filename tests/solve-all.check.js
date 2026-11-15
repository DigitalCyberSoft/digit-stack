// Full rounds by keyboard, Year 1 to Year 7 in all eleven areas, must finish clean. A case that names a layout gets that layout as its round
// (drawn in the page until it comes up), so long multiplication, decimal division, <, > and =, choices by number and sign boxes are all
// typed for real; the others play their area's ordinary mix.
// Run from the repo root: node tests/solve-all.check.js. Needs Playwright; set CHROME_PATH to use an installed Chrome.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const URL = 'http://127.0.0.1:8775/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, rel === '/' ? 'index.html' : rel); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const out = []; const errors = []; const MINUS = '−';
const AREAS = ['divide', 'multiply', 'add', 'subtract', 'number', 'fractions', 'measures', 'shape', 'data', 'algebra', 'words'];
const check = (n, ok, d) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d !== undefined ? ' :: ' + d : ''));
const st = page => page.evaluate(() => window.__digitStack.getState());
async function solve(page) {
  for (let i = 0; i < 900; i++) {
    const s = await st(page); if (s.screen !== 'playing') return s; const a = s.action;
    if (a.kind === 'draw') {
      // A drawing: the engine's plan for this step, by keyboard, then Enter (a corner on a grid is checked as it is placed).
      const plan = await page.evaluate(() => { const s = window.__digitStack.getState(); const D = window.DigitStackEngine.drawing;
        return { keys: D.plan(s.problem, s.board, s.actionIndex), on: D.checkOn(s.problem) }; });
      for (const k of plan.keys) await page.keyboard.press(k === ' ' ? 'Space' : k);
      if (plan.on !== 'place') await page.keyboard.press('Enter');
      await page.waitForTimeout(20);
      continue;
    }
    if (a.kind === 'digit') await page.keyboard.press(String(a.value));
    else if (a.kind === 'sign') await page.keyboard.press(a.value === MINUS ? '-' : String(a.firstDigit));
    else if (a.kind === 'compare') await page.keyboard.press(a.value);
    else await page.waitForTimeout(560);
    await page.waitForTimeout(8);
  }
  throw new Error('timeout');
}

// [year, key, layout title that must be solved (null: any), label, rounds at least]
const CASES = [
  [1, '2', null, 'Y1 multiply pictures and facts', 3], [1, '1', null, 'Y1 divide', 3], [2, '2', null, 'Y2 multiply facts', 3],
  [2, '4', 'Column subtraction', 'Y2 subtract in columns', 2], [5, '2', 'Long multiplication', 'Y5 long multiplication', 1],
  [6, '1', 'Long division', 'Y6 long division', 1], [7, '1', 'Long division', 'Y7 long division', 1], [7, '2', 'Long multiplication', 'Y7 long multiplication', 1],
  [6, '3', 'Column addition', 'Y6 column addition', 1], [6, '1', 'Decimal division', 'Y6 decimal division', 1], [5, '4', 'Decimal subtraction', 'Y5 decimal subtraction', 1],
  [3, '5', 'Compare', 'Y3 number: <, > and =', 1], [4, '6', null, 'Y4 fractions', 4], [2, '7', 'Telling the time', 'Y2 telling the time', 1],
  [4, '8', 'Quadrilaterals', 'Y4 quadrilaterals: a choice by number', 1], [6, '9', 'Pie charts', 'Y6 pie charts', 1], [7, '0', 'Equations', 'Y7 equations with a sign box', 1],
  [2, 'w', null, 'Y2 word problems', 3], [4, 'w', 'Two steps', 'Y4 two-step word problem with working lines', 1], [7, 'w', 'Best buy', 'Y7 best buy: working lines and a choice', 1],
  // Drawing, by keyboard: every board.
  [2, '7', 'Drawing the time', 'Y2 drawing the hands on a clock', 1], [4, '7', 'Drawing lines', 'Y4 drawing a line with a ruler', 1], [5, '5', 'Thermometers', 'Y5 a thermometer', 1],
  [4, '5', 'Number lines', 'Y4 marking a number line', 1], [3, '6', 'Shading', 'Y3 shading a fraction', 1], [4, '8', 'Symmetric figures', 'Y4 completing a symmetric figure', 1],
  [6, '8', 'Drawing nets', 'Y6 completing a net of a cube', 1], [3, '8', 'Drawing shapes', 'Y3 drawing a rectangle on a grid', 1], [6, '8', 'Drawing reflections', 'Y6 reflecting in an axis', 1],
  [7, '8', 'Drawing rotations', 'Y7 rotating about the origin', 1], [5, '8', 'Drawing angles', 'Y5 drawing an angle with a protractor', 1], [6, '8', 'Drawing triangles', 'Y6 drawing a triangle from two angles', 1],
  [2, '9', 'Pictograms to draw', 'Y2 completing a pictogram', 1], [1, '9', 'Tally charts to draw', 'Y1 completing a tally chart', 1], [4, '9', 'Line graphs to draw', 'Y4 plotting a line graph', 1],
  [6, '9', 'Drawing pie charts', 'Y6 drawing a pie chart', 1], [7, '0', 'Plotting graphs', 'Y7 plotting a straight-line graph', 1]
];

(async () => {
  await new Promise(r => server.listen(8775, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  for (const [year, key, title, label, rounds] of CASES) {
    const area = key === 'w' ? 'words' : AREAS[(Number(key) + 9) % 10];
    await page.goto(URL);
    // A named layout is drawn in the page until it comes up, then saved as the round in progress, so the case never depends on luck.
    await page.evaluate(([areas, area, year, title]) => {
      const watched = {}; areas.forEach(a => { watched[a] = [1, 2, 3, 4, 5, 6, 7]; });
      localStorage.clear(); localStorage.setItem('digitstack.progress.v1', JSON.stringify({ schoolYear: year, watched }));
      if (!title) return;
      let p; for (let i = 0; i < 5000; i++) { p = window.DigitStackEngine.generateProblem(area, year); if (p.title === title) break; }
      if (p.title !== title) throw new Error('no ' + title);
      const saved = {}; saved[area] = { year, mode: 'guided', cleanStreak: 0, round: { problem: p, actionIndex: 0, roundClean: true, fixes: 0 } };
      localStorage.setItem('digitstack.play.v1', JSON.stringify({ version: 2, operation: area, areas: saved }));
    }, [AREAS, area, year, title]);
    await page.goto(URL); await page.waitForTimeout(60);
    if (!title) { await page.keyboard.press(key); await page.waitForTimeout(60); }
    let ok = true; let solved = 0; const titles = new Set();
    for (let r = 0; r < rounds; r++) {
      const s0 = await st(page); titles.add(s0.problem.title);
      if (s0.operation !== area || s0.year !== year) { ok = false; break; }
      const e = await solve(page); if (e.screen !== 'won') { ok = false; break; }
      solved++;
      await page.keyboard.press('Enter'); await page.waitForTimeout(40);
    }
    check(label + ' solves clean by keyboard', ok && solved === rounds && (!title || titles.has(title)), 'solved ' + solved + ', layouts ' + [...titles].join('/'));
  }
  check('no console or page errors', errors.length === 0, errors.join(' | '));
  await browser.close(); server.close(); console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' failed of ' + out.length); if (out.some(x => x.startsWith('FAIL'))) process.exitCode = 1;
})().catch(e => { console.error(e); server.close(); process.exit(2); });
