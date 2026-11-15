// Engine replay: generates problems for every area and year and checks arithmetic, layouts, decisions, wording, year scope and the gate table.
// Every sentence is also checked on its own terms: the finished sentence is evaluated with exact fractions, or the answer is worked out again
// here from the question's data (the clock's hands, the chart's bars, the shape's corners) without using the engine's arithmetic.
// Run from the repo root: node tests/engine.check.js [engine-path] [problems-per-area-year, default 2000].
const path = require('path');
const E = require(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'engine.js'));
const N = Number(process.argv[3] || 2000);
const MINUS = E.MINUS;
const fails = []; const stats = {}; let failCount = 0;
const fail = (msg, p) => { failCount++; if (fails.length < 40) fails.push(msg + ' :: ' + (p && p.answer ? p.answer.expression : '')); };
const stat = (key, f, inc = 1) => { stats[key] = stats[key] || {}; stats[key][f] = (stats[key][f] || 0) + inc; };
const D = v => String(Math.abs(v)).length;
const nz = v => !String(v).includes('0');
const SENTENCE_WIDTH = 15;

/* Exact fractions */
const igcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
function Q(n, d = 1) { if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) throw new Error('bad fraction ' + n + '/' + d); if (d < 0) { n = -n; d = -d; } const g = igcd(n, d) || 1; return { n: n / g, d: d / g }; }
const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => Q(a.n * b.n, a.d * b.d);
const div = (a, b) => { if (b.n === 0) throw new Error('divide by 0'); return Q(a.n * b.d, a.d * b.n); };
const cmpQ = (a, b) => Math.sign(a.n * b.d - b.n * a.d);
function powQ(a, e) {
  if (e.d !== 1) throw new Error('non-whole power');
  let r = Q(1); const k = Math.abs(e.n);
  for (let i = 0; i < k; i++) r = mul(r, a);
  return e.n < 0 ? div(Q(1), r) : r;
}
function rootQ(a, k) {
  const r = x => { const v = Math.round(Math.pow(x, 1 / k)); if (Math.pow(v, k) !== x) throw new Error('not an exact root of ' + x); return v; };
  if (a.n < 0) throw new Error('root of a negative');
  return Q(r(a.n), r(a.d));
}
function decQ(text) {
  const t = String(text).replace(MINUS, '-').replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) throw new Error('not a number: ' + text);
  const neg = t[0] === '-'; const body = neg ? t.slice(1) : t; const [w, f = ''] = body.split('.');
  const q = Q(Number(w + f), Math.pow(10, f.length));
  return neg ? Q(-q.n, q.d) : q;
}
const qText = q => q.d === 1 ? String(q.n) : q.n + '/' + q.d;

/* A small expression parser: numbers, + - * / ^, brackets, sqrt and cbrt, letters bound in `env`, implicit products such as 3x and 4(x+1). */
function evaluate(src, env = {}) {
  const s = String(src).replace(new RegExp(MINUS, 'g'), '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
  let i = 0;
  const peek = () => s[i];
  function number() { const m = /^\d+(\.\d+)?/.exec(s.slice(i)); if (!m) throw new Error('expected a number at ' + i + ' in ' + s); i += m[0].length; return decQ(m[0]); }
  function atom() {
    const c = peek();
    if (c === '(') { i++; const v = sum(); if (s[i] !== ')') throw new Error('missing ) in ' + s); i++; return v; }
    if (/\d/.test(c)) return number();
    if (s.startsWith('sqrt', i)) { i += 4; return rootQ(atom(), 2); }
    if (s.startsWith('cbrt', i)) { i += 4; return rootQ(atom(), 3); }
    if (/[a-z]/i.test(c)) { i++; if (!(c in env)) throw new Error('unknown letter ' + c); return env[c]; }
    throw new Error('unexpected ' + c + ' in ' + s);
  }
  function power() { const base = atom(); if (peek() === '^') { i++; const e = unary(); return powQ(base, e); } return base; }
  function implicit() { let v = power(); while (i < s.length && (peek() === '(' || /[a-z]/i.test(peek()) || (peek() === 's' && s.startsWith('sqrt', i)))) v = mul(v, power()); return v; }
  function unary() { if (peek() === '-') { i++; const v = unary(); return Q(-v.n, v.d); } if (peek() === '+') { i++; return unary(); } return implicit(); }
  function product() { let v = unary(); while (peek() === '*' || peek() === '/') { const op = s[i++]; const r = unary(); v = op === '*' ? mul(v, r) : div(v, r); } return v; }
  function sum() { let v = product(); while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = product(); v = op === '+' ? add(v, r) : sub(v, r); } return v; }
  const v = sum();
  if (i !== s.length) throw new Error('left over ' + s.slice(i) + ' in ' + s);
  return v;
}

/* Reading a problem back from its cells */
function cellsOf(p) { const m = new Map(); p.rows.forEach(r => (r.cells || []).forEach(c => { if (c) m.set(c.id, { cell: c, row: r }); })); return m; }

// The typed answer of each answer group in typing order: a number (with its sign box and point), a fraction part, a chosen label, a sign.
function answerGroups(p, sol) {
  const cells = cellsOf(p); const keys = []; const groups = new Map();
  p.actions.forEach(a => {
    const e = cells.get(a.cellId); if (!e) return;
    const key = e.cell.group !== undefined ? 'g' + e.cell.group + e.row.id : 'c' + e.cell.id;
    if (!groups.has(key)) { groups.set(key, { row: e.row, cols: [] }); keys.push(key); }
    groups.get(key).cols.push(e.cell.col);
  });
  return keys.map(k => {
    const g = groups.get(k); const lo = Math.min(...g.cols); const hi = Math.max(...g.cols); let text = '';
    for (let col = lo; col <= hi; col++) { const c = g.row.cells[col]; if (!c) continue; text += c.kind === 'input' ? (sol[c.id] || '') : String(c.value); }
    return text;
  });
}

// The finished sentence as a list of parts, with fractions and powers put back together.
function readSentence(p, sol, prefix = '') {
  const row = id => p.rows.find(r => r.id === prefix + id);
  const mid = row('fact'); const top = row('top'); const bottom = row('bottom');
  const val = c => !c ? '' : (c.kind === 'input' ? (sol[c.id] !== undefined ? sol[c.id] : '') : String(c.value));
  const span = (r, a, b) => { let t = ''; for (let k = a; k <= b; k++) t += val(r && r.cells[k]); return t; };
  const out = []; let col = 0;
  while (col < p.width) {
    const c = mid.cells[col];
    if (c && c.bar) { let end = col; while (end + 1 < p.width && mid.cells[end + 1] && mid.cells[end + 1].bar) end++; out.push({ type: 'frac', num: span(top, col, end), den: span(bottom, col, end) }); col = end + 1; continue; }
    if (c) { out.push({ type: 'cell', cell: c, text: val(c) }); col += c.span || 1; continue; }
    if (top && top.cells[col]) { let end = col; while (end + 1 < p.width && top.cells[end + 1] && !mid.cells[end + 1]) end++; out.push({ type: 'pow', text: span(top, col, end) }); col = end + 1; continue; }
    col++;
  }
  return out;
}

// A question of several lines (two worked, one to do) names its rows l0-fact, l1-fact, ...; a single sentence has one line.
const linePrefixes = p => p.lines ? Array.from({ length: p.lines }, (_, k) => 'l' + k + '-') : [''];

// One line of a finished sentence as plain text with no spaces: "★=7,★+★+4=18".
function lineText(p, sol, prefix) {
  return readSentence(p, sol, prefix).map(part => part.type === 'frac' ? '(' + part.num + ')/(' + part.den + ')' : part.text).join('').replace(/\s+/g, '');
}

// The finished sentence as one line, numbers joined up: "25 minutes past 4".
function sentenceLineOf(p, sol) {
  const words = []; let number = '';
  readSentence(p, sol).forEach(part => {
    const t = part.type === 'frac' ? part.num + '/' + part.den : part.text;
    if (part.type === 'cell' && !part.cell.unit && /^[\d.:]$/.test(t)) { number += t; return; }
    if (number) { words.push(number); number = ''; }
    if (t !== '') words.push(t);
  });
  if (number) words.push(number);
  return words.join(' ');
}

// Turns a finished sentence into comparisons of expressions, or throws when it is not a pure statement. Digits and points join into
// numbers; a fraction is one bracketed value; a number written just before a fraction makes a mixed number.
function statement(p, sol) {
  const items = []; const units = new Set();
  readSentence(p, sol).forEach(part => {
    const last = items[items.length - 1];
    if (part.type === 'frac') {
      const frac = '((' + part.num.replace(MINUS, '-') + ')/(' + part.den + '))';
      if (last && last.kind === 'num') { last.text = '(' + last.text + '+' + frac + ')'; last.kind = 'value'; } else items.push({ kind: 'value', text: frac });
      return;
    }
    if (part.type === 'pow') { items.push({ kind: 'op', text: '^(' + part.text.replace(MINUS, '-') + ')' }); return; }
    const c = part.cell; const t = part.text;
    if (c.unit) { if (t === '%') items.push({ kind: 'op', text: '/100' }); else if (t === 'of') items.push({ kind: 'op', text: '*' }); else if (t !== '£') units.add(t); return; }
    if (/^\d$/.test(t) || t === '.') { if (last && last.kind === 'num') last.text += t; else items.push({ kind: 'num', text: t }); return; }
    if (c.compare) { items.push({ kind: 'cmp', text: t }); return; }
    if (c.signBox) { if (t === MINUS) items.push({ kind: 'op', text: '-' }); return; }
    if (c.option || c.colon || t === ',' || t === '→' || t === '≈' || t === ':') throw new Error('not a statement: ' + t);
    const map = { '×': '*', '÷': '/', [MINUS]: '-', '=': '=', '<': '<', '>': '>', '√': 'sqrt', '∛': 'cbrt', '(': '(', ')': ')', '+': '+' };
    if (map[t] === undefined) throw new Error('unknown symbol ' + t);
    items.push({ kind: ['=', '<', '>'].includes(map[t]) ? 'cmp' : 'op', text: map[t] });
  });
  const expr = items.map(x => x.kind === 'cmp' ? ' ' + x.text + ' ' : x.text).join('');
  if (units.size > 1) throw new Error('mixed units ' + [...units].join(','));
  const pieces = expr.split(/ ([=<>]) /);
  if (pieces.length < 3) throw new Error('no comparison in ' + expr);
  for (let k = 0; k + 2 < pieces.length; k += 2) {
    const a = evaluate(pieces[k]); const b = evaluate(pieces[k + 2]); const c = cmpQ(a, b); const op = pieces[k + 1];
    if ((op === '=' && c !== 0) || (op === '<' && c >= 0) || (op === '>' && c <= 0)) return 'false: ' + expr;
  }
  return null;
}

function simplestOK(p, sol) {
  const parts = readSentence(p, sol);
  for (const part of parts) {
    if (part.type !== 'frac') continue;
    const asked = p.rows.find(r => r.id === 'top').cells.some(c => c && c.kind === 'input');
    if (!asked) continue;
    const n = Number(part.num.replace(MINUS, '')); const d = Number(part.den);
    if (part.num === '' || part.den === '' || !Number.isFinite(n) || !Number.isFinite(d)) return 'unreadable fraction';
  }
  // Fractions that hold answer boxes must be in lowest terms; a whole part means the fraction part is proper.
  const top = p.rows.find(r => r.id === 'top'); const bottom = p.rows.find(r => r.id === 'bottom');
  if (!top) return null;
  const mid = p.rows.find(r => r.id === 'fact'); const val = c => c.kind === 'input' ? sol[c.id] || '' : String(c.value);
  let col = 0;
  while (col < p.width) {
    const c = mid.cells[col];
    if (c && c.bar) {
      let end = col; while (end + 1 < p.width && mid.cells[end + 1] && mid.cells[end + 1].bar) end++;
      const tc = top.cells.slice(col, end + 1).filter(Boolean); const bc = bottom.cells.slice(col, end + 1).filter(Boolean);
      if (tc.some(x => x.kind === 'input') || bc.some(x => x.kind === 'input')) {
        const n = Number(tc.map(val).join('')); const d = Number(bc.map(val).join(''));
        if (igcd(n, d) !== 1) return 'not simplest ' + n + '/' + d;
        const before = mid.cells[col - 1];
        if (before && before.kind === 'input' && /^\d$/.test(String(before.value)) && n >= d) return 'improper part of a mixed number';
      }
      col = end + 1; continue;
    }
    col++;
  }
  return null;
}

/* Independent answers, by check kind. Each returns null when the answer is right, or a message. */
const isPrime = n => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
const roundHalfUp = (q, unit) => { const k = div(q, unit); const fl = Math.floor(k.n / k.d); const rest = sub(k, Q(fl)); return mul(Q(cmpQ(rest, Q(1, 2)) >= 0 ? fl + 1 : fl), unit); };
const WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function wordsValue(text) {
  let total = 0; let current = 0;
  text.replace(/,/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(w => w && w !== 'and').forEach(w => {
    if (w in WORDS) current += WORDS[w];
    else if (w === 'hundred') current *= 100;
    else if (w === 'thousand') { total += current * 1000; current = 0; }
    else if (w === 'million') { total += current * 1000000; current = 0; }
    else throw new Error('unknown word ' + w);
  });
  return total + current;
}
function romanValue(text) {
  const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; let total = 0;
  for (let i = 0; i < text.length; i++) { const a = v[text[i]]; const b = v[text[i + 1]] || 0; if (!a) throw new Error('bad numeral ' + text); total += a < b ? -a : a; }
  return total;
}
const minutesOf = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const near = (a, b) => Math.abs(a - b) < 1e-6;
function sidesOf(points) { return points.map((pt, k) => dist(pt, points[(k + 1) % points.length])); }
function angleAt(points, k) { const n = points.length; const a = points[(k + n - 1) % n]; const b = points[k]; const c = points[(k + 1) % n]; const v1 = [a[0] - b[0], a[1] - b[1]]; const v2 = [c[0] - b[0], c[1] - b[1]]; return Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2))) * 180 / Math.PI; }
function sameSet(a, b) { return a.length === b.length && a.every(p => b.some(q => Math.abs(p[0] - q[0]) < 1e-3 && Math.abs(p[1] - q[1]) < 1e-3)); }
function reflectAcross(pt, c, dir) { const dx = pt[0] - c[0]; const dy = pt[1] - c[1]; const len = Math.hypot(...dir); const ux = dir[0] / len; const uy = dir[1] / len; const dot = dx * ux + dy * uy; return [c[0] + 2 * dot * ux - dx, c[1] + 2 * dot * uy - dy]; }
function symmetryAxes(points) {
  const n = points.length; const c = [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
  const dirs = [];
  points.forEach((p, k) => { dirs.push([p[0] - c[0], p[1] - c[1]]); const q = points[(k + 1) % n]; dirs.push([(p[0] + q[0]) / 2 - c[0], (p[1] + q[1]) / 2 - c[1]]); });
  const found = [];
  dirs.forEach(d => { if (Math.hypot(...d) < 1e-9) return; const ang = (Math.atan2(d[1], d[0]) * 180 / Math.PI + 360) % 180; if (found.some(a => Math.abs(a - ang) < 0.5 || Math.abs(Math.abs(a - ang) - 180) < 0.5)) return; if (sameSet(points.map(pt => reflectAcross(pt, c, d)), points)) found.push(ang); });
  return found.length;
}
function classifyTriangle(points) { const s = sidesOf(points); const eq = (a, b) => Math.abs(a - b) < 1e-2; if (eq(s[0], s[1]) && eq(s[1], s[2])) return 'equilateral'; if (eq(s[0], s[1]) || eq(s[1], s[2]) || eq(s[0], s[2])) return 'isosceles'; return 'scalene'; }
function classifyQuad(points) {
  const s = sidesOf(points); const eq = (a, b) => Math.abs(a - b) < 1e-6; const right = [0, 1, 2, 3].every(k => near(angleAt(points, k), 90));
  const dir = k => [points[(k + 1) % 4][0] - points[k][0], points[(k + 1) % 4][1] - points[k][1]];
  const parallel = (a, b) => near(dir(a)[0] * dir(b)[1] - dir(a)[1] * dir(b)[0], 0);
  const pairs = (parallel(0, 2) ? 1 : 0) + (parallel(1, 3) ? 1 : 0);
  const allEqual = eq(s[0], s[1]) && eq(s[1], s[2]) && eq(s[2], s[3]);
  if (allEqual && right) return 'square'; if (right) return 'rectangle'; if (allEqual) return 'rhombus'; if (pairs === 2) return 'parallelogram'; if (pairs === 1) return 'trapezium';
  if ((eq(s[0], s[3]) && eq(s[1], s[2])) || (eq(s[0], s[1]) && eq(s[2], s[3]))) return 'kite';
  return 'quadrilateral';
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CALENDAR = { 'days are in a week': 7, 'months are in a year': 12, 'days are in a weekend': 2, 'days are in a fortnight': 14, '1 hour minutes': 60, '1 day hours': 24, 'half an hour minutes': 30, '2 hours minutes': 120,
  '1 minute seconds': 60, '1 year days': 365, 'a leap year days': 366, 'April days': 30, 'June days': 30, 'January days': 31, 'February in a leap year days': 29, 'September days': 30,
  'a quarter turn': 1, 'a half turn': 2, 'a three-quarter turn': 3, 'a complete turn': 4 };
const UNITS = { km: ['length', 1000000], m: ['length', 1000], cm: ['length', 10], mm: ['length', 1], kg: ['mass', 1000], g: ['mass', 1], l: ['capacity', 1000], ml: ['capacity', 1],
  hours: ['time', 3600], minutes: ['time', 60], seconds: ['time', 1], days: ['time', 86400], weeks: ['time', 604800], years: ['months', 12], months: ['months', 1],
  'km²': ['area', 1e12], 'm²': ['area', 1e6], 'cm²': ['area', 100], 'mm²': ['area', 1] };
const SOLIDS = { cube: [6, 12, 8], cuboid: [6, 12, 8], pyramid: [5, 8, 5], prism: [5, 9, 6], tetrahedron: [4, 6, 4] };
function clockWordsOf(h, m) { const next = h % 12 + 1; if (m === 0) return h + " o'clock"; if (m === 30) return 'half past ' + h; if (m === 15) return 'quarter past ' + h; if (m === 45) return 'quarter to ' + next; return m < 30 ? m + ' minutes past ' + h : (60 - m) + ' minutes to ' + next; }
const num = t => decQ(t);
const same = (q, t) => cmpQ(q, num(t)) === 0;
const want = (ok, msg) => ok ? null : msg;
const fracAnswer = (ans, q) => q.d === 1 && ans.length === 1 ? same(q, ans[0]) : (ans.length === 2 && Number(ans[0]) === q.n && Number(ans[1]) === q.d);

// "★=7" or "n=7" at the start of a line: the symbol and the number it stands for on that line.
const SYMBOLS = '★▲●■♦';
function withValue(stmt, sym, value) {
  if (SYMBOLS.includes(sym)) return { text: stmt.split(sym).join('(' + value + ')'), env: {} };
  return { text: stmt, env: { [sym]: num(String(value)) } };
}
function sidesEqual(stmt, env) {
  const sides = stmt.split('=');
  if (sides.length !== 2) throw new Error('not one = in ' + stmt);
  return cmpQ(evaluate(sides[0], env), evaluate(sides[1], env)) === 0;
}

const VERIFY = {
  // Every line, worked or asked: put the number shown for the symbol in its place; both sides must be equal. The worked lines must
  // give the symbol different numbers, so it is seen to change.
  symbolLines: (p, ans, c, sol) => {
    const values = [];
    for (const prefix of linePrefixes(p)) {
      const m = /^([★▲●■♦a-z])=(-?\d+),(.+)$/.exec(lineText(p, sol, prefix).replace(new RegExp(MINUS, 'g'), '-'));
      if (!m || m[1] !== c.letter) return 'unreadable line ' + lineText(p, sol, prefix);
      const v = withValue(m[3], m[1], m[2]);
      if (!sidesEqual(v.text, v.env)) return 'false line ' + lineText(p, sol, prefix);
      values.push(m[2]);
    }
    return new Set(values).size === values.length ? null : 'the symbol has the same number on two lines';
  },
  // "★+★+4=8" then "★=2": the number typed for the symbol makes the first line true.
  findSymbol: (p, ans, c, sol) => {
    const [first, second] = linePrefixes(p).map(prefix => lineText(p, sol, prefix).replace(new RegExp(MINUS, 'g'), '-'));
    const m = /^([★▲●■♦a-z])=(-?\d+)$/.exec(second || '');
    if (!m || m[2] !== ans[0]) return 'unreadable ' + first + ' / ' + second;
    if (!first.includes(m[1])) return 'the symbol asked for is not in the sentence';
    const v = withValue(first, m[1], m[2]);
    return sidesEqual(v.text, v.env) ? null : 'false: ' + first + ' with ' + second;
  },
  // "★=7" then "★+★+4=18": the number given on the first line, put in place of the symbol, makes the second line true.
  symbolValue: (p, ans, c, sol) => {
    const [first, second] = linePrefixes(p).map(prefix => lineText(p, sol, prefix).replace(new RegExp(MINUS, 'g'), '-'));
    const m = /^([★▲●■♦a-z])=(-?\d+)$/.exec(first || '');
    if (!m || m[1] !== c.letter || !second || !second.includes(m[1])) return 'unreadable ' + first + ' / ' + second;
    const v = withValue(second, m[1], m[2]);
    return sidesEqual(v.text, v.env) ? null : 'false: ' + second + ' with ' + first;
  },
  // "66→22", "76→32", "61→?": exactly one rule of the kind + n (n may be below zero) or × n fits both worked pairs, and the answer is
  // that rule applied to the third number.
  machinePairs: (p, ans, c, sol) => {
    const pairs = linePrefixes(p).map(prefix => lineText(p, sol, prefix).split('→').map(Number));
    if (pairs.length !== 3 || pairs.some(x => x.length !== 2 || x.some(n => !Number.isInteger(n)))) return 'unreadable pairs';
    const [[a, b], [d, e], [f, g]] = pairs;
    const rules = [];
    if (b - a === e - d) rules.push(x => x + (b - a));
    if (a && b % a === 0 && b / a >= 2 && e === d * (b / a)) rules.push(x => x * (b / a));
    if (rules.length !== 1) return rules.length + ' rules fit the worked pairs';
    return rules[0](f) === g && String(g) === ans[0] ? null : 'rule gives ' + rules[0](f) + ', answer ' + g;
  },
  statement: (p, ans, c, sol) => statement(p, sol) || (c.simplest ? simplestOK(p, sol) : null),
  value: (p, ans, c) => want(same(evaluate(c.expr), ans[0]), 'value ' + ans[0] + ' vs ' + qText(evaluate(c.expr))),
  estimate: (p, ans, c) => { const unit = Q(c.to); const r = c.terms.map(t => roundHalfUp(Q(t), unit)); const v = c.op === '+' ? add(r[0], r[1]) : sub(r[0], r[1]); return want(same(v, ans[0]), 'estimate'); },
  remainder: (p, ans, c) => { const q = Math.floor(c.n / c.k); const r = c.n % c.k; const v = c.round === 'up' ? q + (r ? 1 : 0) : (c.round === 'down' ? q : r); return want(Number(ans[0]) === v, 'remainder story'); },
  digitValue: (p, ans, c) => { const t = c.number; const point = t.indexOf('.') === -1 ? t.length : t.indexOf('.'); const k = c.index; const place = k < point ? point - 1 - k : -(k - point); return want(same(mul(Q(Number(t[k])), powQ(Q(10), Q(place))), ans[0]), 'digit value'); },
  sequence: (p, ans, c) => { const d = c.terms[1] - c.terms[0]; if (!c.terms.every((t, k) => !k || t - c.terms[k - 1] === d)) return 'not a sequence'; return want(Number(ans[0].replace(MINUS, '-')) === c.terms[c.index], 'sequence'); },
  words: (p, ans, c) => want(wordsValue(c.text) === Number(ans[0]), 'words ' + c.text),
  round: (p, ans, c) => {
    const q = num(c.value);
    if (c.unit) return want(same(roundHalfUp(q, Q(c.unit)), ans[0]), 'round to unit');
    if (c.dp !== undefined) { const v = roundHalfUp(q, Q(1, Math.pow(10, c.dp))); const parts = ans[0].split('.'); return want(same(v, ans[0]) && (parts[1] || '').length === c.dp, 'round to dp'); }
    const digits = String(Math.abs(q.n)).length; const unit = Q(Math.pow(10, digits - c.sf)); return want(same(roundHalfUp(q, unit), ans[0]), 'round to sf');
  },
  roman: (p, ans, c) => want(romanValue(c.text) === Number(ans[0]), 'roman ' + c.text),
  factor: (p, ans, c) => want(ans[0] === (c.n % c.a === 0 ? 'yes' : 'no'), 'factor'),
  prime: (p, ans, c) => want(ans[0] === (isPrime(c.n) ? 'yes' : 'no'), 'prime ' + c.n),
  hcf: (p, ans, c) => want(Number(ans[0]) === igcd(c.a, c.b), 'hcf'),
  lcm: (p, ans, c) => want(Number(ans[0]) === c.a * c.b / igcd(c.a, c.b), 'lcm'),
  primeFactors: (p, ans, c) => { const f = ans.map(Number); return want(f.every(isPrime) && f.reduce((s, v) => s * v, 1) === c.n && f.every((v, k) => !k || v >= f[k - 1]), 'prime factors'); },
  coins: (p, ans) => want(Number(ans[0]) === p.picture.coins.reduce((s, v) => s + v, 0), 'coins'),
  clock: (p, ans, c, sol) => {
    const { h, m } = p.picture; if (h < 1 || h > 12 || m < 0 || m > 59) return 'bad clock';
    if (c.digital) return want(ans[0] === h + ':' + String(m).padStart(2, '0'), 'digital time');
    const line = sentenceLineOf(p, sol);
    return want(line === clockWordsOf(h, m), 'clock words ' + line + ' vs ' + clockWordsOf(h, m));
  },
  time24: (p, ans, c) => { const h24 = c.pm ? (c.h === 12 ? 12 : c.h + 12) : (c.h === 12 ? 0 : c.h); return want(ans[0] === String(h24).padStart(2, '0') + ':' + String(c.m).padStart(2, '0'), '24-hour'); },
  calendar: (p, ans, c) => want(CALENDAR[c.fact] !== undefined && Number(ans[0]) === CALENDAR[c.fact], 'calendar ' + c.fact),
  day: (p, ans, c) => want(ans[0] === DAYS[(DAYS.indexOf(c.day) + (c.after ? 1 : 6)) % 7], 'day'),
  ruler: (p, ans) => want(Number(ans[0]) === p.picture.length, 'ruler'),
  scale: (p, ans) => want(Number(ans[0]) === p.picture.value && (p.picture.value - p.picture.min) % p.picture.step === 0, 'scale'),
  perimeter: (p, ans) => { const per = sidesOf(p.picture.points).reduce((s, v) => s + v, 0); return want(Math.abs(per - Number(ans[0])) < 1e-6, 'perimeter ' + per); },
  areaCount: (p, ans) => want(Number(ans[0]) === p.picture.cells.length, 'area count'),
  convert: (p, ans, c) => { const a = UNITS[c.from]; const b = UNITS[c.to]; if (!a || !b || a[0] !== b[0]) return 'units ' + c.from + ' ' + c.to; return want(same(div(mul(num(c.value), Q(a[1])), Q(b[1])), ans[0]), 'convert'); },
  duration: (p, ans, c) => want(Number(ans[0]) === minutesOf(c.to) - minutesOf(c.from), 'duration'),
  poundsPence: (p, ans, c) => want(Number(ans[0]) === Math.floor(c.total / 100) && Number(ans[1]) === c.total % 100, 'pounds and pence'),
  cubes: (p, ans) => want(Number(ans[0]) === p.picture.l * p.picture.w * p.picture.h, 'cubes'),
  cuboid: (p, ans) => want(Number(ans[0]) === p.picture.l * p.picture.w * p.picture.h, 'cuboid'),
  circle: (p, ans, c) => { const label = p.picture.label; const r = /radius (\d+)/.test(label) ? Number(/radius (\d+)/.exec(label)[1]) : Number(/diameter (\d+)/.exec(label)[1]) / 2; return want(Number(ans[0]) === (c.area ? r * r : 2 * r) && r === c.r, 'circle'); },
  shapeName: (p, ans, c) => {
    const pic = p.picture; if (ans[0] !== c.name) return 'label ' + ans[0];
    if (pic.kind === 'solid') return want(pic.name === c.name, 'solid picture');
    if (c.name === 'circle') return want(pic.circle, 'circle picture');
    const pts = pic.points; if (c.name === 'triangle') return want(pts.length === 3, 'triangle picture');
    const q = classifyQuad(pts); return want(q === c.name, 'quad picture is a ' + q);
  },
  turn: (p, ans, c) => want(ans[0] === ['up', 'right', 'down', 'left'][((c.clockwise ? c.quarters : -c.quarters) % 4 + 4) % 4], 'turn'),
  polygonCount: (p, ans) => want(Number(ans[0]) === p.picture.points.length, 'polygon count'),
  solidCount: (p, ans, c) => want(Number(ans[0]) === SOLIDS[c.name][['faces', 'edges', 'vertices'].indexOf(c.part)], 'solid count'),
  symmetryLine: (p, ans) => { const x = p.picture.mirror.x; const pts = p.picture.points; const sym = sameSet(pts.map(q => [2 * x - q[0], q[1]]), pts); return want(ans[0] === (sym ? 'yes' : 'no'), 'symmetry line'); },
  angleClass: (p, ans) => {
    const d = p.picture.degrees; const labels = p.options.map(o => o[1]);
    const expected = labels.includes('reflex') ? (d < 90 ? 'acute' : d < 180 ? 'obtuse' : 'reflex') : labels.includes('acute') ? (d < 90 ? 'acute' : d === 90 ? 'right' : 'obtuse') : (d < 90 ? 'less' : d === 90 ? 'right angle' : 'more');
    return want(ans[0] === expected, 'angle class ' + d);
  },
  linesKind: (p, ans) => want(ans[0] === p.picture.relation, 'lines'),
  triangleKind: (p, ans) => want(ans[0] === classifyTriangle(p.picture.points), 'triangle kind'),
  quadKind: (p, ans) => want(ans[0] === classifyQuad(p.picture.points), 'quad kind ' + classifyQuad(p.picture.points)),
  symmetryCount: (p, ans) => want(Number(ans[0]) === symmetryAxes(p.picture.points), 'symmetry count ' + symmetryAxes(p.picture.points)),
  gridPoint: (p, ans) => { const pt = p.picture.points[0]; return want(Number(ans[0].replace(MINUS, '-')) === pt.x && Number(ans[1].replace(MINUS, '-')) === pt.y, 'grid point'); },
  translate: (p, ans, c) => want(Number(ans[0]) === c.x + c.dx && Number(ans[1]) === c.y + c.dy, 'translate'),
  reflect: (p, ans, c) => { const x = c.mirror !== undefined ? 2 * c.mirror - c.x : (c.axis === 'y' ? -c.x : c.x); const y = c.mirror !== undefined ? c.y : (c.axis === 'x' ? -c.y : c.y); return want(Number(ans[0].replace(MINUS, '-')) === x && Number(ans[1].replace(MINUS, '-')) === y, 'reflect'); },
  angle: (p, ans) => want(Number(ans[0]) === p.picture.degrees, 'angle'),
  anglesSum: (p, ans, c) => { const labels = p.picture.angleLabels || p.picture.labels; const known = labels.filter(l => l && l !== '?').map(l => Number(l.replace('°', ''))); return want(Number(ans[0]) === c.total - known.reduce((s, v) => s + v, 0), 'angle sum'); },
  regular: (p, ans) => { const pts = p.picture.points; const s = sidesOf(pts); const a = pts.map((x, k) => angleAt(pts, k)); const reg = s.every(v => Math.abs(v - s[0]) < 1e-2) && a.every(v => Math.abs(v - a[0]) < 0.5); return want(ans[0] === (reg ? 'yes' : 'no'), 'regular'); },
  polygonAngle: (p, ans, c) => want(Number(ans[0]) === (c.what === 'sum' ? (c.n - 2) * 180 : c.what === 'exterior' ? 360 / c.n : (c.n - 2) * 180 / c.n), 'polygon angle'),
  crossing: (p, ans, c) => want(Number(ans[0]) === ((c.asked % 2) === (c.given % 2) ? c.angle : 180 - c.angle), 'crossing'),
  netName: (p, ans, c) => want(ans[0] === { cube: 'cube', pyramid: 'square-based pyramid', prism: 'triangular prism' }[c.name] && p.picture.name === c.name, 'net'),
  parallel: (p, ans, c) => want(Number(ans[0]) === ((c.asked % 2) === (c.given % 2) ? c.angle : 180 - c.angle), 'parallel'),
  pythagoras: (p, ans, c) => want(c.a * c.a + c.b * c.b === c.c * c.c && Number(ans[0]) === (c.missing === 'c' ? c.c : c.a), 'pythagoras'),
  trig: (p, ans, c) => { const r = { sin: Q(c.opp, c.hyp), cos: Q(c.adj, c.hyp), tan: Q(c.opp, c.adj) }[c.fn]; return want(c.opp * c.opp + c.adj * c.adj === c.hyp * c.hyp && fracAnswer(ans, r), 'trig'); },
  rotate: (p, ans, c) => { const r = c.turn === '180' ? [-c.x, -c.y] : c.turn === '90c' ? [c.y, -c.x] : [-c.y, c.x]; return want(Number(ans[0].replace(MINUS, '-')) === r[0] && Number(ans[1].replace(MINUS, '-')) === r[1], 'rotate'); },
  fractionPicture: (p, ans, c) => { const pic = p.picture; if (c.name) return want(pic.shaded === 1 && ans[0] === (pic.parts === 2 ? 'a half' : 'a quarter'), 'named part'); return want(Number(ans[0]) === pic.shaded && Number(ans[1]) === pic.parts, 'shaded fraction'); },
  chart: (p, ans, c) => {
    const pic = p.picture; let values;
    if (pic.kind === 'tally') values = pic.counts; else if (pic.kind === 'pictogram') { values = pic.values; if (values.some(v => (v * 2) % pic.key !== 0)) return 'pictogram not in halves'; } else if (pic.kind === 'bars') values = pic.values; else values = pic.rows.map(r => Number(r[1]));
    const v = c.op === 'read' ? values[c.a] : c.op === 'difference' ? values[c.a] - values[c.b] : c.op === 'sum' ? values[c.a] + values[c.b] : values.reduce((s, x) => s + x, 0);
    return want(v >= 0 && Number(ans[0]) === v, 'chart ' + c.op);
  },
  line: (p, ans, c) => { const v = p.picture.values; return want(Number(ans[0]) === (c.op === 'read' ? v[c.a] : Math.abs(v[c.b] - v[c.a])), 'line graph'); },
  timetable: (p, ans, c) => { const rows = p.picture.rows; return want(Number(ans[0]) === minutesOf(rows[c.to][c.bus + 1]) - minutesOf(rows[c.from][c.bus + 1]), 'timetable'); },
  pie: (p, ans, c) => { const deg = p.picture.degrees; if (deg.reduce((s, v) => s + v, 0) !== 360) return 'pie not 360'; return want(same(mul(Q(deg[c.index], 360), Q(c.total)), ans[0]), 'pie'); },
  stats: (p, ans, c) => {
    const d = c.data.slice().sort((a, b) => a - b); const n = d.length; let v;
    if (c.measure === 'mean') v = Q(d.reduce((s, x) => s + x, 0), n); else if (c.measure === 'median') v = n % 2 ? Q(d[(n - 1) / 2]) : Q(d[n / 2 - 1] + d[n / 2], 2);
    else if (c.measure === 'range') v = Q(d[n - 1] - d[0]); else { const counts = {}; d.forEach(x => { counts[x] = (counts[x] || 0) + 1; }); const most = Math.max(...Object.values(counts)); const modes = Object.keys(counts).filter(k => counts[k] === most); if (modes.length !== 1) return 'no single mode'; v = Q(Number(modes[0])); }
    return want(same(v, ans[0]), c.measure);
  },
  probability: (p, ans, c) => want(fracAnswer(ans, Q(c.favourable, c.total)), 'probability'),
  dice: (p, ans, c) => { let ways = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === c.target) ways++; return want(fracAnswer(ans, Q(ways, 36)), 'dice'); },
  scatter: (p, ans) => {
    const pts = p.picture.points; const n = pts.length; const mx = pts.reduce((s, q) => s + q[0], 0) / n; const my = pts.reduce((s, q) => s + q[1], 0) / n;
    let sxy = 0, sxx = 0, syy = 0; pts.forEach(q => { sxy += (q[0] - mx) * (q[1] - my); sxx += (q[0] - mx) ** 2; syy += (q[1] - my) ** 2; }); const r = sxy / Math.sqrt(sxx * syy);
    const expected = r > 0.6 ? 'positive' : r < -0.6 ? 'negative' : Math.abs(r) < 0.4 ? 'no correlation' : 'unclear';
    return want(ans[0] === expected, 'scatter r=' + r.toFixed(2));
  },
  machine: (p, ans, c) => {
    const run = x => c.ops.reduce((v, op) => op[0] === '+' ? add(v, Q(op[1])) : op[0] === MINUS ? sub(v, Q(op[1])) : op[0] === '×' ? mul(v, Q(op[1])) : div(v, Q(op[1])), Q(x));
    if (c.find === 'out') return want(same(run(c.input), ans[0]), 'machine out');
    return want(cmpQ(run(Number(ans[0])), run(c.input)) === 0, 'machine in');
  },
  pattern: (p, ans, c) => {
    const s = c.shapes; let period = 1;
    while (period < s.length && !s.every((x, k) => x === s[k % period])) period++;
    if (period * 2 > s.length) return 'pattern does not repeat twice';
    return want(ans[0] === s[s.length % period], 'pattern next');
  },
  sequenceRule: (p, ans, c) => { const d = c.terms[1] - c.terms[0]; return want(c.terms.every((t, k) => !k || t - c.terms[k - 1] === d) && Number(ans[0]) === d, 'sequence rule'); },
  sequenceTerm: (p, ans, c) => { const d = c.terms[1] - c.terms[0]; return want(c.terms.every((t, k) => !k || t - c.terms[k - 1] === d) && Number(ans[0].replace(MINUS, '-')) === c.terms[0] + (c.n - 1) * d, 'nth term value'); },
  solve: (p, ans, c) => { const env = { [c.letter]: num(ans[0]) }; return want(cmpQ(evaluate(c.left, env), evaluate(c.right, env)) === 0, 'solve'); },
  system: (p, ans, c) => want(Number(ans[0]) + Number(ans[1]) === c.sum && Number(ans[0]) - Number(ans[1]) === c.diff, 'system'),
  pairs: (p, ans, c) => { let count = 0; for (let a = c.least; a <= c.sum; a++) { const b = c.sum - a; if (b >= c.least) count++; } return want(Number(ans[0]) === count, 'pairs'); },
  collect: (p, ans, c) => { for (const [a, b] of [[2, 3], [-1, 5], [7, -4]]) { const env = { a: Q(a), b: Q(b) }; if (cmpQ(evaluate(c.left, env), evaluate(ans[0] + '*a+' + ans[1] + '*b', env)) !== 0) return 'collect'; } return null; },
  expand: (p, ans, c) => { for (const x of [2, -3, 5]) { const env = { x: Q(x) }; if (cmpQ(evaluate(c.left, env), evaluate(ans[0] + '*x+' + ans[1], env)) !== 0) return 'expand'; } return null; },
  factorise: (p, ans, c) => { const [k, a, b] = ans.map(Number); if (igcd(a, b) !== 1) return 'not fully factorised'; for (const x of [2, -3, 5]) { const env = { x: Q(x) }; if (cmpQ(evaluate(c.left, env), evaluate(k + '*(' + a + '*x+' + b + ')', env)) !== 0) return 'factorise'; } return null; },
  nthTerm: (p, ans, c) => { const a = Number(ans[0]); const b = Number((ans[1] === MINUS ? '-' : '') + ans[2]); return want(c.terms.every((t, k) => a * (k + 1) + b === t), 'nth term rule'); },
  gradient: (p, ans, c) => { const at = x => evaluate(c.equation.replace(/^y = /, ''), { x: Q(x) }); const m = sub(at(1), at(0)); return want(same(m, ans[0]) && same(at(0), ans[1]), 'gradient'); },
  share: (p, ans, c) => { const parts = c.ratio[0] + c.ratio[1]; return want(c.total % parts === 0 && Number(ans[0]) === c.total / parts * c.ratio[0] && Number(ans[1]) === c.total / parts * c.ratio[1], 'share'); },
  ratio: (p, ans, c) => { const g = igcd(c.given[0], c.given[1]); return want(Number(ans[0]) === c.given[0] / g && Number(ans[1]) === c.given[1] / g, 'ratio'); }
};

const TEXT_FIELDS = ['prompt', 'subprompt', 'why'];

function textChecks(p, key, texts) {
  const maxPlaces = E.MAX_DECIMAL_PLACES[p.year];
  texts.forEach(t => {
    if (t === undefined || t === null) return;
    if (/quotient|borrow|space/i.test(t)) fail(key + ' banned word: ' + t, p);
    if (/[–—]/.test(t)) fail(key + ' en/em dash: ' + t, p);
    if (/undefined|NaN|null|\[object/.test(t)) fail(key + ' bad text: ' + t, p);
    const decimals = t.match(/\d\.\d+/g) || [];
    decimals.forEach(d => { const places = d.split('.')[1].length; if (places > maxPlaces) fail(key + ' ' + places + ' decimal places in Year ' + p.year + ': ' + t, p); });
  });
}

function replay(p, key) {
  const cells = new Map();
  p.rows.forEach(r => (r.cells || []).forEach(c => { if (c) cells.set(c.id, Object.assign({ row: r }, c)); }));
  const shown = new Map();
  const hits = new Map();
  const topRow = p.rows.find(r => r.id === 'a');
  const current = p.operation === 'subtract' && p.method === 'column' ? topRow.cells.map(c => (c ? c.value : null)) : null;
  const bottom = current ? p.rows.find(r => r.id === 'b').cells.map(c => (c ? c.value : 0)) : null;
  textChecks(p, key, [p.question].concat(p.actions.flatMap(a => TEXT_FIELDS.map(f => a[f]))));
  p.actions.forEach((a, i) => {
    if (a.kind === 'move') return fail(key + ' a move action still exists', p);
    const c = cells.get(a.cellId);
    if (!c) return fail(key + ' missing cell ' + a.cellId, p);
    hits.set(a.cellId, (hits.get(a.cellId) || 0) + 1);
    if (a.choice) {
      if (a.subprompt !== E.CHOICE[a.choice]) fail(key + ' choice text differs: ' + a.subprompt, p);
      const starts = { carry: /^Next column/, exchange: /^(Subtract the \w+|Next column): /, leftover: /^What is left over from /, sign: /./ }[a.choice];
      if (!starts.test(a.prompt)) fail(key + ' choice prompt not neutral: ' + a.prompt, p);
      if (a.choice !== 'sign' && c.kind !== 'carry') fail(key + ' decision is not on a small box', p);
      if (a.choice !== 'sign' && a.shown !== (a.value > 0 ? (a.choice === 'exchange' ? String(current[c.col] + 10) : String(a.value)) : null)) fail(key + ' decision shows ' + a.shown + ' for ' + a.value, p);
    }
    if (a.kind === 'sign') {
      if (!c.signBox) fail(key + ' sign on a non-sign cell', p);
      if ((a.value === MINUS) !== (c.value === MINUS)) fail(key + ' sign value differs from its box', p);
      if (p.method === 'fact' && (a.value === MINUS) !== (p.answer.total < 0)) fail(key + ' sign value wrong', p);
      if (a.firstDigit !== p.actions[i + 1].value) fail(key + ' sign firstDigit mismatch', p);
      shown.set(a.cellId, a.value === MINUS ? MINUS : '');
      return;
    }
    if (a.kind === 'compare') { if (!c.compare || c.value !== a.value || !['<', '>', '='].includes(a.value)) fail(key + ' compare box', p); shown.set(a.cellId, a.value); return; }
    if (a.option) { if (!c.option || c.key !== a.value || c.value !== a.shown || !p.options.some(o => o[0] === a.value && o[1] === a.shown)) fail(key + ' option box', p); shown.set(a.cellId, a.shown); return; }
    if (a.kind === 'bringdown') { if (c.kind !== 'bringdown') fail(key + ' bringdown kind', p); shown.set(a.cellId, a.value); return; }
    if (c.kind === 'given') return fail(key + ' digit into a given cell', p);
    if (c.dynamic) {
      const col = c.col;
      if (a.choice === 'exchange') {
        const needed = current[col] < bottom[col];
        if (a.value !== (needed ? 1 : 0)) fail(key + ' exchange decision ' + a.value + ' but ' + current[col] + ' vs ' + bottom[col], p);
        if (needed) { current[col] += 10; shown.set(a.cellId, String(current[col])); }
        return;
      }
      if (a.value !== current[col] - 1) fail(key + ' exchange typed ' + a.value + ' but column has ' + current[col], p);
      current[col] = a.value; shown.set(a.cellId, String(a.value));
      (a.alsoFill || []).forEach(f => {
        const rc = cells.get(f.cellId).col;
        if (f.value !== current[rc] + 10) fail(key + ' receiver did not gain 10', p);
        current[rc] = f.value; shown.set(f.cellId, String(f.value));
      });
      return;
    }
    if (String(c.value) !== String(a.value)) fail(key + ' action value ' + a.value + ' != cell ' + c.value + ' at ' + a.cellId, p);
    if (current && c.row.id === 'diff') {
      const col = c.col;
      if (current[col] < bottom[col] || a.value !== current[col] - bottom[col]) fail(key + ' column answer does not follow the exchanges', p);
    }
    if (a.shown === undefined || a.shown !== null) shown.set(a.cellId, a.shown !== undefined ? a.shown : a.value);
  });
  cells.forEach((c, id) => {
    const n = hits.get(id) || 0;
    if (c.kind === 'given') { if (n) fail(key + ' given cell hit ' + id, p); return; }
    if (c.dynamic) return;
    if (n !== 1) fail(key + ' cell ' + id + ' hit ' + n + ' times', p);
  });
  const readRow = id => p.rows.find(r => r.id === id).cells.filter(x => x && x.kind === 'input').map(x => shown.get(x.id)).join('');
  if (p.method === 'sentence') {
    // Typing order: line by line, left to right, and top before bottom in the same column.
    const pos = p.actions.map(x => { const c = cells.get(x.cellId); return [c.row.line || 0, c.col, { top: 0, fact: 1, bottom: 2 }[c.row.part || c.row.id]]; });
    if (pos.some(v => v[2] === undefined)) fail(key + ' sentence box in an unknown row', p);
    if (pos.some((v, k) => k && v[0] < pos[k - 1][0])) fail(key + ' sentence lines not in order', p);
    const inLine = (v, k) => k && v[0] === pos[k - 1][0];
    if (pos.some((v, k) => inLine(v, k) && (v[1] < pos[k - 1][1] || (v[1] === pos[k - 1][1] && v[2] <= pos[k - 1][2])))) {
      // A fraction's bottom comes after its top even though it starts further left.
      const ok = pos.every((v, k) => !inLine(v, k) || v[1] >= pos[k - 1][1] || (v[2] === 2 && pos[k - 1][2] === 0));
      if (!ok) fail(key + ' sentence boxes not in reading order', p);
    }
  } else if (p.method === 'fact') {
    const w = (p.signBox && p.answer.total < 0 ? MINUS : '') + String(p.answer.value);
    if (readRow('fact') !== w) fail(key + ' sentence reads ' + readRow('fact') + ' want ' + w, p);
    const order = p.actions.filter(x => x.kind === 'digit').map(x => cells.get(x.cellId).col);
    if (order.some((v, i) => i && v <= order[i - 1])) fail(key + ' sentence not left to right', p);
  } else if (p.operation === 'divide') {
    const q = p.rows.find(r => r.id === 'q').cells.filter(Boolean).filter(x => !x.point).map(x => x.kind === 'given' ? x.value : shown.get(x.id)).join('');
    const w = String(p.answer.quotient) + (p.answer.remainder ? 'R' + p.answer.remainder : '');
    if (q !== w) fail(key + ' quotient row reads ' + q, p);
  } else {
    const rowId = p.answerRowIds[0];
    if (readRow(rowId) !== String(p.answer.value)) fail(key + ' answer row reads ' + readRow(rowId), p);
  }
}

// Sentences: the answer is checked again from the question's data, and the sentence must fit and keep to the year's decimals.
function verifySentence(p, key) {
  const sol = E.solutionOf(p).values;
  if (p.width > SENTENCE_WIDTH) fail(key + ' sentence wider than ' + SENTENCE_WIDTH + ' cells', p);
  const points = p.rows.flatMap(r => r.cells.filter(c => c && c.point));
  if (points.length && p.year < 4) fail(key + ' decimal point before Year 4', p);
  linePrefixes(p).forEach(prefix => readSentence(p, sol, prefix).forEach(part => {
    if (part.type !== 'cell') return;
    if (part.cell.option && !p.options) fail(key + ' option without a legend', p);
  }));
  const ans = answerGroups(p, sol);
  ans.forEach(a => { const m = /\.(\d+)$/.exec(a); if (m && m[1].length > E.MAX_DECIMAL_PLACES[p.year]) fail(key + ' answer has too many decimal places', p); });
  const c = p.check || { kind: 'statement' };
  const verify = VERIFY[c.kind];
  if (!verify) return fail(key + ' no verifier for ' + c.kind, p);
  let result;
  try { result = verify(p, ans, c, sol); } catch (err) { result = 'verifier error: ' + err.message; }
  if (result) fail(key + ' ' + p.title + ' [' + c.kind + '] ' + result + ' :: ' + p.line + ' :: ' + ans.join('|'), p);
  stat(key, 'check:' + c.kind);
}

// Year scope for the four calculation areas, by layout title.
const TITLE_YEARS = {
  divide: { 'Division facts': [1, 4], 'Missing number': [2, 4], Sharing: [1, 1], Grouping: [1, 1], 'Short division': [3, 5], 'Long division': [5, 7], Problem: [3, 3], 'Dividing by 1': [4, 4],
    'Mental dividing': [5, 5], Remainders: [5, 5], 'Decimal division': [6, 7], 'Remainder as a fraction': [6, 6], 'Negative numbers': [7, 7] },
  multiply: { 'Times tables': [1, 4], 'Counting groups': [1, 1], 'Missing number': [2, 4], 'Short multiplication': [3, 4], 'Long multiplication': [4, 7], Problem: [3, 5], 'Three numbers': [4, 4],
    'Times 0 and 1': [4, 4], 'Mental multiplying': [5, 5], 'Decimal short multiplication': [6, 6], 'Decimal long multiplication': [7, 7], 'Negative numbers': [7, 7] },
  add: { 'Number sentence': [1, 2], 'Missing number': [1, 7], 'Column addition': [2, 7], Estimate: [3, 6], 'Below zero': [4, 7], 'Decimal addition': [4, 7] },
  subtract: { 'Number sentence': [1, 2], 'Missing number': [1, 7], 'Column subtraction': [2, 7], Estimate: [3, 6], 'Below zero': [4, 7], 'Decimal subtraction': [4, 7] }
};

function scope(p, area, y, key) {
  const range = (TITLE_YEARS[area] || {})[p.title];
  if (TITLE_YEARS[area] && (!range || y < range[0] || y > range[1])) fail(key + ' ' + p.title + ' out of year scope', p);
  if (p.method === 'sentence') return;
  if (p.method === 'fact') {
    if (area === 'add' || area === 'subtract') {
      const t = p.operands.terms; const total = p.answer.total;
      if (p.signBox) {
        if (y < 4) fail(key + ' sign box before Year 4', p);
        const limit = { 4: 10, 5: 20, 6: 100, 7: 20 }[y];
        if (t.some(v => Math.abs(v) > limit)) fail(key + ' negative sentence numbers too big', p);
        if (y === 7 && !(t[1] < 0)) fail(key + ' Year 7 sentence lacks a bracketed negative', p);
        if (!t.some(v => v < 0) && total >= 0) fail(key + ' no negative in a below-zero sentence', p);
        stat(key, 'below-zero sentences');
      } else {
        if (y > 2) fail(key + ' plain sentence after Year 2', p);
        if (total < 0 || t.some(v => v < 0)) fail(key + ' negative in Year 1-2', p);
        if (y === 1 && total > 100) fail(key + ' Year 1 total over 100', p);
        if (t.length === 3 && area !== 'add') fail(key + ' three terms in subtract', p);
        if (p.missing !== null) stat(key, 'missing number');
      }
      if (p.width > 11) fail(key + ' sentence wider than 11 cells', p);
      return;
    }
    if (y > 4) fail(key + ' fact after Year 4', p);
    if (!p.operands) {
      // Year 1 dot pictures: the rows times the dots in a row.
      if (y !== 1 || p.answer.value !== (p.mode === 'share' ? p.picture.cols : (p.mode === 'group' ? p.picture.rows : p.picture.rows * p.picture.cols))) fail(key + ' picture answer', p);
      return;
    }
    const { a, b, dividend, divisor } = p.operands;
    const factors = area === 'multiply' ? [a, b] : [divisor, dividend / divisor];
    if (y >= 3 && factors.some(f => f > 12)) fail(key + ' fact beyond 12 x 12', p);
    if (y <= 2 && area === 'multiply' && !factors.some(f => E.FACT_TABLES.includes(f))) fail(key + ' Year ' + y + ' fact outside its tables', p);
    if (p.width > 9) fail(key + ' fact wider than 9 cells', p);
    return;
  }
  if (p.width > 8) fail(key + ' written layout wider than 8 columns', p);
  if (p.places) {
    if (y < 4) fail(key + ' decimal method before Year 4', p);
    if (p.places > E.MAX_DECIMAL_PLACES[y]) fail(key + ' too many places', p);
    // The answer card must be a true statement.
    try { const r = statementText(p.answer.expression); if (r) fail(key + ' decimal answer card is false: ' + p.answer.expression, p); } catch (err) { fail(key + ' decimal answer card unreadable: ' + err.message, p); }
    stat(key, 'decimal methods');
    return;
  }
  const sizes = { 2: [2, 3], 3: [3, 4], 4: [4, 5], 5: [5, 6], 6: [6, 6], 7: [6, 7] }[y];
  if (area === 'add' || area === 'subtract') {
    const { a, b } = p.operands;
    const longer = Math.max(D(a), D(b)); const shorter = Math.min(D(a), D(b));
    if (y < 2 || longer < sizes[0] || longer > sizes[1] || longer - shorter > 1) fail(key + ' column sizes out of scope ' + a + ',' + b, p);
    if (area === 'subtract') {
      if (b > a || b === a) fail(key + ' subtraction order', p);
      if (E.exchangesAcrossZero(a, b)) stat(key, 'exchange across zero');
    }
    stat(key, 'columns');
    return;
  }
  if (area === 'multiply') {
    const { a, b } = p.operands;
    const moves = p.actions.filter(x => x.choice === 'carry' && x.value > 0).length;
    const ok = {
      3: [2, 3].includes(D(a)) && b >= 2 && b <= 9 && moves > 0,
      4: ([3, 4].includes(D(a)) && b >= 2 && b <= 9 && moves > 0) || (D(a) === 2 && D(b) === 2 && nz(b)),
      5: [3, 4].includes(D(a)) && D(b) === 2 && nz(b),
      6: (D(a) === 4 && D(b) === 2 && nz(b)) || ([3, 4].includes(D(a)) && D(b) === 3 && nz(b)),
      7: [4, 5].includes(D(a)) && D(b) === 3 && nz(b)
    }[y];
    if (!ok) fail(key + ' out of year scope', p);
    if (p.answer.value !== a * b) fail(key + ' wrong product', p);
    return;
  }
  const { dividend, divisor } = p.operands;
  const q = p.answer.quotient, r = p.answer.remainder;
  if (q * divisor + r !== dividend || r < 0 || r >= divisor) fail(key + ' wrong division', p);
  const ok = {
    3: [2, 3].includes(D(dividend)) && divisor >= 2 && divisor <= 9 && r === 0 && p.method === 'short',
    4: [3, 4].includes(D(dividend)) && divisor >= 2 && divisor <= 9 && p.method === 'short',
    5: (D(dividend) === 4 && divisor <= 9 && p.method === 'short') || ([3, 4].includes(D(dividend)) && divisor >= 11 && divisor <= 99 && p.method === 'long'),
    6: [4, 5].includes(D(dividend)) && divisor >= 11 && divisor <= 99 && p.method === 'long',
    7: p.method === 'long' && ((D(dividend) === 5 && divisor >= 11 && divisor <= 99) || (D(dividend) === 4 && D(divisor) === 3 && nz(divisor)))
  }[y];
  if (!ok) fail(key + ' out of year scope', p);
}

// "23.4 + 9.75 = 33.15" and "437 ÷ 4 = 109.25" style answer cards.
function statementText(text) {
  const [left, right] = text.split(' = ');
  return cmpQ(evaluate(left), evaluate(right)) === 0 ? null : 'false';
}

// Test mode: the worked sheet must put the right answer in exactly the marked boxes.
function testSheet(p, key) {
  if (!p.question || !Array.isArray(p.markRowIds) || !p.markRowIds.length) return fail(key + ' missing question or markRowIds', p);
  const sol = E.solutionOf(p);
  const marked = p.rows.filter(r => p.markRowIds.includes(r.id)).flatMap(r => r.cells.filter(c => c && c.kind === 'input'));
  if (marked.some(c => sol.values[c.id] === undefined)) fail(key + ' marked box without a solution value', p);
  if (p.method === 'sentence') {
    const inputs = p.rows.flatMap(r => r.cells.filter(c => c && c.kind === 'input'));
    if (inputs.length !== marked.length) fail(key + ' a sentence answer box is not marked', p);
    stat(key, 'test method:sentence');
    return;
  }
  const read = marked.map(c => sol.values[c.id]).join('');
  let w;
  if (p.method === 'fact') w = (p.signBox && p.answer.total < 0 ? MINUS : '') + String(p.answer.value);
  else if (p.operation === 'divide') w = String(p.answer.quotient) + (p.answer.remainder ? String(p.answer.remainder) : '');
  else w = String(p.answer.value);
  if (read !== w) fail(key + ' test sheet reads ' + read + ' want ' + w, p);
  stat(key, 'test method:' + p.method);
}

let total = 0;
for (const area of E.AREAS) {
  for (const y of E.YEARS) {
    const key = area + ' Y' + y; let inputs = 0;
    for (let i = 0; i < N; i++) {
      const p = E.generateProblem(area, y); total++;
      if (p.year !== y || p.operation !== area) fail(key + ' wrong tags', p);
      replay(p, key); scope(p, area, y, key); testSheet(p, key);
      if (p.method === 'sentence') verifySentence(p, key);
      inputs += E.roundInputs(p);
      stat(key, 'title:' + p.title);
    }
    const mean = inputs / N;
    const nearEdge = Math.abs(mean - 5) < 0.1 || Math.abs(mean - 15) < 0.1;
    const ok = E.cleanRoundsForInputs(mean) === E.cleanRounds(area, y) || (nearEdge && [E.cleanRoundsForInputs(mean - 0.1), E.cleanRoundsForInputs(mean + 0.1)].includes(E.cleanRounds(area, y)));
    if (!ok) fail(key + ' gate table says ' + E.cleanRounds(area, y) + ' but measured ' + mean.toFixed(2) + ' inputs', null);
    stat(key, 'mean inputs x100', Math.round(100 * mean));
  }
}

// Seeded problems repeat exactly, so a mixed test can be rebuilt after the game is closed.
const seededA = E.withSeed(12345, () => E.AREAS.map(a => JSON.stringify(E.generateProblem(a, 5))));
const seededB = E.withSeed(12345, () => E.AREAS.map(a => JSON.stringify(E.generateProblem(a, 5))));
if (seededA.join() !== seededB.join()) fail('withSeed does not repeat', null);

// Easy leans to shorter rounds and hard to longer ones, in every area and year.
for (const area of E.AREAS) for (const y of E.YEARS) {
  const mean = d => { let s = 0; for (let i = 0; i < 300; i++) s += E.effort(E.generateProblem(area, y, d)); return s / 300; };
  const easy = mean('easy'); const hard = mean('hard');
  if (easy > hard) fail(area + ' Y' + y + ' easy (' + easy.toFixed(2) + ') is harder than hard (' + hard.toFixed(2) + ')', null);
}

// Appendix 1 worked examples.
const ex = E.buildSubtraction(932, 457, 3);
const marks = JSON.stringify(E.solutionOf(ex).values);
if (!/"ex-c0":"8"/.test(marks) || !/"ex-c1":"12"/.test(marks) || !/"ex-c2":"12"/.test(marks) || ex.answer.value !== 475) fail('Appendix 1 932 - 457 marks: ' + marks, ex);
[[E.buildAddition(789, 642, 3), 1431], [E.buildMultiplication(342, 7, 4), 2394], [E.buildMultiplication(124, 26, 5), 3224]].forEach(([p, v]) => { if (p.answer.value !== v) fail('Appendix 1 example', p); replay(p, 'appendix'); });
[[E.buildShortDivision(432, 5, 4), '86 R 2'], [E.buildShortDivision(98, 7, 3), '14'], [E.buildDivision(432, 15, 6), '28 R 12'], [E.buildDecimalDivision('432', 15, 1, 6), '28.8']].forEach(([p, v]) => { if (!p.answer.expression.endsWith('= ' + v)) fail('Appendix 1 division', p); replay(p, 'appendix'); });

// Every verifier must have run on generated problems: one that is never reached would pass without checking anything.
const exercised = new Set(Object.values(stats).flatMap(v => Object.keys(v).filter(f => f.startsWith('check:')).map(f => f.slice(6))));
Object.keys(VERIFY).forEach(kind => { if (!exercised.has(kind)) fail('verifier ' + kind + ' never ran', null); });

console.log('problems checked:', total);
console.log('check kinds exercised:', [...exercised].filter(k => VERIFY[k]).length, 'of', Object.keys(VERIFY).length);
console.log('failures:', failCount ? failCount + ' (first ' + fails.length + ' shown)\n  ' + fails.join('\n  ') : 0);
for (const [k, v] of Object.entries(stats)) {
  const shownStats = Object.entries(v).filter(([f]) => !f.startsWith('title:') && !f.startsWith('check:'));
  console.log(k.padEnd(13), shownStats.map(([f, c]) => f === 'mean inputs x100' ? 'inputs=' + (c / 100).toFixed(2) + ' gate=' + E.cleanRounds(k.split(' ')[0], Number(k.split('Y')[1])) : f + '=' + (100 * c / N).toFixed(1) + '%').join('  '));
}
if (failCount) process.exitCode = 1;
