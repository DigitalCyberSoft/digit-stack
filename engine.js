/*
 * Digit Stack arithmetic engine.
 *
 * Builds fully rendered long multiplication and long division layouts as
 * plain data: rows, cells, and an ordered list of actions. The UI layer
 * only has to draw the rows and walk the actions.
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

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

  function buildMultiplication(a, b, stage) {
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

    const aCells = new Array(width).fill(null);
    for (let i = 0; i < m; i++) {
      const col = width - m + i;
      aCells[col] = givenCell('a', col, aDigits[i]);
    }
    rows.push({ id: 'a', kind: 'operand', cells: aCells, gutter: '' });

    const bCells = new Array(width).fill(null);
    for (let i = 0; i < n; i++) {
      const col = width - n + i;
      bCells[col] = givenCell('b', col, bDigits[i]);
    }
    rows.push({ id: 'b', kind: 'operand', cells: bCells, gutter: '×', isOperator: true });

    rows.push({ id: 'rule-top', kind: 'rule', thick: true, lineStart: 0, lineEnd: width - 1 });

    for (let j = 0; j < n; j++) {
      const bDigit = bDigits[n - 1 - j];
      const partialValue = a * bDigit;
      const partialDigits = toDigits(partialValue);
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

      const groupId = 'row-' + (j + 1);
      groups.push(makeMultiplyGroup(j + 1));

      let carry = 0;
      for (let i = 0; i < m; i++) {
        const aDigit = aDigits[m - 1 - i];
        const col = end - i;
        const total = aDigit * bDigit + carry;
        const digit = total % 10;
        const nextCarry = Math.floor(total / 10);
        const isFirst = i === 0;
        const isLast = i === m - 1;
        const carryPhrase = carry ? ' plus the carry' : '';

        actions.push({
          kind: 'digit',
          cellId: rowId + '-c' + col,
          rowId: rowId,
          groupId: groupId,
          value: digit,
          stage: 'MULTIPLY',
          prompt: isFirst
            ? 'Multiply ' + a + ' by ' + bDigit + '. Start on the right.'
            : 'Keep going. Type the next digit.',
          subprompt: isFirst
            ? 'Row ' + (j + 1) + '. What is ' + aDigit + ' × ' + bDigit + '?'
            : 'What is ' + aDigit + ' × ' + bDigit + carryPhrase + '?',
          why:
            aDigit + ' × ' + bDigit + (carry ? ' + ' + carry : '') + ' = ' + total +
            '. Write ' + digit + (nextCarry ? ', carry ' + nextCarry : '') + '.',
          carryIn: carry,
          carryOut: nextCarry
        });

        if (!isLast && nextCarry > 0) {
          const carryCol = col - 1;
          carryCells[carryCol] = carryCell(carryRowId, carryCol, nextCarry, {
            targetRowId: rowId
          });
          actions.push({
            kind: 'carry',
            cellId: carryRowId + '-c' + carryCol,
            rowId: carryRowId,
            groupId: groupId,
            value: nextCarry,
            targetCellId: rowId + '-c' + carryCol,
            targetRowId: rowId,
            stage: 'CARRY',
            prompt: 'Carry ' + nextCarry + ' to the next column.',
            subprompt: 'Press Space or Enter to lift it into place.',
            why: 'The carry is ' + nextCarry + '. It belongs above the next column.'
          });
        } else if (isLast && nextCarry > 0) {
          const leadCol = col - 1;
          actions.push({
            kind: 'digit',
            cellId: rowId + '-c' + leadCol,
            rowId: rowId,
            groupId: groupId,
            value: nextCarry,
            stage: 'MULTIPLY',
            isLeadingCarry: true,
            prompt: 'The last column leaves a carry. Write it as the first digit.',
            subprompt: 'Type the digit you carried out of the last multiplication.',
            why: 'The last carry is ' + nextCarry + '. It becomes the first digit of row ' + (j + 1) + '.'
          });
        }
        carry = nextCarry;
      }

      if (carryCells.some(Boolean)) {
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
        return cell ? cell.value : 0;
      }));
    }

    if (n > 1) {
      rows.push({ id: 'rule-sum', kind: 'rule', thick: true, lineStart: 0, lineEnd: width - 1 });

      const sumRowId = 'sum';
      const sumCarryId = 'sumc';
      const sumCells = new Array(width).fill(null);
      const sumCarryCells = new Array(width).fill(null);
      const groupId = 'row-sum';
      groups.push({ id: groupId, label: 'sum', short: 'sum' });

      let carry = 0;
      for (let col = width - 1; col >= 0; col--) {
        const parts = partialGrids.map(function (grid) { return grid[col] || 0; });
        const total = parts.reduce(function (sum, value) { return sum + value; }, 0) + carry;
        const digit = total % 10;
        const nextCarry = Math.floor(total / 10);
        sumCells[col] = inputCell(sumRowId, col, digit);
        const isFirst = col === width - 1;
        const expression = parts.join(' + ') + (carry ? ' + ' + carry : '');

        actions.push({
          kind: 'digit',
          cellId: sumRowId + '-c' + col,
          rowId: sumRowId,
          groupId: groupId,
          value: digit,
          stage: 'ADD',
          prompt: isFirst ? 'Add the rows. Start on the right.' : 'Add this column.',
          subprompt: expression + ' = ?',
          why: expression + ' = ' + total + '. Write ' + digit +
            (nextCarry ? ', carry ' + nextCarry : '') + '.',
          carryIn: carry,
          carryOut: nextCarry
        });

        if (col > 0 && nextCarry > 0) {
          const carryCol = col - 1;
          sumCarryCells[carryCol] = carryCell(sumCarryId, carryCol, nextCarry, {
            targetRowId: sumRowId
          });
          actions.push({
            kind: 'carry',
            cellId: sumCarryId + '-c' + carryCol,
            rowId: sumCarryId,
            groupId: groupId,
            value: nextCarry,
            targetCellId: sumRowId + '-c' + carryCol,
            targetRowId: sumRowId,
            stage: 'CARRY',
            prompt: 'Carry ' + nextCarry + ' to the next column.',
            subprompt: 'Press Space or Enter to lift it into place.',
            why: 'The carry is ' + nextCarry + '. It belongs above the next column.'
          });
        }
        if (col === 0 && nextCarry > 0) {
          throw new Error('Sum layout overflow');
        }
        carry = nextCarry;
      }

      if (sumCarryCells.some(Boolean)) {
        rows.push({ id: sumCarryId, kind: 'carry', cells: sumCarryCells, targetRowId: sumRowId });
      }
      rows.push({
        id: sumRowId,
        kind: 'sum',
        cells: sumCells,
        groupId: groupId,
        label: 'sum'
      });
    }

    const answerRowIds = n > 1 ? ['sum'] : ['p0'];

    return {
      operation: 'multiply',
      stage: stage,
      title: 'Long multiplication',
      operands: { a: a, b: b },
      width: width,
      rows: rows,
      actions: actions,
      groups: groups,
      answerRowIds: answerRowIds,
      answer: {
        value: product,
        expression: a + ' × ' + b + ' = ' + product
      },
      meta: {
        carries: actions.filter(function (action) { return action.kind === 'carry'; }).length,
        digits: actions.filter(function (action) { return action.kind === 'digit'; }).length
      }
    };
  }

  function subtractionNeedsBorrow(minuend, subtrahend) {
    const top = toDigits(minuend);
    const bottom = toDigits(subtrahend);
    const length = Math.max(top.length, bottom.length);
    let borrow = 0;
    let needed = false;
    for (let i = 1; i <= length; i++) {
      const topDigit = (top[top.length - i] || 0) - borrow;
      const bottomDigit = bottom[bottom.length - i] || 0;
      if (topDigit < bottomDigit) {
        borrow = 1;
        needed = true;
      } else {
        borrow = 0;
      }
    }
    return needed;
  }

  function buildDivision(dividend, divisor, stage) {
    const dividendDigits = toDigits(dividend);
    const n = dividendDigits.length;
    if (dividend < divisor) throw new Error('Dividend must be at least the divisor');

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
        needsBorrow: subtractionNeedsBorrow(partial, product)
      });
      remainder = difference;
    }

    const width = n;
    const rows = [];
    const actions = [];
    const groups = [];

    const quotientCells = new Array(width).fill(null);
    for (let i = 0; i < steps.length; i++) {
      quotientCells[steps[i].pos] = inputCell('q', steps[i].pos, steps[i].quotientDigit, {
        step: steps[i].index
      });
    }
    rows.push({ id: 'q', kind: 'quotient', cells: quotientCells });

    rows.push({
      id: 'bracket',
      kind: 'rule',
      thick: true,
      lineStart: 0,
      lineEnd: width - 1,
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

      actions.push({
        kind: 'digit',
        cellId: 'q-c' + step.pos,
        rowId: 'q',
        groupId: groupId,
        stepIndex: step.index,
        value: step.quotientDigit,
        stage: 'DIVIDE',
        prompt: 'How many times does ' + divisor + ' fit into ' + step.partial + '?',
        subprompt: 'Type the ' + placeName(width - 1 - step.pos) + ' digit of the quotient.',
        why:
          divisor + ' × ' + step.quotientDigit + ' = ' + step.product +
          ', which fits in ' + step.partial + '. ' +
          divisor + ' × ' + (step.quotientDigit + 1) + ' = ' +
          (divisor * (step.quotientDigit + 1)) + ', which is too big.'
      });

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
        gutter: '−',
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
            ? 'Multiply ' + step.quotientDigit + ' × ' + divisor + '. Start on the right.'
            : 'Keep going. Type the next digit.',
          subprompt: isFirst
            ? 'Write the product under ' + step.partial + '.'
            : 'Type the next digit of the product.',
          why: step.quotientDigit + ' × ' + divisor + ' = ' + step.product + '.'
        });
      }

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
            : 'Keep subtracting. Type the next digit.',
          subprompt: isFirst
            ? (step.needsBorrow
              ? 'Start on the right. You will need to borrow.'
              : 'Start on the right.')
            : 'Type the next digit.',
          why:
            step.partial + ' − ' + step.product + ' = ' + step.difference + '.' +
            (step.needsBorrow ? ' This subtraction needs a borrow.' : '')
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

    const quotient = Number(steps.map(function (step) { return step.quotientDigit; }).join(''));
    const finalRemainder = steps[steps.length - 1].difference;
    const lastDifferenceRowId = 'd' + steps[steps.length - 1].index;
    const answerRowIds = ['q', lastDifferenceRowId];

    return {
      operation: 'divide',
      stage: stage,
      title: 'Long division',
      operands: { dividend: dividend, divisor: divisor },
      width: width,
      rows: rows,
      actions: actions,
      groups: groups,
      answerRowIds: answerRowIds,
      answer: {
        value: quotient,
        quotient: quotient,
        remainder: finalRemainder,
        expression: dividend + ' ÷ ' + divisor + ' = ' + quotient +
          (finalRemainder ? ' R ' + finalRemainder : '')
      },
      steps: steps.map(function (step) {
        return {
          index: step.index,
          pos: step.pos,
          partial: step.partial,
          quotientDigit: step.quotientDigit,
          product: step.product,
          difference: step.difference,
          bringdown: step.bringdown,
          needsBorrow: step.needsBorrow
        };
      }),
      meta: {
        steps: steps.length,
        digits: actions.filter(function (action) { return action.kind === 'digit'; }).length
      }
    };
  }

  const DIVISION_STEPS_BY_STAGE = { 1: 1, 2: 2, 3: 3, 4: 4 };

  function validateDivisionProblem(problem, stage) {
    const expectedSteps = DIVISION_STEPS_BY_STAGE[stage];
    if (!problem.steps || problem.steps.length !== expectedSteps) return false;
    for (let i = 0; i < problem.steps.length; i++) {
      const step = problem.steps[i];
      if (step.quotientDigit < 0 || step.quotientDigit > 9) return false;
      if (step.product > step.partial) return false;
    }
    return true;
  }

  function hasCarry(problem) {
    return problem.actions.some(function (action) { return action.kind === 'carry'; });
  }

  function assertStage(stage) {
    if ([1, 2, 3, 4].indexOf(stage) === -1) {
      throw new Error('Unknown stage: ' + stage);
    }
  }

  function generateMultiplication(stage) {
    assertStage(stage);
    for (let attempt = 0; attempt < 3000; attempt++) {
      let a;
      let b;
      if (stage === 1) {
        a = randInt(2, 9);
        b = randInt(2, 9);
      } else if (stage === 2) {
        a = randInt(10, 99);
        b = randInt(2, 9);
      } else if (stage === 3) {
        a = randInt(100, 999);
        b = randInt(2, 9);
      } else {
        a = randInt(1000, 9999);
        b = randInt(2, 9);
      }
      const problem = buildMultiplication(a, b, stage);
      // Only the multiplicand grows. Stage one has a single multiplier
      // digit, so a carry out becomes the leading answer digit instead of a
      // separate carry action.
      if (stage === 1) return problem;
      if (hasCarry(problem)) return problem;
    }
    if (stage === 1) return buildMultiplication(4, 3, stage);
    if (stage === 2) return buildMultiplication(47, 6, stage);
    if (stage === 3) return buildMultiplication(347, 6, stage);
    return buildMultiplication(2048, 6, stage);
  }

  function generateDivision(stage) {
    assertStage(stage);
    for (let attempt = 0; attempt < 5000; attempt++) {
      let dividend;
      let divisor;
      if (stage === 1) {
        dividend = randInt(2, 9);
        divisor = randInt(2, dividend);
      } else if (stage === 2) {
        divisor = randInt(2, 9);
        dividend = randInt(10, 99);
        // One new dividend digit per stage. Requiring the first digit to
        // hold the divisor keeps one quotient digit per dividend column.
        if (Math.floor(dividend / 10) < divisor) continue;
      } else if (stage === 3) {
        divisor = randInt(2, 9);
        dividend = randInt(100, 999);
        if (Math.floor(dividend / 100) < divisor) continue;
      } else {
        divisor = randInt(2, 9);
        dividend = randInt(1000, 9999);
        if (Math.floor(dividend / 1000) < divisor) continue;
      }
      if (dividend < divisor) continue;
      const problem = buildDivision(dividend, divisor, stage);
      if (!validateDivisionProblem(problem, stage)) continue;
      return problem;
    }
    if (stage === 1) return buildDivision(8, 3, stage);
    if (stage === 2) return buildDivision(84, 3, stage);
    if (stage === 3) return buildDivision(204, 2, stage);
    return buildDivision(2048, 2, stage);
  }

  function generateProblem(operation, stage) {
    if (operation === 'multiply') return generateMultiplication(stage);
    if (operation === 'divide') return generateDivision(stage);
    throw new Error('Unknown operation: ' + operation);
  }

  return {
    generateProblem: generateProblem,
    generateMultiplication: generateMultiplication,
    generateDivision: generateDivision,
    buildMultiplication: buildMultiplication,
    buildDivision: buildDivision,
    subtractionNeedsBorrow: subtractionNeedsBorrow,
    toDigits: toDigits
  };
});
