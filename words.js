/*
 * Digit Stack word problems: maths in a story, Years 1 to 7, following the
 * "solve problems" statements of the national curriculum in England
 * (programmes of study, gov.uk, updated 28 September 2021): one-step
 * problems in Year 1, money and change in Year 2, scaling and
 * correspondence in Year 3, two-step problems in contexts in Year 4,
 * multi-step problems, rates and remainders in Year 5, percentages,
 * unequal sharing and missing numbers in Year 6, and percentage change,
 * unit prices, speed and proportion in Year 7.
 *
 * The story is written on the page. Working lines take the steps one at a
 * time while learning (a test marks only the answer line, as it does
 * carries), and the answer line has its unit. A later line never shows an
 * earlier line's result, so a test gives nothing away.
 *
 * Each problem's `check.model` names the sum as plain data (add, change,
 * ratio, ...). tests/engine.check.js works the answer out again from it,
 * checks its numbers are in the story, and checks every working line.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = { install: factory };
  } else if (root && root.DigitStackEngine) {
    factory(root.DigitStackEngine);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Engine) {
  'use strict';

  const K = Engine.kit;
  const MINUS = Engine.MINUS;
  const randInt = K.randInt;
  const pick = K.pick;
  const shuffle = K.shuffle;
  const weighted = K.weighted;
  const decimalText = K.decimalText;

  // Names are repeated rather than replaced by he or she.
  const NAMES = ['Amira', 'Ben', 'Chen', 'Daisy', 'Femi', 'Grace', 'Hamza', 'Isla', 'Jack', 'Kofi', 'Lily', 'Maya',
    'Noah', 'Olu', 'Priya', 'Ravi', 'Sofia', 'Tom', 'Yusuf', 'Zara'];
  const THINGS = ['shells', 'stickers', 'marbles', 'cards', 'beads', 'stamps', 'buttons', 'conkers'];

  function people(count) {
    return shuffle(NAMES).slice(0, count || 1);
  }

  // Money as it is written: 45p below a pound, £3.95 from Year 3.
  function money(pence) {
    return pence < 100 ? pence + 'p' : '£' + decimalText(pence, 2);
  }

  function pounds(pence) {
    return decimalText(pence, 2);
  }

  // What is paid with: a 50p coin, a £1 or £2 coin, a £5, £10 or £20 note.
  function coinOrNote(pence) {
    if (pence < 100) return 'a ' + pence + 'p coin';
    return 'a £' + (pence / 100) + (pence <= 200 ? ' coin' : ' note');
  }

  /* One problem. `lines` are [{ tokens, prompt, why }], the last being the
     answer line; the others are working. */
  function story(year, title, text, lines, model, extra) {
    const tokens = lines.map(function (line) {
      return line.tokens.map(function (token) {
        return token.ask !== undefined || token.pick !== undefined ? Object.assign({ prompt: line.prompt, why: line.why }, token) : token;
      });
    });
    const last = lines[lines.length - 1];
    return K.buildSentenceLines(Object.assign({
      area: 'words', year: year, title: title, stage: 'PROBLEM',
      prompt: text, question: text, why: last.why,
      lines: tokens,
      working: lines.slice(0, -1).map(function (line, k) { return k; }),
      check: { kind: 'story', model: model },
      // A problem of more than one step gets two worked examples.
      examples: lines.length > 1 ? 2 : 1
    }, extra || {}));
  }

  // A working line "a op b = [result]": `known` says which of a and b were
  // worked out on an earlier line and so are typed again, not shown.
  function calc(a, op, b, result, known) {
    const side = function (value, typed) { return typed ? { ask: value } : { n: value }; };
    return [side(a, known === 'a' || known === 'both'), { s: op }, side(b, known === 'b' || known === 'both'), { s: '=' }, { ask: result }];
  }

  function answer(value, unit, before) {
    const tokens = before ? [{ t: before, span: 1 }, { ask: value }] : [{ ask: value }];
    return unit ? tokens.concat([{ t: unit, span: Math.max(1, Math.ceil(unit.length / 4)) }]) : tokens;
  }

  const WORDS = {};

  /* Years 1 to 3: one step. */

  WORDS.join = function (year) {
    const top = { 1: 20, 2: 100, 3: 1000 }[year] || 1000;
    const a = randInt(year === 1 ? 3 : 12, Math.floor(top * 0.6));
    const b = randInt(year === 1 ? 2 : 8, top - a);
    const [name] = people();
    const thing = pick(THINGS);
    const verb = pick(['finds', 'is given', 'wins']);
    return story(year, 'Adding', name + ' has ' + a + ' ' + thing + '. ' + name + ' ' + verb + ' ' + b + ' more. How many ' + thing + ' does ' + name + ' have now?',
      [{ tokens: answer(a + b, thing), prompt: 'How many ' + thing + ' now?', why: name + ' gets more, so add: ' + a + ' + ' + b + ' = ' + (a + b) + '.' }],
      { op: 'add', a: a, b: b });
  };

  WORDS.takeAway = function (year) {
    const top = { 1: 20, 2: 100, 3: 1000 }[year] || 1000;
    const a = randInt(year === 1 ? 8 : 30, top);
    const b = randInt(2, a - 1);
    const scene = pick([['birds are on a fence', 'fly away', 'birds'], ['cakes are on a plate', 'are eaten', 'cakes'],
      ['balloons are at a party', 'pop', 'balloons'], ['children are in the park', 'go home', 'children']]);
    return story(year, 'Taking away', a + ' ' + scene[0] + '. ' + b + ' ' + scene[1] + '. How many ' + scene[2] + ' are left?',
      [{ tokens: answer(a - b, scene[2]), prompt: 'How many are left?', why: b + ' go, so take them away: ' + a + ' ' + MINUS + ' ' + b + ' = ' + (a - b) + '.' }],
      { op: 'sub', a: a, b: b });
  };

  WORDS.compare = function (year) {
    const top = { 1: 20, 2: 100, 3: 1000 }[year] || 1000;
    const a = randInt(year === 1 ? 6 : 20, top);
    const b = randInt(1, a - 1);
    const [p, q] = people(2);
    const thing = pick(THINGS);
    return story(year, 'How many more', p + ' has ' + a + ' ' + thing + '. ' + q + ' has ' + b + '. How many more ' + thing + ' does ' + p + ' have than ' + q + '?',
      [{ tokens: answer(a - b, 'more'), prompt: 'How many more?', why: 'How many more is the difference between the two: ' + a + ' ' + MINUS + ' ' + b + ' = ' + (a - b) + '.' }],
      { op: 'sub', a: a, b: b });
  };

  WORDS.groups = function (year) {
    const tables = { 1: [2, 5, 10], 2: [2, 3, 4, 5, 8, 10] }[year] || [3, 4, 6, 7, 8, 9, 11, 12];
    const each = pick(tables);
    const n = randInt(2, year === 1 ? 5 : (year === 2 ? 10 : 12));
    const scene = pick([['bags', 'apples'], ['boxes', 'pencils'], ['plates', 'biscuits'], ['vases', 'flowers'], ['packs', 'cards']]);
    return story(year, 'Equal groups', 'There are ' + n + ' ' + scene[0] + ' with ' + each + ' ' + scene[1] + ' in each. How many ' + scene[1] + ' are there altogether?',
      [{ tokens: answer(n * each, scene[1]), prompt: 'How many altogether?', why: n + ' groups of ' + each + ': ' + n + ' × ' + each + ' = ' + (n * each) + '.' }],
      { op: 'mul', a: n, b: each });
  };

  WORDS.share = function (year) {
    const tables = { 1: [2, 5, 10], 2: [2, 3, 4, 5, 10] }[year] || [3, 4, 6, 7, 8, 9];
    const parts = pick(tables);
    const each = randInt(2, year === 1 ? 5 : 10);
    const total = parts * each;
    const thing = pick(['sweets', 'grapes', 'stickers', 'crayons']);
    return story(year, 'Sharing', total + ' ' + thing + ' are shared equally between ' + parts + ' children. How many ' + thing + ' does each child get?',
      [{ tokens: answer(each, 'each'), prompt: 'How many each?', why: 'Share ' + total + ' into ' + parts + ' equal groups: ' + total + ' ÷ ' + parts + ' = ' + each + '.' }],
      { op: 'div', a: total, b: parts });
  };

  // Year 2: money of one unit, pence.
  WORDS.moneyTotal = function (year) {
    const items = shuffle([['pencil', 'rubber'], ['apple', 'banana'], ['comic', 'sticker'], ['lolly', 'drink']])[0];
    const a = randInt(11, 55);
    const b = randInt(11, 99 - a);
    return story(year, 'Money', 'A ' + items[0] + ' costs ' + a + 'p and a ' + items[1] + ' costs ' + b + 'p. How much do they cost altogether?',
      [{ tokens: answer(a + b, 'p'), prompt: 'How much altogether?', why: 'Altogether means add: ' + a + 'p + ' + b + 'p = ' + (a + b) + 'p.' }],
      { op: 'add', aP: a, bP: b });
  };

  WORDS.change = function (year) {
    const pay = year === 2 ? pick([20, 50]) : pick([50, 100, 200]);
    const cost = randInt(Math.floor(pay / 4), pay - 3);
    const [name] = people();
    const item = pick(['a drink', 'a comic', 'a yo-yo', 'a ruler', 'a bag of popcorn']);
    return story(year, 'Change', name + ' buys ' + item + ' for ' + money(cost) + ' and pays with ' + coinOrNote(pay) + '. How much change does ' + name + ' get?',
      [{ tokens: answer(pay - cost, 'p'), prompt: 'How much change?', why: (pay >= 100 ? money(pay) + ' is ' + pay + 'p. ' : '') +
        'Change is what is paid take away the cost: ' + pay + 'p ' + MINUS + ' ' + cost + 'p = ' + (pay - cost) + 'p.' }],
      { op: 'change', payP: pay, items: [[1, cost]] });
  };

  /* Years 2 to 4: two steps. */

  WORDS.twoStep = function (year) {
    const top = { 2: 100, 3: 1000, 4: 10000 }[year] || 10000;
    const a = randInt(Math.floor(top * 0.1), Math.floor(top * 0.6));
    const b = randInt(Math.floor(top * 0.05), Math.floor(top * 0.3));
    const c = randInt(Math.floor(top * 0.05), a + b - 1);
    const [p, q] = people(2);
    const thing = pick(THINGS);
    const mid = a + b;
    return story(year, 'Two steps', p + ' has ' + a + ' ' + thing + '. ' + p + ' wins ' + b + ' more, then gives ' + c + ' to ' + q + '. How many ' + thing + ' does ' + p + ' have now?', [
      { tokens: calc(a, '+', b, mid), prompt: 'First: how many after winning ' + b + ' more?', why: 'Winning more means add: ' + a + ' + ' + b + ' = ' + mid + '.' },
      { tokens: calc(mid, MINUS, c, mid - c, 'a'), prompt: 'Then take away the ' + c + ' given away. Start with the ' + mid + ' from the first line.', why: 'Giving away means take away: ' + mid + ' ' + MINUS + ' ' + c + ' = ' + (mid - c) + '.' },
      { tokens: answer(mid - c, thing), prompt: 'So how many ' + thing + ' now?', why: 'The last line gives the answer: ' + (mid - c) + ' ' + thing + '.' }
    ], { op: 'seq', start: a, steps: [['+', b], ['-', c]] });
  };

  // Year 3: positive integer scaling.
  WORDS.scaling = function (year) {
    const k = randInt(2, year === 3 ? 9 : 12);
    const scene = pick([['A tree is', 'm tall. A tower is', 'times as tall. How tall is the tower?', 'm'],
      ['A puppy weighs', 'kg. Its mother weighs', 'times as much. How much does the mother weigh?', 'kg'],
      ['A short film lasts', 'minutes. A long film lasts', 'times as long. How long is the long film?', 'minutes']]);
    const a = randInt(2, year === 3 ? 12 : 60);
    return story(year, 'Scaling', scene[0] + ' ' + a + ' ' + scene[1] + ' ' + k + ' ' + scene[2],
      [{ tokens: answer(a * k, scene[3]), prompt: 'Work it out.', why: k + ' times as much means multiply by ' + k + ': ' + a + ' × ' + k + ' = ' + (a * k) + '.' }],
      { op: 'mul', a: a, b: k });
  };

  // Year 3: correspondence, n objects with m objects.
  WORDS.outfits = function (year) {
    const [name] = people();
    const a = randInt(2, year === 3 ? 6 : 9);
    const b = randInt(2, year === 3 ? 5 : 8);
    if (year >= 4 && randInt(0, 1)) {
      const c = randInt(2, 4);
      return story(year, 'Combinations', name + ' has ' + a + ' hats, ' + b + ' scarves and ' + c + ' pairs of gloves. How many different ways can ' + name + ' wear one hat, one scarf and one pair of gloves?', [
        { tokens: calc(a, '×', b, a * b), prompt: 'First: how many ways to pick a hat and a scarf?', why: 'Each of the ' + a + ' hats goes with each of the ' + b + ' scarves: ' + a + ' × ' + b + ' = ' + (a * b) + '.' },
        { tokens: calc(a * b, '×', c, a * b * c, 'a'), prompt: 'Each of those goes with each pair of gloves. Start with the ' + (a * b) + ' from the first line.', why: (a * b) + ' × ' + c + ' = ' + (a * b * c) + '.' },
        { tokens: answer(a * b * c, 'ways'), prompt: 'So how many ways?', why: 'The last line gives the answer: ' + (a * b * c) + ' ways.' }
      ], { op: 'product', values: [a, b, c] });
    }
    return story(year, 'Combinations', name + ' has ' + a + ' hats and ' + b + ' scarves. How many different ways can ' + name + ' wear one hat with one scarf?',
      [{ tokens: answer(a * b, 'ways'), prompt: 'How many ways?', why: 'Each of the ' + a + ' hats goes with each of the ' + b + ' scarves: ' + a + ' × ' + b + ' = ' + (a * b) + '.' }],
      { op: 'product', values: [a, b] });
  };

  // Year 3: several of one price, then change, in pence.
  WORDS.changeMany = function (year) {
    const n = randInt(2, 6);
    const each = randInt(12, 95);
    const cost = n * each;
    const pay = [100, 200, 500, 1000].find(function (p) { return p > cost + 4; });
    if (!pay) return null;
    const [name] = people();
    const item = pick(['pens', 'stickers', 'rubbers', 'badges']);
    return story(year, 'Change', name + ' buys ' + n + ' ' + item + ' at ' + each + 'p each and pays with ' + coinOrNote(pay) + '. How much change does ' + name + ' get?', [
      { tokens: calc(n, '×', each, cost), prompt: 'First: how much do the ' + item + ' cost, in pence?', why: n + ' at ' + each + 'p: ' + n + ' × ' + each + ' = ' + cost + 'p.' },
      { tokens: calc(pay, MINUS, cost, pay - cost, 'b'), prompt: '£' + (pay / 100) + ' is ' + pay + 'p. Take away the cost from the first line.', why: pay + 'p ' + MINUS + ' ' + cost + 'p = ' + (pay - cost) + 'p.' },
      { tokens: answer(pay - cost, 'p'), prompt: 'So how much change?', why: 'The last line gives the answer: ' + (pay - cost) + 'p.' }
    ], { op: 'change', payP: pay, items: [[n, each]] });
  };

  // Years 4 and 5: multiply, then add.
  WORDS.multiplyAdd = function (year) {
    const n = randInt(3, year === 4 ? 9 : 25);
    const each = randInt(12, year === 4 ? 48 : 96);
    const extra = randInt(5, 60);
    const scene = pick([['A school orders', 'boxes of', 'pencils and', 'loose pencils. How many pencils is that?', 'pencils'],
      ['A farmer packs', 'trays of', 'eggs and has', 'eggs left over. How many eggs are there?', 'eggs'],
      ['A library gets', 'crates of', 'books and', 'single books. How many books is that?', 'books']]);
    return story(year, 'Two steps', scene[0] + ' ' + n + ' ' + scene[1] + ' ' + each + ' ' + scene[2] + ' ' + extra + ' ' + scene[3], [
      { tokens: calc(n, '×', each, n * each), prompt: 'First: how many in the full ' + scene[1].split(' ')[0] + '?', why: n + ' lots of ' + each + ': ' + n + ' × ' + each + ' = ' + (n * each) + '.' },
      { tokens: calc(n * each, '+', extra, n * each + extra, 'a'), prompt: 'Then add the ' + extra + ' extra. Start with the ' + (n * each) + ' from the first line.', why: (n * each) + ' + ' + extra + ' = ' + (n * each + extra) + '.' },
      { tokens: answer(n * each + extra, scene[4]), prompt: 'So how many altogether?', why: 'The last line gives the answer: ' + (n * each + extra) + ' ' + scene[4] + '.' }
    ], { op: 'seq', start: n, steps: [['*', each], ['+', extra]] });
  };

  // Years 4 and 5: money in pounds and pence, two items and change.
  WORDS.moneyDecimal = function (year) {
    const a = randInt(105, 795);
    const b = randInt(35, 450);
    const total = a + b;
    const pay = [500, 1000, 2000].find(function (p) { return p > total + 9; });
    const [name] = people();
    const items = pick([['a book', 'a pen'], ['a T-shirt', 'a cap'], ['a game', 'a snack'], ['a plant', 'a pot']]);
    return story(year, 'Money', name + ' buys ' + items[0] + ' for ' + money(a) + ' and ' + items[1] + ' for ' + money(b) + '. ' + name + ' pays with ' + coinOrNote(pay) + '. How much change does ' + name + ' get?', [
      { tokens: calc(pounds(a), '+', pounds(b), pounds(total)), prompt: 'First: how much do the two cost, in pounds?', why: '£' + pounds(a) + ' + £' + pounds(b) + ' = £' + pounds(total) + '. Line up the points.' },
      { tokens: calc(pounds(pay), MINUS, pounds(total), pounds(pay - total), 'b'), prompt: 'Take the total from the first line away from £' + pounds(pay) + '.', why: '£' + pounds(pay) + ' ' + MINUS + ' £' + pounds(total) + ' = £' + pounds(pay - total) + '.' },
      { tokens: answer(pounds(pay - total), null, '£'), prompt: 'So how much change?', why: 'The last line gives the answer: £' + pounds(pay - total) + '.' }
    ], { op: 'change', payP: pay, items: [[1, a], [1, b]] });
  };

  // Year 4: grams and kilograms.
  WORDS.massLeft = function (year) {
    const kg = randInt(1, 5);
    const used = randInt(110, kg * 1000 - 60);
    const thing = pick(['flour', 'sugar', 'rice', 'oats']);
    return story(year, 'Measures', 'A bag holds ' + kg + ' kg of ' + thing + '. A recipe uses ' + used + ' g. How many grams are left?', [
      { tokens: calc(kg, '×', 1000, kg * 1000), prompt: 'First: how many grams is ' + kg + ' kg?', why: '1 kg is 1000 g, so ' + kg + ' kg is ' + kg + ' × 1000 = ' + (kg * 1000) + ' g.' },
      { tokens: calc(kg * 1000, MINUS, used, kg * 1000 - used, 'a'), prompt: 'Take away the ' + used + ' g used.', why: (kg * 1000) + ' ' + MINUS + ' ' + used + ' = ' + (kg * 1000 - used) + '.' },
      { tokens: answer(kg * 1000 - used, 'g'), prompt: 'So how many grams are left?', why: 'The last line gives the answer: ' + (kg * 1000 - used) + ' g.' }
    ], { op: 'unitsLeft', big: kg, unit: 'kg', small: used });
  };

  /* Year 5: remainders, rates, fractions of amounts, several prices. */

  WORDS.remainders = function (year) {
    const size = randInt(4, 16);
    const total = size * randInt(3, 12) + randInt(1, size - 1);
    const up = randInt(0, 1) === 1;
    const groups = Math.floor(total / size);
    if (up) {
      return story(year, 'Remainders', total + ' children are going on a trip. Each minibus holds ' + size + ' children. How many minibuses are needed?', [
        { tokens: [{ n: total }, { s: '÷' }, { n: size }, { s: '=' }, { ask: groups }, { t: 'r', span: 1 }, { ask: total - groups * size }], prompt: 'Divide, with a remainder.', why: total + ' ÷ ' + size + ' = ' + groups + ' r ' + (total - groups * size) + '.' },
        { tokens: answer(groups + 1, 'minibuses'), prompt: 'How many minibuses?', why: groups + ' minibuses leave ' + (total - groups * size) + ' children behind, so one more is needed: ' + (groups + 1) + '.' }
      ], { op: 'roundUp', a: total, b: size });
    }
    return story(year, 'Remainders', 'A farm has ' + total + ' eggs. They are packed in boxes of ' + size + '. How many boxes can be filled?', [
      { tokens: [{ n: total }, { s: '÷' }, { n: size }, { s: '=' }, { ask: groups }, { t: 'r', span: 1 }, { ask: total - groups * size }], prompt: 'Divide, with a remainder.', why: total + ' ÷ ' + size + ' = ' + groups + ' r ' + (total - groups * size) + '.' },
      { tokens: answer(groups, 'boxes'), prompt: 'How many full boxes?', why: 'The ' + (total - groups * size) + ' eggs left over do not fill a box, so ' + groups + ' boxes.' }
    ], { op: 'roundDown', a: total, b: size });
  };

  WORDS.rate = function (year) {
    const rate = randInt(4, 25);
    const time = randInt(3, 15);
    const scene = pick([['A tap fills', 'litres a minute', 'litres', 'minutes'], ['A printer prints', 'pages a minute', 'pages', 'minutes'],
      ['A cyclist rides', 'km an hour', 'km', 'hours']]);
    if (randInt(0, 1)) {
      return story(year, 'Rates', scene[0] + ' ' + rate + ' ' + scene[1] + '. How many ' + scene[2] + ' in ' + time + ' ' + scene[3] + '?',
        [{ tokens: answer(rate * time, scene[2]), prompt: 'Work it out.', why: rate + ' for each of ' + time + ': ' + rate + ' × ' + time + ' = ' + (rate * time) + '.' }],
        { op: 'mul', a: rate, b: time });
    }
    return story(year, 'Rates', scene[0] + ' ' + rate + ' ' + scene[1] + '. How many ' + scene[3] + ' does it take for ' + (rate * time) + ' ' + scene[2] + '?',
      [{ tokens: answer(time, scene[3]), prompt: 'Work it out.', why: 'How many lots of ' + rate + ' make ' + (rate * time) + ': ' + (rate * time) + ' ÷ ' + rate + ' = ' + time + '.' }],
      { op: 'div', a: rate * time, b: rate });
  };

  WORDS.fractionOff = function (year) {
    const d = pick([2, 3, 4, 5, 10]);
    const n = d === 2 ? 1 : randInt(1, d - 1);
    const price = d * randInt(2, 24);
    const off = price / d * n;
    const item = pick(['A coat', 'A bike', 'A game', 'A lamp', 'A tent']);
    return story(year, 'Fractions of amounts', item + ' costs £' + price + '. In a sale it is ' + n + '/' + d + ' off. What is the sale price?', [
      { tokens: [{ frac: [n, d] }, { t: 'of', span: 1 }, { n: price }, { s: '=' }, { ask: off }], prompt: 'First: how much is ' + n + '/' + d + ' of £' + price + '?', why: price + ' ÷ ' + d + ' = ' + (price / d) + (n > 1 ? ', and ' + n + ' × ' + (price / d) + ' = ' + off : '') + '.' },
      { tokens: calc(price, MINUS, off, price - off, 'b'), prompt: 'Take that off the price.', why: price + ' ' + MINUS + ' ' + off + ' = ' + (price - off) + '.' },
      { tokens: answer(price - off, null, '£'), prompt: 'So what is the sale price?', why: 'The last line gives the answer: £' + (price - off) + '.' }
    ], { op: 'fractionOff', price: price, n: n, d: d });
  };

  WORDS.tickets = function (year) {
    const adults = randInt(1, 4);
    const children = randInt(2, 5);
    const adult = randInt(6, 15);
    const child = randInt(3, adult - 2);
    const a = adults * adult;
    const c = children * child;
    return story(year, 'Several steps', 'Adult tickets cost £' + adult + ' and child tickets cost £' + child + '. What do ' + adults + ' adult' + (adults > 1 ? 's' : '') + ' and ' + children + ' children pay altogether?', [
      { tokens: calc(adults, '×', adult, a), prompt: 'First: the adult tickets, in pounds.', why: adults + ' × ' + adult + ' = ' + a + '.' },
      { tokens: calc(children, '×', child, c), prompt: 'Next: the child tickets.', why: children + ' × ' + child + ' = ' + c + '.' },
      { tokens: calc(a, '+', c, a + c, 'both'), prompt: 'Add the two lines.', why: a + ' + ' + c + ' = ' + (a + c) + '.' },
      { tokens: answer(a + c, null, '£'), prompt: 'So how much altogether?', why: 'The last line gives the answer: £' + (a + c) + '.' }
    ], { op: 'sumProducts', pairs: [[adults, adult], [children, child]] });
  };

  /* Year 6: percentages, unequal sharing, proportion, missing numbers,
     converting units, the mean. */

  WORDS.percentOf = function (year) {
    const pct = pick([5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 75]);
    const whole = randInt(2, 30) * 20;
    const part = pct * whole / 100;
    const scene = pick([['A school has', 'pupils.', 'walk to school. How many pupils walk?', 'pupils'],
      ['A farm has', 'sheep.', 'are black. How many black sheep are there?', 'sheep'],
      ['A cinema has', 'seats.', 'are taken. How many seats are taken?', 'seats']]);
    return story(year, 'Percentages', scene[0] + ' ' + whole + ' ' + scene[1] + ' ' + pct + '% ' + scene[2], [
      { tokens: calc(pct, '×', whole, pct * whole), prompt: 'One way: multiply by ' + pct + ', then divide by 100.', why: pct + ' × ' + whole + ' = ' + (pct * whole) + '.' },
      { tokens: calc(pct * whole, '÷', 100, part, 'a'), prompt: 'Now divide by 100.', why: pct + '% means ' + pct + ' out of every 100: ' + (pct * whole) + ' ÷ 100 = ' + part + '.' },
      { tokens: answer(part, scene[3]), prompt: 'So how many?', why: 'The last line gives the answer: ' + part + ' ' + scene[3] + '.' }
    ], { op: 'percentOf', pct: pct, of: whole });
  };

  WORDS.ratioShare = function (year) {
    // b is at least 2, so the last step is never "× 1".
    const a = randInt(1, year >= 7 ? 7 : 5);
    const b = randInt(2, year >= 7 ? 7 : 5);
    if (a === b) return null;
    const part = randInt(2, year >= 7 ? 25 : 12);
    const total = (a + b) * part;
    const [p, q] = people(2);
    const thing = pick(['stickers', 'sweets', 'beads', 'cards']);
    return story(year, 'Ratio', p + ' and ' + q + ' share ' + total + ' ' + thing + ' in the ratio ' + a + ' : ' + b + '. How many ' + thing + ' does ' + q + ' get?', [
      { tokens: calc(a, '+', b, a + b), prompt: 'First: how many equal parts are there?', why: a + ' : ' + b + ' is ' + a + ' + ' + b + ' = ' + (a + b) + ' parts.' },
      { tokens: calc(total, '÷', a + b, part, 'b'), prompt: 'How many ' + thing + ' in one part?', why: total + ' ÷ ' + (a + b) + ' = ' + part + '.' },
      { tokens: calc(part, '×', b, part * b, 'a'), prompt: q + ' gets ' + b + ' parts.', why: part + ' × ' + b + ' = ' + (part * b) + '.' },
      { tokens: answer(part * b, thing), prompt: 'So how many does ' + q + ' get?', why: 'The last line gives the answer: ' + (part * b) + ' ' + thing + '.' }
    ], { op: 'ratioShare', total: total, a: a, b: b });
  };

  WORDS.recipe = function (year) {
    const from = pick([2, 3, 4, 5, 6]);
    const to = pick([2, 3, 4, 5, 6, 8, 9, 10, 12].filter(function (x) { return x !== from; }));
    const per = randInt(3, 30) * 5;
    const amount = per * from;
    const thing = pick([['flour', 'g'], ['milk', 'ml'], ['rice', 'g'], ['sugar', 'g']]);
    return story(year, 'Proportion', 'A recipe for ' + from + ' people uses ' + amount + ' ' + thing[1] + ' of ' + thing[0] + '. How much ' + thing[0] + ' is needed for ' + to + ' people?', [
      { tokens: calc(amount, '÷', from, per), prompt: 'First: how much for 1 person?', why: amount + ' ÷ ' + from + ' = ' + per + '.' },
      { tokens: calc(per, '×', to, per * to, 'a'), prompt: 'Then for ' + to + ' people.', why: per + ' × ' + to + ' = ' + (per * to) + '.' },
      { tokens: answer(per * to, thing[1]), prompt: 'So how much?', why: 'The last line gives the answer: ' + (per * to) + ' ' + thing[1] + '.' }
    ], { op: 'proportion', amount: amount, from: from, to: to });
  };

  WORDS.thinkOfNumber = function (year) {
    const [name] = people();
    const start = year >= 7 ? randInt(-9, 15) : randInt(2, 15);
    const k = randInt(2, 9);
    const c = randInt(1, 20);
    const result = start * k + c;
    if (start === 0) return null;
    const signText = function (v) { return v < 0 ? MINUS + Math.abs(v) : String(v); };
    return story(year, 'Missing numbers', name + ' thinks of a number, multiplies it by ' + k + ', then adds ' + c + '. The answer is ' + signText(result) + '. What number did ' + name + ' think of?', [
      { tokens: [{ n: signText(result) }, { s: MINUS }, { n: c }, { s: '=' }, { ask: signText(result - c), sign: year >= 7 }], prompt: 'Work backwards. Undo the adding first.', why: 'The last thing done was + ' + c + ', so take it away: ' + signText(result) + ' ' + MINUS + ' ' + c + ' = ' + signText(result - c) + '.' },
      { tokens: [{ ask: signText(result - c), sign: year >= 7 }, { s: '÷' }, { n: k }, { s: '=' }, { ask: signText(start), sign: year >= 7 }], prompt: 'Then undo the multiplying.', why: 'Divide by ' + k + ': ' + signText(result - c) + ' ÷ ' + k + ' = ' + signText(start) + '.' },
      { tokens: [{ t: 'number', span: 3 }, { s: '=' }, { ask: signText(start), sign: year >= 7 }], prompt: 'So what was the number?', why: 'Check: ' + signText(start) + ' × ' + k + ' + ' + c + ' = ' + signText(result) + '.' }
    ], { op: 'inverse', result: result, mul: k, add: c });
  };

  WORDS.convert = function (year) {
    const km = randInt(2, 10);
    const done = randInt(250, km * 1000 - 100);
    const [name] = people();
    return story(year, 'Measures', 'A race is ' + km + ' km long. ' + name + ' has run ' + done + ' m. How many metres are left?', [
      { tokens: calc(km, '×', 1000, km * 1000), prompt: 'First: how many metres is ' + km + ' km?', why: '1 km is 1000 m: ' + km + ' × 1000 = ' + (km * 1000) + '.' },
      { tokens: calc(km * 1000, MINUS, done, km * 1000 - done, 'a'), prompt: 'Take away what has been run.', why: (km * 1000) + ' ' + MINUS + ' ' + done + ' = ' + (km * 1000 - done) + '.' },
      { tokens: answer(km * 1000 - done, 'm'), prompt: 'So how many metres are left?', why: 'The last line gives the answer: ' + (km * 1000 - done) + ' m.' }
    ], { op: 'unitsLeft', big: km, unit: 'km', small: done });
  };

  WORDS.mean = function (year) {
    const count = pick([3, 4]);
    const meanValue = randInt(6, 40);
    const values = [];
    for (let k = 0; k < count - 1; k++) values.push(Math.max(1, meanValue + randInt(-6, 6)));
    const last = meanValue * count - values.reduce(function (s, v) { return s + v; }, 0);
    if (last < 1) return null;
    values.push(last);
    const [name] = people();
    const sum = meanValue * count;
    return story(year, 'Averages', name + ' scores ' + values.slice(0, -1).join(', ') + ' and ' + values[count - 1] + ' points in ' + count + ' games. What is the mean score?', [
      { tokens: values.reduce(function (all, v, k) { return all.concat(k ? [{ s: '+' }, { n: v }] : [{ n: v }]); }, []).concat([{ s: '=' }, { ask: sum }]),
        prompt: 'First: add up the scores.', why: values.join(' + ') + ' = ' + sum + '.' },
      { tokens: calc(sum, '÷', count, meanValue, 'a'), prompt: 'Then share the total between the ' + count + ' games.', why: sum + ' ÷ ' + count + ' = ' + meanValue + '.' },
      { tokens: answer(meanValue, 'points'), prompt: 'So what is the mean?', why: 'The mean is the total shared equally: ' + meanValue + ' points.' }
    ], { op: 'mean', values: values });
  };

  /* Year 7: best buys, interest, percentage change, speed, proportion. */

  WORDS.bestBuy = function (year) {
    const sizes = shuffle([4, 5, 6, 8, 10, 12]).slice(0, 2);
    const units = sizes.map(function () { return randInt(18, 60); });
    if (units[0] === units[1]) return null;
    const prices = sizes.map(function (s, k) { return s * units[k]; });
    const best = units[0] < units[1] ? 1 : 2;
    const thing = pick(['rolls', 'batteries', 'pens', 'yoghurts']);
    const label = function (k) { return 'pack of ' + sizes[k]; };
    return story(year, 'Best buy', 'A pack of ' + sizes[0] + ' ' + thing + ' costs ' + money(prices[0]) + '. A pack of ' + sizes[1] + ' costs ' + money(prices[1]) + '. Which pack is better value?', [
      { tokens: calc(prices[0], '÷', sizes[0], units[0]), prompt: 'Find the price of one in the first pack, in pence.', why: money(prices[0]) + ' is ' + prices[0] + 'p: ' + prices[0] + ' ÷ ' + sizes[0] + ' = ' + units[0] + 'p each.' },
      { tokens: calc(prices[1], '÷', sizes[1], units[1]), prompt: 'Now one in the second pack.', why: prices[1] + ' ÷ ' + sizes[1] + ' = ' + units[1] + 'p each.' },
      { tokens: [{ t: 'better', span: 2 }, { s: ':' }, { pick: best, options: [[1, label(0)], [2, label(1)]] }], prompt: 'Which pack is better value?', why: 'Better value is the lower price for one: ' + Math.min(units[0], units[1]) + 'p, the ' + label(best - 1) + '.' }
    ], { op: 'bestBuy', packsP: [[sizes[0], prices[0]], [sizes[1], prices[1]]] });
  };

  WORDS.interest = function (year) {
    const principal = randInt(2, 40) * 100;
    const rate = randInt(2, 8);
    const years = randInt(2, 6);
    const yearly = principal * rate / 100;
    return story(year, 'Simple interest', '£' + principal + ' is saved at ' + rate + '% simple interest a year. How much interest is paid after ' + years + ' years?', [
      { tokens: [{ n: rate }, { t: '%', span: 1 }, { t: 'of', span: 1 }, { n: principal }, { s: '=' }, { ask: yearly }], prompt: 'First: the interest for one year.', why: rate + '% of ' + principal + ' = ' + rate + ' × ' + principal + ' ÷ 100 = ' + yearly + '.' },
      { tokens: calc(yearly, '×', years, yearly * years, 'a'), prompt: 'Simple interest is the same each year.', why: yearly + ' × ' + years + ' = ' + (yearly * years) + '.' },
      { tokens: answer(yearly * years, null, '£'), prompt: 'So how much interest?', why: 'The last line gives the answer: £' + (yearly * years) + '.' }
    ], { op: 'interest', principal: principal, rate: rate, years: years });
  };

  WORDS.percentChange = function (year) {
    const pct = pick([5, 10, 15, 20, 25, 30, 40, 50]);
    const price = randInt(2, 30) * 20;
    const change = pct * price / 100;
    const up = randInt(0, 1) === 1;
    const item = pick(['A bike', 'A phone', 'A sofa', 'A holiday']);
    return story(year, 'Percentage change', item + ' costs £' + price + '. The price goes ' + (up ? 'up' : 'down') + ' by ' + pct + '%. What is the new price?', [
      { tokens: [{ n: pct }, { t: '%', span: 1 }, { t: 'of', span: 1 }, { n: price }, { s: '=' }, { ask: change }], prompt: 'First: how much is ' + pct + '% of £' + price + '?', why: pct + ' × ' + price + ' ÷ 100 = ' + change + '.' },
      { tokens: calc(price, up ? '+' : MINUS, change, up ? price + change : price - change, 'b'), prompt: (up ? 'Add it on.' : 'Take it off.'), why: price + (up ? ' + ' : ' ' + MINUS + ' ') + change + ' = ' + (up ? price + change : price - change) + '.' },
      { tokens: answer(up ? price + change : price - change, null, '£'), prompt: 'So what is the new price?', why: 'The last line gives the answer.' }
    ], { op: 'percentChange', of: price, pct: pct, up: up });
  };

  WORDS.speed = function (year) {
    const speed = randInt(4, 24) * 5;
    const hours = randInt(2, 6);
    const scene = pick(['A train', 'A coach', 'A car']);
    if (randInt(0, 1)) {
      return story(year, 'Speed', scene + ' travels ' + (speed * hours) + ' km in ' + hours + ' hours at a steady speed. What is its speed?',
        [{ tokens: answer(speed, 'km/h'), prompt: 'Speed is distance ÷ time.', why: (speed * hours) + ' ÷ ' + hours + ' = ' + speed + ' km an hour.' }],
        { op: 'div', a: speed * hours, b: hours });
    }
    return story(year, 'Speed', scene + ' travels at ' + speed + ' km/h for ' + hours + ' hours. How far does it go?',
      [{ tokens: answer(speed * hours, 'km'), prompt: 'Distance is speed × time.', why: speed + ' × ' + hours + ' = ' + (speed * hours) + ' km.' }],
      { op: 'mul', a: speed, b: hours });
  };

  WORDS.workers = function (year) {
    const a = randInt(2, 8);
    const days = randInt(2, 12);
    const work = a * days;
    const choices = [];
    for (let b = 2; b <= 12; b++) if (b !== a && work % b === 0) choices.push(b);
    if (!choices.length) return null;
    const b = pick(choices);
    return story(year, 'Proportion', a + ' painters take ' + days + ' days to paint a school. How many days would ' + b + ' painters take, working at the same rate?', [
      { tokens: calc(a, '×', days, work), prompt: 'First: how many days would 1 painter take?', why: 'One painter does the work of all ' + a + ' alone: ' + a + ' × ' + days + ' = ' + work + ' days.' },
      { tokens: calc(work, '÷', b, work / b, 'a'), prompt: 'Then share the work between ' + b + ' painters.', why: work + ' ÷ ' + b + ' = ' + (work / b) + '.' },
      { tokens: answer(work / b, 'days'), prompt: 'So how many days?', why: 'More painters take fewer days: ' + (work / b) + ' days.' }
    ], { op: 'workers', a: a, days: days, b: b });
  };

  const WORD_KINDS = {
    1: [[3, 'join'], [3, 'takeAway'], [2, 'compare'], [2, 'groups'], [2, 'share']],
    2: [[2, 'join'], [2, 'takeAway'], [2, 'compare'], [2, 'groups'], [1, 'share'], [2, 'moneyTotal'], [2, 'change'], [2, 'twoStep']],
    3: [[1, 'twoStep'], [2, 'groups'], [1, 'share'], [2, 'scaling'], [2, 'outfits'], [2, 'changeMany'], [1, 'compare']],
    4: [[3, 'twoStep'], [2, 'multiplyAdd'], [2, 'moneyDecimal'], [1, 'scaling'], [1, 'outfits'], [2, 'massLeft']],
    5: [[2, 'remainders'], [2, 'rate'], [2, 'fractionOff'], [2, 'tickets'], [1, 'multiplyAdd'], [1, 'moneyDecimal']],
    6: [[2, 'percentOf'], [2, 'ratioShare'], [2, 'recipe'], [2, 'thinkOfNumber'], [1, 'convert'], [2, 'mean'], [1, 'tickets']],
    7: [[2, 'bestBuy'], [2, 'interest'], [2, 'percentChange'], [2, 'speed'], [2, 'workers'], [1, 'ratioShare'], [1, 'thinkOfNumber']]
  };

  // A kind chosen by weight for the year, again if it made nothing or a line
  // too wide for a phone (15 cells).
  function chooser(year) {
    const name = weighted(WORD_KINDS[year]);
    for (let attempt = 0; attempt < 100; attempt++) {
      const problem = WORDS[name](year);
      if (problem && problem.width <= 15) return problem;
    }
    throw new Error('words ' + name + ' made nothing that fits for year ' + year);
  }

  Engine.addArea('words', chooser);
});
