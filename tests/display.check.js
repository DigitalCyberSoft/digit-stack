// Display settings: the theme (auto, light, dark) and colour-blind friendly colours. Checks cycling, saving, following the device, no flash of the
// wrong theme, the guides following the setting, WCAG contrast of key text in all four combinations, and that colour-blind colours stay apart
// under simulated protanopia, deuteranopia and tritanopia.
// Run from the repo root: node tests/display.check.js. Needs Playwright; set CHROME_PATH to use an installed Chrome.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const URL = 'http://127.0.0.1:8783/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, rel === '/' ? 'index.html' : rel); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const out = []; const errors = [];
const check = (n, ok, d) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d !== undefined ? ' :: ' + d : ''));
const KEYS = { theme: 'digitstack.theme.v1', cvd: 'digitstack.cvd.v1' };
const html = page => page.evaluate(() => Object.assign({}, document.documentElement.dataset));
const st = page => page.evaluate(() => window.__digitStack.getState());

// Machado, Oliveira and Fernandes (2009), "A Physiologically-based Model for Simulation of Color Vision Deficiency", Table 1, severity 1.0,
// from the authors' page (inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation). The matrices come from the primaries' spectral power, so they act
// on linear RGB.
const MACHADO = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]
};
const hex = h => { const v = h.trim().replace('#', ''); return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) / 255); };
const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const clamp = v => Math.min(1, Math.max(0, v));
const simulate = (rgb, m) => { const l = rgb.map(lin); return m.map(r => clamp(r[0] * l[0] + r[1] * l[1] + r[2] * l[2])); };
function lab([r, g, b]) {
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Contrast of an element's text (or a pseudo-element's) against the background it sits on, compositing see-through layers.
function contrastIn(page, selector, pseudo, against) {
  return page.evaluate(([sel, pse, ag]) => {
    const el = document.querySelector(sel); if (!el) return null;
    const parse = s => { const n = s.match(/[\d.]+/g).map(Number); return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 }; };
    const style = pse ? getComputedStyle(el, pse) : getComputedStyle(el);
    const fg = parse(ag === 'own-bg' ? style.backgroundColor : style.color);
    const layers = [];
    if (pse) layers.push(parse(ag === 'own-bg' ? getComputedStyle(el).backgroundColor : style.backgroundColor));
    for (let n = pse && ag === 'own-bg' ? el.parentElement : el; n && layers.every(l => l.a < 1); n = n.parentElement) layers.push(parse(getComputedStyle(n).backgroundColor));
    if (layers.every(l => l.a < 1)) layers.push(parse(getComputedStyle(document.documentElement).backgroundColor));
    let acc = null;
    for (let i = layers.length - 1; i >= 0; i--) { const c = layers[i]; acc = acc ? { r: c.r * c.a + acc.r * (1 - c.a), g: c.g * c.a + acc.g * (1 - c.a), b: c.b * c.a + acc.b * (1 - c.a) } : c; }
    const lum = c => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const top = { r: fg.r * fg.a + acc.r * (1 - fg.a), g: fg.g * fg.a + acc.g * (1 - fg.a), b: fg.b * fg.a + acc.b * (1 - fg.a) };
    const a = lum(top), b = lum(acc);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, [selector, pseudo || null, against || null]);
}

async function open(page, settings) {
  await page.goto(URL);
  await page.evaluate(([s, k]) => { localStorage.clear(); localStorage.setItem('digitstack.progress.v1', JSON.stringify({ schoolYear: 1, watched: { divide: [1, 2, 3, 4, 5, 6, 7], multiply: [1, 2, 3, 4, 5, 6, 7], add: [1, 2, 3, 4, 5, 6, 7], subtract: [1, 2, 3, 4, 5, 6, 7] } })); if (s.theme) localStorage.setItem(k.theme, s.theme); if (s.cvd) localStorage.setItem(k.cvd, s.cvd); }, [settings || {}, KEYS]);
  await page.goto(URL); await page.waitForTimeout(80);
}

(async () => {
  await new Promise(r => server.listen(8783, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); return p; };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  const page = watch(await ctx.newPage());

  // Automatic follows the device, including a change while the page is open.
  await open(page);
  let d = await html(page);
  check('with nothing saved the theme is automatic and follows a light device', d.theme === 'auto' && d.mode === 'light' && d.cvd === 'off');
  await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(50); d = await html(page);
  check('automatic switches to dark as soon as the device does', d.mode === 'dark');
  await page.emulateMedia({ colorScheme: 'light' }); await page.waitForTimeout(50);

  // T cycles automatic, light, dark; the choice is saved and the button says so.
  const seen = [];
  for (let i = 0; i < 3; i++) { await page.keyboard.press('t'); d = await html(page); seen.push(d.theme + '/' + d.mode); }
  check('T cycles automatic, light, dark and back', seen.join(' ') === 'light/light dark/dark auto/light', seen.join(' '));
  await page.keyboard.press('t'); await page.keyboard.press('t');
  const title = await page.locator('#themeBtn').getAttribute('title');
  check('the theme button names the setting', title === 'Theme: dark (T)', title);
  await page.emulateMedia({ colorScheme: 'light' }); await page.reload(); d = await html(page);
  check('a dark choice is saved and beats a light device', d.theme === 'dark' && d.mode === 'dark' && await page.evaluate(k => localStorage.getItem(k), KEYS.theme) === 'dark');
  await page.locator('#themeBtn').click(); d = await html(page);
  check('the theme button changes the theme too', d.theme === 'auto' && d.mode === 'light');

  // C switches colour-blind friendly colours.
  await page.keyboard.press('c'); d = await html(page);
  const pressed = await page.locator('#cvdBtn').getAttribute('aria-pressed');
  await page.reload(); const kept = await html(page);
  check('C turns colour-blind friendly colours on, and it is saved', d.cvd === 'on' && pressed === 'true' && kept.cvd === 'on');
  await page.locator('#cvdBtn').click(); d = await html(page);
  check('the colours button turns them off again', d.cvd === 'off' && await page.locator('#cvdBtn').getAttribute('aria-pressed') === 'false');

  // No flash: the theme is set before the body is parsed.
  const early = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  await early.addInitScript(() => {
    new MutationObserver((list, obs) => { if (document.body) { window.__modeAtBody = document.documentElement.dataset.mode; obs.disconnect(); } }).observe(document, { childList: true, subtree: true });
  });
  const ep = watch(await early.newPage());
  await ep.goto(URL); await ep.evaluate(k => localStorage.setItem(k, 'dark'), KEYS.theme); await ep.reload();
  check('the saved theme is applied before the page body exists', await ep.evaluate(() => window.__modeAtBody) === 'dark');
  await ep.goto(URL + 'guide/students.html');
  check('the guides use the saved theme', (await html(ep)).mode === 'dark');
  await early.close();

  // Contrast of key text in all four combinations (WCAG 2: 4.5 for text, 3 for large text and graphics).
  const progress = { schoolYear: 3, passed: { divide: [], multiply: [], add: [], subtract: [] }, learned: { divide: [], multiply: [3], add: [], subtract: [] } };
  for (const theme of ['light', 'dark']) for (const cvd of ['off', 'on']) {
    const label = theme + (cvd === 'on' ? ', colour-blind colours' : '');
    const low = [];
    const measure = async (name, sel, min, pseudo, against) => { const r = await contrastIn(page, sel, pseudo, against); if (r === null) low.push(name + ' missing'); else if (r < min) low.push(name + ' ' + r.toFixed(2)); };
    await open(page, { theme, cvd });
    await measure('lede', '.lede', 4.5); await measure('start hint', '.no-mouse', 4.5); await measure('book name', '.mode-name', 4.5);
    await measure('book year', '.mode-shapes', 4.5); await measure('ruler age', '.ladder-tag', 4.5); await measure('guide link', '.guide-links a', 4.5);
    await page.evaluate(() => { const items = document.querySelectorAll('#setupLadder li'); items[2].click(); });
    await measure('chosen year', '.ladder-large li.is-current .ladder-node', 4.5);
    // A guided round: Add, Year 3.
    await page.keyboard.press('3'); await page.waitForTimeout(60);
    await measure('prompt', '#prompt', 4.5); await measure('subprompt', '#subprompt', 4.5); await measure('step line', '#stepLine', 4.5);
    await measure('stage chip', '#stageChip', 4.5); await measure('learning tag', '.mode-stage', 4.5); await measure('sticker label', '.streak-label', 4.5);
    await measure('sticker line', '.gate-line', 4.5); await measure('printed digit', '.cell.given', 4.5); await measure('number key', '#keypad button', 4.5);
    await measure('caret on the highlighter', '.cell.input.active', 3, '::before', 'own-bg');
    // The box fades from yellow over 120 ms; measure once it has settled.
    let s = await st(page); await page.keyboard.press(String(s.action.value)); await page.waitForTimeout(400);
    await measure('child digit', '.cell.input.filled', 4.5); await measure('done chip', '.row-chip.is-done', 4.5); await measure('current chip', '.row-chip.is-active', 4.5);
    s = await st(page); await page.keyboard.press(String((s.action.value + 1) % 10)); await page.waitForTimeout(80);
    await measure('fix note', '#fixNote', 4.5); await measure('fix status', '.sheet-status.is-fail', 4.5);
    await measure('wrong digit', '.cell.active.wrong', 3); await measure('needed digit ticket', '.cell.active.wrong', 4.5, '::after');
    // A failed test: Multiply, Year 3, one wrong digit.
    await page.evaluate(([p, k, th, cv]) => {
      const E = window.DigitStackEngine; const problem = E.buildMultiplication(342, 7, 3);
      localStorage.clear(); localStorage.setItem('digitstack.progress.v1', JSON.stringify(p)); localStorage.setItem(k.theme, th); localStorage.setItem(k.cvd, cv);
      localStorage.setItem('digitstack.play.v1', JSON.stringify({ version: 1, operation: 'multiply', areas: { multiply: { year: 3, mode: 'test', cleanStreak: 0, round: { problem, entries: { 'p0-c3': '4', 'p0-c2': '8', 'p0-c1': '3', 'p0-c0': '2' }, selectedCellId: null } } } }));
    }, [progress, KEYS, theme, cvd]);
    await page.reload(); await page.waitForTimeout(60); await page.keyboard.press('Enter'); await page.waitForTimeout(120);
    await measure('right answer digit', '.cell.mark-right', 3); await measure('wrong answer digit', '.cell.mark-wrong', 3);
    await measure('was ticket', '.cell.mark-wrong', 4.5, '::after'); await measure('proper working', '.cell.carry-slot.solution', 3);
    await measure('answer shown', '.end-answer', 4.5); await measure('not quite', '.end-kicker', 4.5); await measure('next button', '.end-btn.primary', 4.5);
    if (cvd === 'on') await measure('tick badge', '.cell.mark-right', 3, '::after');
    check('contrast meets WCAG in ' + label, low.length === 0, low.join(', '));
  }

  // Colour-blind colours stay apart under simulated dichromacy (CIE76 delta E in Lab).
  for (const theme of ['light', 'dark']) {
    await open(page, { theme, cvd: 'on' });
    const v = await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); const g = n => cs.getPropertyValue(n).trim(); return { tick: g('--tick'), cross: g('--cross'), pen: g('--pen'), purple: g('--purple'), divide: g('--cover-divide'), multiply: g('--cover-multiply'), add: g('--cover-add'), subtract: g('--cover-subtract') }; });
    const need = [['tick', 'cross', 40], ['pen', 'purple', 15], ['divide', 'multiply', 20], ['divide', 'add', 20], ['divide', 'subtract', 20], ['multiply', 'add', 20], ['multiply', 'subtract', 20], ['add', 'subtract', 20]];
    const weak = [];
    for (const [a, b, min] of need) for (const [kind, m] of Object.entries(MACHADO)) {
      const e = deltaE(lab(simulate(hex(v[a]), m)), lab(simulate(hex(v[b]), m)));
      if (e < min) weak.push(a + '/' + b + ' ' + kind + ' ' + e.toFixed(1));
    }
    check('colour-blind colours stay apart in ' + theme + ' (right/wrong 40+, pen/working 15+, covers 20+)', weak.length === 0, weak.join(', '));
  }

  check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' failed of ' + out.length); if (out.some(x => x.startsWith('FAIL'))) process.exitCode = 1;
})().catch(e => { console.error('HARNESS ERROR', e); server.close(); process.exit(2); });
