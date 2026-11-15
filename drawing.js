/*
 * Digit Stack drawing: questions answered by drawing on a board with the
 * keyboard, as the national curriculum in England asks for (programmes of
 * study, gov.uk, updated 28 September 2021): drawing the hands on a clock
 * face (Years 1 and 2), shading fractions, marking numbers on number lines
 * and thermometers, drawing lines with a ruler, drawing 2-D shapes and
 * plotting points (Years 3 and 4), completing a symmetric figure (Year 4),
 * translating and reflecting shapes (Years 4 to 6), rotating them (key
 * stage 3), drawing given angles (Year 5), drawing a triangle from given
 * angles (Year 6), making nets (Year 6), and constructing tally charts,
 * pictograms, bar charts, line graphs (Years 2 to 6) and pie charts (Year 6).
 *
 * Every board's state is plain data and every key's effect is a pure
 * function of it, so the game and the checks in Node run the same code.
 * Arrows move or turn; Space marks, places or shades; Backspace undoes;
 * Enter says the drawing is finished.
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
  const decimalText = K.decimalText;

  function int(n) {
    return n < 0 ? MINUS + Math.abs(n) : String(n);
  }

  function plural(count, one, many) {
    return count + ' ' + (count === 1 ? one : (many || one + 's'));
  }

  function repeat(key, times) {
    const keys = [];
    for (let k = 0; k < times; k++) keys.push(key);
    return keys;
  }

  /* A drawing problem. The board is fixed data; each step is one thing to
     draw, checked in learning when Enter is pressed (or as a point is
     placed); the target is the finished drawing. */
  function problem(spec) {
    const steps = spec.steps;
    return {
      operation: spec.area,
      method: 'draw',
      year: spec.year,
      title: spec.title,
      kind: spec.kind || null,
      question: spec.question,
      board: spec.board,
      steps: steps,
      target: spec.target,
      rows: [],
      width: 0,
      noGutter: true,
      actions: steps.map(function (step, k) {
        return { kind: 'draw', step: k, groupId: 'answer', stage: spec.stage || 'DRAW', prompt: step.prompt, subprompt: step.sub, why: step.why };
      }),
      groups: [{ id: 'answer', label: 'drawing', short: 'drawing' }],
      groupWord: null,
      markRowIds: [],
      answerRowIds: [],
      answer: { value: spec.answer, expression: spec.answer },
      check: spec.check,
      inputs: spec.inputs,
      hardness: spec.hardness || 0,
      examples: spec.examples || 1,
      picture: null
    };
  }

  const TOOLS = {};

  /* Clock: geared hands, as on a teaching clock. Up and down move an hour,
     left and right move the minute hand (and the hour hand with it). */

  function timeWords(minutes) {
    const h = Math.floor(minutes / 60) || 12;
    const m = minutes % 60;
    const next = h % 12 + 1;
    if (m === 0) return h + " o'clock";
    if (m === 30) return 'half past ' + h;
    if (m === 15) return 'quarter past ' + h;
    if (m === 45) return 'quarter to ' + next;
    if (m < 30) return (m % 5 === 0 ? m : plural(m, 'minute')) + ' past ' + h;
    return (m % 5 === 0 ? 60 - m : plural(60 - m, 'minute')) + ' to ' + next;
  }

  function minuteHand(m) {
    if (m === 0) return 'on the 12';
    if (m % 5 === 0) return 'on the ' + (m / 5);
    return plural(m % 5, 'minute') + ' past the ' + (Math.floor(m / 5) || 12);
  }

  function hourHand(minutes) {
    const h = Math.floor(minutes / 60) || 12;
    const m = minutes % 60;
    const next = h % 12 + 1;
    if (m === 0) return 'on the ' + h;
    if (m === 30) return 'halfway between the ' + h + ' and the ' + next;
    return (m < 30 ? 'just past the ' + h : 'nearly at the ' + next);
  }

  TOOLS.clock = {
    start: function () { return { minutes: 0 }; },
    valid: function (p, s) { return Number.isInteger(s.minutes) && s.minutes >= 0 && s.minutes < 720 && s.minutes % p.board.step === 0; },
    press: function (p, s, key) {
      const moves = { ArrowRight: p.board.step, ArrowLeft: -p.board.step, ArrowUp: 60, ArrowDown: -60 };
      if (moves[key] === undefined) return null;
      return { state: { minutes: (((s.minutes + moves[key]) % 720) + 720) % 720 }, event: 'move' };
    },
    check: function (p, s) {
      const want = p.target.minutes;
      if (s.minutes === want) return null;
      return 'Your clock shows ' + timeWords(s.minutes) + '. ' + timeWords(want).replace(/^./, function (c) { return c.toUpperCase(); }) +
        ' has the minute hand ' + minuteHand(want % 60) + ' and the hour hand ' + hourHand(want) + '.';
    },
    solved: function (p) { return { minutes: p.target.minutes }; },
    plan: function (p, s) {
      const d = ((p.target.minutes - s.minutes) % 720 + 720) % 720;
      return repeat('ArrowUp', Math.floor(d / 60)).concat(repeat('ArrowRight', (d % 60) / p.board.step));
    },
    touched: function (p, s) { return s.minutes !== 0; },
    describe: function (p, s) { return 'The clock shows ' + timeWords(s.minutes) + '.'; }
  };

  /* Shading: parts of a shape, squares of a grid or counters. Arrows move
     between parts, Space shades or clears the one selected. Given parts
     are already shaded and stay so. */

  function partAt(board, r, c) {
    return board.parts.find(function (part) { return part.r === r && part.c === c; }) || null;
  }

  function shadeMove(board, at, key) {
    const part = board.parts.find(function (x) { return x.id === at; });
    if (board.layout === 'circle') {
      const n = board.parts.length;
      if (key === 'ArrowRight' || key === 'ArrowDown') return (at + 1) % n;
      if (key === 'ArrowLeft' || key === 'ArrowUp') return (at + n - 1) % n;
      return null;
    }
    const d = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[key];
    if (!d) return null;
    const next = partAt(board, part.r + d[0], part.c + d[1]);
    return next ? next.id : at;
  }

  // Cube nets fold by rolling: each step across an edge tips the cube that
  // way, and the face underneath is the square's face. Six squares on six
  // different faces fold into a cube.
  function foldsToCube(cells) {
    if (cells.length !== 6) return false;
    const key = function (r, c) { return r + ',' + c; };
    const set = new Set(cells.map(function (x) { return key(x[0], x[1]); }));
    const roll = {
      east: function (o) { return { d: o.e, u: o.w, n: o.n, s: o.s, e: o.u, w: o.d }; },
      west: function (o) { return { d: o.w, u: o.e, n: o.n, s: o.s, e: o.d, w: o.u }; },
      north: function (o) { return { d: o.n, u: o.s, n: o.u, s: o.d, e: o.e, w: o.w }; },
      south: function (o) { return { d: o.s, u: o.n, n: o.d, s: o.u, e: o.e, w: o.w }; }
    };
    const seen = {};
    const first = cells[0];
    seen[key(first[0], first[1])] = { d: 0, u: 1, n: 2, s: 3, e: 4, w: 5 };
    const queue = [first];
    while (queue.length) {
      const cell = queue.shift();
      const o = seen[key(cell[0], cell[1])];
      [['east', 0, 1], ['west', 0, -1], ['north', -1, 0], ['south', 1, 0]].forEach(function (m) {
        const r = cell[0] + m[1];
        const c = cell[1] + m[2];
        if (!set.has(key(r, c)) || seen[key(r, c)]) return;
        seen[key(r, c)] = roll[m[0]](o);
        queue.push([r, c]);
      });
    }
    const faces = Object.keys(seen).map(function (k) { return seen[k].d; });
    return faces.length === 6 && new Set(faces).size === 6;
  }

  function shadedCells(p, on) {
    return on.map(function (id) {
      const part = p.board.parts.find(function (x) { return x.id === id; });
      return [part.r, part.c];
    });
  }

  function sameSet(a, b) {
    return a.length === b.length && a.every(function (x) { return b.indexOf(x) !== -1; });
  }

  // The parts to shade or clear, nearest first, and the arrows to reach each.
  function shadePath(board, from, to) {
    if (from === to) return [];
    const seen = {};
    seen[from] = [];
    const queue = [from];
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'];
    while (queue.length) {
      const at = queue.shift();
      for (let k = 0; k < keys.length; k++) {
        const next = shadeMove(board, at, keys[k]);
        if (next === null || seen[next] !== undefined) continue;
        seen[next] = seen[at].concat([keys[k]]);
        if (next === to) return seen[next];
        queue.push(next);
      }
    }
    throw new Error('No way to part ' + to);
  }

  TOOLS.shade = {
    start: function (p) {
      const first = p.board.parts.find(function (part) { return p.board.given.indexOf(part.id) === -1; });
      return { on: p.board.given.slice(), at: first.id };
    },
    valid: function (p, s) {
      const ids = p.board.parts.map(function (x) { return x.id; });
      return Array.isArray(s.on) && s.on.every(function (id) { return ids.indexOf(id) !== -1; }) && ids.indexOf(s.at) !== -1 &&
        p.board.given.every(function (id) { return s.on.indexOf(id) !== -1; });
    },
    press: function (p, s, key) {
      if (key === ' ' || key === 'Space') {
        if (p.board.given.indexOf(s.at) !== -1) return { state: s, event: 'given' };
        const on = s.on.indexOf(s.at) === -1 ? s.on.concat([s.at]) : s.on.filter(function (id) { return id !== s.at; });
        return { state: { on: on.sort(function (a, b) { return a - b; }), at: s.at }, event: 'toggle' };
      }
      const next = shadeMove(p.board, s.at, key);
      if (next === null) return null;
      return { state: { on: s.on, at: next }, event: 'move' };
    },
    check: function (p, s) {
      const b = p.board;
      if (b.mode === 'fraction') {
        const count = s.on.length;
        if (count === b.need) return null;
        return 'You have shaded ' + count + ' of the ' + b.parts.length + ' ' + b.noun + '. ' + b.fraction + ' of ' + b.parts.length + ' is ' + b.need +
          (count < b.need ? ': shade ' + (b.need - count) + ' more.' : ': clear ' + (count - b.need) + '.');
      }
      if (b.mode === 'symmetry') {
        const missing = p.target.on.filter(function (id) { return s.on.indexOf(id) === -1; }).length;
        const extra = s.on.filter(function (id) { return p.target.on.indexOf(id) === -1; }).length;
        if (!missing && !extra) return null;
        return 'Each shaded square needs a partner the same distance from the mirror line, on the other side. ' +
          (missing ? plural(missing, 'partner square is', 'partner squares are') + ' still missing' : '') +
          (missing && extra ? ', and ' : '') + (extra ? plural(extra, 'shaded square has', 'shaded squares have') + ' no partner' : '') + '.';
      }
      // A net of a cube.
      const cells = shadedCells(p, s.on);
      if (foldsToCube(cells)) return null;
      if (cells.length !== 6) return 'A cube has 6 faces, so its net has 6 squares. There are ' + cells.length + ' shaded.';
      return 'These 6 squares would not fold into a cube: folded up, two of them would land on the same face. Try another square.';
    },
    solved: function (p) { return { on: p.target.on.slice(), at: p.target.on[p.target.on.length - 1] }; },
    plan: function (p, s) {
      const toggles = p.target.on.filter(function (id) { return s.on.indexOf(id) === -1; })
        .concat(s.on.filter(function (id) { return p.target.on.indexOf(id) === -1 && p.board.given.indexOf(id) === -1; }))
        .sort(function (a, b) { return a - b; });
      let at = s.at;
      let keys = [];
      toggles.forEach(function (id) {
        keys = keys.concat(shadePath(p.board, at, id), [' ']);
        at = id;
      });
      return keys;
    },
    touched: function (p, s) { return !sameSet(s.on, p.board.given); },
    describe: function (p, s) { return s.on.length + ' of ' + p.board.parts.length + ' shaded.'; }
  };

  /* A number line, a thermometer or a ruler: arrows move the mark (or the
     end of the line) one small step; Shift with an arrow moves to the next
     labelled step. */

  function lineValue(board, at) {
    return decimalText(board.minScaled + at * board.minorScaled, board.places);
  }

  TOOLS.line = {
    start: function () { return { at: 0 }; },
    valid: function (p, s) { return Number.isInteger(s.at) && s.at >= 0 && s.at <= p.board.n; },
    press: function (p, s, key) {
      const b = p.board;
      const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1,
        'Shift+ArrowRight': b.majorEvery, 'Shift+ArrowUp': b.majorEvery, PageUp: b.majorEvery,
        'Shift+ArrowLeft': -b.majorEvery, 'Shift+ArrowDown': -b.majorEvery, PageDown: -b.majorEvery }[key];
      if (step === undefined) return null;
      return { state: { at: Math.max(0, Math.min(b.n, s.at + step)) }, event: 'move' };
    },
    check: function (p, s) {
      const b = p.board;
      const d = p.target.at - s.at;
      if (!d) return null;
      const minor = decimalText(b.minorScaled, b.places);
      if (b.kind === 'ruler') {
        return 'Your line is ' + lineValue(b, s.at) + ' ' + b.unit + ' long. It needs to be ' + lineValue(b, p.target.at) + ' ' + b.unit + ': ' +
          plural(Math.abs(d), 'small step') + (d > 0 ? ' longer' : ' shorter') + ', and each small step is ' + minor + ' ' + b.unit + ' (1 mm).';
      }
      const way = b.kind === 'thermometer' ? (d > 0 ? 'higher' : 'lower') : (d > 0 ? 'to the right' : 'to the left');
      return 'Your mark is at ' + lineValue(b, s.at).replace('-', MINUS) + (b.unit ? ' ' + b.unit : '') + '. ' + lineValue(b, p.target.at).replace('-', MINUS) +
        ' is ' + plural(Math.abs(d), 'small step') + ' ' + way + '; each small step is ' + minor + '.';
    },
    solved: function (p) { return { at: p.target.at }; },
    plan: function (p, s) {
      const d = p.target.at - s.at;
      const big = Math.floor(Math.abs(d) / p.board.majorEvery);
      const small = Math.abs(d) - big * p.board.majorEvery;
      return d > 0 ? repeat('Shift+ArrowRight', big).concat(repeat('ArrowRight', small))
        : repeat('Shift+ArrowLeft', big).concat(repeat('ArrowLeft', small));
    },
    touched: function (p, s) { return s.at !== 0; },
    describe: function (p, s) { return (p.board.kind === 'ruler' ? 'The line is ' : 'The mark is at ') + lineValue(p.board, s.at) + (p.board.unit ? ' ' + p.board.unit : '') + '.'; }
  };

  /* A grid: arrows move the pencil from point to point; Space puts a corner
     there (or takes it away again); Backspace takes away the last one. The
     corners are joined in order. */

  function samePoint(a, b) {
    return a[0] === b[0] && a[1] === b[1];
  }

  function pointText(pt, axes) {
    return axes ? '(' + int(pt[0]) + ', ' + int(pt[1]) + ')' : 'that corner';
  }

  // Corners in the same cycle, either way round.
  function sameCycle(a, b) {
    if (a.length !== b.length) return false;
    const n = a.length;
    for (let shift = 0; shift < n; shift++) {
      let forward = true;
      let backward = true;
      for (let k = 0; k < n; k++) {
        if (!samePoint(a[k], b[(shift + k) % n])) forward = false;
        if (!samePoint(a[k], b[(shift - k + n) % n])) backward = false;
      }
      if (forward || backward) return true;
    }
    return false;
  }

  // A rectangle `w` by `h` with sides along the grid lines, corners in order.
  function isRectangle(points, w, h) {
    if (points.length !== 4) return false;
    const sides = [];
    for (let k = 0; k < 4; k++) {
      const a = points[k];
      const b = points[(k + 1) % 4];
      if (a[0] !== b[0] && a[1] !== b[1]) return false;
      sides.push(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]));
    }
    for (let k = 0; k < 4; k++) {
      const a = points[k];
      const b = points[(k + 1) % 4];
      const c = points[(k + 2) % 4];
      if ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) !== 0) return false;
    }
    return sides[0] === sides[2] && sides[1] === sides[3] &&
      ((sides[0] === w && sides[1] === h) || (sides[0] === h && sides[1] === w));
  }

  TOOLS.grid = {
    start: function (p) { return { cursor: p.board.start.slice(), points: [] }; },
    valid: function (p, s) {
      const b = p.board;
      const inside = function (pt) { return Array.isArray(pt) && pt[0] >= b.xmin && pt[0] <= b.xmax && pt[1] >= b.ymin && pt[1] <= b.ymax; };
      return inside(s.cursor) && Array.isArray(s.points) && s.points.length <= b.need && s.points.every(inside);
    },
    press: function (p, s, key) {
      const b = p.board;
      const d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[key];
      if (d) {
        const x = Math.max(b.xmin, Math.min(b.xmax, s.cursor[0] + d[0]));
        const y = Math.max(b.ymin, Math.min(b.ymax, s.cursor[1] + d[1]));
        return { state: { cursor: [x, y], points: s.points }, event: 'move' };
      }
      if (key === ' ' || key === 'Space') {
        const here = s.points.findIndex(function (pt) { return samePoint(pt, s.cursor); });
        if (here !== -1) return { state: { cursor: s.cursor, points: s.points.filter(function (pt, k) { return k !== here; }) }, event: 'remove' };
        if (s.points.length >= b.need) return { state: s, event: 'full' };
        return { state: { cursor: s.cursor, points: s.points.concat([s.cursor.slice()]) }, event: 'place' };
      }
      if (key === 'Backspace' || key === 'Delete') {
        return { state: { cursor: s.cursor, points: s.points.slice(0, -1) }, event: 'remove' };
      }
      return null;
    },
    // In learning, point k is checked as it is placed.
    check: function (p, s, k) {
      const b = p.board;
      const placed = s.points[k];
      if (!placed) return 'Move the pencil and press Space to put the corner there.';
      if (b.mode === 'rectangle') {
        const prev = s.points[k - 1];
        if (k === 0) return null;
        const along = Math.abs(placed[0] - prev[0]) + Math.abs(placed[1] - prev[1]);
        const straight = placed[0] === prev[0] || placed[1] === prev[1];
        if (k === 1) {
          if (straight && (along === b.w || along === b.h)) return null;
          return 'Go straight across or up from the first corner, ' + b.w + ' or ' + b.h + ' squares, along a grid line.';
        }
        const first = s.points[0];
        const firstSide = Math.abs(s.points[1][0] - first[0]) + Math.abs(s.points[1][1] - first[1]);
        const need = firstSide === b.w ? b.h : b.w;
        const turn = (prev[0] - s.points[k - 2][0]) * (placed[0] - prev[0]) + (prev[1] - s.points[k - 2][1]) * (placed[1] - prev[1]) === 0;
        if (k === 2) {
          if (straight && turn && along === need) return null;
          return 'Turn a right angle at the last corner and go ' + need + ' squares.';
        }
        if (isRectangle(s.points, b.w, b.h)) return null;
        return 'The last corner is opposite the first, the same distance from it as the other sides.';
      }
      const want = p.target.points[k];
      if (samePoint(placed, want)) return null;
      return p.steps[k].miss + ' Your corner is at ' + pointText(placed, b.axes) + '.';
    },
    checkOn: 'place',
    mark: function (p, s) {
      const b = p.board;
      if (b.mode === 'rectangle') return isRectangle(s.points, b.w, b.h);
      if (b.mode === 'vertex') return s.points.length === 1 && samePoint(s.points[0], p.target.points[0]);
      return sameCycle(s.points, p.target.points);
    },
    solved: function (p, done) { return { cursor: (p.target.points[done - 1] || p.board.start).slice(), points: p.target.points.slice(0, done) }; },
    plan: function (p, s, k) {
      const want = p.target.points[k];
      const keys = [];
      const dx = want[0] - s.cursor[0];
      const dy = want[1] - s.cursor[1];
      return keys.concat(repeat(dx > 0 ? 'ArrowRight' : 'ArrowLeft', Math.abs(dx)), repeat(dy > 0 ? 'ArrowUp' : 'ArrowDown', Math.abs(dy)), [' ']);
    },
    touched: function (p, s) { return s.points.length > 0; },
    describe: function (p, s) {
      return s.points.length ? 'Corners at ' + s.points.map(function (pt) { return pointText(pt, true); }).join(', ') + '.' : 'No corners yet.';
    }
  };

  /* Charts: left and right pick a bar (up and down pick a row of a
     pictogram or tally chart); up and down, or left and right, change it by
     one small step of the scale. */

  function across(board) {
    return board.style === 'pictogram' || board.style === 'tally';
  }

  TOOLS.bars = {
    start: function (p) {
      const b = p.board;
      const first = b.given.findIndex(function (g) { return g === null; });
      return { values: b.given.map(function (g) { return g === null ? 0 : g; }), at: first };
    },
    valid: function (p, s) {
      const b = p.board;
      return Array.isArray(s.values) && s.values.length === b.categories.length && s.values.every(function (v, k) {
        return Number.isFinite(v) && v >= 0 && v <= b.max && (b.given[k] === null || v === b.given[k]);
      }) && Number.isInteger(s.at) && s.at >= 0 && s.at < b.categories.length;
    },
    press: function (p, s, key, ctx) {
      const b = p.board;
      const flip = across(b);
      const pickKeys = flip ? { ArrowDown: 1, ArrowUp: -1 } : { ArrowRight: 1, ArrowLeft: -1 };
      const valueKeys = flip ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowUp: 1, ArrowDown: -1 };
      // In learning the step chooses the bar.
      const guided = ctx && ctx.step !== null && ctx.step !== undefined;
      const at = guided ? p.steps[ctx.step].category : s.at;
      if (pickKeys[key] !== undefined) {
        if (guided) return { state: { values: s.values, at: at }, event: 'locked' };
        const n = b.categories.length;
        return { state: { values: s.values, at: (s.at + pickKeys[key] + n) % n }, event: 'move' };
      }
      if (valueKeys[key] !== undefined) {
        if (b.given[at] !== null) return { state: s, event: 'given' };
        const values = s.values.slice();
        values[at] = Math.max(0, Math.min(b.max, Math.round((values[at] + valueKeys[key] * b.minor) * 1000) / 1000));
        return { state: { values: values, at: at }, event: 'move' };
      }
      return null;
    },
    check: function (p, s, k) {
      const b = p.board;
      const cat = p.steps[k].category;
      const have = s.values[cat];
      const want = p.target.values[cat];
      if (have === want) return null;
      const name = b.categories[cat];
      const unit = b.style === 'pictogram' ? 'pictures' : (b.style === 'tally' ? 'marks' : 'its scale');
      const steps = Math.round(Math.abs(want - have) / b.minor);
      return name + ' is ' + want + '. Yours shows ' + have + ', ' + plural(steps, 'small step') + (want > have ? ' too few' : ' too many') +
        (b.style === 'pictogram' ? '; each picture is ' + b.key + (b.minor < b.key ? ' and half a picture is ' + b.minor : '') + '.' :
          (b.style === 'tally' ? '; each mark is 1.' : '; each small step on ' + unit + ' is ' + b.minor + '.'));
    },
    mark: function (p, s) { return s.values.every(function (v, k) { return v === p.target.values[k]; }); },
    solved: function (p, done) {
      const s = TOOLS.bars.start(p);
      p.steps.slice(0, done).forEach(function (step) { s.values[step.category] = p.target.values[step.category]; });
      s.at = done ? p.steps[done - 1].category : s.at;
      return s;
    },
    plan: function (p, s, k) {
      const b = p.board;
      const cat = p.steps[k].category;
      const flip = across(b);
      let keys = [];
      if (s.at !== cat) {
        const n = b.categories.length;
        const fwd = (cat - s.at + n) % n;
        keys = repeat(flip ? 'ArrowDown' : 'ArrowRight', fwd);
      }
      const d = Math.round((p.target.values[cat] - s.values[cat]) / b.minor);
      return keys.concat(repeat(flip ? (d > 0 ? 'ArrowRight' : 'ArrowLeft') : (d > 0 ? 'ArrowUp' : 'ArrowDown'), Math.abs(d)));
    },
    touched: function (p, s) {
      return s.values.some(function (v, k) { return p.board.given[k] === null && v !== 0; });
    },
    describe: function (p, s) {
      return p.board.categories.map(function (c, k) { return c + ' ' + s.values[k]; }).join(', ') + '.';
    }
  };

  /* Angles with a protractor, a triangle from two angles, and pie charts.
     Up makes the angle bigger and down smaller, by 1°, or by 10° with
     Shift; left and right turn the arm the way they point. */

  TOOLS.angle = {
    start: function (p) { return { angles: p.steps.map(function () { return 0; }), at: 0 }; },
    valid: function (p, s) {
      return Array.isArray(s.angles) && s.angles.length === p.steps.length && s.angles.every(function (a) { return Number.isInteger(a) && a >= 0 && a <= 360; }) &&
        Number.isInteger(s.at) && s.at >= 0 && s.at < p.steps.length;
    },
    limit: function (p, s, k) {
      if (p.board.mode === 'pie') {
        const others = s.angles.reduce(function (sum, a, j) { return j === k ? sum : sum + a; }, 0);
        return 360 - others;
      }
      if (p.board.mode === 'triangle') return 179 - s.angles.reduce(function (sum, a, j) { return j === k ? sum : sum + a; }, 0);
      return p.board.size;
    },
    press: function (p, s, key, ctx) {
      const b = p.board;
      const k = ctx && ctx.step !== null && ctx.step !== undefined ? ctx.step : s.at;
      // Which way left and right turn the arm: the arm's end moves the way the arrow points.
      const leftOpens = b.mode === 'triangle' ? k === 0 : (b.mode === 'angle' && b.base === 'right');
      const change = { ArrowUp: 1, ArrowDown: -1, 'Shift+ArrowUp': 10, 'Shift+ArrowDown': -10,
        ArrowLeft: leftOpens ? 1 : -1, ArrowRight: leftOpens ? -1 : 1,
        'Shift+ArrowLeft': leftOpens ? 10 : -10, 'Shift+ArrowRight': leftOpens ? -10 : 10 }[key];
      if (key === 'Tab' && !(ctx && ctx.guided)) {
        return { state: { angles: s.angles, at: (s.at + 1) % s.angles.length }, event: 'move' };
      }
      if (change === undefined) return null;
      const angles = s.angles.slice();
      angles[k] = Math.max(0, Math.min(TOOLS.angle.limit(p, s, k), angles[k] + change));
      return { state: { angles: angles, at: k }, event: 'move' };
    },
    check: function (p, s, k) {
      const have = s.angles[k];
      const want = p.target.angles[k];
      if (have === want) return null;
      return p.steps[k].miss.replace('{have}', have + '°') + ' ' + (want > have ? 'It needs to be ' + (want - have) + '° bigger.' : 'It needs to be ' + (have - want) + '° smaller.');
    },
    mark: function (p, s) { return s.angles.every(function (a, k) { return a === p.target.angles[k]; }); },
    solved: function (p, done) {
      return { angles: p.target.angles.map(function (a, k) { return k < done ? a : 0; }), at: Math.max(0, Math.min(done, p.steps.length - 1)) };
    },
    plan: function (p, s, k) {
      const d = p.target.angles[k] - s.angles[k];
      const tens = Math.floor(Math.abs(d) / 10);
      return repeat(d > 0 ? 'Shift+ArrowUp' : 'Shift+ArrowDown', tens).concat(repeat(d > 0 ? 'ArrowUp' : 'ArrowDown', Math.abs(d) - 10 * tens));
    },
    touched: function (p, s) { return s.angles.some(function (a) { return a !== 0; }); },
    describe: function (p, s) { return s.angles.map(function (a) { return a + '°'; }).join(', ') + '.'; }
  };

  /* The engine's side of drawing, used by the game and the checks. */

  function tool(p) {
    const t = TOOLS[p.board.tool];
    if (!t) throw new Error('No drawing tool ' + p.board.tool);
    return t;
  }

  const api = {
    problem: problem,
    timeWords: timeWords,
    foldsToCube: foldsToCube,
    start: function (p) { return tool(p).start(p); },
    valid: function (p, s) { return Boolean(s) && typeof s === 'object' && tool(p).valid(p, s); },
    press: function (p, s, key, ctx) { return tool(p).press(p, s, key, ctx || {}); },
    // Learning: null when step k is drawn right, or why it is not.
    check: function (p, s, k) { return tool(p).check(p, s, k); },
    // When a step is checked: as a point is placed, or on Enter.
    checkOn: function (p) { return tool(p).checkOn || 'enter'; },
    mark: function (p, s) {
      const t = tool(p);
      if (t.mark) return t.mark(p, s);
      return t.check(p, s, 0) === null;
    },
    // The drawing once the first `done` steps are drawn, for worked examples
    // and the proper drawing after a miss.
    solved: function (p, done) {
      const n = done === undefined ? p.steps.length : done;
      return n === 0 ? tool(p).start(p) : tool(p).solved(p, n);
    },
    // Keys that draw step k from state s.
    plan: function (p, s, k) { return tool(p).plan(p, s, k); },
    touched: function (p, s) { return tool(p).touched(p, s); },
    describe: function (p, s) { return tool(p).describe(p, s); }
  };

  Engine.drawing = api;

  /* Questions. Each returns a drawing problem for its area and year. */

  const KINDS = {};
  api.kinds = KINDS;

  // Measures, Years 1 to 3: draw the hands to show a time.
  KINDS.clock = function (year) {
    const step = year === 3 ? 1 : 5;
    let h = randInt(1, 12);
    let m;
    if (year === 1) m = pick([0, 30, 30, 15, 45]);
    else if (year === 2) m = pick([0, 15, 30, 45, 5, 10, 20, 25, 35, 40, 50, 55]);
    else m = randInt(1, 59);
    if (h === 12 && m === 0) h = randInt(1, 11);
    const minutes = (h % 12) * 60 + m;
    const words = timeWords(minutes);
    const digital = h + ':' + String(m).padStart(2, '0');
    const asDigits = year === 3 && randInt(0, 1) === 1;
    return problem({
      area: 'measures', year: year, title: 'Drawing the time', stage: 'CLOCK',
      question: 'Set the clock to ' + (asDigits ? digital : words) + '.',
      board: { tool: 'clock', step: step, roman: year === 3 && randInt(0, 2) === 0 },
      steps: [{
        prompt: 'Set the clock to ' + (asDigits ? digital + ' (' + words + ')' : words) + '.',
        sub: 'Up and down move an hour; left and right move the minute hand ' + (step === 1 ? '1 minute' : '5 minutes') + '. Press Enter when it is right.',
        why: words.replace(/^./, function (c) { return c.toUpperCase(); }) + ': the minute hand goes ' + minuteHand(m) + ' and the hour hand ' + hourHand(minutes) + '.'
      }],
      target: { minutes: minutes },
      answer: 'The hands show ' + words + '.',
      check: { kind: 'draw-clock', text: asDigits ? digital : words },
      inputs: 2,
      hardness: m % 5 === 0 ? 0 : 1
    });
  };

  // Measures, Years 2 to 5: draw a line a given length from 0 on a ruler.
  KINDS.ruler = function (year) {
    const mm = year === 2 ? randInt(3, 12) * 10 : randInt(21, 129);
    const cm = Math.floor(mm / 10);
    const rest = mm % 10;
    const text = year <= 3 ? (rest ? cm + ' cm ' + rest + ' mm' : cm + ' cm') : decimalText(mm, 1) + ' cm';
    return problem({
      area: 'measures', year: year, title: 'Drawing lines', stage: 'RULER',
      question: 'Draw a line ' + text + ' long. It starts at 0 on the ruler.',
      board: { tool: 'line', kind: 'ruler', minScaled: 0, minorScaled: 1, places: 1, n: 140, majorEvery: 10, unit: 'cm', labels: 'majors' },
      steps: [{
        prompt: 'Draw a line ' + text + ' long.',
        sub: 'Right and left make the line 1 mm longer or shorter; Shift with an arrow moves a whole centimetre. Press Enter when it is right.',
        why: text + (rest && year <= 3 ? ' is ' + cm + ' whole centimetres and ' + rest + ' small marks more.' : (rest ? ' is ' + cm + ' whole centimetres and ' + rest + ' millimetres.' : ' ends on the ' + cm + '.'))
      }],
      target: { at: mm },
      answer: 'A line ' + text + ' long.',
      check: { kind: 'draw-ruler', text: text },
      inputs: 1,
      hardness: rest ? 1 : 0
    });
  };

  // Number, Years 1 to 7: mark a number on a number line or thermometer.
  // Each line is [from, to, small step, labelled step].
  const NUMBER_LINES = {
    1: [[0, 20, 1, 5], [0, 10, 1, 2]],
    2: [[0, 50, 1, 10], [0, 100, 2, 10], [0, 100, 5, 20]],
    3: [[0, 100, 1, 10], [0, 1000, 10, 100], [100, 200, 1, 10]],
    4: [[0, 2, 0.1, 1], [-10, 10, 1, 5], [0, 1000, 25, 100]],
    5: [[0, 1, 0.01, 0.1], [-20, 20, 1, 5], [0, 5000, 100, 1000]],
    6: [[-10, 10, 0.5, 2], [0, 0.5, 0.01, 0.1], [-30, 30, 1, 10]],
    7: [[-2, 2, 0.1, 0.5], [-10, 10, 0.25, 1]]
  };

  function placesOf(x) {
    const text = String(x);
    return text.indexOf('.') === -1 ? 0 : text.length - text.indexOf('.') - 1;
  }

  KINDS.numberLine = function (year) {
    const line = pick(NUMBER_LINES[year]);
    const places = Math.max(placesOf(line[0]), placesOf(line[2]), placesOf(line[3]));
    const scale = Math.pow(10, places);
    const minScaled = Math.round(line[0] * scale);
    const minorScaled = Math.round(line[2] * scale);
    const n = Math.round((line[1] - line[0]) * scale / minorScaled);
    const majorEvery = Math.round(line[3] * scale / minorScaled);
    const thermometer = line[0] < 0 && places === 0 && (year === 5 || year === 6);
    const at = randInt(1, n - 1);
    // A value already labelled would need no reading of the scale.
    if (at % majorEvery === 0 && randInt(0, 3) > 0) return null;
    const board = { tool: 'line', kind: thermometer ? 'thermometer' : 'numberline', minScaled: minScaled, minorScaled: minorScaled, places: places,
      n: n, majorEvery: majorEvery, unit: thermometer ? '°C' : '', labels: 'majors' };
    const value = lineValue(board, at).replace('-', MINUS);
    const minor = decimalText(minorScaled, places);
    return problem({
      area: 'number', year: year, title: thermometer ? 'Thermometers' : 'Number lines', stage: 'NUMBER LINE',
      question: thermometer ? 'Make the thermometer show ' + value + ' °C.' : 'Mark ' + value + ' on the number line.',
      board: board,
      steps: [{
        prompt: thermometer ? 'Make the thermometer show ' + value + ' °C.' : 'Move the arrow to ' + value + '.',
        sub: (thermometer ? 'Up and down' : 'Right and left') + ' move one small step; Shift with an arrow jumps to the next number written. Press Enter when it is right.',
        why: 'Each small step is ' + minor + '. Count on from the nearest number written to ' + value + '.'
      }],
      target: { at: at },
      answer: value + (thermometer ? ' °C' : '') + ' marked.',
      check: { kind: 'draw-line', value: value },
      inputs: 1,
      hardness: places + (line[0] < 0 ? 1 : 0)
    });
  };

  // Fractions, Years 1 to 6: shade a fraction of a shape, a set or a grid.
  KINDS.shade = function (year) {
    const options = {
      1: [[2, [1]], [4, [1, 2, 3]]],
      2: [[3, [1, 2]], [4, [1, 2, 3]], [2, [1]]],
      3: [[5, [1, 2, 3, 4]], [6, [1, 5]], [8, [3, 5, 7]], [10, [3, 7, 9]]],
      4: [[10, [3, 7, 9]], [8, [3, 5, 7]], [12, [5, 7, 11]]],
      5: [[10, [3, 7, 9]], [20, [7, 9, 11, 13]], [12, [5, 7]]],
      6: [[20, [7, 9, 13, 17]], [25, [4, 8, 12]], [12, [5, 7, 11]]]
    }[year];
    const choice = pick(options);
    const d = choice[0];
    const n = pick(choice[1]);
    // Equivalent fractions: the shape has more parts than the denominator.
    const scale = year >= 3 && randInt(0, 2) === 0 && d <= 6 ? pick([2, 3]) : 1;
    const total = d * scale;
    const need = n * scale;
    let layout;
    let rows;
    let cols;
    if (total <= 8 && year <= 3 && randInt(0, 1)) {
      layout = 'circle';
      rows = 1;
      cols = total;
    } else if (total % 5 === 0 && total > 5) {
      layout = 'grid'; rows = total / 5; cols = 5;
    } else if (total % 4 === 0 && total > 4) {
      layout = 'grid'; rows = total / 4; cols = 4;
    } else if (total % 3 === 0 && total > 3) {
      layout = 'grid'; rows = total / 3; cols = 3;
    } else {
      layout = 'bar'; rows = 1; cols = total;
    }
    if (layout === 'grid' && year <= 2 && randInt(0, 1)) layout = 'counters';
    const parts = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) parts.push({ id: r * cols + c, r: r, c: c });
    let fraction = n + '/' + d;
    let ask = fraction;
    if (year >= 4 && d === 10 && randInt(0, 1)) ask = decimalText(n, 1);
    if (year >= 5 && (d === 20 || d === 25 || d === 10) && randInt(0, 1)) ask = (n * 100 / d) + '%';
    const noun = layout === 'counters' ? 'counters' : (layout === 'grid' ? 'squares' : 'parts');
    return problem({
      area: 'fractions', year: year, title: 'Shading', stage: 'SHADE',
      question: 'Shade ' + ask + ' of the ' + (layout === 'counters' ? 'counters' : 'shape') + '.',
      board: { tool: 'shade', mode: 'fraction', layout: layout, rows: rows, cols: cols, parts: parts, given: [], need: need, fraction: ask, noun: noun },
      steps: [{
        prompt: 'Shade ' + ask + ' of the ' + (layout === 'counters' ? 'counters' : 'shape') + '.',
        sub: 'The arrows move between the ' + noun + '; Space shades one or clears it. Press Enter when it is right.',
        why: 'There are ' + total + ' ' + noun + '. ' + (ask !== fraction ? ask + ' is ' + fraction + '. ' : '') + fraction + ' of ' + total + ' is ' + total + ' ÷ ' + d + ' × ' + n + ' = ' + need +
          (scale > 1 ? ', the same as ' + need + '/' + total : '') + ', so shade any ' + need + '.'
      }],
      target: { on: parts.slice(0, need).map(function (x) { return x.id; }) },
      answer: need + ' of the ' + total + ' ' + noun + ' shaded.',
      check: { kind: 'draw-shade', ask: ask, total: total },
      inputs: Math.min(need, 6),
      hardness: scale > 1 || ask !== fraction ? 1 : 0
    });
  };

  // Shape, Year 4: complete a symmetric figure on squared paper.
  KINDS.symmetry = function (year) {
    const size = 6;
    const vertical = randInt(0, 1) === 1;
    const parts = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) parts.push({ id: r * size + c, r: r, c: c });
    const mirror = function (id) {
      const r = Math.floor(id / size);
      const c = id % size;
      return vertical ? r * size + (size - 1 - c) : (size - 1 - r) * size + c;
    };
    const half = parts.filter(function (x) { return vertical ? x.c < size / 2 : x.r < size / 2; });
    const given = shuffle(half).slice(0, randInt(4, 7)).map(function (x) { return x.id; }).sort(function (a, b) { return a - b; });
    const target = given.concat(given.map(mirror)).sort(function (a, b) { return a - b; });
    return problem({
      area: 'shape', year: year, title: 'Symmetric figures', stage: 'SYMMETRY',
      question: 'Shade squares to make the pattern symmetric about the dashed mirror line.',
      board: { tool: 'shade', mode: 'symmetry', layout: 'grid', rows: size, cols: size, parts: parts, given: given, mirror: vertical ? 'vertical' : 'horizontal', noun: 'squares' },
      steps: [{
        prompt: 'Complete the pattern so it is symmetric about the mirror line.',
        sub: 'The arrows move between squares; Space shades one or clears it. Press Enter when it is right.',
        why: 'Each shaded square has a partner the same distance from the mirror line on the other side, like a reflection.'
      }],
      target: { on: target },
      answer: 'Each shaded square reflected in the mirror line.',
      check: { kind: 'draw-symmetry', vertical: vertical, size: size },
      inputs: given.length,
      examples: 2
    });
  };

  // Shape, Year 6: add the square that completes a net of a cube.
  const CUBE_NETS = [
    ['.X..', 'XXXX', '.X..'], ['X...', 'XXXX', 'X...'], ['X...', 'XXXX', '.X..'], ['X...', 'XXXX', '..X.'], ['X...', 'XXXX', '...X'],
    ['.X..', 'XXXX', '..X.'], ['XX..', '.XXX', '.X..'], ['XX..', '.XXX', '..X.'], ['XX..', '.XXX', '...X'], ['XX..', '.XX.', '..XX'], ['XXX..', '..XXX']
  ];

  KINDS.net = function (year) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const shape = pick(CUBE_NETS);
      // Turn or flip it at random.
      let cells = [];
      shape.forEach(function (row, r) { row.split('').forEach(function (ch, c) { if (ch === 'X') cells.push([r, c]); }); });
      if (randInt(0, 1)) cells = cells.map(function (x) { return [x[1], x[0]]; });
      if (randInt(0, 1)) cells = cells.map(function (x) { return [-x[0], x[1]]; });
      if (randInt(0, 1)) cells = cells.map(function (x) { return [x[0], -x[1]]; });
      const minR = Math.min.apply(null, cells.map(function (x) { return x[0]; }));
      const minC = Math.min.apply(null, cells.map(function (x) { return x[1]; }));
      cells = cells.map(function (x) { return [x[0] - minR + 1, x[1] - minC + 1]; });
      if (!foldsToCube(cells)) continue;
      const rows = Math.max.apply(null, cells.map(function (x) { return x[0]; })) + 2;
      const cols = Math.max.apply(null, cells.map(function (x) { return x[1]; })) + 2;
      if (rows > 6 || cols > 7) continue;
      const parts = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) parts.push({ id: r * cols + c, r: r, c: c });
      const ids = cells.map(function (x) { return x[0] * cols + x[1]; });
      const missing = pick(ids);
      const given = ids.filter(function (id) { return id !== missing; }).sort(function (a, b) { return a - b; });
      return problem({
        area: 'shape', year: year, title: 'Drawing nets', stage: 'NETS',
        question: 'Shade one more square to make a net of a cube.',
        board: { tool: 'shade', mode: 'net', layout: 'grid', rows: rows, cols: cols, parts: parts, given: given, noun: 'squares' },
        steps: [{
          prompt: 'Shade one more square so the six squares fold into a cube.',
          sub: 'The arrows move between squares; Space shades one or clears it. Press Enter when it is done.',
          why: 'A cube has 6 faces. Picture folding the squares up around one in the middle: the new square must cover the face that is still open.'
        }],
        target: { on: ids.slice().sort(function (a, b) { return a - b; }) },
        answer: 'Six squares that fold into a cube.',
        check: { kind: 'draw-net' },
        inputs: 1
      });
    }
    return null;
  };

  // Shape: points and shapes on a grid.
  function gridBoard(year, axes, mode, need, extra) {
    const four = year >= 6;
    return Object.assign({
      tool: 'grid', axes: axes, mode: mode, need: need,
      xmin: four ? -6 : 0, xmax: four ? 6 : 10, ymin: four ? -6 : 0, ymax: four ? 6 : 10,
      start: axes ? [0, 0] : [5, 5], given: [], mirror: null
    }, extra || {});
  }

  const LETTERS = ['A', 'B', 'C', 'D'];

  // Year 3: draw a rectangle (or square) with given sides on squared paper.
  KINDS.drawRectangle = function (year) {
    const w = randInt(2, 6);
    const h = randInt(1, 5);
    const square = w === h;
    const name = square ? 'a square with sides of ' + plural(w, 'square') : 'a rectangle ' + w + ' squares long and ' + h + ' squares wide';
    const start = [randInt(1, 3), randInt(1, 3)];
    const pts = [start, [start[0] + w, start[1]], [start[0] + w, start[1] + h], [start[0], start[1] + h]];
    return problem({
      area: 'shape', year: year, title: 'Drawing shapes', stage: 'DRAW',
      question: 'Draw ' + name + '. Put a corner on a grid point, then the next, going round.',
      board: gridBoard(year, false, 'rectangle', 4, { w: w, h: h, start: [1, 1] }),
      steps: [
        { prompt: 'Put the first corner on any grid point.', sub: 'The arrows move the pencil; Space puts a corner there.', why: 'Any point will do for the first corner.', miss: '' },
        { prompt: 'Go along a grid line, ' + w + ' or ' + h + ' squares, and put the second corner.', sub: 'Count the squares as you go.', why: 'The first side runs along a grid line.', miss: '' },
        { prompt: 'Turn a right angle and go the other length.', sub: 'A rectangle has four right angles.', why: 'Next to a ' + w + '-square side is a ' + h + '-square side.', miss: '' },
        { prompt: 'Put the last corner opposite the first.', sub: 'Opposite sides are equal.', why: 'The last corner makes the opposite sides equal.', miss: '' }
      ],
      target: { points: pts },
      answer: 'A ' + w + ' by ' + h + ' ' + (square ? 'square' : 'rectangle') + '.',
      check: { kind: 'draw-rectangle', w: w, h: h },
      inputs: 4,
      examples: 2
    });
  };

  // Shapes to move: a triangle or an L-shaped quadrilateral, small enough to fit.
  function smallShape(year) {
    const tri = randInt(0, 2) > 0;
    if (tri) {
      const a = [0, 0];
      const b = [randInt(2, 3), 0];
      const c = [randInt(0, 3), randInt(2, 3)];
      if (c[0] === b[0] && c[1] === 0) return null;
      return [a, b, c];
    }
    const w = randInt(2, 3);
    const h = randInt(2, 3);
    return [[0, 0], [w, 0], [w, h], [0, h]];
  }

  function transformProblem(year, kind, shape, image, extra, text, why, misses) {
    const axes = true;
    const labels = shape.map(function (pt, k) { return LETTERS[k]; });
    const board = gridBoard(year, axes, 'image', shape.length, Object.assign({ given: [{ points: shape, labels: labels }] }, extra));
    return problem({
      area: 'shape', year: year, title: 'Drawing ' + kind.toLowerCase() + 's', stage: 'TRANSFORM',
      question: text,
      board: board,
      steps: shape.map(function (pt, k) {
        return {
          prompt: 'Plot ' + labels[k] + '′, where ' + labels[k] + ' moves to.',
          sub: 'The arrows move the pencil; Space puts a corner there.',
          why: misses[k],
          miss: misses[k]
        };
      }),
      target: { points: image },
      answer: labels.map(function (l, k) { return l + '′' + pointText(image[k], true); }).join(', ') + '.',
      check: Object.assign({ kind: 'draw-transform', how: kind }, extra.check),
      inputs: shape.length,
      examples: 2
    });
  }

  // Years 4 to 6: translate a shape.
  KINDS.translate = function (year) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const base = smallShape(year);
      if (!base) continue;
      const four = year >= 6;
      const lo = four ? -6 : 0;
      const hi = four ? 6 : 10;
      const ox = randInt(lo, hi - 3);
      const oy = randInt(lo, hi - 3);
      const shape = base.map(function (pt) { return [pt[0] + ox, pt[1] + oy]; });
      const dx = randInt(-5, 5);
      const dy = randInt(-5, 5);
      if (!dx && !dy) continue;
      const image = shape.map(function (pt) { return [pt[0] + dx, pt[1] + dy]; });
      if (image.some(function (pt) { return pt[0] < lo || pt[0] > hi || pt[1] < lo || pt[1] > hi; })) continue;
      const moveText = [dx ? Math.abs(dx) + (dx > 0 ? ' right' : ' left') : '', dy ? Math.abs(dy) + (dy > 0 ? ' up' : ' down') : ''].filter(Boolean).join(' and ');
      const misses = shape.map(function (pt, k) {
        return LETTERS[k] + ' is at ' + pointText(pt, true) + '. ' + moveText.replace(/^./, function (c) { return c.toUpperCase(); }) + ' takes it to ' + pointText(image[k], true) + '.';
      });
      return transformProblem(year, 'Translation', shape, image, { check: { dx: dx, dy: dy } },
        'Translate the shape ' + moveText + '. Plot the new corners.', '', misses);
    }
    return null;
  };

  // Years 5 and 6: reflect a shape in a mirror line (Year 6: in an axis).
  KINDS.reflect = function (year) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const base = smallShape(year);
      if (!base) continue;
      const four = year >= 6;
      const lo = four ? -6 : 0;
      const hi = four ? 6 : 10;
      const vertical = randInt(0, 1) === 1;
      const at = four ? 0 : randInt(3, 7);
      const ox = randInt(lo, hi - 3);
      const oy = randInt(lo, hi - 3);
      const shape = base.map(function (pt) { return [pt[0] + ox, pt[1] + oy]; });
      // The shape sits on one side of the line.
      const side = shape.map(function (pt) { return vertical ? pt[0] - at : pt[1] - at; });
      if (!(side.every(function (v) { return v > 0; }) || side.every(function (v) { return v < 0; }))) continue;
      const image = shape.map(function (pt) { return vertical ? [2 * at - pt[0], pt[1]] : [pt[0], 2 * at - pt[1]]; });
      if (image.some(function (pt) { return pt[0] < lo || pt[0] > hi || pt[1] < lo || pt[1] > hi; })) continue;
      const line = four ? (vertical ? 'the y-axis' : 'the x-axis') : 'the mirror line';
      const misses = shape.map(function (pt, k) {
        const d = vertical ? pt[0] - at : pt[1] - at;
        return LETTERS[k] + ' is ' + plural(Math.abs(d), 'square') + ' ' + (vertical ? (d > 0 ? 'right of' : 'left of') : (d > 0 ? 'above' : 'below')) + ' ' + line +
          ', so ' + LETTERS[k] + '′ is ' + plural(Math.abs(d), 'square') + ' ' + (vertical ? (d > 0 ? 'left of' : 'right of') : (d > 0 ? 'below' : 'above')) + ' it, at ' + pointText(image[k], true) + '.';
      });
      return transformProblem(year, 'Reflection', shape, image,
        { mirror: four ? null : { axis: vertical ? 'x' : 'y', at: at }, axisMirror: four ? (vertical ? 'y' : 'x') : null, check: { vertical: vertical, at: at } },
        'Reflect the shape in ' + line + (four ? '' : (vertical ? ' (x = ' + at + ')' : ' (y = ' + at + ')')) + '. Plot the new corners.', '', misses);
    }
    return null;
  };

  // Year 7: rotate a shape 90° or 180° about the origin.
  KINDS.rotate = function (year) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const base = smallShape(year);
      if (!base) continue;
      const ox = randInt(1, 3);
      const oy = randInt(1, 3);
      const shape = base.map(function (pt) { return [pt[0] + ox, pt[1] + oy]; });
      const turn = pick([90, 180, 270]);
      const rot = function (pt) {
        if (turn === 180) return [-pt[0], -pt[1]];
        if (turn === 90) return [-pt[1], pt[0]];
        return [pt[1], -pt[0]];
      };
      const image = shape.map(rot);
      if (image.some(function (pt) { return Math.abs(pt[0]) > 6 || Math.abs(pt[1]) > 6; })) continue;
      const words = turn === 180 ? '180°' : (turn === 90 ? '90° anticlockwise' : '90° clockwise');
      const misses = shape.map(function (pt, k) {
        const rule = turn === 180 ? '(x, y) goes to (' + MINUS + 'x, ' + MINUS + 'y)' : (turn === 90 ? '(x, y) goes to (' + MINUS + 'y, x)' : '(x, y) goes to (y, ' + MINUS + 'x)');
        return 'Turning ' + words + ' about the origin, ' + rule + ': ' + LETTERS[k] + pointText(pt, true) + ' goes to ' + pointText(image[k], true) + '.';
      });
      return transformProblem(year, 'Rotation', shape, image, { centre: [0, 0], check: { turn: turn } },
        'Rotate the shape ' + words + ' about the origin (0, 0). Plot the new corners.', '', misses);
    }
    return null;
  };

  // Year 4: plot the missing corner of a rectangle or square.
  KINDS.missingVertex = function (year) {
    const four = year >= 6;
    const lo = four ? -5 : 1;
    const hi = four ? 5 : 9;
    const x1 = randInt(lo, hi - 2);
    const y1 = randInt(lo, hi - 2);
    const x2 = randInt(x1 + 2, hi);
    const y2 = randInt(y1 + 2, hi);
    const corners = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
    const missing = randInt(0, 3);
    const shown = corners.filter(function (pt, k) { return k !== missing; });
    const want = corners[missing];
    const labels = ['A', 'B', 'C'];
    return problem({
      area: 'shape', year: year, title: 'Completing shapes', stage: 'COORDINATES',
      question: 'A, B and C are three corners of a rectangle. Plot the fourth corner, D.',
      board: gridBoard(year, true, 'vertex', 1, { given: [{ points: shown, labels: labels, open: true }] }),
      steps: [{
        prompt: 'Plot D, the fourth corner of the rectangle.',
        sub: 'The arrows move the pencil; Space puts a point there.',
        why: 'A rectangle\'s sides run along the grid here, so D lines up across with one corner and up and down with another: D is at ' + pointText(want, true) + '.',
        miss: 'D lines up across with one corner and up and down with another, so it is at ' + pointText(want, true) + '.'
      }],
      target: { points: [want] },
      answer: 'D is at ' + pointText(want, true) + '.',
      check: { kind: 'draw-vertex' },
      inputs: 1
    });
  };

  // Data, Years 1 to 7: draw a chart from a table.
  // Not colours: a slice called red would be drawn in another colour.
  const CHART_SETS = [
    ['Favourite fruit', ['apple', 'banana', 'grape', 'pear']],
    ['Pets', ['cat', 'dog', 'fish', 'rabbit']],
    ['Ways to school', ['walk', 'car', 'bus', 'bike']],
    ['Sports', ['football', 'swimming', 'tennis', 'netball']]
  ];

  KINDS.chart = function (year) {
    const set = pick(CHART_SETS);
    let style;
    if (year === 1) style = 'tally';
    else if (year === 2) style = pick(['tally', 'pictogram', 'bars']);
    else if (year === 3) style = pick(['pictogram', 'bars']);
    else if (year <= 6) style = pick(['bars', 'line']);
    else style = 'bars';
    let minor = 1;
    let key = 1;
    let max;
    if (style === 'tally') { max = 15; minor = 1; }
    else if (style === 'pictogram') { key = year === 2 ? 2 : pick([2, 4]); minor = key / 2; max = key * 8; }
    else {
      minor = { 2: 1, 3: 2, 4: 5, 5: 10, 6: 10, 7: 5 }[year];
      max = minor * 12;
    }
    const categories = style === 'line' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] : set[1];
    const count = categories.length;
    const values = categories.map(function () { return randInt(1, Math.round(max / minor) - 1) * minor; });
    // One or two are drawn already, so the scale can be read from them.
    const given = categories.map(function (c, k) { return k === 0 || (style !== 'tally' && k === 1 && count > 4) ? values[k] : null; });
    const steps = [];
    categories.forEach(function (c, k) {
      if (given[k] !== null) return;
      steps.push({
        category: k,
        prompt: (style === 'line' ? 'Plot ' : 'Draw ') + c + ': ' + values[k] + '.',
        sub: style === 'pictogram' || style === 'tally' ? 'Left and right add or take away; press Enter when it is right.' : 'Up and down move it by one small step of the scale; press Enter when it is right.',
        why: c + ' is ' + values[k] + (style === 'pictogram' ? ': each picture is ' + key + ', so ' + (values[k] / key) + ' pictures.' : (style === 'tally' ? ': four lines and one across make 5.' : ': find ' + values[k] + ' on the scale; each small step is ' + minor + '.'))
      });
    });
    const titles = { tally: 'Tally charts', pictogram: 'Pictograms', bars: 'Bar charts', line: 'Line graphs' };
    const table = categories.map(function (c, k) { return c + ' ' + values[k]; }).join(', ');
    return problem({
      area: 'data', year: year, title: titles[style] + ' to draw', stage: 'CHARTS',
      question: (style === 'line' ? 'Plot the number of visitors each day: ' : 'Complete the ' + titles[style].toLowerCase().replace(/s$/, '') + ': ') + table + '.',
      board: { tool: 'bars', style: style, categories: categories, values: values, given: given, minor: minor, max: max, key: key, labelEvery: style === 'bars' || style === 'line' ? minor * 2 : minor },
      steps: steps,
      target: { values: values },
      answer: table + '.',
      check: { kind: 'draw-chart', table: table },
      inputs: steps.length,
      hardness: style === 'pictogram' ? 1 : 0
    });
  };

  // Data, Years 6 and 7: draw a pie chart from a table.
  KINDS.pie = function (year) {
    const totals = [12, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90];
    const total = pick(totals);
    const each = 360 / total;
    const set = pick(CHART_SETS);
    const parts = [];
    let left = total;
    for (let k = 0; k < 3; k++) {
      const v = randInt(1, Math.max(1, Math.floor(left / 2)));
      parts.push(v);
      left -= v;
    }
    if (left < 1) return null;
    parts.push(left);
    const labels = set[1];
    const angles = parts.map(function (v) { return v * each; });
    if (angles.some(function (a) { return a < 10; })) return null;
    const table = labels.map(function (l, k) { return l + ' ' + parts[k]; }).join(', ');
    return problem({
      area: 'data', year: year, title: 'Drawing pie charts', stage: 'PIE CHARTS',
      question: total + ' children were asked. ' + table + '. Draw the pie chart.',
      board: { tool: 'angle', mode: 'pie', size: 360, labels: labels, counts: parts, total: total },
      steps: labels.slice(0, 3).map(function (l, k) {
        return {
          prompt: 'Draw the slice for ' + l + ': ' + parts[k] + ' of ' + total + '.',
          sub: 'Up and down change the slice by 1°, with Shift by 10°; press Enter when it is right.',
          why: 'The whole circle is 360° for ' + total + ' children, so each child is 360 ÷ ' + total + ' = ' + each + '°. ' + l + ': ' + parts[k] + ' × ' + each + ' = ' + angles[k] + '°.',
          miss: 'Your slice for ' + l + ' is {have}. Each child is ' + each + '°, so ' + parts[k] + ' children are ' + angles[k] + '°.'
        };
      }),
      target: { angles: angles.slice(0, 3) },
      answer: labels.map(function (l, k) { return l + ' ' + angles[k] + '°'; }).join(', ') + '.',
      check: { kind: 'draw-pie', total: total, counts: parts },
      inputs: 3,
      examples: 2
    });
  };

  // Shape, Years 5 to 7: draw an angle with a protractor.
  KINDS.angle = function (year) {
    let degrees = year === 5 ? randInt(2, 17) * 10 + pick([0, 5]) : randInt(5, 175);
    if (degrees === 90 || degrees > 175) degrees = 125;
    const base = pick(['right', 'left']);
    return problem({
      area: 'shape', year: year, title: 'Drawing angles', stage: 'ANGLES',
      question: 'Draw an angle of ' + degrees + '°. The base arm is along 0 on the protractor.',
      board: { tool: 'angle', mode: 'angle', size: 180, base: base },
      steps: [{
        prompt: 'Turn the arm to make ' + degrees + '°.',
        sub: 'Up makes the angle bigger and down smaller, by 1°; with Shift by 10°. Press Enter when it is right.',
        why: 'Use the scale that starts at 0 on the base arm, on the ' + base + ', and count up to ' + degrees + '.',
        miss: 'Your angle is {have}, read on the scale that starts at 0 on the base arm.'
      }],
      target: { angles: [degrees] },
      answer: 'An angle of ' + degrees + '°.',
      check: { kind: 'draw-angle', degrees: degrees },
      inputs: 1,
      hardness: degrees % 5 === 0 ? 0 : 1
    });
  };

  // Shape, Year 6: draw a triangle from a side and the two angles on it.
  KINDS.triangle = function (year) {
    const a = randInt(25, 80);
    const b = randInt(25, 80);
    if (a + b > 150) return null;
    const ab = randInt(5, 9);
    return problem({
      area: 'shape', year: year, title: 'Drawing triangles', stage: 'TRIANGLES',
      question: 'Draw triangle ABC with AB = ' + ab + ' cm, angle A = ' + a + '° and angle B = ' + b + '°.',
      board: { tool: 'angle', mode: 'triangle', size: 180, ab: ab },
      steps: [
        { prompt: 'Draw angle A: ' + a + '°.', sub: 'The protractor sits on A. Up makes the angle bigger; Shift moves 10°. Press Enter when it is right.',
          why: 'At A the base arm points along AB, to the right; read the scale that starts at 0 there.', miss: 'Your angle A is {have}.' },
        { prompt: 'Draw angle B: ' + b + '°.', sub: 'The protractor sits on B now. Press Enter when it is right; the lines meet at C.',
          why: 'At B the base arm points along BA, to the left; read the scale that starts at 0 on that side.', miss: 'Your angle B is {have}.' }
      ],
      target: { angles: [a, b] },
      answer: 'Triangle ABC with A = ' + a + '° and B = ' + b + '°, so C = ' + (180 - a - b) + '°.',
      check: { kind: 'draw-triangle', a: a, b: b, ab: ab },
      inputs: 2,
      examples: 2
    });
  };

  // Algebra, Year 7: plot points of a straight line from its equation.
  KINDS.plotLine = function (year) {
    const m = pick([1, 2, 3, -1, -2]);
    const c = randInt(-3, 3);
    const xs = [0, 1, 2];
    const pts = xs.map(function (x) { return [x, m * x + c]; });
    if (pts.some(function (pt) { return Math.abs(pt[1]) > 6; })) return null;
    const eq = 'y = ' + (m === 1 ? '' : (m === -1 ? MINUS : int(m))) + 'x' + (c ? (c > 0 ? ' + ' + c : ' ' + MINUS + ' ' + Math.abs(c)) : '');
    return problem({
      area: 'algebra', year: year, title: 'Plotting graphs', stage: 'GRAPHS',
      question: 'Plot the points of ' + eq + ' for x = 0, 1 and 2.',
      board: gridBoard(year, true, 'points', 3, { xmin: -6, xmax: 6, ymin: -6, ymax: 6, start: [0, 0], line: true }),
      steps: pts.map(function (pt) {
        const why = 'When x = ' + pt[0] + ', y = ' + (m === 1 ? '' : int(m) + ' × ') + pt[0] + (c ? (c > 0 ? ' + ' + c : ' ' + MINUS + ' ' + Math.abs(c)) : '') + ' = ' + int(pt[1]) + ', so the point is ' + pointText(pt, true) + '.';
        return { prompt: 'Plot the point where x = ' + pt[0] + '.', sub: 'Work out y, then move the pencil there and press Space.', why: why, miss: why };
      }),
      target: { points: pts },
      answer: pts.map(function (pt) { return pointText(pt, true); }).join(', ') + ' on ' + eq + '.',
      check: { kind: 'draw-points', m: m, c: c, xs: xs },
      inputs: 3,
      examples: 2
    });
  };
});
