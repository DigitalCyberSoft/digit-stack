/*
 * Digit Stack arithmetic engine.
 *
 * Builds fully rendered written-method layouts as plain data: rows, cells,
 * and an ordered list of actions. The UI layer only has to draw the rows and
 * walk the actions.
 *
 * Problem sets follow the national curriculum in England, Years 1 to 7.
 * Years 1 and 2 use pictures and number sentences. From Year 3 the layouts
 * follow its Mathematics Appendix 1: columnar addition, columnar subtraction
 * by crossing out, short and long multiplication, short division for
 * one-digit divisors, and long division for longer divisors.
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
  if (typeof module === 'object' && module.exports) module.exports = api;
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

  const YEARS = [1, 2, 3, 4, 5, 6, 7];
  const AREAS = ['divide', 'multiply', 'add', 'subtract'];
  const MINUS = '−';

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

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(list) {
    return list[randInt(0, list.length - 1)];
  }

  function toDigits(value) {
    return String(value).split('').map(Number);
  }

  function placeName(digitsFromRight) {
    return PLACES[digitsFromRight] || 'next';
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

  function makeColumnGroup(placeIndex) {
    return { id: 'col-' + placeIndex, label: placeName(placeIndex), short: placeName(placeIndex) };
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

  function buildMultiplication(a, b, year) {
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
              ? 'Multiply ' + a + ' by ' + bDigit + '. Start on the right.'
              : 'Now multiply ' + a + ' by ' + (bDigit * Math.pow(10, j)) + '. ' +
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
  function buildAddition(a, b, year) {
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
      groups.push(makeColumnGroup(placeIndex));
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
          prompt: 'Add the ones. Start on the right.',
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
  function buildSubtraction(a, b, year) {
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
      groups.push(makeColumnGroup(placeIndex));
      const cellId = 'diff-c' + col;
      const choicePrompt = (col === width - 1 ? 'Subtract the ones: ' : 'Next column: ') +
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
          const place = placeName(width - 1 - g);
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
        prompt: 'Now subtract the ' + placeName(placeIndex) + '.',
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

  function divideAction(step, divisor, n, groupId, lead) {
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
        'Type the ' + placeName(n - 1 - step.pos) + ' digit of the answer.',
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

  function buildDivision(dividend, divisor, year) {
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

      actions.push(divideAction(step, divisor, n, groupId, lead));

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
  function buildShortDivision(dividend, divisor, year) {
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
      const divide = divideAction(step, divisor, n, groupId, lead);
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
      const table = FACT_TABLES.indexOf(b) !== -1 ? b : a;
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

  // Years 5 to 7: answers below zero, as number sentences with a sign box.
  function negativeSentence(area, year) {
    const op = area === 'add' ? '+' : MINUS;
    for (let attempt = 0; attempt < 5000; attempt++) {
      let terms;
      let brackets = false;
      if (year === 5 || year === 6) {
        const limit = year === 5 ? 20 : 100;
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
   * Multiply and Divide:
   *  Year 1: counting rows of 2, 5 or 10 dots up to 100, sharing and
   *          grouping; plus Year 2 facts for the 2, 5 and 10 tables.
   *  Year 2: 2, 5 and 10 tables plus Year 3's 3, 4 and 8, with missing
   *          numbers.
   *  Year 3: two- and three-digit numbers by a one-digit number; short
   *          division with exact answers.
   *  Year 4: up to 4 digits by one digit, long multiplication for two-digit
   *          numbers, short division with remainders.
   *  Year 5: up to 4 digits by two digits; 4-digit short division; long
   *          division by two digits.
   *  Year 6: 4-digit by 2-digit and 3-digit multipliers, long division of
   *          4- and 5-digit numbers (key stage 3: integers of any size).
   *  Year 7: up to 5 digits by 3 digits; long division by 2- and 3-digit
   *          divisors.
   * Add and Subtract:
   *  Year 1: sentences: facts to 20, a 2-digit number and 1s, 10s or
   *          another 2-digit number, three 1-digit numbers, missing numbers
   *          such as 7 = ? - 9.
   *  Year 2: sentences with 3-digit numbers and 1s, 10s or 100s, missing
   *          numbers; plus 2- and 3-digit columns.
   *  Years 3 to 7: columns of 3-4, 4-5, 5-6, 6 and 6-7 digits. About 1 in
   *          4 subtractions exchange across a zero. From Year 5, about 1 in
   *          3 problems are sentences with answers below zero.
   * Every written layout stays within 8 columns and every sentence within 11
   * cells, so a phone screen fits.
   */
  function generateMultiplication(year) {
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

  function generateDivision(year) {
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

  function generateAddition(year) {
    assertYear(year);
    if (year === 1) return sentence('add', 1);
    if (year === 2) return randInt(0, 1) ? sentence('add', 2) : columnAddition(2);
    if (year >= 5 && randInt(0, 2) === 0) return negativeSentence('add', year);
    return columnAddition(year);
  }

  function generateSubtraction(year) {
    assertYear(year);
    if (year === 1) return sentence('subtract', 1);
    if (year === 2) return randInt(0, 1) ? sentence('subtract', 2) : columnSubtraction(2);
    if (year >= 5 && randInt(0, 2) === 0) return negativeSentence('subtract', year);
    return columnSubtraction(year);
  }

  function generateProblem(operation, year) {
    if (operation === 'multiply') return generateMultiplication(year);
    if (operation === 'divide') return generateDivision(year);
    if (operation === 'add') return generateAddition(year);
    if (operation === 'subtract') return generateSubtraction(year);
    throw new Error('Unknown operation: ' + operation);
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
      } else if (action.kind === 'digit' || action.kind === 'bringdown') {
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
  // and the minus key. A positive sign box is answered by the first digit,
  // so it adds none.
  function roundInputs(problem) {
    return problem.actions.filter(function (action) {
      if (action.kind === 'digit') return true;
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
    // 1.2, 1.3, 3.0, 5.8, 9.4, 17.3, 16.6
    divide: { 1: 10, 2: 10, 3: 10, 4: 5, 5: 5, 6: 3, 7: 3 },
    // 1.9, 1.7, 5.0, 10.7, 23.2, 29.1, 39.9
    multiply: { 1: 10, 2: 10, 3: 5, 4: 5, 5: 3, 6: 3, 7: 3 },
    // 1.7, 3.3, 6.3, 8.3, 7.5, 8.3, 8.8
    add: { 1: 10, 2: 10, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5 },
    // 1.4, 4.2, 8.1, 10.6, 9.6, 10.6, 10.9
    subtract: { 1: 10, 2: 10, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5 }
  };

  function cleanRounds(area, year) {
    return CLEAN_ROUNDS[area][year];
  }

  return {
    YEARS: YEARS,
    AREAS: AREAS,
    MINUS: MINUS,
    CHOICE: CHOICE,
    COUNTING_STEPS: COUNTING_STEPS,
    FACT_TABLES: FACT_TABLES,
    CLEAN_ROUNDS: CLEAN_ROUNDS,
    cleanRounds: cleanRounds,
    cleanRoundsForInputs: cleanRoundsForInputs,
    roundInputs: roundInputs,
    solutionOf: solutionOf,
    generateProblem: generateProblem,
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
