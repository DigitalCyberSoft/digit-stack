/*
 * Digit Stack arithmetic engine.
 *
 * Builds fully rendered written-method layouts as plain data: rows, cells,
 * and an ordered list of actions. The UI layer only has to draw the rows and
 * walk the actions.
 *
 * Problem sets follow the national curriculum in England, Years 1 to 7.
 * Written layouts follow its Mathematics Appendix 1: columnar addition,
 * columnar subtraction by crossing out, short and long multiplication,
 * short division for one-digit divisors, long division for longer ones, and
 * from Year 4 the same methods with a decimal point column. Everything else
 * is a sentence (buildSentence): numbers, symbols and words with answer
 * boxes, sometimes a picture. This file builds the four calculation areas;
 * topics.js adds number, fractions, measures, shape, data and algebra.
 *
 * Action kinds:
 *   digit      type `value` into `cellId`. A decision digit (`choice`) sits
 *              on a small box the cursor stops at whether or not anything
 *              moves: the carry, the left-over or a 1 for an exchange, or 0
 *              when there is none. `shown` is what the box then displays
 *              (null leaves it as it was, so a 0 is never written).
 *   sign       the sign box of an answer that may be below zero. `value` is
 *              MINUS (press minus) or '+' (type the first digit straight away).
 *   bringdown  automatic.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    // The other six areas are in topics.js and word problems in words.js. A
    // page loads them as the next scripts; under Node they are installed here.
    require('./drawing.js').install(api);
    require('./topics.js').install(api);
    require('./words.js').install(api);
  }
  if (root) root.DigitStackEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PLACES = [
    'ones',
    'tens',
    'hundreds',
    'thousands',
    'ten thousands',
    'hundred thousands',
    'millions'
  ];

  const DECIMAL_PLACES = ['tenths', 'hundredths', 'thousandths'];

  const YEARS = [1, 2, 3, 4, 5, 6, 7];
  // The four calculation areas are built here; the other six come from
  // topics.js, which adds its generators with addArea.
  const AREAS = ['divide', 'multiply', 'add', 'subtract', 'number', 'fractions', 'measures', 'shape', 'data', 'algebra', 'words'];
  const MINUS = '−';

  // Decimal notation starts in Year 4 (Year 3 counts in tenths as
  // fractions), and the places allowed grow with the year.
  const MAX_DECIMAL_PLACES = { 1: 0, 2: 0, 3: 0, 4: 2, 5: 3, 6: 3, 7: 4 };

  // Year 1 counts in 2s, 5s and 10s. Year 2 learns those tables and Year 3
  // adds 3, 4 and 8. The other tables are Year 4 work.
  const COUNTING_STEPS = [2, 5, 10];
  const FACT_TABLES = [2, 3, 4, 5, 8, 10];

  // The same words show whether or not something moves, so the prompt never
  // makes the decision for the child.
  const CHOICE = {
    carry: 'Small box first: type the carry from the last column, or 0 if nothing carries.',
    exchange: 'Small box first: type 1 to exchange a ten into this column, or 0 if the top digit is big enough.',
    leftover: 'Small box first: type what is left over, or 0 if nothing is left over.',
    sign: 'If the answer is below zero, press − first. Otherwise type the first digit.'
  };

  // Random numbers come from Math.random unless withSeed has put a seeded
  // generator in place, so a mixed test can be rebuilt from its seed.
  let random = Math.random;

  // mulberry32, a small 32-bit generator: the same seed gives the same run.
  function seededRandom(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function withSeed(seed, fn) {
    const saved = random;
    random = seededRandom(seed);
    try {
      return fn();
    } finally {
      random = saved;
    }
  }

  function randInt(min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  function pick(list) {
    return list[randInt(0, list.length - 1)];
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      const swap = copy[i];
      copy[i] = copy[j];
      copy[j] = swap;
    }
    return copy;
  }

  // Picks from [[weight, value], ...].
  function weighted(entries) {
    const total = entries.reduce(function (sum, entry) { return sum + entry[0]; }, 0);
    let roll = random() * total;
    for (let i = 0; i < entries.length; i++) {
      roll -= entries[i][0];
      if (roll < 0) return entries[i][1];
    }
    return entries[entries.length - 1][1];
  }

  function toDigits(value) {
    return String(value).split('').map(Number);
  }

  // Places to the left of the point count up from 0 (ones); places to the
  // right are -1 (tenths), -2 (hundredths) and -3 (thousandths).
  function placeName(digitsFromRight) {
    if (digitsFromRight < 0) return DECIMAL_PLACES[-digitsFromRight - 1] || 'next';
    return PLACES[digitsFromRight] || 'next';
  }

  // A whole number of tenths, hundredths or thousandths written as a
  // decimal: decimalText(3315, 2) is '33.15'. `trim` drops trailing zeros.
  function decimalText(scaled, places, trim) {
    const negative = scaled < 0;
    const digits = String(Math.abs(scaled)).padStart(places + 1, '0');
    let text = places ? digits.slice(0, digits.length - places) + '.' + digits.slice(digits.length - places) : digits;
    if (trim && places) text = text.replace(/0+$/, '').replace(/\.$/, '');
    return (negative ? MINUS : '') + text;
  }

  // Thousands commas for numbers of five digits or more, as the programmes
  // of study write them (10,000 and 1,000,000).
  function grouped(value) {
    const text = String(value);
    const negative = text.charAt(0) === '-' || text.charAt(0) === MINUS;
    const body = negative ? text.slice(1) : text;
    const parts = body.split('.');
    if (parts[0].length >= 5) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (negative ? MINUS : '') + parts.join('.');
  }

  function inputCell(rowId, col, value, extra) {
    return Object.assign(
      { id: rowId + '-c' + col, kind: 'input', col: col, value: value },
      extra || {}
    );
  }

  function givenCell(rowId, col, value, extra) {
    return Object.assign(
      { id: rowId + '-c' + col, kind: 'given', col: col, value: value },
      extra || {}
    );
  }

  function carryCell(rowId, col, value, extra) {
    return Object.assign(
      { id: rowId + '-c' + col, kind: 'carry', col: col, value: value },
      extra || {}
    );
  }

  function bringdownCell(rowId, col, value, extra) {
    return Object.assign(
      { id: rowId + '-c' + col, kind: 'bringdown', col: col, value: value },
      extra || {}
    );
  }

  function makeMultiplyGroup(index) {
    return { id: 'row-' + index, label: 'row ' + index, short: 'row ' + index };
  }

  function makeStepGroup(index) {
    return { id: 'step-' + index, label: 'step ' + index, short: 'step ' + index };
  }

  // `places` is how many columns sit right of a decimal point, so the
  // rightmost column of 23.40 is hundredths.
  function makeColumnGroup(placeIndex, places) {
    const name = placeName(placeIndex - (places || 0));
    return { id: 'col-' + placeIndex, label: name, short: name };
  }

  function rightAligned(rowId, value, width, extra) {
    const digits = toDigits(value);
    const cells = new Array(width).fill(null);
    for (let i = 0; i < digits.length; i++) {
      const col = width - digits.length + i;
      cells[col] = givenCell(rowId, col, digits[i], extra);
    }
    return cells;
  }

  // One column of a carrying method. The cursor stops at the small box above
  // the column every time; the child types the carry, or 0 when nothing
  // carries, then the column's digit. A 0 is not written on the sheet.
  function pushCarryChoice(actions, c) {
    actions.push({
      kind: 'digit',
      choice: 'carry',
      cellId: c.carryCellId,
      rowId: c.carryRowId,
      groupId: c.groupId,
      value: c.carry,
      shown: c.carry > 0 ? String(c.carry) : null,
      stage: 'CARRY',
      prompt: c.choicePrompt,
      subprompt: CHOICE.carry,
      why: c.carry > 0
        ? c.previous.work + ' = ' + c.previous.total + ', which is ' + c.carry +
          (c.carry === 1 ? ' ten' : ' tens') + ' and ' + c.previous.digit +
          (c.previous.digit === 1 ? ' one' : ' ones') + ', so carry ' + c.carry + '.'
        : c.previous.work + ' = ' + c.previous.total + ', which is less than 10, so nothing carries: type 0.'
    });
    actions.push({
      kind: 'digit',
      cellId: c.cellId,
      rowId: c.rowId,
      groupId: c.groupId,
      value: c.digit,
      stage: c.stage,
      prompt: c.carry > 0 ? c.afterPrompt : (c.stage === 'MULTIPLY' ? 'Now multiply.' : 'Now add the column.'),
      subprompt: c.onlyCarry
        ? 'Only the carry is in this column. Write it.'
        : 'Work out ' + c.work + '. Type only the ones digit.',
      why: c.why
    });
  }

  // `places` is the number of decimal places in `a` (Year 6: 3.45 x 7 is
  // laid out as 345 x 7 and then gets its point); `b` is always whole.
  function buildMultiplication(a, b, year, places) {
    places = places || 0;
    const aText = decimalText(a, places);
    const aDigits = toDigits(a);
    const bDigits = toDigits(b);
    const m = aDigits.length;
    const n = bDigits.length;
    const product = a * b;
    const width = String(product).length;
    const rows = [];
    const actions = [];
    const groups = [];
    const partialGrids = [];

    rows.push({ id: 'a', kind: 'operand', cells: rightAligned('a', a, width), gutter: '' });
    rows.push({ id: 'b', kind: 'operand', cells: rightAligned('b', b, width), gutter: '×', isOperator: true });
    rows.push({ id: 'rule-top', kind: 'rule', thick: true, lineStart: 0, lineEnd: width - 1 });

    for (let j = 0; j < n; j++) {
      const bDigit = bDigits[n - 1 - j];
      const partialDigits = toDigits(a * bDigit);
      const end = width - 1 - j;
      const start = end - partialDigits.length + 1;
      if (start < 0) throw new Error('Multiplication layout overflow');

      const rowId = 'p' + j;
      const carryRowId = 'pc' + j;
      const cells = new Array(width).fill(null);
      const carryCells = new Array(width).fill(null);

      // Shift zeroes hold the place for the second (and later) rows.
      for (let z = 0; z < j; z++) {
        const col = width - 1 - z;
        cells[col] = givenCell(rowId, col, 0, { shiftZero: true });
      }
      for (let d = 0; d < partialDigits.length; d++) {
        const col = start + d;
        cells[col] = inputCell(rowId, col, partialDigits[d]);
      }
      // A small box above every column a carry could land in.
      for (let i = 1; i < m; i++) {
        const col = end - i;
        carryCells[col] = carryCell(carryRowId, col, 0, { targetRowId: rowId });
      }

      const groupId = 'row-' + (j + 1);
      groups.push(makeMultiplyGroup(j + 1));

      let carry = 0;
      let previous = null;
      for (let i = 0; i < m; i++) {
        const aDigit = aDigits[m - 1 - i];
        const col = end - i;
        const total = aDigit * bDigit + carry;
        const digit = total % 10;
        const nextCarry = Math.floor(total / 10);
        const plain = aDigit + ' × ' + bDigit;
        const work = plain + (carry ? ' + ' + carry : '');
        const why = work + ' = ' + total + '. Write ' + digit + (nextCarry ? ', carry ' + nextCarry : '') + '.';

        if (i === 0) {
          actions.push({
            kind: 'digit',
            cellId: rowId + '-c' + col,
            rowId: rowId,
            groupId: groupId,
            value: digit,
            stage: 'MULTIPLY',
            prompt: j === 0
              ? 'Multiply ' + aText + ' by ' + bDigit + '. Start on the right.'
              : 'Now multiply ' + aText + ' by ' + (bDigit * Math.pow(10, j)) + '. ' +
                (j === 1 ? 'The 0 holds the ones place.' : 'The 0s hold the places on the right.'),
            subprompt: 'Work out ' + plain + '. Type only the ones digit.',
            why: why
          });
        } else {
          if (carry) carryCells[col].value = carry;
          pushCarryChoice(actions, {
            cellId: rowId + '-c' + col,
            rowId: rowId,
            groupId: groupId,
            stage: 'MULTIPLY',
            carry: carry,
            carryCellId: carryRowId + '-c' + col,
            carryRowId: carryRowId,
            previous: previous,
            choicePrompt: 'Next column: ' + plain + '.',
            afterPrompt: 'Now multiply, then add the carry.',
            work: work,
            digit: digit,
            why: why
          });
        }

        if (i === m - 1 && nextCarry > 0) {
          actions.push({
            kind: 'digit',
            cellId: rowId + '-c' + (col - 1),
            rowId: rowId,
            groupId: groupId,
            value: nextCarry,
            stage: 'MULTIPLY',
            isLeadingCarry: true,
            prompt: 'Nothing is left to multiply. Write the carry in front.',
            subprompt: 'Type the tens digit of ' + work + '.',
            why: work + ' = ' + total + '. Write the ' + nextCarry + ' in front of the ' + digit + '.'
          });
        }
        previous = { work: work, total: total, digit: digit };
        carry = nextCarry;
      }

      if (m > 1) {
        rows.push({ id: carryRowId, kind: 'carry', cells: carryCells, targetRowId: rowId });
      }
      rows.push({
        id: rowId,
        kind: 'product',
        step: j,
        cells: cells,
        groupId: groupId,
        label: 'row ' + (j + 1)
      });

      partialGrids.push(cells.map(function (cell) {
        return cell ? cell.value : null;
      }));
    }

    if (n > 1) {
      rows.push({ id: 'rule-sum', kind: 'rule', thick: true, lineStart: 0, lineEnd: width - 1 });

      const sumCells = new Array(width).fill(null);
      const sumCarryCells = new Array(width).fill(null);
      const groupId = 'row-sum';
      groups.push({ id: groupId, label: 'add', short: 'add' });
      for (let col = 0; col < width - 1; col++) {
        sumCarryCells[col] = carryCell('sumc', col, 0, { targetRowId: 'sum' });
      }

      let carry = 0;
      let previous = null;
      for (let col = width - 1; col >= 0; col--) {
        const terms = partialGrids
          .map(function (grid) { return grid[col]; })
          .filter(function (value) { return value !== null; });
        const all = carry ? terms.concat([carry]) : terms;
        const total = all.reduce(function (sum, value) { return sum + value; }, 0);
        const digit = total % 10;
        const nextCarry = Math.floor(total / 10);
        const work = all.join(' + ');
        const why = (all.length > 1 ? work + ' = ' + total + '. ' : '') +
          'Write ' + digit + (nextCarry ? ', carry ' + nextCarry : '') + '.';
        sumCells[col] = inputCell('sum', col, digit);

        if (col === width - 1) {
          actions.push({
            kind: 'digit',
            cellId: 'sum-c' + col,
            rowId: 'sum',
            groupId: groupId,
            value: digit,
            stage: 'ADD',
            prompt: 'Add the rows. Start on the right.',
            subprompt: terms.length > 1
              ? 'Work out ' + terms.join(' + ') + '. Type only the ones digit.'
              : 'Only ' + total + ' is in this column. Write it.',
            why: why
          });
        } else {
          if (carry) sumCarryCells[col].value = carry;
          pushCarryChoice(actions, {
            cellId: 'sum-c' + col,
            rowId: 'sum',
            groupId: groupId,
            stage: 'ADD',
            carry: carry,
            carryCellId: 'sumc-c' + col,
            carryRowId: 'sumc',
            previous: previous,
            choicePrompt: terms.length ? 'Next column: add ' + terms.join(' + ') + '.' : 'Next column.',
            afterPrompt: 'Now add the column with the carry.',
            work: work,
            digit: digit,
            why: why,
            onlyCarry: terms.length === 0
          });
        }
        if (col === 0 && nextCarry > 0) {
          throw new Error('Sum layout overflow');
        }
        previous = { work: work, total: total, digit: digit };
        carry = nextCarry;
      }

      if (width > 1) {
        rows.push({ id: 'sumc', kind: 'carry', cells: sumCarryCells, targetRowId: 'sum' });
      }
      rows.push({ id: 'sum', kind: 'sum', cells: sumCells, groupId: groupId, label: 'add' });
    }

    return {
      operation: 'multiply',
      method: n > 1 ? 'long' : 'short',
      year: year,
      title: n > 1 ? 'Long multiplication' : 'Short multiplication',
      question: 'Work out ' + a + ' × ' + b + '.',
      markRowIds: n > 1 ? ['sum'] : ['p0'],
      groupWord: 'Row',
      operands: { a: a, b: b },
      width: width,
      rows: rows,
      actions: actions,
      groups: groups,
      answerRowIds: n > 1 ? ['sum'] : ['p0'],
      answer: {
        value: product,
        expression: a + ' × ' + b + ' = ' + product
      }
    };
  }

  // Column addition, Appendix 1 layout, carries above the next column like
  // multiplication.
  function buildAddition(a, b, year, places) {
    places = places || 0;
    const total = a + b;
    const width = String(total).length;
    const aDigits = rightAligned('a', a, width);
    const bDigits = rightAligned('b', b, width);
    const rows = [];
    const actions = [];
    const groups = [];
    const sumCells = new Array(width).fill(null);
    const carryCells = new Array(width).fill(null);

    rows.push({ id: 'a', kind: 'operand', cells: aDigits, gutter: '' });
    rows.push({ id: 'b', kind: 'operand', cells: bDigits, gutter: '+', isOperator: true });
    rows.push({ id: 'rule-top', kind: 'rule', thick: true, lineStart: 0, lineEnd: width - 1 });
    for (let col = 0; col < width - 1; col++) {
      if (aDigits[col] || bDigits[col]) {
        carryCells[col] = carryCell('ac', col, 0, { targetRowId: 'sum' });
      }
    }

    let carry = 0;
    let previous = null;
    for (let col = width - 1; col >= 0; col--) {
      const placeIndex = width - 1 - col;
      const groupId = 'col-' + placeIndex;
      groups.push(makeColumnGroup(placeIndex, places));
      const terms = [aDigits[col], bDigits[col]]
        .filter(Boolean)
        .map(function (cell) { return cell.value; });
      const all = carry ? terms.concat([carry]) : terms;
      const columnTotal = all.reduce(function (sum, value) { return sum + value; }, 0);
      const digit = columnTotal % 10;
      const nextCarry = Math.floor(columnTotal / 10);
      const work = all.join(' + ');
      const why = (all.length > 1 ? work + ' = ' + columnTotal + '. ' : '') +
        'Write ' + digit + (nextCarry ? ', carry ' + nextCarry : '') + '.';
      sumCells[col] = inputCell('sum', col, digit);

      if (!terms.length) {
        actions.push({
          kind: 'digit',
          cellId: 'sum-c' + col,
          rowId: 'sum',
          groupId: groupId,
          value: carry,
          stage: 'ADD',
          isLeadingCarry: true,
          prompt: 'Nothing is left to add. Write the carry in front.',
          subprompt: 'Type the tens digit of ' + previous.total + '.',
          why: previous.work + ' = ' + previous.total + ', so the ' + carry + ' goes in front.'
        });
      } else if (col === width - 1) {
        actions.push({
          kind: 'digit',
          cellId: 'sum-c' + col,
          rowId: 'sum',
          groupId: groupId,
          value: digit,
          stage: 'ADD',
          prompt: 'Add the ' + placeName(-places) + '. Start on the right.',
          subprompt: 'Work out ' + terms.join(' + ') + '. Type only the ones digit.',
          why: why
        });
      } else {
        if (carry) carryCells[col].value = carry;
        pushCarryChoice(actions, {
          cellId: 'sum-c' + col,
          rowId: 'sum',
          groupId: groupId,
          stage: 'ADD',
          carry: carry,
          carryCellId: 'ac-c' + col,
          carryRowId: 'ac',
          previous: previous,
          choicePrompt: 'Next column: ' + terms.join(' + ') + '.',
          afterPrompt: 'Now add the column with the carry.',
          work: work,
          digit: digit,
          why: why
        });
      }
      previous = { work: work, total: columnTotal, digit: digit };
      carry = nextCarry;
    }

    if (carryCells.some(Boolean)) {
      rows.push({ id: 'ac', kind: 'carry', cells: carryCells, targetRowId: 'sum' });
    }
    rows.push({ id: 'sum', kind: 'sum', cells: sumCells, groupId: 'col-0', label: 'answer' });

    return {
      operation: 'add',
      method: 'column',
      year: year,
      title: 'Column addition',
      question: 'Work out ' + a + ' + ' + b + '.',
      markRowIds: ['sum'],
      groupWord: 'Column',
      operands: { a: a, b: b },
      width: width,
      rows: rows,
      actions: actions,
      groups: groups,
      answerRowIds: ['sum'],
      answer: { value: total, expression: a + ' + ' + b + ' = ' + total }
    };
  }

  // Column subtraction by crossing out (Appendix 1, 932 - 457). Every digit
  // of the top number has a small box above it. The child decides when to
  // exchange, types each digit that gives one away, and the receiving column
  // fills itself in because it always gains 10.
  function buildSubtraction(a, b, year, places) {
    places = places || 0;
    if (b > a) throw new Error('Column subtraction needs the larger number on top');
    const difference = a - b;
    const width = String(a).length;
    const topCells = rightAligned('a', a, width);
    const bottomCells = rightAligned('b', b, width);
    const top = topCells.map(function (cell) { return cell.value; });
    const bottom = bottomCells.map(function (cell) { return cell ? cell.value : 0; });
    const answerDigits = toDigits(difference);
    const answerStart = width - answerDigits.length;
    const rows = [];
    const actions = [];
    const groups = [];

    const exchangeCells = new Array(width).fill(null);
    for (let col = 0; col < width; col++) {
      exchangeCells[col] = carryCell('ex', col, null, { optional: true, dynamic: true });
    }
    const answerCells = new Array(width).fill(null);
    for (let k = 0; k < answerDigits.length; k++) {
      answerCells[answerStart + k] = inputCell('diff', answerStart + k, answerDigits[k]);
    }

    rows.push({ id: 'ex', kind: 'carry', cells: exchangeCells, targetRowId: 'a', isExchange: true });
    rows.push({ id: 'a', kind: 'operand', cells: topCells, gutter: '' });
    rows.push({ id: 'b', kind: 'operand', cells: bottomCells, gutter: MINUS, isOperator: true });
    rows.push({ id: 'rule-top', kind: 'rule', thick: true, lineStart: 0, lineEnd: width - 1 });
    rows.push({ id: 'diff', kind: 'sum', cells: answerCells, groupId: 'col-0', label: 'answer' });

    const current = top.slice();
    for (let col = width - 1; col >= answerStart; col--) {
      const placeIndex = width - 1 - col;
      const groupId = 'col-' + placeIndex;
      groups.push(makeColumnGroup(placeIndex, places));
      const cellId = 'diff-c' + col;
      const choicePrompt = (col === width - 1 ? 'Subtract the ' + placeName(-places) + ': ' : 'Next column: ') +
        current[col] + ' ' + MINUS + ' ' + bottom[col] + '.';

      // The cursor stops at this column's small box every time: 1 brings in
      // a ten (the box then shows the new value, such as 12), 0 means no
      // exchange. A 1 is never a column's new value here, so it cannot be
      // mistaken for one.
      const needed = current[col] < bottom[col];
      actions.push({
        kind: 'digit',
        choice: 'exchange',
        cellId: 'ex-c' + col,
        rowId: 'ex',
        groupId: groupId,
        value: needed ? 1 : 0,
        shown: needed ? String(current[col] + 10) : null,
        crossCellId: needed ? 'a-c' + col : undefined,
        stage: 'EXCHANGE',
        prompt: choicePrompt,
        subprompt: CHOICE.exchange,
        why: needed
          ? current[col] + ' is less than ' + bottom[col] + ', so exchange: type 1 to bring in a ten.'
          : current[col] + ' ' + MINUS + ' ' + bottom[col] + ' works without exchanging: type 0.'
      });
      if (needed) {
        current[col] += 10;
        let giver = col - 1;
        while (current[giver] === 0) giver--;
        for (let g = giver; g < col; g++) {
          const before = current[g];
          const passingZero = g !== giver;
          current[g] = before - 1;
          const fills = [];
          if (g + 1 < col) {
            current[g + 1] += 10;
            fills.push({ cellId: 'ex-c' + (g + 1), value: current[g + 1], crossCellId: 'a-c' + (g + 1) });
          }
          const place = placeName(width - 1 - g - places);
          actions.push({
            kind: 'digit',
            cellId: 'ex-c' + g,
            rowId: 'ex',
            groupId: groupId,
            value: current[g],
            stage: 'EXCHANGE',
            prompt: passingZero
              ? 'The ' + place + ' are now 10. Exchange 1 of them for the next column.'
              : 'Take the ten from the ' + before + ' ' + place + '.',
            subprompt: 'How many ' + place + ' are left? Type it in the small box.',
            why: before + ' ' + MINUS + ' 1 = ' + current[g] + '.',
            crossCellId: 'a-c' + g,
            alsoFill: fills
          });
        }
      }
      const value = current[col] - bottom[col];
      const work = current[col] + ' ' + MINUS + ' ' + bottom[col];
      actions.push({
        kind: 'digit',
        cellId: cellId,
        rowId: 'diff',
        groupId: groupId,
        value: value,
        stage: 'SUBTRACT',
        prompt: 'Now subtract the ' + placeName(placeIndex - places) + '.',
        subprompt: 'Work out ' + work + '.',
        why: work + ' = ' + value + '.'
      });
    }

    return {
      operation: 'subtract',
      method: 'column',
      year: year,
      title: 'Column subtraction',
      question: 'Work out ' + a + ' ' + MINUS + ' ' + b + '.',
      markRowIds: ['diff'],
      groupWord: 'Column',
      operands: { a: a, b: b },
      width: width,
      rows: rows,
      actions: actions,
      groups: groups,
      answerRowIds: ['diff'],
      answer: { value: difference, expression: a + ' ' + MINUS + ' ' + b + ' = ' + difference }
    };
  }

  function subtractionNeedsExchange(minuend, subtrahend) {
    const top = toDigits(minuend);
    const bottom = toDigits(subtrahend);
    const length = Math.max(top.length, bottom.length);
    let exchange = 0;
    let needed = false;
    for (let i = 1; i <= length; i++) {
      const topDigit = (top[top.length - i] || 0) - exchange;
      const bottomDigit = bottom[bottom.length - i] || 0;
      if (topDigit < bottomDigit) {
        exchange = 1;
        needed = true;
      } else {
        exchange = 0;
      }
    }
    return needed;
  }

  // One step per answer digit. The first step reads as many leading dividend
  // digits as it takes for the divisor to fit.
  function divisionSteps(dividendDigits, divisor) {
    const n = dividendDigits.length;
    let startIndex = 0;
    while (startIndex < n) {
      const prefix = Number(dividendDigits.slice(0, startIndex + 1).join(''));
      if (prefix >= divisor) break;
      startIndex++;
    }
    if (startIndex >= n) throw new Error('No first quotient position');

    const steps = [];
    let remainder = 0;
    for (let index = startIndex; index < n; index++) {
      const partial = index === startIndex
        ? Number(dividendDigits.slice(0, startIndex + 1).join(''))
        : remainder * 10 + dividendDigits[index];
      const quotientDigit = Math.floor(partial / divisor);
      const product = quotientDigit * divisor;
      const difference = partial - product;
      steps.push({
        index: steps.length,
        pos: index,
        partial: partial,
        quotientDigit: quotientDigit,
        product: product,
        difference: difference,
        bringdown: index < n - 1 ? dividendDigits[index + 1] : null,
        needsExchange: subtractionNeedsExchange(partial, product)
      });
      remainder = difference;
    }
    return { startIndex: startIndex, steps: steps };
  }

  // Shared by both division layouts: answer digits above the bracket, then an
  // R and the remainder when something is left over.
  function buildQuotientRow(steps, n, width, remainderDigits) {
    const cells = new Array(width).fill(null);
    for (let i = 0; i < steps.length; i++) {
      cells[steps[i].pos] = inputCell('q', steps[i].pos, steps[i].quotientDigit, {
        step: steps[i].index
      });
    }
    if (remainderDigits.length) {
      cells[n] = givenCell('q', n, 'R', { remainderLabel: true });
      for (let k = 0; k < remainderDigits.length; k++) {
        cells[n + 1 + k] = inputCell('q', n + 1 + k, remainderDigits[k], { remainder: true });
      }
    }
    return { id: 'q', kind: 'quotient', cells: cells };
  }

  function divideAction(step, divisor, n, groupId, lead, places) {
    return {
      kind: 'digit',
      cellId: 'q-c' + step.pos,
      rowId: 'q',
      groupId: groupId,
      stepIndex: step.index,
      value: step.quotientDigit,
      stage: 'DIVIDE',
      prompt: 'How many times does ' + divisor + ' fit into ' + step.partial + '?',
      subprompt: (lead !== null
        ? divisor + ' does not fit into ' + lead + ', so use ' + step.partial + '. '
        : '') +
        'Type the ' + placeName(n - 1 - step.pos - (places || 0)) + ' digit of the answer.',
      why:
        (lead !== null ? divisor + ' does not fit into ' + lead + ', so start with ' +
          step.partial + '. ' : '') +
        divisor + ' × ' + step.quotientDigit + ' = ' + step.product +
        ', which fits in ' + step.partial + '. ' +
        divisor + ' × ' + (step.quotientDigit + 1) + ' = ' +
        (divisor * (step.quotientDigit + 1)) + ', which is too big.'
    };
  }

  function remainderActions(remainderDigits, n, groupId, lastStep, summary) {
    const actions = [];
    for (let k = remainderDigits.length - 1; k >= 0; k--) {
      const isFirst = k === remainderDigits.length - 1;
      actions.push({
        kind: 'digit',
        cellId: 'q-c' + (n + 1 + k),
        rowId: 'q',
        groupId: groupId,
        stepIndex: lastStep.index,
        value: remainderDigits[k],
        stage: 'REMAINDER',
        prompt: isFirst ? 'Write the remainder after R.' : 'Keep going.',
        subprompt: remainderDigits.length === 1
          ? 'It is the amount left over at the end.'
          : 'Type the ' + placeName(remainderDigits.length - 1 - k) + ' digit of what is left over.',
        why: summary
      });
    }
    return actions;
  }

  function divisionQuestion(dividend, divisor, remainder) {
    return 'Work out ' + dividend + ' ÷ ' + divisor + '.' +
      (remainder ? ' Write the remainder after R.' : '');
  }

  // `places` (Year 6 on) is how many digits of the dividend sit after a
  // decimal point: 432 / 15 = 28.8 is worked as 4320 / 15 with the last 0
  // written after the point, as in Appendix 1.
  function buildDivision(dividend, divisor, year, places) {
    places = places || 0;
    const dividendDigits = toDigits(dividend);
    const n = dividendDigits.length;
    if (dividend < divisor) throw new Error('Dividend must be at least the divisor');

    const plan = divisionSteps(dividendDigits, divisor);
    const steps = plan.steps;
    const quotient = Number(steps.map(function (step) { return step.quotientDigit; }).join(''));
    const finalRemainder = steps[steps.length - 1].difference;
    const remainderDigits = finalRemainder > 0 ? toDigits(finalRemainder) : [];
    const width = n + (remainderDigits.length ? remainderDigits.length + 1 : 0);
    const rows = [];
    const actions = [];
    const groups = [];

    rows.push(buildQuotientRow(steps, n, width, remainderDigits));
    rows.push({
      id: 'bracket',
      kind: 'rule',
      thick: true,
      lineStart: 0,
      lineEnd: n - 1,
      bracket: true
    });

    const dividendCells = new Array(width).fill(null);
    for (let i = 0; i < n; i++) {
      dividendCells[i] = givenCell('dividend', i, dividendDigits[i]);
    }
    rows.push({
      id: 'dividend',
      kind: 'dividend',
      cells: dividendCells,
      gutter: String(divisor),
      divisor: divisor,
      isDividend: true
    });

    for (let s = 0; s < steps.length; s++) {
      const step = steps[s];
      const groupId = 'step-' + (step.index + 1);
      groups.push(makeStepGroup(step.index + 1));
      const lead = s === 0 && plan.startIndex > 0
        ? dividendDigits.slice(0, plan.startIndex).join('')
        : null;

      actions.push(divideAction(step, divisor, n, groupId, lead, places));

      const productRowId = 'p' + step.index;
      const productDigits = toDigits(step.product);
      const productEnd = step.pos;
      const productStart = productEnd - productDigits.length + 1;
      if (productStart < 0) throw new Error('Division product layout overflow');
      const productCells = new Array(width).fill(null);
      for (let k = 0; k < productDigits.length; k++) {
        productCells[productStart + k] = inputCell(
          productRowId,
          productStart + k,
          productDigits[k]
        );
      }
      rows.push({
        id: productRowId,
        kind: 'product',
        cells: productCells,
        gutter: MINUS,
        step: step.index,
        groupId: groupId
      });
      rows.push({
        id: 'rule-p' + step.index,
        kind: 'rule',
        thin: true,
        lineStart: productStart,
        lineEnd: productEnd
      });

      const multiplyWork = step.quotientDigit + ' × ' + divisor;
      for (let k = productDigits.length - 1; k >= 0; k--) {
        const col = productStart + k;
        const isFirst = k === productDigits.length - 1;
        actions.push({
          kind: 'digit',
          cellId: productRowId + '-c' + col,
          rowId: productRowId,
          groupId: groupId,
          stepIndex: step.index,
          value: productDigits[k],
          stage: 'MULTIPLY',
          prompt: isFirst
            ? 'Multiply ' + multiplyWork + '. Write it under ' + step.partial + '.'
            : 'Keep going with ' + multiplyWork + '.',
          subprompt: productDigits.length === 1
            ? 'Type the answer to ' + multiplyWork + '.'
            : 'Type the ' + placeName(productDigits.length - 1 - k) + ' digit of ' +
              multiplyWork + '.' + (isFirst ? ' Start on the right.' : ''),
          why: multiplyWork + ' = ' + step.product + '.'
        });
      }

      // Long division types each difference straight in; exchanges are
      // practised in Subtract.
      const differenceRowId = 'd' + step.index;
      const differenceDigits = toDigits(step.difference);
      const differenceEnd = step.pos;
      const differenceStart = differenceEnd - differenceDigits.length + 1;
      const differenceCells = new Array(width).fill(null);
      for (let k = 0; k < differenceDigits.length; k++) {
        differenceCells[differenceStart + k] = inputCell(
          differenceRowId,
          differenceStart + k,
          differenceDigits[k]
        );
      }
      let bringdownId = null;
      if (step.bringdown !== null) {
        const bringdownCol = step.pos + 1;
        bringdownId = differenceRowId + '-c' + bringdownCol;
        differenceCells[bringdownCol] = bringdownCell(
          differenceRowId,
          bringdownCol,
          step.bringdown
        );
      }
      rows.push({
        id: differenceRowId,
        kind: 'difference',
        cells: differenceCells,
        step: step.index,
        groupId: groupId,
        isFinal: step.index === steps.length - 1
      });

      for (let k = differenceDigits.length - 1; k >= 0; k--) {
        const col = differenceStart + k;
        const isFirst = k === differenceDigits.length - 1;
        let subprompt;
        if (differenceDigits.length === 1) {
          subprompt = step.needsExchange ? 'You will need to exchange.' : 'Type the answer.';
        } else if (isFirst) {
          subprompt = step.needsExchange
            ? 'Start on the right. You will need to exchange.'
            : 'Start on the right.';
        } else {
          subprompt = 'Type the ' + placeName(differenceDigits.length - 1 - k) + ' digit.';
        }
        actions.push({
          kind: 'digit',
          cellId: differenceRowId + '-c' + col,
          rowId: differenceRowId,
          groupId: groupId,
          stepIndex: step.index,
          value: differenceDigits[k],
          stage: 'SUBTRACT',
          prompt: isFirst
            ? 'Subtract ' + step.product + ' from ' + step.partial + '.'
            : 'Keep subtracting.',
          subprompt: subprompt,
          why:
            step.partial + ' ' + MINUS + ' ' + step.product + ' = ' + step.difference + '.' +
            (step.needsExchange ? ' This subtraction needs an exchange.' : '')
        });
      }

      if (bringdownId) {
        actions.push({
          kind: 'bringdown',
          cellId: bringdownId,
          rowId: differenceRowId,
          groupId: groupId,
          stepIndex: step.index,
          value: step.bringdown,
          stage: 'BRING DOWN',
          prompt: 'Bring down the ' + step.bringdown + '.',
          subprompt: 'It joins the ' + step.difference + ' for the next step.',
          why: 'Bring down ' + step.bringdown + '.'
        });
      }
    }

    const lastStep = steps[steps.length - 1];
    const expression = dividend + ' ÷ ' + divisor + ' = ' + quotient +
      (finalRemainder ? ' R ' + finalRemainder : '');
    remainderActions(
      remainderDigits,
      n,
      'step-' + (lastStep.index + 1),
      lastStep,
      'The last subtraction left ' + finalRemainder + '. That is the remainder, so ' +
        expression + '.'
    ).forEach(function (action) { actions.push(action); });

    return {
      operation: 'divide',
      method: 'long',
      year: year,
      title: 'Long division',
      question: divisionQuestion(dividend, divisor, finalRemainder),
      markRowIds: ['q'],
      groupWord: 'Step',
      operands: { dividend: dividend, divisor: divisor },
      width: width,
      rows: rows,
      actions: actions,
      groups: groups,
      answerRowIds: ['q', 'd' + lastStep.index],
      answer: {
        value: quotient,
        quotient: quotient,
        remainder: finalRemainder,
        expression: expression
      },
      steps: steps.map(function (step) { return Object.assign({}, step); })
    };
  }

  // Short division (the "bus stop"). A small box sits in front of every digit
  // after the first one used; the child decides whether anything is left over
  // to write there.
  function buildShortDivision(dividend, divisor, year, places) {
    places = places || 0;
    if (divisor > 9) throw new Error('Short division layout supports one-digit divisors');
    const dividendDigits = toDigits(dividend);
    const n = dividendDigits.length;
    if (dividend < divisor) throw new Error('Dividend must be at least the divisor');

    const plan = divisionSteps(dividendDigits, divisor);
    const steps = plan.steps;
    const quotient = Number(steps.map(function (step) { return step.quotientDigit; }).join(''));
    const lastStep = steps[steps.length - 1];
    const finalRemainder = lastStep.difference;
    const remainderDigits = finalRemainder > 0 ? toDigits(finalRemainder) : [];
    const width = n + (remainderDigits.length ? remainderDigits.length + 1 : 0);
    const rows = [];
    const actions = [];
    const groups = [];

    rows.push(buildQuotientRow(steps, n, width, remainderDigits));
    rows.push({
      id: 'bracket',
      kind: 'rule',
      thick: true,
      lineStart: 0,
      lineEnd: n - 1,
      bracket: true
    });

    const carryCells = new Array(width).fill(null);
    for (let col = steps[0].pos + 1; col < n; col++) {
      carryCells[col] = carryCell('sc', col, 0, { targetRowId: 'dividend' });
    }
    for (let s = 1; s < steps.length; s++) {
      carryCells[steps[s].pos].value = steps[s - 1].difference;
    }
    if (carryCells.some(Boolean)) {
      rows.push({ id: 'sc', kind: 'carry', cells: carryCells, targetRowId: 'dividend', inBracket: true });
    }

    const dividendCells = new Array(width).fill(null);
    for (let i = 0; i < n; i++) {
      dividendCells[i] = givenCell('dividend', i, dividendDigits[i]);
    }
    rows.push({
      id: 'dividend',
      kind: 'dividend',
      cells: dividendCells,
      gutter: String(divisor),
      divisor: divisor,
      isDividend: true
    });

    for (let s = 0; s < steps.length; s++) {
      const step = steps[s];
      const groupId = 'step-' + (step.index + 1);
      groups.push(makeStepGroup(step.index + 1));
      const lead = s === 0 && plan.startIndex > 0
        ? dividendDigits.slice(0, plan.startIndex).join('')
        : null;
      const divide = divideAction(step, divisor, n, groupId, lead, places);
      if (s === 0) {
        actions.push(divide);
        continue;
      }

      // The cursor stops at the small box in front of the next digit every
      // time: the child types what is left over, or 0.
      const prev = steps[s - 1];
      const leftWhy = divisor + ' × ' + prev.quotientDigit + ' = ' + prev.product;
      actions.push({
        kind: 'digit',
        choice: 'leftover',
        cellId: 'sc-c' + step.pos,
        rowId: 'sc',
        groupId: groupId,
        stepIndex: step.index,
        value: prev.difference,
        shown: prev.difference > 0 ? String(prev.difference) : null,
        stage: 'LEFT OVER',
        prompt: 'What is left over from ' + prev.partial + '?',
        subprompt: CHOICE.leftover,
        why: prev.difference > 0
          ? leftWhy + ', and ' + prev.partial + ' ' + MINUS + ' ' + prev.product + ' = ' +
            prev.difference + '. Carry the ' + prev.difference + ' to make ' + step.partial + '.'
          : leftWhy + ', so nothing is left over from ' + prev.partial + ': type 0.'
      });
      actions.push(divide);
    }

    const expression = dividend + ' ÷ ' + divisor + ' = ' + quotient +
      (finalRemainder ? ' R ' + finalRemainder : '');
    remainderActions(
      remainderDigits,
      n,
      'step-' + (lastStep.index + 1),
      lastStep,
      divisor + ' × ' + lastStep.quotientDigit + ' = ' + lastStep.product + ', and ' +
        lastStep.partial + ' ' + MINUS + ' ' + lastStep.product + ' = ' + finalRemainder +
        '. That is the remainder, so ' + expression + '.'
    ).forEach(function (action) { actions.push(action); });

    return {
      operation: 'divide',
      method: 'short',
      year: year,
      title: 'Short division',
      question: divisionQuestion(dividend, divisor, finalRemainder),
      markRowIds: ['q'],
      groupWord: 'Step',
      operands: { dividend: dividend, divisor: divisor },
      width: width,
      rows: rows,
      actions: actions,
      groups: groups,
      answerRowIds: ['q'],
      answer: {
        value: quotient,
        quotient: quotient,
        remainder: finalRemainder,
        expression: expression
      },
      steps: steps.map(function (step) { return Object.assign({}, step); })
    };
  }

  /* Decimals in written methods (Year 4 on). A method is built with whole
     numbers and then gets a point column: 23.4 + 9.75 is worked as
     2340 + 975 and drawn as 23.40 + 9.75, the added 0 marked as a place
     holder. Every digit step is the same as in the whole-number method. */

  function parseDecimal(text) {
    const clean = String(text).replace(MINUS, '-');
    const negative = clean.charAt(0) === '-';
    const parts = (negative ? clean.slice(1) : clean).split('.');
    const scaled = Number(parts[0] + (parts[1] || ''));
    return { scaled: negative ? -scaled : scaled, places: parts[1] ? parts[1].length : 0 };
  }

  function scaleTo(text, places) {
    const d = parseDecimal(text);
    return d.scaled * Math.pow(10, places - d.places);
  }

  // Puts the point column in front of the last `places` columns. Rows named
  // in `pointRows` get a point there and the others a gap; every box to the
  // right moves one column and its id follows.
  function insertPointColumn(problem, places, pointRows) {
    const at = problem.width - places;
    const idMap = {};
    problem.rows.forEach(function (row) {
      if (row.kind === 'rule') {
        if (row.lineStart >= at) row.lineStart += 1;
        if (row.lineEnd >= at) row.lineEnd += 1;
        return;
      }
      const cells = row.cells.slice(0, at).concat([null], row.cells.slice(at));
      for (let col = at + 1; col < cells.length; col++) {
        const cell = cells[col];
        if (!cell) continue;
        const id = row.id + '-c' + col;
        idMap[cell.id] = id;
        cell.id = id;
        cell.col = col;
      }
      if (pointRows.indexOf(row.id) !== -1) cells[at] = givenCell(row.id, at, '.', { point: true });
      row.cells = cells;
    });
    function remap(id) {
      return idMap[id] || id;
    }
    problem.actions.forEach(function (action) {
      action.cellId = remap(action.cellId);
      if (action.crossCellId) action.crossCellId = remap(action.crossCellId);
      (action.alsoFill || []).forEach(function (fill) {
        fill.cellId = remap(fill.cellId);
        if (fill.crossCellId) fill.crossCellId = remap(fill.crossCellId);
      });
    });
    problem.width += 1;
  }

  // `placeholders` counts the zeros added at the end of each row, which are
  // drawn as place holders.
  function finishDecimal(problem, places, pointRows, placeholders, fields) {
    insertPointColumn(problem, places, pointRows);
    Object.keys(placeholders).forEach(function (rowId) {
      const row = problem.rows.find(function (r) { return r.id === rowId; });
      for (let k = 0; k < placeholders[rowId]; k++) {
        const cell = row.cells[problem.width - 1 - k];
        if (cell && cell.kind === 'given') cell.placeholder = true;
      }
    });
    return Object.assign(problem, { places: places }, fields);
  }

  function buildDecimalAddition(aText, bText, year) {
    const pa = parseDecimal(aText).places;
    const pb = parseDecimal(bText).places;
    const places = Math.max(pa, pb);
    const a = scaleTo(aText, places);
    const b = scaleTo(bText, places);
    return finishDecimal(buildAddition(a, b, year, places), places, ['a', 'b', 'sum'],
      { a: places - pa, b: places - pb }, {
        title: 'Decimal addition',
        question: 'Work out ' + aText + ' + ' + bText + '. Line up the points.',
        operands: { a: a, b: b, aText: aText, bText: bText },
        answer: {
          value: a + b,
          text: decimalText(a + b, places),
          expression: aText + ' + ' + bText + ' = ' + decimalText(a + b, places, true)
        }
      });
  }

  function buildDecimalSubtraction(aText, bText, year) {
    const pa = parseDecimal(aText).places;
    const pb = parseDecimal(bText).places;
    const places = Math.max(pa, pb);
    const a = scaleTo(aText, places);
    const b = scaleTo(bText, places);
    return finishDecimal(buildSubtraction(a, b, year, places), places, ['a', 'b', 'diff'],
      { a: places - pa, b: places - pb }, {
        title: 'Decimal subtraction',
        question: 'Work out ' + aText + ' ' + MINUS + ' ' + bText + '. Line up the points.',
        operands: { a: a, b: b, aText: aText, bText: bText },
        answer: {
          value: a - b,
          text: decimalText(a - b, places),
          expression: aText + ' ' + MINUS + ' ' + bText + ' = ' + decimalText(a - b, places, true)
        }
      });
  }

  // Year 6: a number with up to 2 decimal places times a whole number.
  function buildDecimalMultiplication(aText, b, year) {
    const d = parseDecimal(aText);
    const problem = buildMultiplication(d.scaled, b, year, d.places);
    const pointRows = problem.rows.filter(function (row) {
      return row.id === 'a' || row.kind === 'product' || row.kind === 'sum';
    }).map(function (row) { return row.id; });
    const product = d.scaled * b;
    return finishDecimal(problem, d.places, pointRows, {}, {
      title: b > 9 ? 'Decimal long multiplication' : 'Decimal short multiplication',
      question: 'Work out ' + aText + ' × ' + b + '. Keep the point in line.',
      operands: { a: d.scaled, b: b, aText: aText },
      answer: {
        value: product,
        text: decimalText(product, d.places),
        expression: aText + ' × ' + b + ' = ' + decimalText(product, d.places, true)
      }
    });
  }

  // Year 6: "use written division methods in cases where the answer has up
  // to 2 decimal places". The dividend gets zeros after a point (437 is
  // written 437.00) and the method keeps going, as in Appendix 1's
  // 432 / 15 = 28.8.
  function buildDecimalDivision(dividendText, divisor, places, year) {
    const d = parseDecimal(dividendText);
    const scaled = d.scaled * Math.pow(10, places - d.places);
    const problem = divisor > 9
      ? buildDivision(scaled, divisor, year, places)
      : buildShortDivision(scaled, divisor, year, places);
    if (problem.answer.remainder) throw new Error('A decimal division has to come out exactly');
    const written = decimalText(scaled, places);
    const value = problem.answer.quotient;
    return finishDecimal(problem, places, ['q', 'dividend'], { dividend: places - d.places }, {
      title: 'Decimal division',
      question: 'Work out ' + dividendText + ' ÷ ' + divisor + '.' +
        (places > d.places ? ' Write it as ' + written + ' and keep going after the point.' : ''),
      operands: { dividend: scaled, divisor: divisor, dividendText: dividendText },
      answer: {
        value: value,
        quotient: value,
        remainder: 0,
        text: decimalText(value, places),
        expression: dividendText + ' ÷ ' + divisor + ' = ' + decimalText(value, places, true)
      }
    });
  }

  /* Sentences: given numbers, symbols and words with answer boxes, read and
     typed left to right. A fraction or a power stacks the sentence into
     three rows: tops (numerators and powers), the line, and bottoms
     (denominators). A point, sign or unit inside an answer is already
     written, except a sign box, where the child presses minus or starts
     with the first digit.

     Tokens: { n } a given number, { s } a symbol, { t } a word or unit,
     { ask } a number to type ({ sign: true } adds a sign box), { cmp } one of
     <, > and = to type, { pick, options } an answer chosen by its number,
     { frac: [top, bottom] } a fraction whose parts are numbers or { ask },
     { sup } a power after the number before it. */

  function sentenceChars(text) {
    return String(text).replace('-', MINUS).split('');
  }

  // Marks the digits a comma follows, for given numbers of 5 digits or more.
  function commaFlags(chars) {
    const flags = chars.map(function () { return false; });
    const point = chars.indexOf('.');
    const end = point === -1 ? chars.length : point;
    const start = chars[0] === MINUS ? 1 : 0;
    if (end - start < 5) return flags;
    for (let i = start; i < end - 1; i++) {
      if ((end - 1 - i) % 3 === 0) flags[i] = true;
    }
    return flags;
  }

  function textSpan(text) {
    return Math.max(1, Math.ceil(String(text).length / 3));
  }

  function partText(part) {
    return typeof part === 'object' ? String(part.ask) : String(part);
  }

  function partAsked(part) {
    return typeof part === 'object' && part.ask !== undefined;
  }

  const SUPERSCRIPT = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '−': '⁻' };

  // The sentence written out in one line, for the answer card.
  function sentenceLine(tokens) {
    const parts = [];
    tokens.forEach(function (token) {
      if (token.n !== undefined) parts.push(grouped(String(token.n).replace('-', MINUS)));
      else if (token.ask !== undefined) parts.push(String(token.ask).replace('-', MINUS));
      else if (token.s !== undefined) parts.push(token.s);
      else if (token.signBox !== undefined) parts.push(token.signBox === MINUS ? MINUS : '');
      else if (token.t !== undefined) parts.push(token.t);
      else if (token.v !== undefined) parts.push(token.v);
      else if (token.cmp !== undefined) parts.push(token.cmp);
      else if (token.pick !== undefined) {
        parts.push(token.options.find(function (o) { return o[0] === token.pick; })[1]);
      } else if (token.frac !== undefined) {
        parts.push(partText(token.frac[0]) + '/' + partText(token.frac[1]));
      } else if (token.sup !== undefined) {
        const power = partText(token.sup).split('').map(function (ch) { return SUPERSCRIPT[ch] || ch; }).join('');
        parts[parts.length - 1] = (parts[parts.length - 1] || '') + power;
      }
    });
    return parts.filter(function (part) { return part !== ''; }).join(' ')
      .replace(new RegExp('(^|[=(×÷+,] )' + MINUS + ' (?=\\d)', 'g'), '$1' + MINUS)
      .replace(/\( /g, '(').replace(/ \)/g, ')')
      .replace(/ ,/g, ',')
      .replace(/(\d) %/g, '$1%')
      .replace(/£ (\d)/g, '£$1')
      .replace(/(\d) p\b/g, '$1p')
      .replace(/(\d) °/g, '$1°')
      .replace(/(\d) : (\d)/g, '$1:$2');
  }

  function digitSubprompt(entry, first, year) {
    const info = entry.info;
    if (entry.part === 'top') return first ? 'Type the numerator, the top number.' : 'Keep going with the top number.';
    if (entry.part === 'bottom') return first ? 'Now the denominator, the bottom number.' : 'Keep going with the bottom number.';
    if (entry.part === 'power') return first ? 'Type the power, the small number.' : 'Keep going.';
    if (info.sub && first) return info.sub;
    const chars = entry.chars;
    const count = chars.filter(function (ch) { return /\d/.test(ch); }).length;
    if (count === 1) return first ? (info.sub || 'Type the answer.') : 'Keep going.';
    if (year < 2) return first ? 'Type the number from the left.' : 'Type the next digit.';
    const point = chars.indexOf('.');
    const end = point === -1 ? chars.length : point;
    const place = entry.index < end ? placeName(end - 1 - entry.index) : placeName(-(entry.index - point));
    return first ? 'Type the ' + place + ' digit first.' : 'Now the ' + place + ' digit.';
  }

  function buildSentence(spec) {
    const tokens = spec.tokens;
    const stacked = tokens.some(function (token) { return token.frac !== undefined || token.sup !== undefined; });
    const grid = { top: [], fact: [], bottom: [] };
    const order = [];
    let col = 0;
    let signBox = false;
    let compareBox = false;
    let options = null;

    function place(rowId, at, value, asked, extra) {
      const cell = asked ? inputCell(rowId, at, value, extra) : givenCell(rowId, at, value, extra);
      grid[rowId][at] = cell;
      return cell;
    }

    // Writes a number from column `at` and returns the next free column.
    function number(rowId, at, text, asked, info, part) {
      let chars = sentenceChars(text);
      const negative = chars[0] === MINUS;
      const group = order.length;
      if (asked && info.sign) {
        const cell = place(rowId, at, negative ? MINUS : '', true, { signBox: true, group: group });
        order.push({ cell: cell, rowId: rowId, kind: 'sign', value: negative ? MINUS : '+', info: info });
        signBox = true;
        at += 1;
        if (negative) chars = chars.slice(1);
      } else if (asked && negative) {
        throw new Error('An answer below zero needs a sign box: ' + text);
      }
      const commas = asked ? [] : commaFlags(chars);
      chars.forEach(function (ch, i) {
        if (ch === MINUS) {
          place(rowId, at, MINUS, false, { sign: true });
        } else if (ch === '.') {
          place(rowId, at, '.', false, { point: true });
        } else if (ch === ':') {
          // Times such as 7:35, in a given number or between answer boxes.
          place(rowId, at, ':', false, { sign: true, colon: true });
        } else {
          // `mark` underlines one given digit, as in "what is the 7 worth?"
          const extra = asked ? { group: group } : Object.assign({},
            commas[i] ? { comma: true } : null, info.mark === i ? { mark: true } : null);
          const cell = place(rowId, at, Number(ch), asked, extra);
          if (part === 'power') cell.power = true;
          if (asked) {
            order.push({ cell: cell, rowId: rowId, kind: 'digit', value: Number(ch), info: info, chars: chars, index: i, part: part });
          }
        }
        at += 1;
      });
      return at;
    }

    tokens.forEach(function (token) {
      if (token.n !== undefined) {
        col = number('fact', col, String(token.n), false, token, null);
      } else if (token.ask !== undefined) {
        col = number('fact', col, String(token.ask), true, token, null);
      } else if (token.s !== undefined) {
        place('fact', col, token.s, false, { sign: true });
        col += 1;
      } else if (token.signBox !== undefined) {
        // A sign box on its own, in front of a fraction to type.
        const negative = token.signBox === MINUS;
        const cell = place('fact', col, negative ? MINUS : '', true, { signBox: true, group: order.length });
        order.push({ cell: cell, rowId: 'fact', kind: 'sign', value: negative ? MINUS : '+', info: token });
        signBox = true;
        col += 1;
      } else if (token.t !== undefined) {
        const span = token.span || textSpan(token.t);
        place('fact', col, token.t, false, { unit: true, span: span });
        col += span;
      } else if (token.v !== undefined) {
        // A symbol or letter standing for a number, or a term such as 5a,
        // written as large as the digits.
        const span = token.span || 1;
        place('fact', col, token.v, false, { symbol: true, span: span });
        col += span;
      } else if (token.cmp !== undefined) {
        const cell = place('fact', col, token.cmp, true, { compare: true });
        order.push({ cell: cell, rowId: 'fact', kind: 'compare', value: token.cmp, info: token });
        compareBox = true;
        col += 1;
      } else if (token.pick !== undefined) {
        const chosen = token.options.find(function (o) { return o[0] === token.pick; });
        if (!chosen) throw new Error('The answer is not one of the options');
        const longest = Math.max.apply(null, token.options.map(function (o) { return o[1].length; }));
        const span = token.span || Math.max(2, Math.ceil(longest / 3));
        const cell = place('fact', col, chosen[1], true, { option: true, span: span, key: token.pick });
        order.push({ cell: cell, rowId: 'fact', kind: 'option', value: token.pick, label: chosen[1], info: token });
        options = token.options;
        col += span;
      } else if (token.frac !== undefined) {
        const top = partText(token.frac[0]);
        const bottom = partText(token.frac[1]);
        const width = Math.max(top.length, bottom.length);
        number('top', col + width - top.length, top, partAsked(token.frac[0]),
          typeof token.frac[0] === 'object' ? token.frac[0] : {}, 'top');
        for (let k = 0; k < width; k++) place('fact', col + k, '', false, { bar: true });
        number('bottom', col + width - bottom.length, bottom, partAsked(token.frac[1]),
          typeof token.frac[1] === 'object' ? token.frac[1] : {}, 'bottom');
        col += width;
      } else if (token.sup !== undefined) {
        // A sign box makes an asked power one column wider than its text.
        col = number('top', col, partText(token.sup), partAsked(token.sup), typeof token.sup === 'object' ? token.sup : {}, 'power');
      } else {
        throw new Error('Unknown sentence token ' + JSON.stringify(token));
      }
    });

    const width = col;
    const rowIds = stacked ? ['top', 'fact', 'bottom'] : ['fact'];
    const rows = rowIds.map(function (rowId) {
      const cells = new Array(width).fill(null);
      grid[rowId].forEach(function (cell, at) { if (cell) cells[at] = cell; });
      return { id: rowId, kind: 'fact', cells: cells, part: rowId };
    });
    const markRowIds = rows.filter(function (row) {
      return row.cells.some(function (cell) { return cell && cell.kind === 'input'; });
    }).map(function (row) { return row.id; });

    const legend = options ? options.map(function (o) { return o[0] + ' ' + o[1]; }).join(', ') : '';
    const firstOfGroup = {};
    const actions = order.map(function (entry, k) {
      const info = entry.info || {};
      const base = {
        cellId: entry.cell.id,
        rowId: entry.rowId,
        groupId: 'answer',
        stage: info.stage || spec.stage,
        prompt: info.prompt || spec.prompt,
        why: info.why || spec.why
      };
      if (entry.kind === 'sign') {
        const next = order[k + 1];
        return Object.assign(base, {
          kind: 'sign',
          choice: 'sign',
          value: entry.value,
          firstDigit: next.value,
          subprompt: CHOICE.sign,
          why: (entry.value === MINUS ? 'This number is below zero, so it starts with ' + MINUS + '. '
            : 'This number is not below zero, so it has no minus sign. ') + base.why
        });
      }
      if (entry.kind === 'compare') {
        return Object.assign(base, { kind: 'compare', value: entry.value, subprompt: info.sub || 'Type <, > or =.' });
      }
      if (entry.kind === 'option') {
        return Object.assign(base, {
          kind: 'digit',
          value: entry.value,
          shown: entry.label,
          option: true,
          subprompt: info.sub || 'Type the number of your answer: ' + legend + '.'
        });
      }
      const key = entry.cell.group + ':' + entry.part;
      const first = !firstOfGroup[key];
      firstOfGroup[key] = true;
      return Object.assign(base, {
        kind: 'digit',
        value: entry.value,
        subprompt: digitSubprompt(entry, first, spec.year)
      });
    });
    // A worked line in a set of lines (buildSentenceLines) is given in full.
    if (!actions.length && !spec.given) throw new Error('A sentence needs an answer box');

    const line = sentenceLine(tokens);
    return {
      operation: spec.area,
      method: 'sentence',
      year: spec.year,
      title: spec.title,
      kind: spec.kind || null,
      question: spec.question || spec.prompt,
      markRowIds: markRowIds,
      groupWord: null,
      width: width,
      noGutter: true,
      rows: rows,
      actions: actions,
      groups: [{ id: 'answer', label: 'answer', short: 'answer' }],
      answerRowIds: markRowIds,
      answer: {
        value: order.map(function (entry) {
          return entry.kind === 'option' ? entry.label : String(entry.value === '+' ? '' : entry.value);
        }).join(''),
        expression: spec.expression || line
      },
      line: line,
      picture: spec.picture || null,
      options: options,
      signBox: signBox,
      compareBox: compareBox,
      check: spec.check || { kind: 'statement' },
      operands: spec.operands || null,
      // Kinds that teach an idea (a symbol standing for a number) show two
      // worked examples with different numbers, not one.
      examples: spec.examples || 1
    };
  }

  // Several sentences, one under another: worked lines given in full, then
  // lines with answer boxes, so a question can show two worked examples and
  // ask for a third. Each line's rows and cells are renamed (l0-fact,
  // l1-fact, ...) so every id stays unique, and only lines with boxes are
  // marked. Lines listed in `spec.working` are working, like carries: they
  // are filled while learning but a test does not mark them.
  function buildSentenceLines(spec) {
    const working = spec.working || [];
    const parts = spec.lines.map(function (tokens) {
      const asks = tokens.some(function (token) {
        return token.ask !== undefined || token.cmp !== undefined || token.pick !== undefined || token.signBox !== undefined ||
          (token.frac && (partAsked(token.frac[0]) || partAsked(token.frac[1]))) || (token.sup !== undefined && partAsked(token.sup));
      });
      return buildSentence(Object.assign({}, spec, { tokens: tokens, given: !asks, picture: null }));
    });
    const width = Math.max.apply(null, parts.map(function (part) { return part.width; }));
    const rows = [];
    const actions = [];
    const markRowIds = [];
    parts.forEach(function (part, k) {
      const rename = {};
      part.rows.forEach(function (row) {
        const id = 'l' + k + '-' + row.id;
        rename[row.id] = id;
        const cells = new Array(width).fill(null);
        row.cells.forEach(function (cell, col) {
          if (!cell) return;
          cells[col] = Object.assign({}, cell, { id: id + '-c' + col });
        });
        rows.push(Object.assign({}, row, { id: id, cells: cells, line: k }, working.indexOf(k) !== -1 ? { working: true } : null));
      });
      if (working.indexOf(k) === -1) part.markRowIds.forEach(function (rowId) { markRowIds.push(rename[rowId]); });
      part.actions.forEach(function (action) {
        const rowId = rename[action.rowId];
        actions.push(Object.assign({}, action, { rowId: rowId, cellId: rowId + '-c' + action.cellId.split('-c').pop() }));
      });
    });
    const last = parts[parts.length - 1];
    const options = parts.reduce(function (found, part) { return found || part.options; }, null);
    return Object.assign({}, last, {
      width: width,
      rows: rows,
      actions: actions,
      markRowIds: markRowIds,
      answerRowIds: markRowIds,
      lines: parts.length,
      line: parts.map(function (part) { return part.line; }).join('; '),
      answer: { value: last.answer.value, expression: spec.expression || last.line },
      picture: spec.picture || null,
      options: options,
      signBox: parts.some(function (part) { return part.signBox; }),
      compareBox: parts.some(function (part) { return part.compareBox; })
    });
  }

  function countingList(step, count) {
    const values = [];
    for (let i = 1; i <= count; i++) values.push(step * i);
    return values.join(', ');
  }

  // Years 1 and 2 type a whole answer, so the boxes fill left to right in the
  // order a child writes a number.
  function answerActions(answer, startCol, base) {
    const digits = toDigits(answer);
    return digits.map(function (digit, k) {
      const isFirst = k === 0;
      return {
        kind: 'digit',
        cellId: 'fact-c' + (startCol + k),
        rowId: 'fact',
        groupId: 'answer',
        value: digit,
        stage: base.stage,
        // The question stays up for every digit of a whole answer.
        prompt: base.prompt,
        // Tens and ones are Year 2 place value, so Year 1 is told the order.
        subprompt: isFirst
          ? ([base.subprompt, digits.length === 1
            ? ''
            : (base.placeWords
              ? 'Type the ' + placeName(digits.length - 1) + ' digit first.'
              : 'Type the number from the left.')]
            .filter(Boolean).join(' ') || 'Type the answer.')
          : (base.placeWords
            ? 'Now type the ' + placeName(digits.length - 1 - k) + ' digit.'
            : 'Type the next digit.'),
        why: base.why
      };
    });
  }

  function factProblem(operation, year, title, cells, answerStart, answer, base, extra) {
    return Object.assign({
      operation: operation,
      method: 'fact',
      year: year,
      title: title,
      question: base.prompt + (base.stage === 'MISSING' && base.subprompt ? ' ' + base.subprompt : ''),
      markRowIds: ['fact'],
      groupWord: null,
      width: cells.length,
      // A number sentence has nothing in the left gutter, so it is drawn
      // without one.
      noGutter: true,
      rows: [{ id: 'fact', kind: 'fact', cells: cells }],
      actions: answerActions(answer.value, answerStart, base),
      groups: [{ id: 'answer', label: 'answer', short: 'answer' }],
      answerRowIds: ['fact'],
      answer: answer
    }, extra);
  }

  // Year 1: groups of dots in rows (an array). Multiply counts them all;
  // divide either shares them into rows or counts the groups.
  function buildPicture(operation, groups, size, mode, year) {
    const total = groups * size;
    let answer;
    let base;
    if (operation === 'multiply') {
      answer = { value: total, expression: groups + ' rows of ' + size + ' = ' + total };
      base = {
        stage: 'COUNT',
        prompt: 'There are ' + groups + ' rows of ' + size + ' dots. How many dots altogether?',
        subprompt: 'Count in ' + size + 's.',
        why: 'Count in ' + size + 's: ' + countingList(size, groups) + '. There are ' + total + ' dots.',
        placeWords: false
      };
    } else if (mode === 'share') {
      answer = {
        value: size,
        quotient: size,
        remainder: 0,
        expression: total + ' shared into ' + groups + ' rows = ' + size + ' each'
      };
      base = {
        stage: 'SHARE',
        prompt: total + ' dots are shared equally into ' + groups + ' rows. How many dots are in each row?',
        subprompt: 'Count the dots in one row.',
        why: groups + ' rows of ' + size + ' make ' + total + ', so each row has ' + size + '.',
        placeWords: false
      };
    } else {
      answer = {
        value: groups,
        quotient: groups,
        remainder: 0,
        expression: total + ' in groups of ' + size + ' = ' + groups + ' groups'
      };
      base = {
        stage: 'GROUP',
        prompt: total + ' dots are put into groups of ' + size + '. How many groups are there?',
        subprompt: 'Count the rows.',
        why: 'Count in ' + size + 's: ' + countingList(size, groups) + '. That is ' + groups +
          ' groups of ' + size + '.',
        placeWords: false
      };
    }
    const cells = toDigits(answer.value).map(function (digit, k) {
      return inputCell('fact', k, digit);
    });
    return factProblem(
      operation,
      year,
      operation === 'multiply' ? 'Counting groups' : (mode === 'share' ? 'Sharing' : 'Grouping'),
      cells,
      0,
      answer,
      base,
      { picture: { rows: groups, cols: size }, mode: mode || 'count' }
    );
  }

  // Years 1 and 2: a number sentence from the tables. The box holds the
  // answer, or for a missing-number problem ('a' or 'b') one of the numbers
  // on the left, which is solved with the inverse operation.
  function buildFact(operation, a, b, year, missing) {
    const sign = operation === 'multiply' ? '×' : '÷';
    const result = operation === 'multiply' ? a * b : a / b;
    if (result !== Math.floor(result)) throw new Error('Division fact must be exact');
    const hidden = missing || 'result';
    const cells = [];
    let answerStart = 0;
    function addNumber(value, isHidden) {
      if (isHidden) answerStart = cells.length;
      toDigits(value).forEach(function (digit) {
        cells.push(isHidden
          ? inputCell('fact', cells.length, digit)
          : givenCell('fact', cells.length, digit));
      });
    }
    function addSign(text) {
      cells.push(givenCell('fact', cells.length, text, { sign: true }));
    }
    addNumber(a, hidden === 'a');
    addSign(sign);
    addNumber(b, hidden === 'b');
    addSign('=');
    addNumber(result, hidden === 'result');

    const expression = a + ' ' + sign + ' ' + b + ' = ' + result;
    const value = hidden === 'a' ? a : (hidden === 'b' ? b : result);
    const shown = (hidden === 'a' ? '?' : a) + ' ' + sign + ' ' + (hidden === 'b' ? '?' : b) +
      ' = ' + result;
    let why;
    if (hidden !== 'result') {
      if (operation === 'multiply') {
        why = 'Use division: ' + result + ' ÷ ' + (hidden === 'a' ? b : a) + ' = ' + value +
          '. So ' + expression + '.';
      } else if (hidden === 'a') {
        why = 'Use multiplication: ' + result + ' × ' + b + ' = ' + a + '. So ' + expression + '.';
      } else {
        why = 'Use division: ' + a + ' ÷ ' + result + ' = ' + b + '. So ' + expression + '.';
      }
    } else if (operation === 'multiply') {
      // From Year 3 every table is in play, so count in the bigger number:
      // fewer steps.
      const table = year >= 3 ? Math.max(a, b) : (FACT_TABLES.indexOf(b) !== -1 ? b : a);
      const times = table === b ? a : b;
      why = (table === a && a !== b ? a + ' × ' + b + ' is the same as ' + b + ' × ' + a + '. ' : '') +
        'Count in ' + table + 's, ' + times + (times === 1 ? ' time: ' : ' times: ') +
        countingList(table, times) + '. So ' + expression + '.';
    } else {
      why = 'Count in ' + b + 's up to ' + a + ': ' + countingList(b, result) + '. That is ' +
        result + ' lots of ' + b + ', so ' + expression + '.';
    }

    const answer = { value: value, expression: expression };
    if (operation === 'multiply') {
      answer.product = result;
    } else {
      answer.quotient = result;
      answer.remainder = 0;
    }
    return factProblem(
      operation,
      year,
      hidden === 'result'
        ? (operation === 'multiply' ? 'Times tables' : 'Division facts')
        : 'Missing number',
      cells,
      answerStart,
      answer,
      {
        stage: hidden === 'result' ? (operation === 'multiply' ? 'MULTIPLY' : 'DIVIDE') : 'MISSING',
        prompt: hidden === 'result'
          ? 'What is ' + a + ' ' + sign + ' ' + b + '?'
          : 'What number goes in the box?',
        subprompt: hidden === 'result' ? '' : shown + '.',
        why: why,
        placeWords: year >= 2
      },
      {
        operands: operation === 'multiply' ? { a: a, b: b } : { dividend: a, divisor: b },
        missing: missing || null
      }
    );
  }

  // One fact from the given tables, times 1 to 12. With missing numbers on,
  // one in three problems hides a number on the left instead of the answer.
  function tableFact(operation, tables, year, withMissing) {
    const table = pick(tables);
    const times = randInt(1, 12);
    const missing = withMissing && randInt(0, 2) === 0 ? (randInt(0, 1) ? 'a' : 'b') : null;
    if (operation === 'divide') return buildFact('divide', table * times, table, year, missing);
    return randInt(0, 1)
      ? buildFact('multiply', times, table, year, missing)
      : buildFact('multiply', table, times, year, missing);
  }

  /* Add and Subtract number sentences */

  function evaluate(terms, ops) {
    let total = terms[0];
    for (let i = 1; i < terms.length; i++) {
      total = ops[i - 1] === '+' ? total + terms[i] : total - terms[i];
    }
    return total;
  }

  function signed(value) {
    return value < 0 ? MINUS + Math.abs(value) : String(value);
  }

  // Explanations a child can follow: make 10 for single-digit facts, a number
  // line for negatives, the inverse for missing numbers.
  function sumWhy(terms, ops, result, brackets) {
    const expression = sentenceText(terms, ops, result, null, brackets);
    if (brackets && terms[1] < 0) {
      const size = Math.abs(terms[1]);
      return ops[0] === '+'
        ? 'Adding ' + signed(terms[1]) + ' is the same as subtracting ' + size + ': ' +
          signed(terms[0]) + ' ' + MINUS + ' ' + size + ' = ' + signed(result) + '.'
        : 'Subtracting ' + signed(terms[1]) + ' is the same as adding ' + size + ': ' +
          signed(terms[0]) + ' + ' + size + ' = ' + signed(result) + '.';
    }
    if (terms.length === 2 && (terms[0] < 0 || result < 0)) {
      const start = terms[0];
      const up = ops[0] === '+';
      const crosses = (start < 0 && up && result > 0) || (start > 0 && !up && result < 0);
      if (crosses) {
        return 'Start at ' + signed(start) + ' and count ' + (up ? 'up ' : 'down ') + terms[1] +
          ': ' + Math.abs(start) + ' to reach 0, then ' + Math.abs(result) + ' more to reach ' +
          signed(result) + '.';
      }
      return 'Start at ' + signed(start) + ' and count ' + (up ? 'up ' : 'down ') + terms[1] +
        ' to reach ' + signed(result) + '.';
    }
    if (terms.length === 3) {
      const first = evaluate(terms.slice(0, 2), ops.slice(0, 1));
      return terms[0] + ' + ' + terms[1] + ' = ' + first + ', then ' + first + ' + ' + terms[2] +
        ' = ' + result + '.';
    }
    const a = terms[0];
    const b = terms[1];
    if (ops[0] === '+' && a < 10 && b < 10 && result > 10) {
      return 'Make 10: ' + a + ' + ' + (10 - a) + ' = 10, then ' + (b - (10 - a)) +
        ' more makes ' + result + '.';
    }
    if (ops[0] === MINUS && a > 10 && a < 20 && b < 10 && result < 10) {
      return 'Take ' + (a - 10) + ' to get to 10, then ' + (b - (a - 10)) + ' more gets to ' +
        result + '.';
    }
    return expression + '.';
  }

  function sentenceText(terms, ops, result, hiddenIndex, brackets) {
    const parts = [];
    terms.forEach(function (term, i) {
      if (i) parts.push(ops[i - 1]);
      let text = hiddenIndex === i ? '?' : signed(term);
      if (brackets && i > 0 && term < 0) text = '(' + text + ')';
      parts.push(text);
    });
    return parts.join(' ') + ' = ' + (hiddenIndex === 'result' ? '?' : signed(result));
  }

  // Number sentences for Add and Subtract. `missing` is a term index for a
  // missing-number problem; `equalsLeft` writes the total first (7 = ? - 9);
  // `signBox` gives the answer a sign box because it may be below zero.
  function buildSumSentence(opts) {
    const terms = opts.terms;
    const ops = opts.ops;
    const result = evaluate(terms, ops);
    const missing = opts.missing === undefined ? null : opts.missing;
    const brackets = Boolean(opts.brackets);
    const cells = [];
    let answerStart = 0;
    let signCellId = null;

    function addSign(text) {
      cells.push(givenCell('fact', cells.length, text, { sign: true }));
    }
    function addNumber(value, hidden, bracket) {
      if (bracket && value < 0) addSign('(');
      if (value < 0) addSign(MINUS);
      if (hidden) answerStart = cells.length;
      toDigits(Math.abs(value)).forEach(function (digit) {
        cells.push(hidden
          ? inputCell('fact', cells.length, digit)
          : givenCell('fact', cells.length, digit));
      });
      if (bracket && value < 0) addSign(')');
    }
    function addTerms() {
      terms.forEach(function (term, i) {
        if (i) addSign(ops[i - 1]);
        addNumber(term, missing === i, brackets && i > 0);
      });
    }

    if (opts.equalsLeft) {
      addNumber(result, false, false);
      addSign('=');
      addTerms();
    } else {
      addTerms();
      addSign('=');
      if (missing === null) {
        if (opts.signBox) {
          signCellId = 'fact-c' + cells.length;
          cells.push(inputCell('fact', cells.length, result < 0 ? MINUS : '', { signBox: true }));
        }
        addNumber(Math.abs(result), true, false);
      } else {
        addNumber(result, false, false);
      }
    }

    const value = missing === null ? Math.abs(result) : terms[missing];
    const expression = sentenceText(terms, ops, result, null, brackets);
    const shown = opts.equalsLeft
      ? signed(result) + ' = ' + sentenceText(terms, ops, result, missing, brackets).split(' = ')[0]
      : sentenceText(terms, ops, result, missing === null ? 'result' : missing, brackets);
    let why;
    if (missing === null) {
      why = sumWhy(terms, ops, result, brackets);
    } else if (ops[0] === '+') {
      const other = terms[1 - missing];
      why = 'Use subtraction: ' + result + ' ' + MINUS + ' ' + other + ' = ' + value + '. So ' +
        expression + '.';
    } else if (missing === 0) {
      why = 'Use addition: ' + result + ' + ' + terms[1] + ' = ' + value + '. So ' + expression + '.';
    } else {
      why = 'Use subtraction: ' + terms[0] + ' ' + MINUS + ' ' + result + ' = ' + value + '. So ' +
        expression + '.';
    }

    const operation = opts.area;
    const base = {
      stage: missing === null ? (operation === 'add' ? 'ADD' : 'SUBTRACT') : 'MISSING',
      prompt: missing === null ? 'What is ' + shown.replace(/ = \?$/, '') + '?' : 'What number goes in the box?',
      subprompt: missing === null ? '' : shown + '.',
      why: why,
      placeWords: opts.year >= 2
    };
    const answer = {
      value: value,
      total: result,
      expression: expression
    };
    const extra = {
      operands: { terms: terms.slice(), ops: ops.slice() },
      missing: missing,
      signBox: Boolean(signCellId)
    };

    if (signCellId) {
      const digits = toDigits(Math.abs(result));
      const actions = [{
        kind: 'sign',
        choice: 'sign',
        cellId: signCellId,
        rowId: 'fact',
        groupId: 'answer',
        value: result < 0 ? MINUS : '+',
        firstDigit: digits[0],
        stage: 'SIGN',
        prompt: base.prompt,
        subprompt: CHOICE.sign,
        why: result < 0
          ? 'The answer is below zero, so it starts with ' + MINUS + '. ' + why
          : 'The answer is not below zero, so it has no minus sign. ' + why
      }].concat(answerActions(Math.abs(result), answerStart, Object.assign({}, base, {
        subprompt: ''
      })));
      extra.actions = actions;
    }

    return factProblem(
      operation,
      opts.year,
      missing === null ? (signCellId ? 'Below zero' : 'Number sentence') : 'Missing number',
      cells,
      answerStart,
      answer,
      base,
      extra
    );
  }

  function digitsNumber(count) {
    return randInt(Math.pow(10, count - 1), Math.pow(10, count) - 1);
  }

  const COLUMN_SIZES = { 2: [2, 3], 3: [3, 4], 4: [4, 5], 5: [5, 6], 6: [6, 6], 7: [6, 7] };

  function columnPair(year) {
    const sizes = COLUMN_SIZES[year];
    const longer = randInt(sizes[0], sizes[1]);
    const shorter = randInt(0, 1) ? longer : longer - 1;
    return [digitsNumber(longer), digitsNumber(shorter)];
  }

  // True when an exchange has to pass through a 0 in the top number, as in
  // 400 - 167.
  function exchangesAcrossZero(top, bottom) {
    const current = toDigits(top);
    const width = current.length;
    const low = new Array(width).fill(0);
    const bottomDigits = toDigits(bottom);
    bottomDigits.forEach(function (digit, i) { low[width - bottomDigits.length + i] = digit; });
    for (let col = width - 1; col >= 0; col--) {
      if (current[col] < low[col]) {
        let giver = col - 1;
        let crossed = false;
        while (current[giver] === 0) {
          current[giver] = 9;
          giver--;
          crossed = true;
        }
        current[giver] -= 1;
        current[col] += 10;
        if (crossed) return true;
      }
    }
    return false;
  }

  function withInteriorZero(count) {
    const digits = toDigits(digitsNumber(count));
    const zeros = randInt(1, Math.max(1, count - 2));
    for (let z = 0; z < zeros; z++) digits[randInt(1, count - 2)] = 0;
    return Number(digits.join(''));
  }

  // About 1 in 4 column subtractions exchange across a zero.
  function columnSubtraction(year) {
    const wantZero = randInt(1, 4) === 1;
    for (let attempt = 0; attempt < 5000; attempt++) {
      let top;
      let bottom;
      if (wantZero) {
        const sizes = COLUMN_SIZES[year];
        const count = Math.max(3, randInt(sizes[0], sizes[1]));
        top = withInteriorZero(count);
        bottom = digitsNumber(randInt(0, 1) ? count : count - 1);
      } else {
        const pair = columnPair(year);
        top = Math.max(pair[0], pair[1]);
        bottom = Math.min(pair[0], pair[1]);
      }
      if (bottom >= top) continue;
      if (exchangesAcrossZero(top, bottom) !== wantZero) continue;
      return buildSubtraction(top, bottom, year);
    }
    throw new Error('No subtraction problem found for year ' + year);
  }

  function columnAddition(year) {
    const pair = columnPair(year);
    return buildAddition(pair[0], pair[1], year);
  }

  function oneOf(kinds) {
    return pick(kinds);
  }

  // Year 1 and Year 2 sentences. Totals stay within 20 for Year 1 facts and
  // within 100 for the Year 2 work Year 1 also gets.
  function sentence(area, year) {
    const ops = [area === 'add' ? '+' : MINUS];
    for (let attempt = 0; attempt < 5000; attempt++) {
      const roll = randInt(1, 20);
      let terms;
      let missing = null;
      let equalsLeft = false;
      if (year === 1) {
        if (roll <= 6) {
          const a = randInt(0, 20);
          terms = area === 'add' ? [a, randInt(0, 20 - a)] : [a, randInt(0, a)];
        } else if (roll <= 12) {
          const a = randInt(10, 99);
          const b = oneOf([randInt(1, 9), 10 * randInt(1, 9), randInt(10, 99)]);
          terms = [a, b];
        } else if (roll <= 15 && area === 'add') {
          terms = [randInt(1, 9), randInt(1, 9), randInt(1, 9)];
        } else {
          const total = randInt(2, 20);
          const part = randInt(0, total);
          terms = area === 'add' ? [part, total - part] : [total, part];
          missing = randInt(0, 1);
          equalsLeft = randInt(0, 1) === 1;
        }
      } else {
        if (roll <= 10) {
          const a = randInt(100, 999);
          const b = oneOf([randInt(1, 9), 10 * randInt(1, 9), 100 * randInt(1, 9)]);
          terms = [a, b];
        } else {
          const total = randInt(20, 100);
          const part = randInt(1, total - 1);
          terms = area === 'add' ? [part, total - part] : [total, part];
          missing = randInt(0, 1);
          equalsLeft = randInt(0, 1) === 1;
        }
      }
      const termOps = terms.length === 3 ? ['+', '+'] : ops;
      const result = evaluate(terms, termOps);
      if (result < 0) continue;
      if (year === 1 && result > 100) continue;
      if (year === 2 && result > 999) continue;
      const problem = buildSumSentence({
        area: area,
        terms: terms,
        ops: termOps,
        year: year,
        missing: missing,
        equalsLeft: equalsLeft
      });
      if (problem.width > 11) continue;
      return problem;
    }
    throw new Error('No sentence found for year ' + year);
  }

  // Years 4 to 7: answers below zero, as number sentences with a sign box.
  function negativeSentence(area, year) {
    const op = area === 'add' ? '+' : MINUS;
    for (let attempt = 0; attempt < 5000; attempt++) {
      let terms;
      let brackets = false;
      if (year >= 4 && year <= 6) {
        // Year 4 counts back through 0 with small numbers.
        const limit = { 4: 10, 5: 20, 6: 100 }[year];
        const second = randInt(1, limit);
        const first = area === 'add' ? -randInt(1, limit) : randInt(-limit, limit);
        terms = [first, second];
      } else {
        terms = [randInt(-20, 20), -randInt(1, 9)];
        brackets = true;
      }
      const result = evaluate(terms, [op]);
      if (terms[0] === 0 || result === 0) continue;
      if (!brackets && terms[0] > 0 && result > 0) continue;
      const problem = buildSumSentence({
        area: area,
        terms: terms,
        ops: [op],
        year: year,
        signBox: true,
        brackets: brackets
      });
      if (problem.width > 11) continue;
      return problem;
    }
    throw new Error('No negative sentence found for year ' + year);
  }

  function hasCarry(problem) {
    return problem.actions.some(function (action) {
      return action.choice === 'carry' && action.value > 0;
    });
  }

  function assertYear(year) {
    if (YEARS.indexOf(year) === -1) {
      throw new Error('Unknown year: ' + year);
    }
  }

  function threeOrFourDigits() {
    return randInt(0, 1) ? randInt(100, 999) : randInt(1000, 9999);
  }

  function fourOrFiveDigits() {
    return randInt(0, 1) ? randInt(1000, 9999) : randInt(10000, 99999);
  }

  // Multi-digit multipliers skip zero digits, which turn a whole partial row
  // into zeroes.
  function multiplierWithDigits(count) {
    let value;
    do {
      value = randInt(Math.pow(10, count - 1), Math.pow(10, count) - 1);
    } while (String(value).indexOf('0') !== -1);
    return value;
  }

  function twoDigitNumber() {
    return multiplierWithDigits(2);
  }

  /*
   * Each year is pitched for a strong pupil in that year: its own content at
   * the top of the range, plus the next year's methods. The programmes of
   * study set one programme for the majority and say pupils who grasp
   * concepts rapidly should get "rich and sophisticated problems before any
   * acceleration", so Years 1 and 2 also have missing-number problems.
   * Written methods (most rounds from Year 3):
   *  Multiply: Year 3 two- and three-digit numbers by one digit; Year 4 up
   *   to 4 digits by one digit and 2-digit by 2-digit; Year 5 up to 4 digits
   *   by two digits; Year 6 up to 4 digits by 3 digits, and a number with 2
   *   decimal places by one digit; Year 7 up to 5 digits by 3 digits, and
   *   decimals by two digits.
   *  Divide: Year 3 short division with exact answers; Year 4 with
   *   remainders; Year 5 4-digit short division and long division by two
   *   digits; Year 6 long division of 4 and 5 digits, and answers with up to
   *   2 decimal places; Year 7 divisors up to 3 digits and decimals.
   *  Add and Subtract: columns of 2-3 (Year 2), 3-4, 4-5, 5-6, 6 and 6-7
   *   digits, about 1 in 4 subtractions exchanging across a zero; decimal
   *   columns from Year 4 (2 places), Year 5 (1 or 2), Years 6 and 7 (up to
   *   3).
   * Sentences around them:
   *  Years 1 and 2: pictures, facts, sums and missing numbers.
   *  Years 3 and 4: all the tables to 12 x 12 with missing numbers, x0, x1
   *   and three numbers in Year 4; missing numbers with 1s, 10s, 100s (and
   *   1,000s) in Add and Subtract; scaling and "n objects with m objects"
   *   problems.
   *  Estimates (Years 3 to 6): round each number, then add or subtract.
   *  Below zero: Year 4 counts back through 0 within 10, Year 5 within 20,
   *   Year 6 within 100, Year 7 adds and subtracts negative numbers and
   *   multiplies and divides them.
   *  Year 5: mental multiplying and dividing with multiples of 10 and 100,
   *   and remainders in a story (round up, round down, or what is left).
   *  Year 6: a remainder as a fraction in its simplest form (Appendix 1:
   *   432 / 15 = 28 4/5).
   * Every written layout stays within 8 columns and every sentence within 14
   * cells, so a phone screen fits.
   */
  function writtenMultiplication(year) {
    assertYear(year);
    if (year === 1) {
      return randInt(0, 1)
        ? buildPicture('multiply', randInt(2, 10), pick(COUNTING_STEPS), null, year)
        : tableFact('multiply', COUNTING_STEPS, year, false);
    }
    if (year === 2) return tableFact('multiply', FACT_TABLES, year, true);
    for (let attempt = 0; attempt < 3000; attempt++) {
      let a;
      let b;
      if (year === 3) {
        a = randInt(0, 1) ? randInt(10, 99) : randInt(100, 999);
        b = randInt(2, 9);
      } else if (year === 4) {
        if (randInt(0, 1)) {
          a = threeOrFourDigits();
          b = randInt(2, 9);
        } else {
          a = randInt(11, 99);
          b = twoDigitNumber();
        }
      } else if (year === 5) {
        a = threeOrFourDigits();
        b = twoDigitNumber();
      } else if (year === 6) {
        if (randInt(0, 1)) {
          a = randInt(1000, 9999);
          b = twoDigitNumber();
        } else {
          a = threeOrFourDigits();
          b = multiplierWithDigits(3);
        }
      } else {
        a = fourOrFiveDigits();
        b = multiplierWithDigits(3);
      }
      const problem = buildMultiplication(a, b, year);
      // Short multiplication always includes a carry.
      if (b < 10 && !hasCarry(problem)) continue;
      return problem;
    }
    throw new Error('No multiplication problem found for year ' + year);
  }

  function writtenDivision(year) {
    assertYear(year);
    if (year === 1) {
      return randInt(0, 1)
        ? buildPicture('divide', randInt(2, 10), pick(COUNTING_STEPS), randInt(0, 1) ? 'share' : 'group', year)
        : tableFact('divide', COUNTING_STEPS, year, false);
    }
    if (year === 2) return tableFact('divide', FACT_TABLES, year, true);
    if (year === 3) {
      const divisor = randInt(2, 9);
      const low = randInt(0, 1) ? 10 : 100;
      const quotient = randInt(Math.ceil(low / divisor), Math.floor((low * 10 - 1) / divisor));
      return buildShortDivision(divisor * quotient, divisor, year);
    }
    if (year === 4) {
      return buildShortDivision(threeOrFourDigits(), randInt(2, 9), year);
    }
    if (year === 5) {
      return randInt(0, 1)
        ? buildShortDivision(randInt(1000, 9999), randInt(2, 9), year)
        : buildDivision(threeOrFourDigits(), randInt(11, 99), year);
    }
    if (year === 6) {
      return buildDivision(fourOrFiveDigits(), randInt(11, 99), year);
    }
    return randInt(0, 1)
      ? buildDivision(randInt(10000, 99999), randInt(11, 99), year)
      : buildDivision(randInt(1000, 9999), multiplierWithDigits(3), year);
  }

  /* Sentences around the written methods */

  const ALL_TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Half up, as the programmes of study round (4,500 to the nearest 1,000
  // is 5,000).
  function roundTo(value, unit) {
    return Math.floor((value + unit / 2) / unit) * unit;
  }

  // A decimal with `whole` digits before the point and `places` after it;
  // the last place is never 0, so every place counts.
  function randomDecimal(whole, places) {
    const intPart = whole === 1 ? randInt(1, 9) : digitsNumber(whole);
    let fraction = '';
    for (let i = 0; i < places; i++) fraction += String(i === places - 1 ? randInt(1, 9) : randInt(0, 9));
    return places ? intPart + '.' + fraction : String(intPart);
  }

  function compareDecimals(a, b) {
    const places = Math.max(parseDecimal(a).places, parseDecimal(b).places);
    return scaleTo(a, places) - scaleTo(b, places);
  }

  const DECIMAL_COLUMNS = {
    4: { whole: [1, 2], places: [[2, 2]] },
    5: { whole: [1, 3], places: [[1, 2], [2, 1], [2, 2], [1, 1]] },
    6: { whole: [1, 3], places: [[1, 2], [2, 3], [3, 1], [3, 3], [2, 2]] },
    7: { whole: [1, 4], places: [[1, 3], [3, 2], [2, 3], [3, 3], [1, 2]] }
  };

  function decimalColumns(area, year) {
    const spec = DECIMAL_COLUMNS[year];
    for (let attempt = 0; attempt < 5000; attempt++) {
      const places = pick(spec.places);
      const a = randomDecimal(randInt(spec.whole[0], spec.whole[1]), places[0]);
      const b = randomDecimal(randInt(spec.whole[0], spec.whole[1]), places[1]);
      let problem;
      if (area === 'add') {
        problem = buildDecimalAddition(a, b, year);
      } else {
        const big = compareDecimals(a, b) >= 0 ? a : b;
        const small = big === a ? b : a;
        const gap = compareDecimals(big, small);
        // The answer is at least 1, so it has a digit before the point.
        if (gap < Math.pow(10, Math.max(parseDecimal(a).places, parseDecimal(b).places))) continue;
        problem = buildDecimalSubtraction(big, small, year);
        if (!problem.actions.some(function (action) { return action.choice === 'exchange' && action.value === 1; })) continue;
      }
      if (problem.width > 8) continue;
      return problem;
    }
    throw new Error('No decimal column problem for year ' + year);
  }

  function inverseWhy(op, terms, missing, total, show) {
    const value = missing === 'total' ? total : terms[missing];
    if (op === '+') {
      if (missing === 'total') return show(terms[0]) + ' + ' + show(terms[1]) + ' = ' + show(total) + '.';
      return 'Use subtraction: ' + show(total) + ' ' + MINUS + ' ' + show(terms[1 - missing]) + ' = ' + show(value) + '.';
    }
    if (missing === 0) return 'Use addition: ' + show(total) + ' + ' + show(terms[1]) + ' = ' + show(value) + '.';
    return 'Use subtraction: ' + show(terms[0]) + ' ' + MINUS + ' ' + show(total) + ' = ' + show(value) + '.';
  }

  // Year 3 on: a missing number with 1s, 10s, 100s or 1,000s (mental
  // methods), bigger round numbers in Years 5 and 6, tenths in Year 7.
  function missingSum(area, year) {
    for (let attempt = 0; attempt < 5000; attempt++) {
      let a;
      let b;
      let places = 0;
      if (year === 3) {
        a = randInt(100, 999);
        b = pick([randInt(1, 9), 10 * randInt(1, 9), 100 * randInt(1, 9)]);
      } else if (year === 4) {
        a = randInt(1000, 9999);
        b = pick([randInt(1, 9), 10 * randInt(1, 9), 100 * randInt(1, 9), 1000 * randInt(1, 8)]);
      } else if (year === 5) {
        a = 100 * randInt(10, 89);
        b = 100 * randInt(11, 89);
      } else if (year === 6) {
        a = 10 * randInt(100, 899);
        b = 10 * randInt(101, 899);
      } else {
        places = 1;
        a = randInt(11, 499);
        b = randInt(11, 99);
      }
      if (b % 10 === 0 && places) continue;
      const show = function (value) { return places ? decimalText(value, places, true) : String(value); };
      const ask = function (value) { return places ? decimalText(value, places) : String(value); };
      let terms;
      let total;
      const op = area === 'add' ? '+' : MINUS;
      if (area === 'add') {
        terms = [a, b];
        total = a + b;
      } else {
        terms = [a + b, b];
        total = a;
      }
      if (year === 3 && Math.max(terms[0], total) > 999) continue;
      if (year === 4 && Math.max(terms[0], total) > 9999) continue;
      const missing = randInt(0, 1);
      const tokens = [];
      terms.forEach(function (term, i) {
        if (i) tokens.push({ s: op });
        tokens.push(missing === i ? { ask: ask(term) } : { n: show(term) });
      });
      tokens.push({ s: '=' }, { n: show(total) });
      if (places && /\.0$/.test(ask(terms[missing]))) continue;
      const problem = buildSentence({
        area: area,
        year: year,
        title: 'Missing number',
        stage: 'MISSING',
        prompt: 'What number goes in the box?',
        why: inverseWhy(op, terms, missing, total, show) + ' So ' +
          show(terms[0]) + ' ' + op + ' ' + show(terms[1]) + ' = ' + show(total) + '.',
        tokens: tokens
      });
      if (problem.width > 14) continue;
      return problem;
    }
    throw new Error('No missing-number sum for year ' + year);
  }

  const ESTIMATES = {
    3: { to: 10, digits: [2, 3] },
    4: { to: 100, digits: [3, 4] },
    5: { to: 100, digits: [3, 4] },
    6: { to: 1000, digits: [4, 4] }
  };

  // Years 3 to 6: "estimate the answer to a calculation", "use rounding to
  // check answers".
  function estimateSum(area, year) {
    const spec = ESTIMATES[year];
    const op = area === 'add' ? '+' : MINUS;
    for (let attempt = 0; attempt < 5000; attempt++) {
      const x = digitsNumber(randInt(spec.digits[0], spec.digits[1]));
      const y = digitsNumber(randInt(spec.digits[0], spec.digits[1]));
      const big = Math.max(x, y);
      const small = Math.min(x, y);
      if (big % spec.to === 0 || small % spec.to === 0) continue;
      const rb = roundTo(big, spec.to);
      const rs = roundTo(small, spec.to);
      const estimate = area === 'add' ? rb + rs : rb - rs;
      if (estimate <= 0) continue;
      const problem = buildSentence({
        area: area,
        year: year,
        title: 'Estimate',
        stage: 'ESTIMATE',
        prompt: 'Round each number to the nearest ' + grouped(spec.to) + ', then ' +
          (area === 'add' ? 'add' : 'subtract') + '.',
        why: big + ' rounds to ' + grouped(rb) + ' and ' + small + ' rounds to ' + grouped(rs) + '. ' +
          grouped(rb) + ' ' + op + ' ' + grouped(rs) + ' = ' + grouped(estimate) + '.',
        tokens: [{ n: big }, { s: op }, { n: small }, { s: '≈' }, { ask: estimate }],
        check: { kind: 'estimate', terms: [big, small], op: op, to: spec.to }
      });
      if (problem.width > 15) continue;
      return problem;
    }
    throw new Error('No estimate for year ' + year);
  }

  // Years 3 and 4 multiply: "multiplying by 0 and 1", and Year 4 divide:
  // "dividing by 1".
  function zeroOrOne(area, year) {
    const n = randInt(2, 12);
    if (area === 'divide') {
      return buildSentence({
        area: area,
        year: year,
        title: 'Dividing by 1',
        stage: 'DIVIDE',
        prompt: 'What is ' + n + ' ÷ 1?',
        why: 'Dividing by 1 leaves a number as it is: ' + n + ' ÷ 1 = ' + n + '.',
        tokens: [{ n: n }, { s: '÷' }, { n: 1 }, { s: '=' }, { ask: n }]
      });
    }
    const by = randInt(0, 1);
    const first = randInt(0, 1);
    const terms = first ? [by, n] : [n, by];
    return buildSentence({
      area: area,
      year: year,
      title: 'Times 0 and 1',
      stage: 'MULTIPLY',
      prompt: 'What is ' + terms[0] + ' × ' + terms[1] + '?',
      why: by === 0
        ? 'Any number times 0 is 0: ' + terms[0] + ' × ' + terms[1] + ' = 0.'
        : 'Any number times 1 stays the same: ' + terms[0] + ' × ' + terms[1] + ' = ' + n + '.',
      tokens: [{ n: terms[0] }, { s: '×' }, { n: terms[1] }, { s: '=' }, { ask: by === 0 ? 0 : n }]
    });
  }

  // Year 4: "multiplying together 3 numbers".
  function threeNumbers(year) {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 6);
      if (a * b * c > 400) continue;
      return buildSentence({
        area: 'multiply',
        year: year,
        title: 'Three numbers',
        stage: 'MULTIPLY',
        prompt: 'What is ' + a + ' × ' + b + ' × ' + c + '?',
        why: a + ' × ' + b + ' = ' + (a * b) + ', then ' + (a * b) + ' × ' + c + ' = ' + (a * b * c) + '.',
        tokens: [{ n: a }, { s: '×' }, { n: b }, { s: '×' }, { n: c }, { s: '=' }, { ask: a * b * c }]
      });
    }
    throw new Error('No three-number product');
  }

  // Word problems: scaling, n objects with m objects (Years 3 and 4),
  // simple rates (Year 5), sharing and grouping (Year 3 divide).
  const SCALING = [
    { story: 'A blue ribbon is {a} cm long. A red ribbon is {b} times as long. How long is the red ribbon?', unit: 'cm' },
    { story: 'A puppy weighs {a} kg. A big dog is {b} times as heavy. How heavy is the big dog?', unit: 'kg' },
    { story: 'Sam has {a} stickers. Ali has {b} times as many. How many stickers does Ali have?', unit: 'stickers' },
    { story: 'A small tower is {a} cubes tall. A big tower is {b} times as tall. How tall is the big tower?', unit: 'cubes' }
  ];
  const RATES = [
    { story: 'One pen costs {a}p. How much do {b} pens cost?', unit: 'p', a: [25, 95] },
    { story: 'A bus holds {a} people. How many people fit in {b} buses?', unit: 'people', a: [32, 75] },
    { story: 'A box holds {a} pencils. How many pencils are in {b} boxes?', unit: 'pencils', a: [24, 60] },
    { story: 'A runner goes {a} metres a minute. How far does she run in {b} minutes?', unit: 'm', a: [120, 250] }
  ];

  function fill(story, values) {
    return story.replace(/\{(\w+)\}/g, function (match, key) { return String(values[key]); });
  }

  function wordProblem(area, year) {
    let story;
    let a;
    let b;
    let answer;
    let unit;
    let expr;
    let why;
    if (area === 'divide') {
      const size = randInt(2, 10);
      const groups = randInt(2, 10);
      const total = size * groups;
      if (randInt(0, 1)) {
        story = total + ' sweets are shared equally between ' + groups + ' children. How many does each child get?';
        answer = size;
        unit = 'each';
        why = total + ' ÷ ' + groups + ' = ' + size + ', so each child gets ' + size + '.';
        expr = total + ' ÷ ' + groups;
      } else {
        story = total + ' eggs are put into boxes of ' + size + '. How many boxes are filled?';
        answer = groups;
        unit = 'boxes';
        why = total + ' ÷ ' + size + ' = ' + groups + ', so ' + groups + ' boxes are filled.';
        expr = total + ' ÷ ' + size;
      }
    } else if (year === 5) {
      const rate = pick(RATES);
      a = randInt(rate.a[0], rate.a[1]);
      b = randInt(3, 9);
      story = fill(rate.story, { a: a, b: b });
      answer = a * b;
      unit = rate.unit;
      why = a + ' × ' + b + ' = ' + answer + '.';
      expr = a + ' × ' + b;
    } else if (randInt(0, 2) === 0) {
      a = randInt(2, 6);
      b = randInt(2, 6);
      if (year === 4) {
        const c = randInt(2, 3);
        story = 'You have ' + a + ' hats, ' + b + ' scarves and ' + c + ' pairs of gloves. How many different outfits of one hat, one scarf and one pair of gloves can you make?';
        answer = a * b * c;
        why = 'Each hat goes with each scarf: ' + a + ' × ' + b + ' = ' + (a * b) + ' pairs. Each pair goes with each pair of gloves: ' +
          (a * b) + ' × ' + c + ' = ' + answer + '.';
        expr = a + ' × ' + b + ' × ' + c;
      } else {
        story = 'You have ' + a + ' hats and ' + b + ' scarves. How many different hat and scarf pairs can you make?';
        answer = a * b;
        why = 'Each of the ' + a + ' hats goes with each of the ' + b + ' scarves: ' + a + ' × ' + b + ' = ' + answer + '.';
        expr = a + ' × ' + b;
      }
      unit = year === 4 ? 'outfits' : 'pairs';
    } else {
      const scale = pick(SCALING);
      a = randInt(year === 3 ? 3 : 12, year === 3 ? 12 : 45);
      b = randInt(2, year === 3 ? 5 : 9);
      story = fill(scale.story, { a: a, b: b });
      answer = a * b;
      unit = scale.unit;
      why = b + ' times as much: ' + a + ' × ' + b + ' = ' + answer + '.';
      expr = a + ' × ' + b;
    }
    return buildSentence({
      area: area,
      year: year,
      title: 'Problem',
      stage: 'PROBLEM',
      prompt: story,
      why: why,
      tokens: [{ ask: answer }, { t: unit }],
      check: { kind: 'value', expr: expr }
    });
  }

  // Year 5: "multiply and divide numbers mentally, drawing upon known facts",
  // with multiples of 10 and 100.
  function mentalTens(area, year) {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const d1 = randInt(2, 9);
      const d2 = randInt(2, 9);
      const i = randInt(0, 2);
      const j = randInt(0, 2);
      if (i + j < 1 || i + j > 3) continue;
      const a = d1 * Math.pow(10, i);
      const b = d2 * Math.pow(10, j);
      const product = a * b;
      if (area === 'multiply') {
        return buildSentence({
          area: area,
          year: year,
          title: 'Mental multiplying',
          stage: 'MULTIPLY',
          prompt: 'Work it out in your head: ' + a + ' × ' + b + '.',
          why: 'Use ' + d1 + ' × ' + d2 + ' = ' + (d1 * d2) + '. ' + a + ' × ' + b + ' is ' +
            grouped(Math.pow(10, i + j)) + ' times as big: ' + grouped(product) + '.',
          tokens: [{ n: a }, { s: '×' }, { n: b }, { s: '=' }, { ask: product }]
        });
      }
      if (product > 99999) continue;
      return buildSentence({
        area: area,
        year: year,
        title: 'Mental dividing',
        stage: 'DIVIDE',
        prompt: 'Work it out in your head: ' + grouped(product) + ' ÷ ' + b + '.',
        why: 'Use ' + (d1 * d2) + ' ÷ ' + d2 + ' = ' + d1 + '. ' + a + ' × ' + b + ' = ' + grouped(product) +
          ', so ' + grouped(product) + ' ÷ ' + b + ' = ' + a + '.',
        tokens: [{ n: product }, { s: '÷' }, { n: b }, { s: '=' }, { ask: a }]
      });
    }
    throw new Error('No mental fact');
  }

  // Year 5: "interpret remainders appropriately for the context".
  const REMAINDER_STORIES = [
    { round: 'up', story: '{n} children are going on a trip. Each car takes {k} children. How many cars are needed?', unit: 'cars',
      why: '{n} ÷ {k} = {q} r {r}. The {r} children left over need one more car, so {a} cars.' },
    { round: 'up', story: '{n} cakes need boxes. A box holds {k} cakes. How many boxes are needed for all of them?', unit: 'boxes',
      why: '{n} ÷ {k} = {q} r {r}. The {r} cakes left over need one more box, so {a} boxes.' },
    { round: 'down', story: 'A baker has {n} eggs. An egg box holds {k}. How many boxes can be filled?', unit: 'boxes',
      why: '{n} ÷ {k} = {q} r {r}. The {r} eggs left over do not fill a box, so {a} boxes.' },
    { round: 'down', story: 'A ticket costs £{k}. How many tickets can you buy with £{n}?', unit: 'tickets',
      why: '{n} ÷ {k} = {q} r {r}. £{r} is not enough for another ticket, so {a} tickets.' },
    { round: 'left', story: '{n} stickers are shared equally between {k} children. How many stickers are left over?', unit: 'left',
      why: '{n} ÷ {k} = {q} r {r}, so {r} stickers are left over.' }
  ];

  function remainderStory(year) {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const k = randInt(3, 9);
      const n = randInt(20, 99);
      const r = n % k;
      if (!r) continue;
      const q = (n - r) / k;
      const story = pick(REMAINDER_STORIES);
      const answer = story.round === 'up' ? q + 1 : (story.round === 'down' ? q : r);
      const values = { n: n, k: k, q: q, r: r, a: answer };
      return buildSentence({
        area: 'divide',
        year: year,
        title: 'Remainders',
        stage: 'PROBLEM',
        prompt: fill(story.story, values),
        why: fill(story.why, values),
        tokens: [{ ask: answer }, { t: story.unit }],
        check: { kind: 'remainder', n: n, k: k, round: story.round }
      });
    }
    throw new Error('No remainder story');
  }

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      const t = a % b;
      a = b;
      b = t;
    }
    return a;
  }

  // Year 6: "interpret remainders as whole number remainders, fractions, or
  // by rounding". Appendix 1 writes 432 / 15 = 28 r 12 as 28 4/5.
  function fractionRemainder(year) {
    for (let attempt = 0; attempt < 5000; attempt++) {
      const divisor = randInt(11, 25);
      const dividend = randInt(150, 999);
      const r = dividend % divisor;
      if (!r) continue;
      const q = (dividend - r) / divisor;
      const g = gcd(r, divisor);
      const top = r / g;
      const bottom = divisor / g;
      return buildSentence({
        area: 'divide',
        year: year,
        title: 'Remainder as a fraction',
        stage: 'FRACTION',
        prompt: dividend + ' ÷ ' + divisor + ' = ' + q + ' r ' + r + '. Write the answer as a mixed number, in its simplest form.',
        why: 'The remainder ' + r + ' is ' + r + '/' + divisor + ' of another ' + divisor + '.' +
          (g > 1 ? ' Divide the top and bottom by ' + g + ': ' + r + '/' + divisor + ' = ' + top + '/' + bottom + '.' : '') +
          ' So ' + dividend + ' ÷ ' + divisor + ' = ' + q + ' ' + top + '/' + bottom + '.',
        tokens: [{ n: dividend }, { s: '÷' }, { n: divisor }, { s: '=' }, { n: q }, { frac: [{ ask: top }, { ask: bottom }] }],
        check: { kind: 'statement', simplest: true }
      });
    }
    throw new Error('No fraction remainder');
  }

  // Year 6 and 7 division with a decimal answer.
  function decimalDivision(year) {
    for (let attempt = 0; attempt < 5000; attempt++) {
      if (year === 6 || randInt(0, 1)) {
        if (randInt(0, 1)) {
          const divisor = pick([2, 4, 5, 8]);
          const dividend = year === 6 ? randInt(100, 999) : randInt(1000, 9999);
          if (dividend % divisor === 0) continue;
          const places = [1, 2].find(function (p) { return (dividend * Math.pow(10, p)) % divisor === 0; });
          if (!places) continue;
          const problem = buildDecimalDivision(String(dividend), divisor, places, year);
          if (problem.width > 8) continue;
          return problem;
        }
        const divisor = randInt(11, 40);
        const dividend = randInt(200, 999);
        if (dividend % divisor === 0 || (dividend * 10) % divisor !== 0) continue;
        return buildDecimalDivision(String(dividend), divisor, 1, year);
      }
      // Year 7: a decimal divided by a whole number.
      const divisor = randInt(3, 9);
      const places = randInt(1, 2);
      const answer = randInt(Math.pow(10, places) + 1, 9 * Math.pow(10, places + 1));
      const dividendText = decimalText(answer * divisor, places);
      if (/0$/.test(dividendText)) continue;
      const problem = buildDecimalDivision(dividendText, divisor, places, year);
      if (problem.width > 8) continue;
      return problem;
    }
    throw new Error('No decimal division for year ' + year);
  }

  // Year 6: one digit and up to 2 decimal places times a whole number
  // (short multiplication). Year 7: decimals times two-digit numbers.
  function decimalMultiplication(year) {
    for (let attempt = 0; attempt < 5000; attempt++) {
      let aText;
      let b;
      if (year === 6) {
        aText = randomDecimal(1, randInt(1, 2));
        b = randInt(3, 9);
      } else {
        aText = randomDecimal(randInt(1, 2), randInt(1, 2));
        b = twoDigitNumber();
      }
      const problem = buildDecimalMultiplication(aText, b, year);
      if (problem.width > 8) continue;
      if (b < 10 && !hasCarry(problem)) continue;
      return problem;
    }
    throw new Error('No decimal multiplication for year ' + year);
  }

  // Year 7: "use the 4 operations ... all both positive and negative".
  function negativeProduct(area, year) {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const x = randInt(2, 12);
      const y = randInt(2, 12);
      const signs = pick([[-1, 1], [1, -1], [-1, -1]]);
      let a;
      let b;
      let result;
      if (area === 'multiply') {
        a = signs[0] * x;
        b = signs[1] * y;
        result = a * b;
      } else {
        a = signs[0] * x * y;
        b = signs[1] * y;
        result = a / b;
      }
      const sign = area === 'multiply' ? '×' : '÷';
      const tokens = [{ n: a }, { s: sign }];
      if (b < 0) tokens.push({ s: '(' }, { n: b }, { s: ')' });
      else tokens.push({ n: b });
      tokens.push({ s: '=' }, { ask: result, sign: true });
      const size = Math.abs(result);
      const both = a < 0 && b < 0;
      return buildSentence({
        area: area,
        year: year,
        title: area === 'multiply' ? 'Negative numbers' : 'Negative numbers',
        stage: area === 'multiply' ? 'MULTIPLY' : 'DIVIDE',
        prompt: 'What is ' + signed(a) + ' ' + sign + ' ' + (b < 0 ? '(' + signed(b) + ')' : b) + '?',
        why: Math.abs(a) + ' ' + sign + ' ' + Math.abs(b) + ' = ' + size + '. ' +
          (both ? 'Both numbers are below zero, so the answer is not.' : 'One number is below zero, so the answer is below zero.'),
        tokens: tokens
      });
    }
    throw new Error('No negative product');
  }

  const TIMES_KINDS = {
    3: [[6, 'written'], [3, 'facts'], [1, 'problem']],
    4: [[5, 'written'], [2, 'facts'], [1, 'three'], [1, 'zero'], [1, 'problem']],
    5: [[7, 'written'], [2, 'mental'], [1, 'problem']],
    6: [[7, 'written'], [3, 'decimal']],
    7: [[6, 'written'], [2, 'decimal'], [2, 'negative']]
  };

  const DIVIDE_KINDS = {
    3: [[6, 'written'], [3, 'facts'], [1, 'problem']],
    4: [[7, 'written'], [2, 'facts'], [1, 'zero']],
    5: [[7, 'written'], [2, 'story'], [1, 'mental']],
    6: [[6, 'written'], [2, 'decimal'], [2, 'fraction']],
    7: [[6, 'written'], [2, 'decimal'], [2, 'negative']]
  };

  const SUM_KINDS = {
    3: [[7, 'columns'], [2, 'missing'], [1, 'estimate']],
    4: [[5, 'columns'], [2, 'decimal'], [1, 'missing'], [1, 'estimate'], [1, 'negative']],
    5: [[4, 'columns'], [2, 'decimal'], [1, 'missing'], [1, 'estimate'], [2, 'negative']],
    6: [[4, 'columns'], [2, 'decimal'], [1, 'missing'], [1, 'estimate'], [2, 'negative']],
    7: [[4, 'columns'], [3, 'decimal'], [1, 'missing'], [2, 'negative']]
  };

  function generateMultiplication(year) {
    assertYear(year);
    if (year < 3) return writtenMultiplication(year);
    const kind = weighted(TIMES_KINDS[year]);
    if (kind === 'facts') return tableFact('multiply', ALL_TABLES, year, true);
    if (kind === 'three') return threeNumbers(year);
    if (kind === 'zero') return zeroOrOne('multiply', year);
    if (kind === 'problem') return wordProblem('multiply', year);
    if (kind === 'mental') return mentalTens('multiply', year);
    if (kind === 'decimal') return decimalMultiplication(year);
    if (kind === 'negative') return negativeProduct('multiply', year);
    return writtenMultiplication(year);
  }

  function generateDivision(year) {
    assertYear(year);
    if (year < 3) return writtenDivision(year);
    const kind = weighted(DIVIDE_KINDS[year]);
    if (kind === 'facts') return tableFact('divide', ALL_TABLES, year, true);
    if (kind === 'zero') return zeroOrOne('divide', year);
    if (kind === 'problem') return wordProblem('divide', year);
    if (kind === 'story') return remainderStory(year);
    if (kind === 'mental') return mentalTens('divide', year);
    if (kind === 'decimal') return decimalDivision(year);
    if (kind === 'fraction') return fractionRemainder(year);
    if (kind === 'negative') return negativeProduct('divide', year);
    return writtenDivision(year);
  }

  function generateSum(area, year) {
    assertYear(year);
    if (year === 1) return sentence(area, 1);
    if (year === 2) return randInt(0, 1) ? sentence(area, 2) : (area === 'add' ? columnAddition(2) : columnSubtraction(2));
    const kind = weighted(SUM_KINDS[year]);
    if (kind === 'decimal') return decimalColumns(area, year);
    if (kind === 'missing') return missingSum(area, year);
    if (kind === 'estimate') return estimateSum(area, year);
    if (kind === 'negative') return negativeSentence(area, year);
    return area === 'add' ? columnAddition(year) : columnSubtraction(year);
  }

  function generateAddition(year) {
    return generateSum('add', year);
  }

  function generateSubtraction(year) {
    return generateSum('subtract', year);
  }

  /* Areas from topics.js register here. */

  const TOPICS = {};

  function addArea(area, generator) {
    if (AREAS.indexOf(area) === -1) throw new Error('Unknown area ' + area);
    TOPICS[area] = generator;
  }

  function generateOnce(operation, year) {
    assertYear(year);
    if (operation === 'multiply') return generateMultiplication(year);
    if (operation === 'divide') return generateDivision(year);
    if (operation === 'add') return generateAddition(year);
    if (operation === 'subtract') return generateSubtraction(year);
    if (TOPICS[operation]) return TOPICS[operation](year);
    throw new Error('Unknown operation: ' + operation);
  }

  // How much a round asks of the child: its key presses, plus decimal
  // places, which make a sum harder without adding many presses.
  function effort(problem) {
    return roundInputs(problem) + 2 * (problem.places || 0) + (problem.hardness || 0);
  }

  // A mixed test can lean easy or hard: the easiest or hardest of three
  // problems from the same area and year. Medium takes the first.
  function generateProblem(operation, year, difficulty) {
    if (!difficulty || difficulty === 'medium') return generateOnce(operation, year);
    const candidates = [0, 1, 2].map(function () { return generateOnce(operation, year); });
    candidates.sort(function (a, b) { return effort(a) - effort(b); });
    return difficulty === 'easy' ? candidates[0] : candidates[candidates.length - 1];
  }

  /* Tutorials: worked examples, one for each layout a year uses */

  const TUTORIAL_SAMPLES = 600;

  // The kinds of step a worked example can show: each decision both ways
  // (something to carry and nothing to carry), bringing down, exchanging
  // across a zero, crossing out, a carry written in front, and a remainder.
  function teachingFeatures(problem) {
    const seen = {};
    problem.actions.forEach(function (action) {
      if (action.choice) {
        seen[action.choice + (action.value === MINUS || action.value > 0 ? ' yes' : ' no')] = true;
      }
      if (action.kind === 'bringdown') seen.bringdown = true;
      if (action.alsoFill && action.alsoFill.length) seen.acrossZero = true;
      if (action.crossCellId) seen.crossOut = true;
      if (action.isLeadingCarry) seen.carryInFront = true;
    });
    const hasRemainder = problem.rows.some(function (row) {
      return (row.cells || []).some(function (cell) { return cell && cell.remainderLabel; });
    });
    if (hasRemainder) seen.remainder = true;
    return Object.keys(seen).length;
  }

  // One example per layout the year uses (column addition, short division and
  // so on), each the one that shows the most kinds of step in the fewest
  // steps, shortest layout first. Among equals, two steps beat one, so a
  // fact shows a two-digit answer rather than 2 rows of 2. A kind that
  // teaches an idea gets two different examples, one after the other, so a
  // symbol is seen standing for two different numbers.
  function tutorialProblems(operation, year) {
    assertYear(year);
    const best = {};
    for (let i = 0; i < TUTORIAL_SAMPLES; i++) {
      const problem = generateProblem(operation, year);
      const steps = problem.actions.length;
      const score = teachingFeatures(problem) * 100 + Math.min(steps, 2) * 10 - steps;
      const group = best[problem.title] || (best[problem.title] = { want: 1, list: [] });
      group.want = Math.max(group.want, problem.examples || 1);
      // Two examples of a kind must differ in their numbers (or, for a
      // drawing, in what is drawn), not only in wording.
      const content = function (p) { return p.method === 'draw' ? JSON.stringify(p.target) : p.line; };
      if (group.list.some(function (entry) {
        return entry.problem.question === problem.question && content(entry.problem) === content(problem);
      })) continue;
      group.list.push({ problem: problem, score: score });
      // Best first; among equals the one found first stays ahead.
      group.list.sort(function (a, b) { return b.score - a.score; });
      if (group.list.length > group.want) group.list.length = group.want;
    }
    return Object.keys(best).map(function (title) {
      return best[title].list.map(function (entry) { return entry.problem; })
        .sort(function (a, b) { return a.actions.length - b.actions.length; });
    }).sort(function (a, b) { return a[0].actions.length - b[0].actions.length; })
      .reduce(function (all, group) { return all.concat(group); }, []);
  }

  /* Test mode */

  // The finished sheet: what every box holds once the method is complete and
  // which given digits end up crossed out. Test mode marks only the boxes in
  // `markRowIds` and shows the rest as the proper working after a hand-in.
  function solutionOf(problem) {
    const values = {};
    const crossed = [];
    problem.actions.forEach(function (action) {
      if (action.shown !== undefined) {
        if (action.shown !== null) values[action.cellId] = action.shown;
      } else if (action.kind === 'digit' || action.kind === 'bringdown' || action.kind === 'compare') {
        values[action.cellId] = String(action.value);
      }
      if (action.kind === 'sign') values[action.cellId] = action.value === MINUS ? MINUS : '';
      if (action.crossCellId) crossed.push(action.crossCellId);
      (action.alsoFill || []).forEach(function (fill) {
        values[fill.cellId] = String(fill.value);
        if (fill.crossCellId) crossed.push(fill.crossCellId);
      });
    });
    return { values: values, crossed: crossed };
  }

  /* Year checks */

  // Key presses a round needs: every digit, including a 0 at a small box,
  // each <, > or =, and the minus key. A positive sign box is answered by
  // the first digit, so it adds none.
  function roundInputs(problem) {
    // A drawing counts each thing drawn: a hand, a point, a bar, an angle.
    if (problem.method === 'draw') return problem.inputs;
    return problem.actions.filter(function (action) {
      if (action.kind === 'digit' || action.kind === 'compare') return true;
      return action.kind === 'sign' && action.value === MINUS;
    }).length;
  }

  // Clean rounds in a row a check needs, by how long a round is. The
  // average is taken to one decimal so a year sitting on a boundary does not
  // flip with sampling.
  function cleanRoundsForInputs(inputs) {
    const rounded = Math.round(inputs * 10) / 10;
    if (rounded < 5) return 10;
    if (rounded <= 15) return 5;
    return 3;
  }

  // Measured from 20,000 generated rounds per area and year; average key
  // presses per round are in the comments. The engine check re-measures and
  // must agree, so change this table only together with the generators.
  const CLEAN_ROUNDS = {
    // 1.2, 1.3, 2.3, 4.5, 7.1, 12.6, 11.9
    divide: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 5, 6: 5, 7: 5 },
    // 1.9, 1.7, 3.7, 6.3, 17.3, 22.0, 28.6
    multiply: { 1: 10, 2: 10, 3: 10, 4: 5, 5: 3, 6: 3, 7: 3 },
    // 1.7, 3.3, 5.2, 6.4, 6.8, 7.7, 8.8
    add: { 1: 10, 2: 10, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5 },
    // 1.4, 4.2, 6.4, 8.1, 8.6, 9.5, 11.1
    subtract: { 1: 10, 2: 10, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5 },
    // The six topic areas are all short sentences: 1.0 to 3.1 presses.
    number: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10 },
    fractions: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10 },
    measures: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10 },
    shape: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10 },
    data: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10 },
    algebra: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10 },
    // Word problems: 1.4, 2.6, 4.3, 11.9, 7.5, 10.3, 7.3 (working lines
    // count while learning).
    words: { 1: 10, 2: 10, 3: 10, 4: 5, 5: 5, 6: 5, 7: 5 }
  };

  function cleanRounds(area, year) {
    return CLEAN_ROUNDS[area][year];
  }

  // A short code for what the generators make. A saved mixed test keeps
  // only its seed and rebuilds its questions, so it can be trusted only
  // while this code is the same as when it was started.
  let fingerprintCache = null;

  function fingerprint() {
    if (fingerprintCache) return fingerprintCache;
    let text = '';
    withSeed(20261115, function () {
      AREAS.forEach(function (area) {
        YEARS.forEach(function (year) {
          const problem = generateProblem(area, year);
          text += area + year + problem.question + JSON.stringify(problem.answer) + '|';
        });
      });
    });
    let hash = 5381;
    for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
    fingerprintCache = hash.toString(36);
    return fingerprintCache;
  }

  return {
    YEARS: YEARS,
    AREAS: AREAS,
    MINUS: MINUS,
    CHOICE: CHOICE,
    COUNTING_STEPS: COUNTING_STEPS,
    FACT_TABLES: FACT_TABLES,
    ALL_TABLES: ALL_TABLES,
    MAX_DECIMAL_PLACES: MAX_DECIMAL_PLACES,
    CLEAN_ROUNDS: CLEAN_ROUNDS,
    cleanRounds: cleanRounds,
    fingerprint: fingerprint,
    cleanRoundsForInputs: cleanRoundsForInputs,
    roundInputs: roundInputs,
    effort: effort,
    solutionOf: solutionOf,
    generateProblem: generateProblem,
    tutorialProblems: tutorialProblems,
    withSeed: withSeed,
    addArea: addArea,
    // Shared with topics.js, which builds the other six areas.
    kit: {
      randInt: randInt,
      pick: pick,
      shuffle: shuffle,
      weighted: weighted,
      gcd: gcd,
      roundTo: roundTo,
      grouped: grouped,
      decimalText: decimalText,
      parseDecimal: parseDecimal,
      scaleTo: scaleTo,
      compareDecimals: compareDecimals,
      randomDecimal: randomDecimal,
      digitsNumber: digitsNumber,
      placeName: placeName,
      signed: signed,
      fill: fill,
      buildSentence: buildSentence,
      buildSentenceLines: buildSentenceLines
    },
    buildDecimalAddition: buildDecimalAddition,
    buildDecimalSubtraction: buildDecimalSubtraction,
    buildDecimalMultiplication: buildDecimalMultiplication,
    buildDecimalDivision: buildDecimalDivision,
    buildSentence: buildSentence,
    buildSentenceLines: buildSentenceLines,
    generateMultiplication: generateMultiplication,
    generateDivision: generateDivision,
    generateAddition: generateAddition,
    generateSubtraction: generateSubtraction,
    buildPicture: buildPicture,
    buildFact: buildFact,
    buildSumSentence: buildSumSentence,
    buildAddition: buildAddition,
    buildSubtraction: buildSubtraction,
    buildMultiplication: buildMultiplication,
    buildDivision: buildDivision,
    buildShortDivision: buildShortDivision,
    exchangesAcrossZero: exchangesAcrossZero,
    subtractionNeedsExchange: subtractionNeedsExchange,
    toDigits: toDigits
  };
});
