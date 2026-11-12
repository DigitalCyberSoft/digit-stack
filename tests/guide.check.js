// Guide pages: every image loads at its stated size with alt text, every link and anchor resolves, no sideways scroll on a phone; the game links to both guides, takes taps on its number keys, and fits the not-saving notice on a phone.
// Run from the repo root: node tests/guide.check.js. Needs Playwright; set CHROME_PATH to use an installed Chrome.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path'); const { URL: Href } = require('url');
const ROOT = path.resolve(__dirname, '..'); const URL = 'http://127.0.0.1:8780/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.pdf': 'application/pdf' };
const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, rel === '/' ? 'index.html' : rel); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const out = []; const errors = [];
const check = (n, ok, d) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d !== undefined ? ' :: ' + d : ''));
const PAGES = ['guide/students.html', 'guide/parents-and-teachers.html'];

(async () => {
  await new Promise(r => server.listen(8780, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); }); return page; };
  const desk = watch(await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage());
  const phone = watch(await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage());

  for (const rel of PAGES) {
    await desk.goto(URL + rel);
    const images = await desk.evaluate(async () => Promise.all(Array.from(document.images).map(async img => {
      img.loading = 'eager';
      let loaded = true; try { await img.decode(); } catch (e) { loaded = false; }
      return { src: img.getAttribute('src'), loaded, alt: img.alt.trim().length, w: Number(img.getAttribute('width')), h: Number(img.getAttribute('height')), nw: img.naturalWidth, nh: img.naturalHeight };
    })));
    const bad = images.filter(i => !i.loaded || !i.alt || i.w !== i.nw || i.h !== i.nh);
    check(rel + ': ' + images.length + ' images load, have alt text and match their stated size', images.length > 0 && bad.length === 0, JSON.stringify(bad.slice(0, 3)));
    const links = await desk.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href')));
    const local = links.filter(h => !/^https?:/.test(h));
    const broken = [];
    for (const href of local) {
      const [file, hash] = href.split('#');
      if (file) { const r = await desk.request.get(new Href(file, URL + rel).href); if (r.status() !== 200) broken.push(href + ' ' + r.status()); }
      if (hash && !file) { if (!(await desk.evaluate(id => Boolean(document.getElementById(id)), hash))) broken.push(href); }
    }
    check(rel + ': ' + local.length + ' links and anchors resolve', broken.length === 0, broken.join(' | '));
    await phone.goto(URL + rel);
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(rel + ': no sideways scroll at 390 px', overflow <= 0, overflow + 'px');
  }

  await desk.goto(URL); await desk.evaluate(() => localStorage.clear()); await desk.goto(URL);
  const guideLinks = await desk.evaluate(() => Array.from(document.querySelectorAll('.guide-links a')).map(a => a.getAttribute('href')));
  const statuses = []; for (const href of guideLinks) statuses.push((await desk.request.get(URL + href)).status());
  check('the start screen links to both guides', JSON.stringify(guideLinks) === JSON.stringify(PAGES) && statuses.every(s => s === 200), JSON.stringify(guideLinks) + ' ' + statuses);

  await phone.goto(URL); await phone.evaluate(() => localStorage.clear()); await phone.goto(URL);
  await phone.locator('[data-mode="add"]').tap(); await phone.waitForTimeout(80);
  const before = await phone.evaluate(() => window.__digitStack.getState());
  await phone.locator('#keypad button[data-digit="' + before.action.value + '"]').tap(); await phone.waitForTimeout(80);
  const after = await phone.evaluate(() => window.__digitStack.getState());
  check('a tapped on-screen number key fills the box', after.actionIndex === before.actionIndex + 1, before.actionIndex + ' -> ' + after.actionIndex);

  const blocked = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await blocked.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('Blocked for the test', 'SecurityError'); }; });
  const bp = watch(await blocked.newPage());
  await bp.goto(URL);
  const fit = await bp.evaluate(() => { const n = document.getElementById('saveNote').getBoundingClientRect(); return { shown: n.height > 0, inside: n.left >= 0 && n.right <= window.innerWidth, overflow: document.documentElement.scrollWidth - window.innerWidth }; });
  check('the not-saving notice fits on a phone', fit.shown && fit.inside && fit.overflow <= 0, JSON.stringify(fit));

  check('no console, page or request errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' failed of ' + out.length); if (out.some(x => x.startsWith('FAIL'))) process.exitCode = 1;
})().catch(e => { console.error('HARNESS ERROR', e); server.close(); process.exit(2); });
