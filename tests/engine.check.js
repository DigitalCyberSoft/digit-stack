// Engine replay: generates problems for every area and year and checks arithmetic, layouts, decisions, wording and the gate table.
// Run from the repo root: node tests/engine.check.js [engine-path] [problems-per-area-year, default 2000].
const path = require('path');
const E = require(process.argv[2] || path.join(__dirname, '..', 'engine.js'));
const N = Number(process.argv[3] || 2000);
const MINUS = E.MINUS;
const fails = []; const stats = {}; let failCount = 0;
const fail = (msg, p) => { failCount++; if (fails.length < 30) fails.push(msg + ' :: ' + (p && p.answer ? p.answer.expression : '')); };
const stat = (key, f, inc = 1) => { stats[key] = stats[key] || {}; stats[key][f] = (stats[key][f] || 0) + inc; };
const D = v => String(Math.abs(v)).length;
const nz = v => !String(v).includes('0');

function replay(p, key) {
  const cells = new Map();
  p.rows.forEach(r => (r.cells || []).forEach(c => { if (c) cells.set(c.id, Object.assign({ row: r }, c)); }));
  const shown = new Map();
  const hits = new Map();
  const topRow = p.rows.find(r => r.id === 'a');
  const current = p.operation === 'subtract' && p.method === 'column' ? topRow.cells.map(c => c.value) : null;
  const bottom = current ? p.rows.find(r => r.id === 'b').cells.map(c => (c ? c.value : 0)) : null;
  p.actions.forEach((a, i) => {
    ['prompt', 'subprompt', 'why'].forEach(f => {
      const t = a[f]; if (t === undefined) return;
      if (/quotient|borrow|space/i.test(t)) fail(key + ' banned word: ' + t, p);
      if (/\d+\.\d+/.test(t)) fail(key + ' decimal-like text: ' + t, p);
      if (/[–—]/.test(t)) fail(key + ' en/em dash: ' + t, p);
      if (/undefined|NaN|null/.test(t)) fail(key + ' bad text: ' + t, p);
    });
    if (a.kind === 'move') return fail(key + ' a move action still exists', p);
    const c = cells.get(a.cellId);
    if (!c) return fail(key + ' missing cell ' + a.cellId, p);
    hits.set(a.cellId, (hits.get(a.cellId) || 0) + 1);
    if (a.choice) {
      if (a.subprompt !== E.CHOICE[a.choice]) fail(key + ' choice text differs: ' + a.subprompt, p);
      const starts = { carry: /^Next column/, exchange: /^(Subtract the ones|Next column): /, leftover: /^What is left over from /, sign: /^What is / }[a.choice];
      if (!starts.test(a.prompt)) fail(key + ' choice prompt not neutral: ' + a.prompt, p);
      if (a.choice !== 'sign' && c.kind !== 'carry') fail(key + ' decision is not on a small box', p);
      if (a.choice !== 'sign' && a.shown !== (a.value > 0 ? (a.choice === 'exchange' ? String(current[c.col] + 10) : String(a.value)) : null)) fail(key + ' decision shows ' + a.shown + ' for ' + a.value, p);
    }
    if (a.kind === 'sign') {
      if (!c.signBox) fail(key + ' sign on a non-sign cell', p);
      if ((a.value === MINUS) !== (p.answer.total < 0)) fail(key + ' sign value wrong', p);
      if (a.firstDigit !== p.actions[i + 1].value) fail(key + ' sign firstDigit mismatch', p);
      shown.set(a.cellId, a.value === MINUS ? MINUS : '');
      return;
    }
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
  if (p.method === 'fact') {
    const want = (p.signBox && p.answer.total < 0 ? MINUS : '') + String(p.answer.value);
    if (readRow('fact') !== want) fail(key + ' sentence reads ' + readRow('fact') + ' want ' + want, p);
    const order = p.actions.filter(x => x.kind === 'digit').map(x => cells.get(x.cellId).col);
    if (order.some((v, i) => i && v <= order[i - 1])) fail(key + ' sentence not left to right', p);
  } else if (p.operation === 'divide') {
    const q = p.rows.find(r => r.id === 'q').cells.filter(Boolean).map(x => x.kind === 'given' ? x.value : shown.get(x.id)).join('');
    const want = String(p.answer.quotient) + (p.answer.remainder ? 'R' + p.answer.remainder : '');
    if (q !== want) fail(key + ' quotient row reads ' + q, p);
  } else {
    const rowId = p.answerRowIds[0];
    if (readRow(rowId) !== String(p.answer.value)) fail(key + ' answer row reads ' + readRow(rowId), p);
  }
}

function scope(p, area, y, key) {
  if (p.method === 'fact') {
    if (area === 'add' || area === 'subtract') {
      const t = p.operands.terms; const total = p.answer.total;
      if (p.signBox) {
        if (y < 5) fail(key + ' sign box before Year 5', p);
        const limit = y === 5 ? 20 : y === 6 ? 100 : 20;
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
    if (y > 2) fail(key + ' fact after Year 2', p);
    if (p.width > 9) fail(key + ' fact wider than 9 cells', p);
    return;
  }
  if (p.width > 8) fail(key + ' written layout wider than 8 columns', p);
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

// Test mode: the worked sheet must put the right answer in exactly the marked boxes.
function testSheet(p, key) {
  if (!p.question || !Array.isArray(p.markRowIds) || !p.markRowIds.length) return fail(key + ' missing question or markRowIds', p);
  const sol = E.solutionOf(p);
  const marked = p.rows.filter(r => p.markRowIds.includes(r.id)).flatMap(r => r.cells.filter(c => c && c.kind === 'input'));
  if (marked.some(c => sol.values[c.id] === undefined)) fail(key + ' marked box without a solution value', p);
  const read = marked.map(c => sol.values[c.id]).join('');
  let want;
  if (p.method === 'fact') want = (p.signBox && p.answer.total < 0 ? MINUS : '') + String(p.answer.value);
  else if (p.operation === 'divide') want = String(p.answer.quotient) + (p.answer.remainder ? String(p.answer.remainder) : '');
  else want = String(p.answer.value);
  if (read !== want) fail(key + ' test sheet reads ' + read + ' want ' + want, p);
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
      inputs += E.roundInputs(p);
    }
    const mean = inputs / N;
    const nearEdge = Math.abs(mean - 5) < 0.1 || Math.abs(mean - 15) < 0.1;
    const ok = E.cleanRoundsForInputs(mean) === E.cleanRounds(area, y) || (nearEdge && [E.cleanRoundsForInputs(mean - 0.1), E.cleanRoundsForInputs(mean + 0.1)].includes(E.cleanRounds(area, y)));
    if (!ok) fail(key + ' gate table says ' + E.cleanRounds(area, y) + ' but measured ' + mean.toFixed(2) + ' inputs', null);
    stat(key, 'mean inputs x100', Math.round(100 * mean));
  }
}
// Appendix 1 worked examples.
const ex = E.buildSubtraction(932, 457, 3);
const marks = JSON.stringify(E.solutionOf(ex).values);
if (!/"ex-c0":"8"/.test(marks) || !/"ex-c1":"12"/.test(marks) || !/"ex-c2":"12"/.test(marks) || ex.answer.value !== 475) fail('Appendix 1 932 - 457 marks: ' + marks, ex);
[[E.buildAddition(789, 642, 3), 1431], [E.buildMultiplication(342, 7, 4), 2394], [E.buildMultiplication(124, 26, 5), 3224]].forEach(([p, v]) => { if (p.answer.value !== v) fail('Appendix 1 example', p); replay(p, 'appendix'); });
[[E.buildShortDivision(432, 5, 4), '86 R 2'], [E.buildShortDivision(98, 7, 3), '14'], [E.buildDivision(432, 15, 6), '28 R 12']].forEach(([p, v]) => { if (!p.answer.expression.endsWith('= ' + v)) fail('Appendix 1 division', p); replay(p, 'appendix'); });

console.log('problems checked:', total);
console.log('failures:', failCount ? failCount + ' (first ' + fails.length + ' shown)\n  ' + fails.join('\n  ') : 0);
for (const [k, v] of Object.entries(stats)) {
  console.log(k.padEnd(12), Object.entries(v).map(([f, c]) => f === 'mean inputs x100' ? 'inputs=' + (c / 100).toFixed(2) + ' gate=' + E.cleanRounds(k.split(' ')[0], Number(k.split('Y')[1])) : f + '=' + (100 * c / N).toFixed(1) + '%').join('  '));
}
if (failCount) process.exitCode = 1;
