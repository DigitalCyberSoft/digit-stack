(function () {
  'use strict';

  const Engine = window.DigitStackEngine;
  // Theme and colour settings, applied by theme.js in <head>.
  const DISPLAY = window.DigitStackDisplay;
  if (!Engine) throw new Error('Digit Stack arithmetic engine failed to load.');

  const YEARS = Engine.YEARS;
  const AREAS = Engine.AREAS;
  const FIRST_YEAR = YEARS[0];
  const TOP_YEAR = YEARS[YEARS.length - 1];
  const MINUS = Engine.MINUS;

  // Keys 1 to 9 and 0 open the ten areas, in this order.
  const AREA_INFO = {
    divide: { key: '1', sign: '÷', name: 'Divide' },
    multiply: { key: '2', sign: '×', name: 'Multiply' },
    add: { key: '3', sign: '+', name: 'Add' },
    subtract: { key: '4', sign: MINUS, name: 'Subtract' },
    number: { key: '5', sign: '123', name: 'Number' },
    fractions: { key: '6', sign: '½', name: 'Fractions' },
    measures: { key: '7', sign: 'cm', name: 'Measures' },
    shape: { key: '8', sign: '△', name: 'Shape' },
    data: { key: '9', sign: '▥', name: 'Data' },
    algebra: { key: '0', sign: 'x', name: 'Algebra' },
    words: { key: 'w', sign: '?', name: 'Word problems' }
  };

  // Ages follow the key stage tables on gov.uk ("The national curriculum").
  const YEAR_INFO = {
    1: {
      age: '5-6',
      multiply: 'Dot rows up to 100; 2, 5 and 10 tables',
      divide: 'Sharing and grouping; ÷ 2, 5 and 10',
      add: 'Facts to 20, 2-digit sums, missing numbers',
      subtract: 'Facts to 20, 2-digit take-aways, missing numbers',
      number: 'Counting, 1 more and less, comparing, words',
      fractions: 'Halves and quarters',
      measures: "Coins, o'clock and half past, days, rulers",
      shape: '2-D and 3-D shapes, turns',
      data: 'Tally charts and pictograms',
      algebra: 'Balancing, function machines, patterns',
      words: 'One step: adding, taking away, sharing, equal groups'
    },
    2: {
      age: '6-7',
      multiply: '2, 3, 4, 5, 8, 10 tables; missing numbers',
      divide: '÷ 2, 3, 4, 5, 8, 10; missing numbers',
      add: '3-digit sentences, missing numbers, 2-3 digit columns',
      subtract: '3-digit sentences, missing numbers, 2-3 digit columns',
      number: 'Place value, <, > and =, counting in steps',
      fractions: '1/3, 1/4, 2/4 and 3/4 of amounts and shapes',
      measures: 'Time to 5 minutes, money and change, scales',
      shape: 'Sides, faces, edges, vertices, symmetry',
      data: 'Pictograms, tallies, block diagrams, tables',
      algebra: 'Balancing to 100, machines, symbols',
      words: 'Money and change; one and two steps'
    },
    3: {
      age: '7-8',
      multiply: 'Tables to 12; 2- or 3-digit × 1-digit',
      divide: 'Tables to 12; 2- or 3-digit ÷ 1-digit, exact',
      add: '3- or 4-digit columns, missing numbers, estimates',
      subtract: '3- or 4-digit columns, missing numbers, estimates',
      number: 'To 1,000, counting in steps, Roman numerals',
      fractions: 'Tenths, equivalents, adding, comparing',
      measures: 'Measures, perimeter, clocks, durations, money',
      shape: 'Right angles, parallel and perpendicular lines',
      data: 'Bar charts, pictograms and tables',
      algebra: 'Machines, sequences, symbols',
      words: 'Two steps; scaling; combinations; change in £ and p'
    },
    4: {
      age: '8-9',
      multiply: 'Tables to 12 × 12; 4-digit × 1-digit, 2-digit × 2-digit',
      divide: 'Tables to 12 × 12; 3- or 4-digit ÷ 1-digit, remainders',
      add: '4- or 5-digit columns, decimals, below zero',
      subtract: '4- or 5-digit columns, decimals, below zero',
      number: 'Rounding, Roman numerals to C, factor pairs',
      fractions: 'Equivalents, decimals, dividing by 10 and 100',
      measures: 'Converting units, area, money, 24-hour clock',
      shape: 'Angles, triangles, quadrilaterals, coordinates',
      data: 'Bar charts and time graphs',
      algebra: 'Symbols, sequences, machines',
      words: 'Two-step problems; money in £; grams and kilograms'
    },
    5: {
      age: '9-10',
      multiply: 'Long multiplication; mental × with 10s and 100s',
      divide: '4-digit short division, long division, remainders',
      add: '5- or 6-digit columns, decimals, below zero',
      subtract: '5- or 6-digit columns, decimals, below zero',
      number: 'Primes, factors, squares, cubes, × and ÷ by 10',
      fractions: 'Mixed numbers, decimals, percentages',
      measures: 'Metric units, area, volume, decimals',
      shape: 'Degrees, protractors, angles on a line',
      data: 'Line graphs and timetables',
      algebra: 'Letters, sequences, formulae',
      words: 'Remainders, rates, fractions of amounts, tickets'
    },
    6: {
      age: '10-11',
      multiply: 'Long multiplication; decimals × whole numbers',
      divide: 'Long division, decimal answers, fraction remainders',
      add: '6-digit columns, decimals, below zero to 100',
      subtract: '6-digit columns, decimals, below zero to 100',
      number: 'Order of operations, HCF and LCM, primes',
      fractions: 'Fraction calculations, percentages, ratio',
      measures: 'Area of triangles, volume, miles and km',
      shape: 'Angles in shapes, 4-quadrant coordinates',
      data: 'Pie charts and the mean',
      algebra: 'Formulae, equations, two unknowns',
      words: 'Percentages, ratio, recipes, missing numbers, the mean'
    },
    7: {
      age: '11-12',
      multiply: 'Up to 5-digit × 3-digit, decimals, negatives',
      divide: 'Divisors up to 3 digits, decimals, negatives',
      add: '6- or 7-digit columns, decimals, adding negatives',
      subtract: '6- or 7-digit columns, decimals, subtracting negatives',
      number: 'Powers, roots, prime factors, standard form',
      fractions: 'Fraction operations, percentage change, ratio',
      measures: 'Circles, trapezia, area units, speed',
      shape: 'Parallel lines, Pythagoras, trigonometry',
      data: 'Averages, probability, scatter graphs',
      algebra: 'Expressions, equations, nth term, graphs',
      words: 'Best buys, interest, percentage change, speed, proportion'
    }
  };

  const STORAGE = {
    sound: 'digitstack.sound.v1',
    progress: 'digitstack.progress.v1',
    play: 'digitstack.play.v1',
    mixed: 'digitstack.mixed.v1'
  };

  // Saved rounds hold whole problems. Bump this when the engine's problem
  // layout changes, so rounds saved by older code are dropped, not misdrawn.
  // 2: sentences, decimals and the six topic areas.
  const PLAY_VERSION = 2;

  // Mixed test settings, chosen with the arrow keys.
  const MIXED_COUNTS = [10, 20, 30, 40, 50];
  const MIXED_MINUTES = [0, 10, 15, 20, 30, 45, 60, 90];
  const MIXED_LEVELS = ['easy', 'medium', 'hard'];

  // Grades: 5-point bands from 50%, and under 50% is always a fail.
  const GRADES = [[95, 'A+'], [90, 'A'], [85, 'A' + MINUS], [80, 'B+'], [75, 'B'], [70, 'B' + MINUS], [65, 'C+'], [60, 'C'], [55, 'C' + MINUS],
    [50, 'D'], [0, 'F']];

  const TEST_HELP = 'Arrows move between boxes; Tab follows the method. Type to fill a box, ' +
    'Backspace clears it. Small boxes are for working and are not marked. Press Enter to hand in.';
  const DRAW_HELP = 'Arrows move or turn; Shift with an arrow takes a bigger step. Space marks, places or shades; ' +
    'Backspace takes the last one away. Press Enter to hand in.';
  const MIXED_HELP = 'Arrows move between boxes. Type to fill a box, Backspace clears it. N or Enter goes to the next question, ' +
    'P back. E hands in the test.';

  function $(id) {
    return document.getElementById(id);
  }

  const els = {
    app: document.querySelector('.app'),
    setupScreen: $('setupScreen'),
    gameScreen: $('gameScreen'),
    setupLadder: $('setupLadder'),
    shapes: AREAS.reduce(function (map, area) {
      map[area] = $(area + 'Shape');
      return map;
    }, {}),
    modeButtons: Array.from(document.querySelectorAll('[data-mode]')),
    mixedBtn: $('mixedBtn'),
    mixedNote: $('mixedNote'),
    mixedOverlay: $('mixedOverlay'),
    mixedRows: Array.from(document.querySelectorAll('[data-setting]')),
    mixedStart: $('mixedStart'),
    mixedCancel: $('mixedCancel'),
    mixedSummary: $('mixedSummary'),
    compareKeys: Array.from(document.querySelectorAll('[data-compare]')),
    pauseEnd: $('pauseEnd'),
    handInBtn: $('handInBtn'),
    handInLabel: document.querySelector('#handInBtn .carry-label'),
    mixedPrevBtn: $('mixedPrevBtn'),
    mixedEndBtn: $('mixedEndBtn'),
    turnLabel: $('turnLabel'),
    tutorBack: $('tutorBack'),
    tutorNext: $('tutorNext'),
    tutorSkip: $('tutorSkip'),
    watchBtn: $('watchBtn'),
    soundBtn: $('soundBtn'),
    themeBtn: $('themeBtn'),
    cvdBtn: $('cvdBtn'),
    helpBtn: $('helpBtn'),
    pauseBtn: $('pauseBtn'),
    modeChip: $('modeChip'),
    modeShape: $('modeShape'),
    gameLadder: $('gameLadder'),
    streakChip: $('streakChip'),
    streakValue: $('streakValue'),
    gateLabel: $('gateLabel'),
    gateLine: $('gateLine'),
    streakMeter: $('streakMeter'),
    sheet: $('sheet'),
    sheetTitle: $('sheetTitle'),
    sheetStatus: $('sheetStatus'),
    worksheet: $('worksheet'),
    sheetQuestion: $('sheetQuestion'),
    boardPad: $('boardPad'),
    rowMap: $('rowMap'),
    console: $('console'),
    consoleMain: $('consoleMain'),
    stageChip: $('stageChip'),
    stepLine: $('stepLine'),
    prompt: $('prompt'),
    subprompt: $('subprompt'),
    fixNote: $('fixNote'),
    keypad: $('keypad'),
    minusKey: $('minusKey'),
    footMinus: $('footMinus'),
    carryHint: $('carryHint'),
    endPanel: $('endPanel'),
    endKicker: $('endKicker'),
    endTitle: $('endTitle'),
    endAnswer: $('endAnswer'),
    endDetail: $('endDetail'),
    endActions: $('endActions'),
    helpOverlay: $('helpOverlay'),
    helpClose: $('helpClose'),
    helpGotIt: $('helpGotIt'),
    pauseOverlay: $('pauseOverlay'),
    pauseYear: $('pauseYear'),
    pauseStreak: $('pauseStreak'),
    pauseCheck: $('pauseCheck'),
    resumeBtn: $('resumeBtn'),
    quitBtn: $('quitBtn'),
    pauseNote: $('pauseNote'),
    saveNote: $('saveNote'),
    liveRegion: $('liveRegion')
  };

  const state = {
    screen: 'setup',
    operation: null,
    year: FIRST_YEAR,
    cleanStreak: 0,
    pendingYear: null,
    roundClean: true,
    fixes: 0,
    problem: null,
    actions: [],
    actionIndex: 0,
    cellEls: new Map(),
    rowEls: new Map(),
    groupChips: new Map(),
    lockInput: false,
    timer: null,
    soundOn: true,
    audioCtx: null,
    helpOpen: false,
    pauseOpen: false,
    previousFocus: null,
    progress: null,
    mode: 'guided',
    pendingTest: false,
    selectedCellId: null,
    entries: new Map(),
    handInWarned: false,
    solution: null,
    fillOrder: [],
    play: null,
    saving: true,
    tutorial: null,
    // The mixed test: its settings while choosing them, then the run.
    mixedSetup: null,
    mixedOpen: false,
    mixed: null,
    mixedTimer: null,
    // Each question's answer boxes, worked out once per test.
    mixedMarked: null,
    // A drawing question's board: plain data that every key changes.
    boardState: null,
    reviewIndex: 0
  };

  /* Storage is optional: a blocked store should not stop the game, but the
     child should be told that closing it will lose their place. A browser
     with storage turned off can give no store at all, or throw a
     DOMException (SecurityError when blocked, QuotaExceededError when full). */

  function readStored(key, fallback) {
    try {
      const storage = window.localStorage;
      if (!storage) return fallback;
      const value = storage.getItem(key);
      return value === null ? fallback : value;
    } catch (err) {
      if (!(err instanceof DOMException)) throw err;
      return fallback;
    }
  }

  // Returns whether the value was stored. The result also sets
  // `state.saving`, which shows or hides the not-saving notice.
  function writeStored(key, value) {
    let stored = false;
    try {
      const storage = window.localStorage;
      if (storage) {
        storage.setItem(key, String(value));
        stored = true;
      }
    } catch (err) {
      if (!(err instanceof DOMException)) throw err;
    }
    state.saving = stored;
    updateSaveUI();
    return stored;
  }

  function updateSaveUI() {
    els.saveNote.hidden = state.saving;
    els.pauseNote.textContent = state.saving
      ? 'Quitting returns to the start. Each area keeps its place on this device, so the game can also be closed.'
      : 'This browser is not saving, so quitting or closing the game loses this run.';
  }

  function seedPreferences() {
    state.soundOn = readStored(STORAGE.sound, 'on') !== 'off';
  }

  /* Progress: the child's school year and the year checks passed per area. */

  function emptyPassed() {
    const passed = {};
    AREAS.forEach(function (area) { passed[area] = []; });
    return passed;
  }

  function emptyProgress() {
    return { schoolYear: FIRST_YEAR, passed: emptyPassed(), learned: emptyPassed(), watched: emptyPassed() };
  }

  function knownYears(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (year) { return YEARS.indexOf(year) !== -1; });
  }

  // A missing or unreadable record starts a fresh ladder, the same as a
  // first visit. JSON.parse has no non-throwing form.
  function readProgress() {
    const raw = readStored(STORAGE.progress, null);
    if (raw === null) return emptyProgress();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      if (err instanceof SyntaxError) return emptyProgress();
      throw err;
    }
    if (!data || typeof data !== 'object') return emptyProgress();
    const savedPassed = data.passed && typeof data.passed === 'object' ? data.passed : {};
    const savedLearned = data.learned && typeof data.learned === 'object' ? data.learned : {};
    const savedWatched = data.watched && typeof data.watched === 'object' ? data.watched : {};
    const passed = emptyPassed();
    const learned = emptyPassed();
    const watched = emptyPassed();
    AREAS.forEach(function (area) {
      passed[area] = knownYears(savedPassed[area]);
      learned[area] = knownYears(savedLearned[area]);
      watched[area] = knownYears(savedWatched[area]);
    });
    return {
      schoolYear: YEARS.indexOf(data.schoolYear) !== -1 ? data.schoolYear : FIRST_YEAR,
      passed: passed,
      learned: learned,
      watched: watched
    };
  }

  // Each area and year is learned first, in guided play, then tested. The
  // learning gate unlocks the test; passing the test passes the year check.
  function phaseFor(operation, year) {
    return state.progress.learned[operation].indexOf(year) !== -1 ? 'test' : 'guided';
  }

  function markLearned(operation, year) {
    const list = state.progress.learned[operation];
    if (list.indexOf(year) === -1) {
      list.push(year);
      list.sort(function (a, b) { return a - b; });
    }
    saveProgress();
  }

  // The worked example for a year plays by itself once, before learning.
  function hasWatched(operation, year) {
    return state.progress.watched[operation].indexOf(year) !== -1;
  }

  function markWatched(operation, year) {
    const list = state.progress.watched[operation];
    if (list.indexOf(year) === -1) {
      list.push(year);
      list.sort(function (a, b) { return a - b; });
    }
    saveProgress();
  }

  // Each area starts at the school year and sits one year above its highest
  // passed check, so one area can run ahead without moving the others.
  function areaLevel(operation) {
    const passed = state.progress.passed[operation];
    const highest = passed.length ? Math.max.apply(null, passed) : 0;
    return Math.min(TOP_YEAR, Math.max(state.progress.schoolYear, highest + 1));
  }

  function saveProgress() {
    writeStored(STORAGE.progress, JSON.stringify(state.progress));
  }

  function hasPassed(operation, year) {
    return Boolean(operation) && state.progress.passed[operation].indexOf(year) !== -1;
  }

  function markPassed(operation, year) {
    const list = state.progress.passed[operation];
    if (list.indexOf(year) === -1) {
      list.push(year);
      list.sort(function (a, b) { return a - b; });
    }
    saveProgress();
  }

  // Clean rounds in a row a check needs, set by how long that area's rounds
  // are in that year.
  function cleanTarget() {
    return Engine.cleanRounds(state.operation, state.year);
  }

  /* Saved play: the area left open, and for each area its clean count and
     the round in progress, so the game can be closed and picked up again. */

  function emptyPlay() {
    return { version: PLAY_VERSION, operation: null, areas: {} };
  }

  // A missing, unreadable or older record starts afresh. JSON.parse has no
  // non-throwing form.
  function readPlay() {
    const raw = readStored(STORAGE.play, null);
    if (raw === null) return emptyPlay();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      if (err instanceof SyntaxError) return emptyPlay();
      throw err;
    }
    if (!data || typeof data !== 'object' || data.version !== PLAY_VERSION) return emptyPlay();
    const play = emptyPlay();
    play.operation = AREAS.indexOf(data.operation) !== -1 ? data.operation : null;
    const areas = data.areas && typeof data.areas === 'object' ? data.areas : {};
    AREAS.forEach(function (area) {
      if (areas[area] && typeof areas[area] === 'object') play.areas[area] = areas[area];
    });
    return play;
  }

  // A saved place counts only while it matches the area's year and stage, so
  // a new school year or a passed check starts that area afresh.
  function savedRecord(operation) {
    const record = state.play.areas[operation];
    if (!record) return null;
    const year = areaLevel(operation);
    if (record.year !== year || record.mode !== phaseFor(operation, year)) return null;
    const streak = record.cleanStreak;
    if (!Number.isInteger(streak) || streak < 0 || streak >= Engine.cleanRounds(operation, year)) return null;
    return record;
  }

  function savedRound(record, operation) {
    const round = record.round;
    if (!round || typeof round !== 'object') return null;
    const problem = round.problem;
    if (!problem || problem.operation !== operation || problem.year !== record.year ||
      !Array.isArray(problem.rows) || !Array.isArray(problem.actions) || !problem.actions.length) {
      return null;
    }
    if (record.mode === 'test') {
      return round.entries && typeof round.entries === 'object' ? round : null;
    }
    const index = round.actionIndex;
    if (!Number.isInteger(index) || index < 0 || index >= problem.actions.length) return null;
    if (typeof round.roundClean !== 'boolean' || !Number.isInteger(round.fixes) || round.fixes < 0) return null;
    return round;
  }

  function currentRound() {
    if (state.mode === 'test') {
      return {
        problem: state.problem,
        entries: Object.fromEntries(state.entries),
        selectedCellId: state.selectedCellId
      };
    }
    return {
      problem: state.problem,
      actionIndex: state.actionIndex,
      roundClean: state.roundClean,
      fixes: state.fixes,
      board: isDraw(state.problem) ? state.boardState : undefined
    };
  }

  // A finished round is already counted, so it is not kept: the next visit
  // starts the next problem at the stage and year the result leads to.
  function currentRecord() {
    if (state.screen === 'playing') {
      return { year: state.year, mode: state.mode, cleanStreak: state.cleanStreak, round: currentRound() };
    }
    if (state.screen === 'won' && state.pendingTest) {
      return { year: state.year, mode: 'test', cleanStreak: 0, round: null };
    }
    if (state.screen === 'won' && state.pendingYear !== null) {
      return {
        year: state.pendingYear,
        mode: phaseFor(state.operation, state.pendingYear),
        cleanStreak: 0,
        round: null
      };
    }
    return { year: state.year, mode: state.mode, cleanStreak: state.cleanStreak, round: null };
  }

  function savePlay() {
    // A mixed test keeps its own record; the areas' places stay as they were.
    if (state.mixed && state.mixed.running) return saveMixed();
    if (state.tutorial && state.tutorial.kind === 'mixed') return true;
    // While an example plays, the area's saved place stays as it was, so a
    // replay returns to the same step.
    if (state.operation && state.screen !== 'tutorial') {
      state.play.areas[state.operation] = currentRecord();
    }
    state.play.operation = state.operation;
    return writeStored(STORAGE.play, JSON.stringify(state.play));
  }

  /* Sound */

  function updateSoundUI() {
    els.soundBtn.classList.toggle('is-muted', !state.soundOn);
    els.soundBtn.setAttribute('aria-pressed', String(state.soundOn));
    els.soundBtn.setAttribute('aria-label', state.soundOn ? 'Turn sound off' : 'Turn sound on');
  }

  function ensureAudio() {
    if (!state.soundOn) return false;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      state.soundOn = false;
      updateSoundUI();
      return false;
    }
    if (!state.audioCtx) {
      try {
        state.audioCtx = new AudioCtor();
      } catch (err) {
        return false;
      }
    }
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume().catch(function () {
        // Browsers can decline to start audio; the game remains playable.
      });
    }
    return true;
  }

  function tone(frequency, duration, options) {
    if (!ensureAudio()) return;
    const ctx = state.audioCtx;
    const opts = options || {};
    const now = ctx.currentTime + (opts.delay || 0);
    const gainValue = opts.gain == null ? 0.03 : opts.gain;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = opts.type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    if (opts.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(opts.endFrequency, now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.025);
  }

  function playSound(name) {
    if (!state.soundOn) return;
    if (!ensureAudio()) return;
    if (name === 'tick') {
      tone(520, 0.045, { type: 'triangle', gain: 0.016 });
      tone(780, 0.035, { type: 'sine', gain: 0.007, delay: 0.025 });
    } else if (name === 'carry') {
      tone(320, 0.17, { endFrequency: 720, type: 'triangle', gain: 0.035 });
    } else if (name === 'bring') {
      tone(520, 0.13, { endFrequency: 300, type: 'sine', gain: 0.022 });
    } else if (name === 'miss') {
      tone(240, 0.18, { endFrequency: 160, type: 'triangle', gain: 0.032 });
    } else if (name === 'win') {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (frequency, index) {
        tone(frequency, 0.19, { type: 'triangle', gain: 0.028, delay: index * 0.085 });
      });
    }
  }

  function toggleSound() {
    state.soundOn = !state.soundOn;
    writeStored(STORAGE.sound, state.soundOn ? 'on' : 'off');
    updateSoundUI();
    if (state.soundOn) {
      ensureAudio();
      playSound('tick');
    }
  }

  /* Display: light, dark or automatic, and colour-blind friendly colours */

  const THEME_NAMES = { auto: 'automatic', light: 'light', dark: 'dark' };

  function updateDisplayUI() {
    const now = DISPLAY.get();
    const name = THEME_NAMES[now.theme];
    els.themeBtn.setAttribute('aria-label', 'Theme: ' + name + '. Press T to change.');
    els.themeBtn.title = 'Theme: ' + name + ' (T)';
    els.cvdBtn.setAttribute('aria-pressed', String(now.cvd));
    els.cvdBtn.title = 'Colour-blind friendly colours: ' + (now.cvd ? 'on' : 'off') + ' (C)';
  }

  // Automatic, then light, then dark.
  function cycleTheme() {
    const themes = DISPLAY.themes;
    const next = themes[(themes.indexOf(DISPLAY.get().theme) + 1) % themes.length];
    DISPLAY.set({ theme: next });
    writeStored(DISPLAY.keys.theme, next);
    updateDisplayUI();
    els.liveRegion.textContent = next === 'auto'
      ? 'Automatic theme: light or dark to match this device.'
      : (next === 'dark' ? 'Dark theme.' : 'Light theme.');
  }

  function toggleCvd() {
    const on = !DISPLAY.get().cvd;
    DISPLAY.set({ cvd: on });
    writeStored(DISPLAY.keys.cvd, on ? 'on' : 'off');
    updateDisplayUI();
    els.liveRegion.textContent = on
      ? 'Colour-blind friendly colours on. Right answers are blue with a tick and wrong ones are orange.'
      : 'Colour-blind friendly colours off.';
  }

  /* Text helpers */

  function titleCase(value) {
    const lower = String(value).toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  function blurFocus() {
    const active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === 'function') {
      active.blur();
    }
  }

  /* Year ladders */

  function buildLadders() {
    [els.setupLadder, els.gameLadder].forEach(function (list) {
      const isSetup = list === els.setupLadder;
      list.innerHTML = '';
      YEARS.forEach(function (year) {
        const item = document.createElement('li');
        item.dataset.year = String(year);
        const node = document.createElement('span');
        node.className = 'ladder-node';
        node.textContent = String(year);
        const label = document.createElement('span');
        label.className = 'ladder-label';
        label.textContent = isSetup ? 'Year ' + year : 'Y' + year;
        item.appendChild(node);
        item.appendChild(label);
        if (isSetup) {
          const tag = document.createElement('span');
          tag.className = 'ladder-tag';
          // The range never splits, so a narrow ruler wraps after "age".
          const range = document.createElement('span');
          range.className = 'ladder-age';
          range.textContent = YEAR_INFO[year].age;
          tag.append('age ', range);
          const pass = document.createElement('span');
          pass.className = 'ladder-pass';
          item.appendChild(tag);
          item.appendChild(pass);
        }
        list.appendChild(item);
      });
    });
  }

  function areaSummary(operation) {
    const level = areaLevel(operation);
    const ahead = level - state.progress.schoolYear;
    return 'Year ' + level + (ahead > 0 ? ' (' + ahead + ' ahead)' : '') +
      (phaseFor(operation, level) === 'test' ? ', test' : ', learning');
  }

  function updateSetupLadder() {
    Array.from(els.setupLadder.children).forEach(function (item) {
      const year = Number(item.dataset.year);
      const selected = year === state.progress.schoolYear;
      const passedAreas = AREAS.filter(function (area) { return hasPassed(area, year); });
      item.classList.toggle('is-current', selected);
      item.classList.toggle('is-done', !selected && passedAreas.length === AREAS.length);
      if (selected) {
        item.setAttribute('aria-current', 'true');
      } else {
        item.removeAttribute('aria-current');
      }
      const pass = item.querySelector('.ladder-pass');
      // Ten areas are too many signs for a ruler mark, so it shows a count.
      pass.textContent = passedAreas.length ? passedAreas.length + '/' + AREAS.length : '';
      pass.setAttribute('aria-label', passedAreas.length
        ? 'Passed: ' + passedAreas.map(function (area) { return AREA_INFO[area].name; }).join(', ')
        : 'No checks passed');
    });
    AREAS.forEach(function (area) {
      els.shapes[area].textContent = areaSummary(area) + ': ' + YEAR_INFO[areaLevel(area)][area];
    });
  }

  function selectYear(year) {
    if (YEARS.indexOf(year) === -1) return;
    state.progress.schoolYear = year;
    saveProgress();
    updateSetupLadder();
    els.liveRegion.textContent = 'School year ' + year + ', age ' + YEAR_INFO[year].age + '. ' +
      AREAS.map(function (area) {
        return AREA_INFO[area].name + ' is at ' + areaSummary(area) + ', key ' + AREA_INFO[area].key;
      }).join('. ') + '.';
  }

  /* Screens */

  function showSetup() {
    clearTimer();
    stopMixedTimer();
    if (state.helpOpen) closeHelp();
    if (state.pauseOpen) closePause();
    // A mixed test left half done stays saved; R picks it up.
    if (state.mixed && !state.mixed.finished) {
      state.mixed.running = false;
      state.mixed.open = false;
      saveMixed();
    }
    state.screen = 'setup';
    state.operation = null;
    state.tutorial = null;
    els.console.classList.remove('is-tutorial');
    delete document.body.dataset.area;
    state.cleanStreak = 0;
    state.pendingYear = null;
    state.pendingTest = false;
    state.problem = null;
    state.actions = [];
    state.actionIndex = 0;
    state.lockInput = false;
    els.setupScreen.hidden = false;
    els.gameScreen.hidden = true;
    els.pauseBtn.hidden = true;
    els.consoleMain.hidden = false;
    els.endPanel.hidden = true;
    updateSetupLadder();
    updateMixedCard();
    document.body.classList.remove('is-mixed');
    window.scrollTo(0, 0);
    blurFocus();
    els.liveRegion.textContent = 'Choose the school year with the arrow keys. Then press 1 to 9 or 0 for an area, ' +
      'or R for a mixed test.';
    savePlay();
  }

  function startRun(operation) {
    if (state.screen !== 'setup' || AREAS.indexOf(operation) === -1) return;
    ensureAudio();
    beginArea(operation);
  }

  // Starts an area, or picks it up where it was left: its saved clean count,
  // and the round in progress with every box as it was.
  function beginArea(operation) {
    const record = savedRecord(operation);
    const round = record ? savedRound(record, operation) : null;
    state.operation = operation;
    state.year = areaLevel(operation);
    state.mode = phaseFor(operation, state.year);
    state.cleanStreak = record ? record.cleanStreak : 0;
    state.pendingYear = null;
    state.pendingTest = false;
    state.screen = 'playing';
    window.scrollTo(0, 0);
    if (!round && state.mode === 'guided' && !hasWatched(operation, state.year)) {
      startTutorial();
      return;
    }
    if (round) {
      try {
        loadProblem(round.problem, round);
        return;
      } catch (err) {
        // A saved round this code cannot draw is replaced by a new problem,
        // so the area still opens. The error is rethrown afterwards so it
        // still reaches the console.
        window.setTimeout(function () { throw err; }, 0);
      }
    }
    loadProblem(Engine.generateProblem(operation, state.year));
  }

  function loadProblem(problem, saved) {
    clearTimer();
    if (isDraw(problem)) setBoard(Engine.drawing.start(problem));
    else state.boardState = null;
    state.problem = problem;
    state.actions = problem.actions;
    state.actionIndex = 0;
    state.screen = 'playing';
    state.lockInput = false;
    state.roundClean = true;
    state.fixes = 0;
    els.setupScreen.hidden = true;
    els.gameScreen.hidden = false;
    els.pauseBtn.hidden = false;
    els.consoleMain.hidden = false;
    els.endPanel.hidden = true;
    els.endPanel.className = 'end-panel';
    els.sheetStatus.classList.remove('is-win', 'is-fail');
    els.console.classList.remove('is-tutorial');
    els.turnLabel.textContent = 'Your turn';
    // The dock only holds the Hand in button, so only a test shows it.
    els.console.classList.toggle('no-carry', state.mode !== 'test');
    showSpecialKeys(problem);
    els.console.classList.toggle('is-draw', isDraw(problem));
    // Space and Backspace only where they do something: placing corners and shading.
    els.console.dataset.tool = isDraw(problem) ? problem.board.tool : '';
    els.console.classList.toggle('is-test', state.mode === 'test');
    els.handInBtn.disabled = state.mode !== 'test';
    els.handInLabel.textContent = 'Hand in';
    els.handInBtn.setAttribute('aria-label', 'Hand in (Enter)');
    hideFixNote();
    updateModeUI();
    renderWorksheet(problem);
    updateLadder();
    updateStreak();
    setKeypadEnabled(true);
    if (state.mode === 'test') {
      startTest(problem);
      if (saved) restoreEntries(saved);
    } else {
      if (saved) restoreSteps(saved);
      activateAction();
    }
    blurFocus();
    savePlay();
  }

  // The minus key only for answers that can be below zero, and <, = and >
  // only for a comparison.
  function showSpecialKeys(problem) {
    const minus = Boolean(problem && problem.signBox);
    const compare = Boolean(problem && problem.compareBox);
    els.footMinus.hidden = !minus;
    els.minusKey.hidden = !minus;
    els.keypad.classList.toggle('has-minus', minus);
    els.keypad.classList.toggle('has-compare', compare);
    els.compareKeys.forEach(function (key) { key.hidden = !compare; });
    // "0 nothing to carry" only where there are small boxes to answer.
    els.carryHint.hidden = !(problem && problem.actions.some(function (a) { return a.choice && a.choice !== 'sign'; }));
  }

  // Redraws what a saved round had filled in, in the order it was typed and
  // without sounds or animation. A fix made before closing still counts.
  function restoreSteps(saved) {
    if (isDraw(state.problem)) {
      // The board as it was, or else every step before this one drawn.
      const board = saved.board;
      setBoard(board && Engine.drawing.valid(state.problem, board) ? board : Engine.drawing.solved(state.problem, saved.actionIndex));
      state.actionIndex = saved.actionIndex;
      state.roundClean = saved.roundClean;
      state.fixes = saved.fixes;
      if (!state.roundClean) {
        els.sheetStatus.textContent = 'fixed, keep going';
        els.sheetStatus.classList.add('is-fail');
      }
      return;
    }
    for (let index = 0; index < saved.actionIndex; index += 1) {
      const action = state.actions[index];
      const entry = state.cellEls.get(action.cellId);
      if (action.kind === 'bringdown') {
        if (entry) {
          entry.el.classList.remove('pending');
          entry.el.classList.add('revealed');
          entry.el.textContent = String(action.value);
        }
      } else if (action.kind === 'sign') {
        if (action.value === MINUS) {
          fillCell(entry, MINUS);
        } else if (entry) {
          entry.el.textContent = '';
          entry.el.classList.add('filled', 'skipped');
        }
      } else {
        applyDigit(action, action.value, true);
      }
    }
    state.actionIndex = saved.actionIndex;
    state.roundClean = saved.roundClean;
    state.fixes = saved.fixes;
    if (!state.roundClean) {
      els.sheetStatus.textContent = 'fixed, keep going';
      els.sheetStatus.classList.add('is-fail');
    }
  }

  // Puts back the boxes typed in a test before it was closed. Only what each
  // box could hold is accepted: digits (two in an exchange box), a minus in a
  // sign box, a sign in a comparison box, an answer's name in a choice box.
  function entryFits(cell, text) {
    if (typeof text !== 'string') return false;
    if (cell.signBox) return text === MINUS;
    if (cell.compare) return ['<', '>', '='].indexOf(text) !== -1;
    if (cell.option) {
      return state.problem.options.some(function (o) { return o[1] === text; });
    }
    return /^[0-9]{1,2}$/.test(text);
  }

  function restoreEntries(saved) {
    if (isDraw(state.problem)) {
      const board = saved.entries && saved.entries.board;
      if (board && Engine.drawing.valid(state.problem, board)) setBoard(board);
      renderBoard();
      return;
    }
    Object.keys(saved.entries).forEach(function (cellId) {
      const text = saved.entries[cellId];
      const entry = state.cellEls.get(cellId);
      if (!entry || !isFillable(entry.cell) || !entryFits(entry.cell, text)) return;
      setEntry(cellId, text);
    });
    if (state.cellEls.has(saved.selectedCellId)) selectCell(saved.selectedCellId);
  }

  /* Tutorial: the game works an example, one box at a time, saying why.
     It plays by itself the first time a year is learned, and W replays it
     while learning. Afterwards the area picks up its saved place. */

  function currentExample() {
    return state.tutorial.problems[state.tutorial.index];
  }

  // `walk` (optional) goes through given problems instead of the year's
  // examples: { kind: 'walkthrough', problems } after a missed test problem,
  // or { kind: 'mixed', problems, questions, areas } for the questions of a
  // mixed test that were not right.
  function startTutorial(walk) {
    clearTimer();
    state.tutorial = walk ? {
      kind: walk.kind,
      problems: walk.problems,
      questions: walk.questions || null,
      areas: walk.areas || null,
      index: 0,
      step: 0
    } : {
      kind: 'example',
      problems: Engine.tutorialProblems(state.operation, state.year),
      index: 0,
      step: 0
    };
    state.screen = 'tutorial';
    state.lockInput = false;
    els.setupScreen.hidden = true;
    els.gameScreen.hidden = false;
    els.pauseBtn.hidden = false;
    els.consoleMain.hidden = false;
    els.endPanel.hidden = true;
    els.endPanel.className = 'end-panel';
    els.console.classList.add('is-tutorial', 'no-carry');
    els.console.classList.remove('is-test');
    showSpecialKeys(null);
    els.turnLabel.textContent = state.tutorial.kind === 'example' ? 'Watch' : 'How to solve it';
    els.tutorSkip.firstChild.textContent = { example: 'Skip to my turn ', walkthrough: 'Next problem ', mixed: 'Back to the results ' }[state.tutorial.kind];
    hideFixNote();
    window.scrollTo(0, 0);
    savePlay();
    showTutorialStep();
  }

  // After a wrong test answer: the same problem, worked one box at a time
  // with the reason for each, then the next problem.
  function startWalkthrough() {
    if (state.screen !== 'testFailed' || !state.problem) return;
    ensureAudio();
    startTutorial({ kind: 'walkthrough', problems: [state.problem] });
  }

  // After a mixed test is marked: every question that was not right, in
  // order, then back to the results.
  function startMixedWalkthrough() {
    if (state.screen !== 'mixedResults' || !state.mixed) return;
    const m = state.mixed;
    const missed = markMixed(m).map(function (r, k) { return r.correct ? -1 : k; }).filter(function (k) { return k >= 0; });
    if (!missed.length) return;
    ensureAudio();
    els.endPanel.className = 'end-panel';
    startTutorial({
      kind: 'mixed',
      problems: missed.map(function (k) { return mixedQuestion(m, k); }),
      questions: missed,
      areas: missed.map(function (k) { return m.areas[k]; })
    });
  }

  // Writes one step's box the way play does, and marks it as the step shown.
  function showTutorialAction(action) {
    const entry = state.cellEls.get(action.cellId);
    if (action.kind === 'bringdown') {
      if (entry) {
        entry.el.classList.remove('pending');
        entry.el.classList.add('revealed');
        entry.el.textContent = String(action.value);
      }
      playSound('bring');
    } else if (action.kind === 'sign') {
      if (action.value === MINUS) {
        fillCell(entry, MINUS, 'just-filled');
      } else if (entry) {
        entry.el.textContent = '';
        entry.el.classList.add('filled', 'skipped');
      }
      playSound('tick');
    } else {
      applyDigit(action, action.value);
      playSound('tick');
    }
    const rowEl = state.rowEls.get(action.rowId);
    if (rowEl) rowEl.classList.add('is-active');
    if (entry) {
      entry.el.classList.add('tutor-step');
      revealActiveCell(entry.el);
    }
  }

  // Step 0 introduces the example, steps 1 to n each write one box with the
  // reason for it, and the last step shows the answer.
  function showTutorialStep() {
    const tutorial = state.tutorial;
    const problem = currentExample();
    const count = problem.actions.length;
    const more = tutorial.index + 1 < tutorial.problems.length;
    const mixed = tutorial.kind === 'mixed';
    state.problem = problem;
    state.actions = problem.actions;
    if (mixed) {
      state.operation = tutorial.areas[tutorial.index];
      document.body.dataset.area = state.operation;
    }
    const drawn = Math.min(tutorial.step, count);
    if (isDraw(problem)) setBoard(drawn ? Engine.drawing.solved(problem, drawn) : Engine.drawing.start(problem));
    renderWorksheet(problem);
    if (mixed) {
      const stage = document.createElement('span');
      stage.className = 'mode-stage';
      stage.textContent = 'Going over';
      els.modeChip.textContent = 'Mixed test';
      els.modeChip.appendChild(stage);
      els.modeShape.textContent = 'Question ' + (tutorial.questions[tutorial.index] + 1) + ' of ' + state.mixed.count + ': ' + AREA_INFO[state.operation].name;
      updateMixedClock();
    } else {
      updateModeUI();
      updateLadder();
      updateStreak();
    }
    const written = drawn;
    const action = written >= 1 ? problem.actions[written - 1] : null;
    if (isDraw(problem)) {
      renderBoard({ step: written >= 1 && written <= count ? written - 1 : null });
      if (action) playSound('tick');
    } else {
      restoreSteps({ actionIndex: Math.max(0, written - 1), roundClean: true, fixes: 0 });
      if (action) showTutorialAction(action);
    }

    let example;
    if (tutorial.kind === 'walkthrough') example = 'How to solve it';
    else if (mixed) example = 'Question ' + (tutorial.questions[tutorial.index] + 1) + ' (' + (tutorial.index + 1) + ' of ' + tutorial.problems.length + ' to go over)';
    else example = 'Example ' + (tutorial.index + 1) + ' of ' + tutorial.problems.length;
    let stage;
    let stepText;
    let prompt;
    let detail;
    if (tutorial.step === 0) {
      stage = tutorial.kind === 'example' ? 'Example' : 'How to';
      stepText = example;
      prompt = tutorial.kind === 'example' ? 'Watch an example: ' + problem.title.toLowerCase() + '.' : 'Here is how to solve it, one step at a time.';
      detail = problem.question + ' Press Enter or the right arrow to see each step.';
    } else if (tutorial.step <= count) {
      stage = titleCase(action.stage);
      stepText = example + ', step ' + tutorial.step + ' of ' + count;
      prompt = action.prompt;
      detail = action.why;
    } else {
      stage = 'Answer';
      stepText = example + ', finished';
      prompt = problem.answer.expression;
      if (tutorial.kind === 'walkthrough') {
        detail = 'That is how to solve it. Press Enter for the next problem.';
      } else if (mixed) {
        detail = more ? 'Next: question ' + (tutorial.questions[tutorial.index + 1] + 1) + '.' : 'That was the last one. Press Enter to go back to your results.';
      } else {
        detail = more
          ? 'Next, an example of ' + tutorial.problems[tutorial.index + 1].title.toLowerCase() + '.'
          : 'Now it is your turn. Press Enter to start.';
      }
      problem.answerRowIds.forEach(function (rowId) {
        const rowEl = state.rowEls.get(rowId);
        if (rowEl) rowEl.classList.add('answer-solved');
      });
    }
    if (action && tutorial.step <= count) {
      updateRowMapForAction(action.groupId);
    } else if (tutorial.step > count) {
      markAllGroupsDone();
    }
    els.stageChip.textContent = stage;
    els.stepLine.textContent = stepText;
    els.prompt.textContent = prompt;
    els.subprompt.textContent = detail;
    els.sheetStatus.textContent = example.toLowerCase();
    els.sheetStatus.classList.remove('is-win', 'is-fail');
    els.tutorBack.disabled = tutorial.index === 0 && tutorial.step === 0;
    let last = 'My turn ';
    if (tutorial.kind === 'walkthrough') last = 'Next problem ';
    if (mixed) last = 'Results ';
    els.tutorNext.firstChild.textContent = tutorial.step > count && !more ? last : 'Next ';
    els.liveRegion.textContent = stepText + '. ' + prompt + ' ' + detail;
  }

  function tutorialNext() {
    if (state.screen !== 'tutorial') return;
    ensureAudio();
    const tutorial = state.tutorial;
    if (tutorial.step <= currentExample().actions.length) {
      tutorial.step += 1;
    } else if (tutorial.index + 1 < tutorial.problems.length) {
      tutorial.index += 1;
      tutorial.step = 0;
    } else {
      finishTutorial();
      return;
    }
    showTutorialStep();
  }

  function tutorialBack() {
    if (state.screen !== 'tutorial') return;
    const tutorial = state.tutorial;
    if (tutorial.step > 0) {
      tutorial.step -= 1;
    } else if (tutorial.index > 0) {
      tutorial.index -= 1;
      tutorial.step = currentExample().actions.length + 1;
    } else {
      return;
    }
    showTutorialStep();
  }

  function finishTutorial() {
    if (state.screen !== 'tutorial') return;
    const kind = state.tutorial.kind;
    state.tutorial = null;
    if (kind === 'walkthrough') {
      // The missed round is already counted; the test carries on.
      loadProblem(Engine.generateProblem(state.operation, state.year));
      return;
    }
    if (kind === 'mixed') {
      state.mixed.walked = true;
      saveMixed();
      showMixedResults(state.reviewIndex);
      return;
    }
    const operation = state.operation;
    markWatched(operation, state.year);
    beginArea(operation);
  }

  // W replays the example while learning. A test is the child's own work.
  function watchExample() {
    if (!state.operation || state.mode !== 'guided' || state.pendingTest || state.pendingYear) return;
    if (state.screen !== 'playing' && state.screen !== 'won' && state.screen !== 'fixed') return;
    ensureAudio();
    startTutorial();
  }

  function retryProblem() {
    if (state.screen !== 'fixed' || !state.problem) return;
    ensureAudio();
    loadProblem(state.problem);
  }

  function newProblem() {
    if (state.screen !== 'fixed' && state.screen !== 'testFailed') return;
    ensureAudio();
    loadProblem(Engine.generateProblem(state.operation, state.year));
  }

  function nextProblem() {
    if (state.screen !== 'won') return;
    ensureAudio();
    const pendingYear = state.pendingYear;
    const pendingTest = state.pendingTest;
    state.pendingYear = null;
    state.pendingTest = false;
    if (pendingTest) {
      state.mode = 'test';
      state.cleanStreak = 0;
    } else if (pendingYear) {
      state.year = pendingYear;
      state.mode = phaseFor(state.operation, state.year);
      state.cleanStreak = 0;
      if (state.mode === 'guided' && !hasWatched(state.operation, state.year)) {
        startTutorial();
        return;
      }
    }
    loadProblem(Engine.generateProblem(state.operation, state.year));
  }

  function updateModeUI() {
    if (!state.operation) return;
    const info = AREA_INFO[state.operation];
    const stage = document.createElement('span');
    stage.className = 'mode-stage';
    let label = state.mode === 'test' ? 'Test' : 'Learning';
    if (state.screen === 'tutorial') label = state.tutorial && state.tutorial.kind === 'walkthrough' ? 'Going over' : 'Example';
    stage.textContent = label;
    els.modeChip.textContent = info.name;
    els.modeChip.appendChild(stage);
    els.modeShape.textContent = 'Year ' + state.year + ': ' + YEAR_INFO[state.year][state.operation];
    // The area's book colour frames the page, the controls and the pause panel.
    document.body.dataset.area = state.operation;
  }

  /* Worksheet */

  // Year 1 dot rows are plain dots; every other picture is drawn by
  // pictures.js from the problem's data.
  function renderPicture(picture) {
    if (picture.kind) return window.DigitStackPictures.render(picture);
    const grid = document.createElement('div');
    grid.className = 'dot-picture';
    grid.style.gridTemplateColumns = 'repeat(' + picture.cols + ', auto)';
    for (let i = 0; i < picture.rows * picture.cols; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      grid.appendChild(dot);
    }
    return grid;
  }

  // A column that holds nothing but decimal points is drawn narrow, so 23.40
  // reads as one number and the working under it stays in its columns.
  function columnTemplate(problem) {
    const widths = [];
    for (let col = 0; col < problem.width; col++) {
      let points = 0;
      let other = 0;
      problem.rows.forEach(function (row) {
        if (row.kind === 'rule') return;
        const cell = row.cells[col];
        if (!cell) return;
        if (cell.point) points += 1;
        else other += 1;
      });
      widths.push(points && !other ? 'var(--point)' : 'var(--cell)');
    }
    return (problem.noGutter ? '' : 'var(--gutter) ') + widths.join(' ');
  }

  function cellClasses(cell) {
    let cellClass = 'cell ' + cell.kind;
    if (cell.kind === 'carry') cellClass += ' carry-slot';
    if (cell.shiftZero) cellClass += ' shift-zero';
    if (cell.sign) cellClass += ' sign-cell';
    if (cell.signBox) cellClass += ' sign-box';
    if (cell.remainderLabel) cellClass += ' remainder-label';
    if (cell.kind === 'bringdown') cellClass += ' pending';
    if (cell.point) cellClass += ' point-cell';
    if (cell.placeholder) cellClass += ' placeholder';
    if (cell.unit) cellClass += ' unit-cell';
    if (cell.bar) cellClass += ' bar-cell';
    if (cell.power) cellClass += ' power-cell';
    if (cell.compare) cellClass += ' compare-box';
    if (cell.option) cellClass += ' option-box';
    if (cell.comma) cellClass += ' has-comma';
    if (cell.mark) cellClass += ' marked-digit';
    if (cell.colon) cellClass += ' colon-cell';
    if (cell.symbol) cellClass += /[a-z]/.test(String(cell.value)) ? ' symbol-cell letter-cell' : ' symbol-cell';
    return cellClass;
  }

  // Shapes that stand for numbers in algebra, drawn rather than typed: the
  // characters differ a lot in size from one font to another.
  const SYMBOL_SHAPES = {
    '★': '<polygon points="50,4 62,37 97,37 69,58 79,93 50,72 21,93 31,58 3,37 38,37"/>',
    '▲': '<polygon points="50,8 94,90 6,90"/>',
    '●': '<circle cx="50" cy="50" r="42"/>',
    '■': '<rect x="10" y="10" width="80" height="80"/>',
    '♦': '<polygon points="50,4 92,50 50,96 8,50"/>'
  };

  function symbolShape(symbol) {
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    shape.setAttribute('viewBox', '0 0 100 100');
    shape.setAttribute('class', 'symbol-shape');
    shape.setAttribute('aria-hidden', 'true');
    shape.innerHTML = SYMBOL_SHAPES[symbol];
    return shape;
  }

  // The choices for a numbered answer, under the sentence.
  function renderLegend(options) {
    const legend = document.createElement('div');
    legend.className = 'option-legend';
    options.forEach(function (option) {
      const chip = document.createElement('span');
      chip.className = 'legend-chip';
      chip.dataset.key = String(option[0]);
      const key = document.createElement('kbd');
      key.textContent = String(option[0]);
      chip.appendChild(key);
      chip.appendChild(document.createTextNode(' ' + option[1]));
      legend.appendChild(chip);
    });
    return legend;
  }

  // A sentence or a picture wider than the page shrinks its boxes to fit.
  function fitSheet() {
    const holder = els.worksheet.parentElement;
    els.worksheet.style.removeProperty('--cell');
    if (!holder || !holder.clientWidth || els.gameScreen.hidden) return;
    for (let pass = 0; pass < 2; pass++) {
      // The laid-out width: the pencil label over the active box may hang
      // over the edge without making the page scroll.
      const available = holder.clientWidth - 8;
      const needed = els.worksheet.offsetWidth;
      if (needed <= available) return;
      const probe = document.createElement('div');
      probe.className = 'cell-probe';
      els.worksheet.appendChild(probe);
      const cell = probe.getBoundingClientRect().width;
      probe.remove();
      if (!cell) return;
      els.worksheet.style.setProperty('--cell', Math.max(16, Math.floor(cell * available / needed)) + 'px');
    }
  }

  function renderWorksheet(problem) {
    // A sentence, a fact or a drawing has its question on the page too; a
    // written method shows its numbers in the layout itself.
    const written = ['sentence', 'fact', 'draw'].indexOf(problem.method) === -1;
    els.sheetQuestion.hidden = written;
    els.sheetQuestion.textContent = written ? '' : problem.question;
    els.worksheet.innerHTML = '';
    els.worksheet.classList.toggle('is-board', isDraw(problem));
    if (isDraw(problem)) {
      els.worksheet.classList.remove('is-sentence', 'is-stacked');
      state.cellEls.clear();
      state.rowEls.clear();
      state.groupChips.clear();
      renderBoard();
      els.sheetTitle.textContent = problem.title;
      els.rowMap.innerHTML = '';
      els.rowMap.setAttribute('aria-label', 'Progress through the drawing');
      problem.groups.forEach(function (group) {
        const chip = document.createElement('span');
        chip.className = 'row-chip';
        chip.dataset.groupId = group.id;
        chip.textContent = group.label;
        state.groupChips.set(group.id, chip);
        els.rowMap.appendChild(chip);
      });
      return;
    }
    els.worksheet.classList.toggle('is-sentence', problem.method === 'fact' || problem.method === 'sentence');
    els.worksheet.classList.toggle('is-stacked', problem.rows.some(function (row) { return row.part === 'top'; }));
    state.cellEls.clear();
    state.rowEls.clear();
    state.groupChips.clear();
    const template = columnTemplate(problem);
    const fragment = document.createDocumentFragment();
    if (problem.picture) fragment.appendChild(renderPicture(problem.picture));

    problem.rows.forEach(function (row, rowIndex) {
      const rowEl = document.createElement('div');
      rowEl.dataset.rowId = row.id;
      // The lines of a question with several (two worked, one to do) are
      // spaced apart.
      const lineStart = row.line > 0 && problem.rows[rowIndex - 1].line !== row.line;

      if (row.kind === 'rule') {
        rowEl.className = 'row rule' +
          (row.thick ? ' thick' : '') +
          (row.thin ? ' thin' : '') +
          (row.bracket ? ' bracket' : '');
        rowEl.style.gridTemplateColumns = template;
        const line = document.createElement('div');
        line.className = 'rule-line';
        line.style.gridColumn = (row.lineStart + 2) + ' / ' + (row.lineEnd + 3);
        rowEl.appendChild(line);
        state.rowEls.set(row.id, rowEl);
        fragment.appendChild(rowEl);
        return;
      }

      rowEl.className = 'row row-' + row.kind +
        (row.part ? ' row-part-' + row.part : '') +
        (row.isOperator ? ' is-operator' : '') +
        (row.kind === 'dividend' ? ' dividend' : '') +
        (row.kind === 'sum' ? ' sum' : '') +
        (row.inBracket ? ' in-bracket' : '') +
        (row.isExchange ? ' is-exchange' : '') +
        (lineStart ? ' line-start' : '');
      rowEl.style.gridTemplateColumns = template;

      if (!problem.noGutter) {
        const gutter = document.createElement('div');
        gutter.className = 'gutter';
        let gutterText = row.gutter || '';
        if (row.kind === 'sum' && !gutterText && problem.operation === 'multiply') gutterText = '=';
        gutter.textContent = gutterText;
        gutter.setAttribute('aria-hidden', 'true');
        rowEl.appendChild(gutter);
      }

      for (let col = 0; col < problem.width; col++) {
        const cell = row.cells[col];
        if (!cell) {
          const blank = document.createElement('div');
          blank.className = 'cell blank';
          blank.setAttribute('aria-hidden', 'true');
          rowEl.appendChild(blank);
          continue;
        }
        const cellEl = document.createElement('div');
        cellEl.className = cellClasses(cell);
        cellEl.dataset.cellId = cell.id;
        cellEl.dataset.col = String(col);
        // Words, units and choice boxes run across several columns.
        if (cell.span > 1) {
          cellEl.style.gridColumn = 'span ' + cell.span;
          col += cell.span - 1;
        }
        if (cell.kind === 'given' && SYMBOL_SHAPES[cell.value]) {
          cellEl.dataset.symbol = cell.value;
          cellEl.appendChild(symbolShape(cell.value));
        } else if (cell.kind === 'given') {
          cellEl.textContent = String(cell.value);
        } else if (cell.kind === 'bringdown') {
          // In a test the child writes the brought-down digit themselves; a
          // walkthrough of a test problem brings it down as learning does.
          if (state.mode === 'test' && state.screen !== 'tutorial') {
            cellEl.classList.remove('pending');
            cellEl.classList.add('test-box');
          } else {
            cellEl.textContent = '↓';
          }
        }
        state.cellEls.set(cell.id, { el: cellEl, cell: cell, row: row });
        rowEl.appendChild(cellEl);
      }

      state.rowEls.set(row.id, rowEl);
      fragment.appendChild(rowEl);
    });

    if (problem.options) fragment.appendChild(renderLegend(problem.options));
    els.worksheet.appendChild(fragment);
    fitSheet();
    els.sheetTitle.textContent = problem.title;
    els.rowMap.innerHTML = '';
    els.rowMap.setAttribute('aria-label', 'Progress through the fillable rows');
    problem.groups.forEach(function (group) {
      const chip = document.createElement('span');
      chip.className = 'row-chip';
      chip.dataset.groupId = group.id;
      chip.textContent = group.label;
      state.groupChips.set(group.id, chip);
      els.rowMap.appendChild(chip);
    });
  }

  /* Drawing questions: the board is drawn from its state; keys change the
     state; Enter says a step (or, in a test, the drawing) is done. */

  function isDraw(problem) {
    return Boolean(problem && problem.method === 'draw');
  }

  function setBoard(next) {
    state.boardState = next;
    state.entries = new Map([['board', next]]);
  }

  // The part being drawn is highlighted while it can be changed.
  function boardView() {
    if (state.screen !== 'playing' || state.lockInput) return { step: null };
    return { step: state.mode === 'test' ? 0 : state.actionIndex };
  }

  function renderBoard(view) {
    els.worksheet.innerHTML = '';
    els.worksheet.appendChild(window.DigitStackPictures.board(state.problem, state.boardState, view || boardView()));
  }

  function pressBoard(name) {
    if (state.screen !== 'playing' || state.lockInput || !isDraw(state.problem)) return;
    ensureAudio();
    const guided = state.mode !== 'test';
    if (!guided) resetHandInWarning();
    const result = Engine.drawing.press(state.problem, state.boardState, name, guided ? { step: state.actionIndex, guided: true } : {});
    if (!result) return;
    // In learning, corners already checked stay where they are.
    if (guided && result.event === 'remove') return;
    setBoard(result.state);
    if (result.event === 'toggle' || result.event === 'place') playSound('tick');
    renderBoard();
    savePlay();
    if (guided && result.event === 'place' && Engine.drawing.checkOn(state.problem) === 'place') checkDrawStep('place');
  }

  // Learning: the step is checked when it is done (Enter), or as a corner is
  // placed on a grid.
  function checkDrawStep(trigger) {
    if (state.screen !== 'playing' || state.mode === 'test' || state.lockInput || !isDraw(state.problem)) return;
    ensureAudio();
    if (trigger === 'enter' && Engine.drawing.checkOn(state.problem) === 'place') {
      const compass = state.problem.board.tool === 'compass';
      els.liveRegion.textContent = compass ? 'Each arc and line is checked as you draw it.' : 'Move the pencil to the point and press Space to put the corner there.';
      els.fixNote.textContent = compass ? 'Each arc and line is checked as you draw it: Space draws an arc, L at two points draws a line.'
        : 'Each corner is checked as you put it down: move the pencil and press Space.';
      els.fixNote.hidden = false;
      return;
    }
    const why = Engine.drawing.check(state.problem, state.boardState, state.actionIndex);
    if (why !== null) {
      drawMiss(why, trigger);
      return;
    }
    hideFixNote();
    playSound('carry');
    state.actionIndex += 1;
    if (state.actionIndex >= state.actions.length) {
      state.lockInput = true;
      renderBoard({ step: null });
      finishProblem();
      return;
    }
    savePlay();
    activateAction();
  }

  function drawMiss(why, trigger) {
    const firstMiss = state.roundClean;
    state.roundClean = false;
    state.fixes += 1;
    state.cleanStreak = 0;
    state.pendingYear = null;
    // A wrong corner, arc or line is taken off again, to be drawn afresh.
    if (trigger === 'place') {
      setBoard(Engine.drawing.undo(state.problem, state.boardState));
      renderBoard();
    }
    savePlay();
    els.fixNote.textContent = 'Not quite. ' + why;
    els.fixNote.hidden = false;
    updateStreak();
    els.sheetStatus.textContent = 'Fix the drawing';
    els.sheetStatus.classList.remove('is-win');
    els.sheetStatus.classList.add('is-fail');
    els.sheet.classList.remove('is-shaking');
    void els.sheet.offsetWidth;
    els.sheet.classList.add('is-shaking');
    window.setTimeout(function () { els.sheet.classList.remove('is-shaking'); }, 500);
    playSound('miss');
    els.liveRegion.textContent = 'Not quite. ' + why + (firstMiss ? ' This round no longer counts as clean, so the clean count is back to 0.' : '');
  }

  // Keys for a drawing; true when the key was used.
  function drawKey(event) {
    const key = event.key;
    if (key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) {
        if (state.mode === 'test') handIn();
        else checkDrawStep('enter');
      }
      return true;
    }
    let name = null;
    if (/^Arrow/.test(key)) name = (event.shiftKey ? 'Shift+' : '') + key;
    else if (key === ' ' || key === 'Spacebar') name = ' ';
    else if (key === 'Backspace' || key === 'Delete' || key === 'PageUp' || key === 'PageDown') name = key;
    else if (key === 'Tab') name = state.mode === 'test' && !event.shiftKey ? 'Tab' : null;
    else if (state.problem.board.tool === 'compass' && (key === '+' || key === '=')) name = '+';
    else if (state.problem.board.tool === 'compass' && (key === '-' || key === MINUS)) name = '-';
    else if (state.problem.board.tool === 'compass' && (key === 'l' || key === 'L')) name = 'L';
    else if (/^[0-9]$/.test(key) || key === '-' || key === MINUS) {
      // Nothing is typed on a drawing.
      event.preventDefault();
      return true;
    }
    if (key === 'Tab') event.preventDefault();
    if (!name) return key === 'Tab';
    event.preventDefault();
    if (name === ' ' && event.repeat) return true;
    pressBoard(name);
    return true;
  }

  function clearActiveMarks() {
    els.worksheet.querySelectorAll('.cell.active, .cell.bringdown-active').forEach(function (el) {
      el.classList.remove('active', 'bringdown-active');
      el.removeAttribute('data-flag');
    });
    els.worksheet.querySelectorAll('.row.is-active').forEach(function (el) {
      el.classList.remove('is-active');
    });
  }

  function setKeypadEnabled(enabled) {
    els.keypad.classList.toggle('is-locked', !enabled);
    els.keypad.setAttribute('aria-disabled', String(!enabled));
    els.keypad.querySelectorAll('button').forEach(function (button) {
      button.disabled = !enabled;
    });
  }

  function currentAction() {
    return state.actions[state.actionIndex] || null;
  }

  function activateAction() {
    const action = currentAction();
    if (!action) {
      finishProblem();
      return;
    }

    clearActiveMarks();
    if (isDraw(state.problem)) {
      state.lockInput = false;
      setKeypadEnabled(true);
      renderBoard();
      updateActionUI(action);
      announceAction(action);
      return;
    }
    const entry = state.cellEls.get(action.cellId);
    if (!entry) throw new Error('Missing cell for action ' + action.cellId);
    const rowEl = state.rowEls.get(action.rowId);
    state.lockInput = false;

    if (action.kind === 'bringdown') {
      state.lockInput = true;
      entry.el.classList.add('bringdown-active');
      if (rowEl) rowEl.classList.add('is-active');
      setKeypadEnabled(false);
      state.timer = window.setTimeout(function () {
        resolveBringdown(action);
      }, 480);
    } else {
      // Digits, moves and signs all mark the same kind of box, so the box
      // never tells the child which of them is due.
      entry.el.classList.add('active');
      entry.el.dataset.flag = 'type';
      if (rowEl) rowEl.classList.add('is-active');
      setKeypadEnabled(true);
    }

    updateActionUI(action);
    announceAction(action);
    revealActiveCell(entry.el);
  }

  function updateActionUI(action) {
    els.stageChip.textContent = titleCase(action.stage);
    els.prompt.textContent = action.prompt;
    els.subprompt.textContent = action.subprompt;
    let label;
    if (isDraw(state.problem)) {
      label = 'Draw it' + (state.problem.steps.length > 1 ? ', step ' + (state.actionIndex + 1) + ' of ' + state.problem.steps.length : '');
    } else if (!state.problem.groupWord) {
      label = 'Type the answer';
    } else {
      const groupIndex = Math.max(0, state.problem.groups.findIndex(function (group) {
        return group.id === action.groupId;
      }));
      label = state.problem.groupWord + ' ' + (groupIndex + 1) + ' of ' + state.problem.groups.length;
    }
    els.stepLine.textContent = label;
    if (state.roundClean) {
      els.sheetStatus.textContent = label.toLowerCase();
      els.sheetStatus.classList.remove('is-win', 'is-fail');
    }
    updateRowMapForAction(action.groupId);
  }

  function updateRowMapForAction(groupId) {
    const groups = state.problem.groups;
    const current = groups.findIndex(function (group) { return group.id === groupId; });
    groups.forEach(function (group, index) {
      const chip = state.groupChips.get(group.id);
      if (!chip) return;
      chip.classList.toggle('is-done', index < current);
      chip.classList.toggle('is-active', index === current);
      chip.classList.remove('is-missed');
    });
  }

  function markAllGroupsDone() {
    state.problem.groups.forEach(function (group) {
      const chip = state.groupChips.get(group.id);
      if (!chip) return;
      chip.classList.add('is-done');
      chip.classList.remove('is-active', 'is-missed');
    });
  }

  function announceAction(action) {
    let message = els.stepLine.textContent + '. ' + titleCase(action.stage) + '. ' +
      action.prompt + ' ' + action.subprompt;
    if (action.kind === 'sign') {
      message += ' Press minus for an answer below zero, or type the first digit.';
    } else if (action.choice) {
      message += ' Type the small digit, or 0 if there is none.';
    } else if (action.kind === 'digit') {
      message += ' Type a digit.';
    }
    els.liveRegion.textContent = message;
  }

  function revealActiveCell(el) {
    window.requestAnimationFrame(function () {
      if (!el || !el.isConnected || (state.screen !== 'playing' && state.screen !== 'tutorial')) return;
      if (state.helpOpen || state.pauseOpen) return;
      const rect = el.getBoundingClientRect();
      const padY = 54;
      const padX = 24;
      let dx = 0;
      let dy = 0;
      if (rect.top < padY) {
        dy = rect.top - padY;
      } else if (rect.bottom > window.innerHeight - padY) {
        dy = rect.bottom - (window.innerHeight - padY);
      }
      if (rect.left < padX) {
        dx = rect.left - padX;
      } else if (rect.right > window.innerWidth - padX) {
        dx = rect.right - (window.innerWidth - padX);
      }
      if (dx !== 0 || dy !== 0) {
        window.scrollBy({ left: dx, top: dy, behavior: 'auto' });
      }
    });
  }

  function flashKey(selector) {
    const key = els.keypad.querySelector(selector);
    if (!key) return;
    key.classList.add('just-pressed');
    window.setTimeout(function () { key.classList.remove('just-pressed'); }, 120);
  }

  function fillCell(entry, value, animationClass) {
    if (!entry) return;
    entry.el.textContent = String(value);
    entry.el.classList.add('filled');
    if (animationClass) {
      entry.el.classList.add(animationClass);
      window.setTimeout(function () {
        entry.el.classList.remove(animationClass);
      }, 320);
    }
  }

  function crossOut(cellId) {
    const entry = state.cellEls.get(cellId);
    if (entry) entry.el.classList.add('crossed');
  }

  // A typed digit can also cross out the top digit it replaces and fill the
  // receiving column of an exchange. A 0 at a small box writes nothing; the
  // box is only marked as checked.
  function applyDigit(action, digit, quiet) {
    const entry = state.cellEls.get(action.cellId);
    clearMissMark(action);
    if (action.shown === null) {
      if (entry && !entry.el.textContent) entry.el.classList.add('zeroed');
    } else {
      fillCell(entry, action.shown !== undefined ? action.shown : digit,
        quiet ? null : (entry && entry.cell.kind === 'carry' ? 'just-carried' : 'just-filled'));
    }
    if (action.crossCellId) crossOut(action.crossCellId);
    (action.alsoFill || []).forEach(function (fill) {
      fillCell(state.cellEls.get(fill.cellId), fill.value, quiet ? null : 'just-carried');
      const filled = state.cellEls.get(fill.cellId);
      if (filled) filled.el.classList.add('auto-filled');
      if (fill.crossCellId) crossOut(fill.crossCellId);
    });
  }

  function advance(steps) {
    state.actionIndex += steps;
    if (state.actionIndex >= state.actions.length) {
      finishProblem();
      return;
    }
    savePlay();
    activateAction();
  }

  function submitDigit(digit) {
    if (state.screen !== 'playing' || state.lockInput) return;
    const action = currentAction();
    if (!action) return;
    ensureAudio();
    flashKey('button[data-digit="' + digit + '"]');

    if (action.kind === 'sign') {
      const next = state.actions[state.actionIndex + 1];
      if (action.value === '+' && digit === action.firstDigit) {
        clearMissMark(action);
        const signEntry = state.cellEls.get(action.cellId);
        if (signEntry) {
          signEntry.el.textContent = '';
          signEntry.el.classList.add('filled', 'skipped');
        }
        applyDigit(next, digit);
        playSound('tick');
        advance(2);
        return;
      }
      handleMiss(
        action,
        String(digit),
        'Not quite. ' + action.why,
        action.value === MINUS ? MINUS : String(action.firstDigit)
      );
      return;
    }
    if (action.kind !== 'digit') return;

    if (digit !== action.value) {
      if (action.option) {
        // A numbered answer shows the name of the one typed.
        const typed = state.problem.options.find(function (o) { return o[0] === digit; });
        handleMiss(action, typed ? typed[1] : String(digit), 'Not quite. The answer is ' + action.shown + '. ' + action.why,
          action.shown);
        return;
      }
      handleMiss(action, String(digit), 'Not quite. This box needs ' + action.value + '. ' + action.why,
        String(action.value));
      return;
    }
    applyDigit(action, digit);
    playSound('tick');
    advance(1);
  }

  // <, > and = go in a comparison box.
  const COMPARE_KEYS = { '<': '<', ',': '<', '>': '>', '.': '>', '=': '=' };

  function submitCompare(symbol) {
    if (state.screen !== 'playing' || state.lockInput) return;
    const action = currentAction();
    if (!action || action.kind !== 'compare') return;
    ensureAudio();
    flashKey('button[data-compare="' + symbol + '"]');
    if (symbol !== action.value) {
      handleMiss(action, symbol, 'Not quite. ' + action.why, action.value);
      return;
    }
    applyDigit(action, symbol);
    playSound('tick');
    advance(1);
  }

  function submitMinus() {
    if (state.screen !== 'playing' || state.lockInput) return;
    const action = currentAction();
    if (!action || action.kind !== 'sign') return;
    ensureAudio();
    flashKey('#minusKey');
    if (action.value === MINUS) {
      const entry = state.cellEls.get(action.cellId);
      clearMissMark(action);
      fillCell(entry, MINUS, 'just-filled');
      playSound('tick');
      advance(1);
      return;
    }
    handleMiss(action, MINUS, 'Not quite. ' + action.why, String(action.firstDigit));
  }

  function resolveBringdown(action) {
    state.timer = null;
    if (state.screen !== 'playing' || currentAction() !== action) return;
    const entry = state.cellEls.get(action.cellId);
    if (entry) {
      entry.el.classList.remove('pending', 'bringdown-active');
      entry.el.classList.add('revealed');
      entry.el.textContent = String(action.value);
    }
    playSound('bring');
    state.lockInput = false;
    advance(1);
  }

  function clearTimer() {
    if (state.timer !== null) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
  }

  /* Mistakes: show why, then let the right input go in. */

  function hideFixNote() {
    els.fixNote.hidden = true;
    els.fixNote.textContent = '';
  }

  // A box can already show a value (an exchange box that gave a ten away),
  // so a wrong digit is shown over it and the old value comes back after.
  function clearMissMark(action) {
    const entry = state.cellEls.get(action.cellId);
    if (entry && entry.el.classList.contains('wrong')) {
      entry.el.classList.remove('wrong');
      entry.el.textContent = entry.el.dataset.before || '';
      delete entry.el.dataset.before;
    }
    const rowEl = state.rowEls.get(action.rowId);
    if (rowEl) rowEl.classList.remove('is-failed');
    hideFixNote();
    if (!state.roundClean) {
      els.sheetStatus.textContent = 'fixed, keep going';
    }
  }

  function handleMiss(action, shownText, note, needed) {
    const firstMiss = state.roundClean;
    state.roundClean = false;
    state.fixes += 1;
    state.cleanStreak = 0;
    state.pendingYear = null;
    // Saved at once, so closing the game cannot undo a mistake.
    savePlay();

    const entry = state.cellEls.get(action.cellId);
    if (entry) {
      if (!entry.el.classList.contains('wrong')) entry.el.dataset.before = entry.el.textContent;
      entry.el.textContent = shownText;
      entry.el.classList.add('wrong');
      entry.el.dataset.flag = '✓ ' + needed;
    }
    const rowEl = state.rowEls.get(action.rowId);
    if (rowEl) rowEl.classList.add('is-failed');

    els.fixNote.textContent = note;
    els.fixNote.hidden = false;
    updateStreak();
    els.sheetStatus.textContent = 'Fix this box';
    els.sheetStatus.classList.remove('is-win');
    els.sheetStatus.classList.add('is-fail');

    els.sheet.classList.remove('is-shaking');
    void els.sheet.offsetWidth;
    els.sheet.classList.add('is-shaking');
    window.setTimeout(function () { els.sheet.classList.remove('is-shaking'); }, 500);

    playSound('miss');
    els.liveRegion.textContent = note + ' The box needs ' + needed + '.' +
      (firstMiss ? ' This round no longer counts as clean, so the clean count is back to 0.' : '');
  }

  /* Ladder and clean-round meter */

  function updateLadder() {
    const promotionWin = state.screen === 'won' && state.pendingYear !== null &&
      state.pendingYear !== state.year;
    Array.from(els.gameLadder.children).forEach(function (item) {
      const year = Number(item.dataset.year);
      item.classList.remove('is-done', 'is-current', 'is-next');
      if (year === state.year) {
        item.classList.add(promotionWin ? 'is-done' : 'is-current');
      } else if (hasPassed(state.operation, year)) {
        item.classList.add('is-done');
      }
      if (promotionWin && year === state.pendingYear) {
        item.classList.add('is-next');
      }
    });
  }

  function buildStreakMeter(count) {
    els.streakMeter.innerHTML = '';
    els.streakMeter.setAttribute('aria-valuemax', String(count));
    for (let i = 0; i < count; i++) {
      const pip = document.createElement('span');
      pip.setAttribute('aria-hidden', 'true');
      els.streakMeter.appendChild(pip);
    }
  }

  function updateStreak() {
    const target = cleanTarget();
    if (els.streakMeter.children.length !== target) buildStreakMeter(target);
    const shown = Math.max(0, Math.min(state.cleanStreak, target));
    const pips = els.streakMeter.children;
    for (let i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('is-on', i < shown);
    }
    els.streakMeter.setAttribute('aria-valuenow', String(shown));
    els.streakMeter.setAttribute('aria-valuetext', shown + ' of ' + target + ' clean rounds');
    els.streakChip.classList.toggle('is-full', shown >= target);
    els.gateLabel.textContent = state.mode === 'test' ? 'Test streak' : 'Learning streak';
    els.streakValue.textContent = shown + ' / ' + target;
    if (state.pendingTest) {
      els.gateLine.textContent = 'Year ' + state.year + ' test unlocked';
    } else if (state.pendingYear && state.pendingYear !== state.year) {
      els.gateLine.textContent = 'Year ' + state.pendingYear + ' unlocked';
    } else if (state.mode === 'test') {
      els.gateLine.textContent = 'Year ' + state.year + ' test' +
        (hasPassed(state.operation, state.year) ? ' passed' : '');
    } else {
      els.gateLine.textContent = 'Year ' + state.year + ': learn, then test';
    }
  }

  /* End states */

  function printEndButton(label, key, extraClass, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'end-btn' + (extraClass ? ' ' + extraClass : '');
    const labelEl = document.createElement('span');
    labelEl.className = 'end-btn-label';
    labelEl.textContent = label;
    button.appendChild(labelEl);
    if (key) {
      const keyEl = document.createElement('kbd');
      keyEl.textContent = key;
      button.appendChild(keyEl);
    }
    button.addEventListener('click', function () {
      ensureAudio();
      handler();
    });
    els.endActions.appendChild(button);
    return button;
  }

  function focusButtonSoon(button) {
    window.requestAnimationFrame(function () {
      if (button && button.isConnected && !els.endPanel.hidden) {
        button.focus({ preventScroll: true });
      }
    });
  }

  /* Test mode: every box open, arrows to move, Enter to hand in. */

  function isFillable(cell) {
    return cell.kind === 'input' || cell.kind === 'carry' || cell.kind === 'bringdown';
  }

  // Tab order follows the method: the boxes in the order guided mode visits
  // them, then any small boxes the method never needed.
  function testOrder(problem) {
    const order = [];
    problem.actions.forEach(function (action) {
      if (order.indexOf(action.cellId) === -1) order.push(action.cellId);
    });
    problem.rows.forEach(function (row) {
      (row.cells || []).forEach(function (cell) {
        if (cell && isFillable(cell) && order.indexOf(cell.id) === -1) order.push(cell.id);
      });
    });
    return order;
  }

  function markedCellIds() {
    const ids = [];
    state.problem.rows.forEach(function (row) {
      if (state.problem.markRowIds.indexOf(row.id) === -1) return;
      row.cells.forEach(function (cell) {
        if (cell && cell.kind === 'input') ids.push(cell.id);
      });
    });
    return ids;
  }

  // Answers are written left to right in a number sentence and in the answer
  // above a division bracket; everything else in a written method is worked
  // from the right. Small boxes do not move on by themselves.
  function rowDirection(row) {
    if (row.kind === 'carry') return 0;
    if (row.kind === 'fact' || row.id === 'q') return 1;
    return -1;
  }

  function rowIndexOf(cellId) {
    const entry = state.cellEls.get(cellId);
    return state.problem.rows.indexOf(entry.row);
  }

  function fillableInRow(rowIndex) {
    const row = state.problem.rows[rowIndex];
    return (row.cells || []).filter(function (cell) { return cell && isFillable(cell); });
  }

  function rowNeighbour(cellId, direction) {
    const entry = state.cellEls.get(cellId);
    const cells = fillableInRow(rowIndexOf(cellId));
    const candidates = cells.filter(function (cell) {
      return direction > 0 ? cell.col > entry.cell.col : cell.col < entry.cell.col;
    });
    if (!candidates.length) return null;
    candidates.sort(function (a, b) {
      return Math.abs(a.col - entry.cell.col) - Math.abs(b.col - entry.cell.col);
    });
    return candidates[0].id;
  }

  function verticalNeighbour(cellId, direction) {
    const entry = state.cellEls.get(cellId);
    for (let r = rowIndexOf(cellId) + direction; r >= 0 && r < state.problem.rows.length; r += direction) {
      const cells = fillableInRow(r);
      if (!cells.length) continue;
      cells.sort(function (a, b) {
        return Math.abs(a.col - entry.cell.col) - Math.abs(b.col - entry.cell.col) || b.col - a.col;
      });
      return cells[0].id;
    }
    return null;
  }

  function describeCell(cellId) {
    const entry = state.cellEls.get(cellId);
    const role = markedCellIds().indexOf(cellId) !== -1
      ? (entry.cell.signBox ? 'sign box' : (entry.cell.compare ? 'comparison box: type <, > or ='
        : (entry.cell.option ? 'choice box: type the number of your answer' : 'answer box')))
      : (entry.cell.kind === 'carry' ? 'small working box' : 'working box');
    const text = state.entries.get(cellId);
    return role + ', ' + (text ? 'holds ' + text : 'empty');
  }

  function selectCell(cellId) {
    if (!cellId || !state.cellEls.has(cellId)) return;
    clearActiveMarks();
    state.selectedCellId = cellId;
    const entry = state.cellEls.get(cellId);
    entry.el.classList.add('active');
    entry.el.dataset.flag = 'type';
    const rowEl = state.rowEls.get(entry.row.id);
    if (rowEl) rowEl.classList.add('is-active');
    els.liveRegion.textContent = describeCell(cellId) + '.';
    revealActiveCell(entry.el);
  }

  function setEntry(cellId, text) {
    const entry = state.cellEls.get(cellId);
    if (!entry) return;
    if (text) {
      state.entries.set(cellId, text);
    } else {
      state.entries.delete(cellId);
    }
    entry.el.textContent = text;
    entry.el.classList.toggle('filled', Boolean(text));
    // Writing a new value above a top digit crosses that digit out.
    if (entry.row.isExchange) {
      const top = state.cellEls.get('a-c' + entry.cell.col);
      if (top) top.el.classList.toggle('crossed', Boolean(text));
    }
  }

  function startTest(problem) {
    if (isDraw(problem)) {
      state.handInWarned = false;
      state.solution = null;
      state.fillOrder = [];
      state.selectedCellId = null;
      els.stageChip.textContent = 'Test';
      els.stepLine.textContent = 'Draw it, then hand in';
      els.prompt.textContent = problem.question;
      els.subprompt.textContent = DRAW_HELP;
      els.sheetStatus.textContent = 'test';
      renderBoard();
      els.liveRegion.textContent = 'Test. ' + problem.question + ' ' + DRAW_HELP;
      return;
    }
    state.entries = new Map();
    state.handInWarned = false;
    state.solution = Engine.solutionOf(problem);
    state.fillOrder = testOrder(problem);
    els.stageChip.textContent = 'Test';
    els.stepLine.textContent = 'Fill the boxes, then hand in';
    els.prompt.textContent = problem.question;
    els.subprompt.textContent = TEST_HELP;
    els.sheetStatus.textContent = 'test';
    els.rowMap.querySelectorAll('.row-chip').forEach(function (chip) {
      chip.classList.remove('is-active', 'is-done');
    });
    selectCell(state.fillOrder[0]);
    els.liveRegion.textContent = 'Test. ' + problem.question + ' ' + TEST_HELP + ' ' +
      describeCell(state.selectedCellId) + '.';
  }

  function resetHandInWarning() {
    if (state.handInWarned) {
      state.handInWarned = false;
      hideFixNote();
    }
  }

  function testType(digit) {
    if (state.screen !== 'playing' || state.mode !== 'test') return;
    const id = state.selectedCellId;
    const entry = state.cellEls.get(id);
    if (!entry) return;
    ensureAudio();
    flashKey('button[data-digit="' + digit + '"]');
    resetHandInWarning();
    if (entry.cell.signBox) {
      const next = rowNeighbour(id, 1);
      if (next) {
        selectCell(next);
        testType(digit);
      }
      return;
    }
    // Digits do not go in a comparison box; in a choice box they pick a name.
    if (entry.cell.compare) return;
    if (entry.cell.option) {
      const option = state.problem.options.find(function (o) { return o[0] === digit; });
      if (!option) return;
      setEntry(id, option[1]);
      playSound('tick');
      savePlay();
      return;
    }
    const before = state.entries.get(id) || '';
    // Exchange boxes can hold two digits, such as 12.
    const text = entry.row.isExchange && before.length === 1 ? before + digit : String(digit);
    setEntry(id, text);
    playSound('tick');
    const direction = rowDirection(entry.row);
    if (direction && entry.cell.kind === 'input') {
      const next = rowNeighbour(id, direction);
      if (next) selectCell(next);
    }
    savePlay();
  }

  function testBackspace() {
    if (state.screen !== 'playing' || state.mode !== 'test') return;
    const id = state.selectedCellId;
    const entry = state.cellEls.get(id);
    if (!entry) return;
    resetHandInWarning();
    const text = state.entries.get(id) || '';
    if (text) {
      setEntry(id, text.length > 1 ? text.slice(0, -1) : '');
      savePlay();
      return;
    }
    const direction = rowDirection(entry.row);
    if (!direction) return;
    const previous = rowNeighbour(id, -direction);
    if (previous) {
      selectCell(previous);
      setEntry(previous, '');
      savePlay();
    }
  }

  // The sign box a minus goes in: the selected box, the sign box of the
  // number being typed, or the nearest one to its left (coordinates have
  // two).
  function signBoxFor(cellId) {
    const entry = state.cellEls.get(cellId);
    const boxes = [];
    state.problem.rows.forEach(function (row) {
      (row.cells || []).forEach(function (cell) { if (cell && cell.signBox) boxes.push({ cell: cell, row: row }); });
    });
    if (!boxes.length) return null;
    if (entry && entry.cell.signBox) return entry.cell;
    if (entry && entry.cell.group !== undefined) {
      const same = boxes.find(function (box) { return box.cell.group === entry.cell.group && box.row === entry.row; });
      if (same) return same.cell;
    }
    const left = boxes.filter(function (box) { return entry && box.cell.col <= entry.cell.col; })
      .sort(function (a, b) { return b.cell.col - a.cell.col; })[0];
    return (left || boxes[0]).cell;
  }

  function testMinus() {
    if (state.screen !== 'playing' || state.mode !== 'test' || !state.problem.signBox) return;
    const sign = signBoxFor(state.selectedCellId);
    if (!sign) return;
    resetHandInWarning();
    flashKey('#minusKey');
    setEntry(sign.id, state.entries.get(sign.id) === MINUS ? '' : MINUS);
    playSound('tick');
    savePlay();
  }

  function testCompare(symbol) {
    if (state.screen !== 'playing' || state.mode !== 'test') return;
    const entry = state.cellEls.get(state.selectedCellId);
    if (!entry || !entry.cell.compare) return;
    ensureAudio();
    flashKey('button[data-compare="' + symbol + '"]');
    resetHandInWarning();
    setEntry(state.selectedCellId, symbol);
    playSound('tick');
    const next = rowNeighbour(state.selectedCellId, 1);
    if (next) selectCell(next);
    savePlay();
  }

  function testMove(key, shift) {
    const id = state.selectedCellId;
    let next = null;
    if (key === 'ArrowLeft') next = rowNeighbour(id, -1);
    if (key === 'ArrowRight') next = rowNeighbour(id, 1);
    if (key === 'ArrowUp') next = verticalNeighbour(id, -1);
    if (key === 'ArrowDown') next = verticalNeighbour(id, 1);
    if (key === 'Tab') {
      const index = state.fillOrder.indexOf(id);
      const count = state.fillOrder.length;
      next = state.fillOrder[(index + (shift ? count - 1 : 1)) % count];
    }
    if (next) {
      selectCell(next);
      savePlay();
    }
  }

  function handIn() {
    if (state.screen !== 'playing' || state.mode !== 'test') return;
    ensureAudio();
    // A mixed test marks nothing until the end, and a question can be left
    // empty and come back to, so Enter goes on to the next question. Once
    // the hand-in check is showing, Enter hands the test in.
    if (state.mixed && state.mixed.running) {
      if (state.handInWarned) finishMixed(false);
      else mixedNext();
      return;
    }
    if (isDraw(state.problem)) {
      if (!Engine.drawing.touched(state.problem, state.boardState) && !state.handInWarned) {
        state.handInWarned = true;
        els.fixNote.textContent = 'Nothing is drawn yet. Press Enter again to hand in, or keep going.';
        els.fixNote.hidden = false;
        els.liveRegion.textContent = els.fixNote.textContent;
        return;
      }
      const right = Engine.drawing.mark(state.problem, state.boardState);
      state.lockInput = true;
      renderBoard({ step: null, result: right ? 'right' : 'wrong', solution: right ? null : Engine.drawing.solved(state.problem) });
      state.roundClean = right;
      completeRound();
      return;
    }
    const marked = markedCellIds();
    const empty = marked.filter(function (id) {
      return !state.entries.get(id) && !state.cellEls.get(id).cell.signBox;
    });
    if (empty.length && !state.handInWarned) {
      state.handInWarned = true;
      els.fixNote.textContent = empty.length + (empty.length === 1 ? ' answer box is' : ' answer boxes are') +
        ' empty. Press Enter again to hand in, or keep going.';
      els.fixNote.hidden = false;
      els.liveRegion.textContent = els.fixNote.textContent;
      return;
    }
    const correct = marked.every(function (id) {
      return (state.entries.get(id) || '') === (state.solution.values[id] || '');
    });
    markTest(marked, correct);
    state.roundClean = correct;
    completeRound();
  }

  // Answer boxes are marked right or wrong. After a wrong answer every other
  // box shows the proper working, with exchanged digits crossed out.
  function markTest(marked, correct) {
    clearActiveMarks();
    marked.forEach(function (id) {
      const entry = state.cellEls.get(id);
      const typed = state.entries.get(id) || '';
      const proper = state.solution.values[id] || '';
      if (typed === proper) {
        entry.el.classList.add('mark-right');
        return;
      }
      entry.el.textContent = proper;
      entry.el.classList.add('filled', 'mark-wrong');
      entry.el.dataset.was = typed ? 'was ' + typed : 'was empty';
    });
    if (correct) return;
    state.cellEls.forEach(function (entry, id) {
      if (marked.indexOf(id) !== -1 || !isFillable(entry.cell)) return;
      const proper = state.solution.values[id];
      entry.el.textContent = proper === undefined ? '' : proper;
      entry.el.classList.toggle('filled', proper !== undefined);
      entry.el.classList.toggle('solution', proper !== undefined);
      if (entry.row.isExchange) {
        const top = state.cellEls.get('a-c' + entry.cell.col);
        if (top) top.el.classList.remove('crossed');
      }
    });
    state.solution.crossed.forEach(crossOut);
  }

  function finishProblem() {
    completeRound();
  }

  function completeRound() {
    clearTimer();
    state.lockInput = true;
    hideFixNote();

    let passedNow = false;
    if (state.roundClean) {
      state.screen = 'won';
      state.cleanStreak += 1;
      if (state.cleanStreak >= cleanTarget()) {
        passedNow = true;
        if (state.mode === 'guided') {
          // Learning done: the same year's test comes next.
          markLearned(state.operation, state.year);
          state.pendingTest = true;
        } else {
          markPassed(state.operation, state.year);
          // The top year has nowhere to go, so its tests start again.
          state.pendingYear = state.year < TOP_YEAR ? state.year + 1 : state.year;
        }
      } else {
        state.pendingYear = null;
      }
    } else {
      state.screen = state.mode === 'test' ? 'testFailed' : 'fixed';
      state.cleanStreak = 0;
      state.pendingYear = null;
    }
    savePlay();

    clearActiveMarks();
    setKeypadEnabled(false);
    els.sheetStatus.textContent = state.roundClean
      ? (state.mode === 'test' ? 'Correct' : 'Solved')
      : (state.mode === 'test' ? 'Not quite' : 'Solved with a fix');
    els.sheetStatus.classList.toggle('is-win', state.roundClean);
    els.sheetStatus.classList.toggle('is-fail', !state.roundClean);
    // A failed test keeps its own right and wrong marks instead.
    if (state.roundClean || state.mode !== 'test') {
      state.problem.answerRowIds.forEach(function (rowId) {
        const rowEl = state.rowEls.get(rowId);
        if (rowEl) rowEl.classList.add('answer-solved');
      });
    }

    updateLadder();
    updateStreak();
    markAllGroupsDone();
    playSound(state.roundClean ? 'win' : 'tick');
    showEndPanel(passedNow);

    let spoken = (state.mode === 'test' ? (state.roundClean ? 'Correct. ' : 'Not quite. The answer is ') : 'Solved. ') +
      state.problem.answer.expression + '. ';
    if (!state.roundClean && state.mode === 'test') {
      spoken += 'The proper working is on the sheet. The clean count is 0. Press Enter for the next problem.';
    } else if (!state.roundClean) {
      spoken += 'This round had a fix, so the clean count is 0. Press Enter to try it again or N for a new problem.';
    } else if (passedNow && state.pendingTest) {
      spoken += cleanTarget() + ' clean rounds. Learning done. The Year ' + state.year + ' test is next.';
    } else if (passedNow) {
      spoken += cleanTarget() + ' clean tests. Year ' + state.year + ' check passed.';
    } else {
      spoken += state.cleanStreak + ' of ' + cleanTarget() + (state.mode === 'test' ? ' clean tests toward the Year ' +
        state.year + ' check.' : ' clean rounds toward the Year ' + state.year + ' test.');
    }
    els.liveRegion.textContent = spoken;
  }

  function showEndPanel(passedNow) {
    els.consoleMain.hidden = true;
    els.endPanel.hidden = false;
    els.endTitle.textContent = 'Solved.';
    els.endAnswer.textContent = state.problem.answer.expression;
    els.endActions.innerHTML = '';

    let primary;
    if (!state.roundClean && state.mode === 'test') {
      els.endPanel.className = 'end-panel is-fail';
      els.endKicker.textContent = 'Not quite';
      els.endTitle.textContent = 'The answer is';
      els.endDetail.textContent = 'Your boxes are marked and the proper working is on the sheet. ' +
        'The clean count is back to 0. Press Enter to see how to solve it, step by step.';
      primary = printEndButton('Show me how', 'Enter', 'primary', startWalkthrough);
      printEndButton('Next problem', 'N', '', newProblem);
    } else if (!state.roundClean) {
      els.endPanel.className = 'end-panel is-fail';
      els.endKicker.textContent = state.fixes === 1 ? 'Solved with a fix' : 'Solved with ' + state.fixes + ' fixes';
      els.endDetail.textContent = 'A round with a fix does not count, so the clean count is back to 0. ' +
        'Try it again to make it clean, or start a new one.';
      primary = printEndButton('Try it again', 'Enter', 'primary', retryProblem);
      printEndButton('New problem', 'N', '', newProblem);
    } else if (passedNow && state.pendingTest) {
      els.endPanel.className = 'end-panel is-win';
      els.endKicker.textContent = 'Learning done';
      els.endDetail.textContent = cleanTarget() + ' clean rounds in a row. Next is the Year ' + state.year +
        ' test: every box is open, and you hand in the whole answer.';
      primary = printEndButton('Start the test', 'Enter', 'primary', nextProblem);
    } else if (passedNow) {
      els.endPanel.className = 'end-panel is-win';
      els.endKicker.textContent = 'Year ' + state.year + ' check passed';
      els.endDetail.textContent = state.year < TOP_YEAR
        ? cleanTarget() + ' clean tests in a row. Year ' + state.pendingYear +
          ' is next, starting with learning.'
        : cleanTarget() + ' clean tests in a row at Year ' + TOP_YEAR +
          ', the top year. The tests carry on.';
      primary = printEndButton(
        state.year < TOP_YEAR ? 'Start Year ' + state.pendingYear : 'Next problem',
        'Enter',
        'primary',
        nextProblem
      );
    } else {
      els.endPanel.className = 'end-panel is-win';
      els.endKicker.textContent = state.mode === 'test' ? 'Correct' : 'Clean round';
      els.endDetail.textContent = state.mode === 'test'
        ? state.cleanStreak + ' of ' + cleanTarget() + ' clean tests in a row toward the Year ' +
          state.year + ' check.'
        : state.cleanStreak + ' of ' + cleanTarget() + ' clean rounds in a row toward the Year ' +
          state.year + ' test.';
      primary = printEndButton('Next problem', 'Enter', 'primary', nextProblem);
    }
    printEndButton('Pause', 'Esc', 'ghost', openPause);
    focusButtonSoon(primary);
  }

  /* Modals */

  function setAppInert(value) {
    if ('inert' in HTMLElement.prototype) {
      els.app.inert = value;
    } else {
      if (value) {
        els.app.setAttribute('aria-hidden', 'true');
      } else {
        els.app.removeAttribute('aria-hidden');
      }
    }
  }

  function finishModalFocus() {
    if (state.screen === 'setup') {
      const previous = state.previousFocus;
      state.previousFocus = null;
      if (previous && previous.isConnected && !previous.hidden) {
        previous.focus({ preventScroll: true });
        return;
      }
    }
    state.previousFocus = null;
    blurFocus();
  }

  function openHelp() {
    if (state.helpOpen || state.pauseOpen) return;
    state.helpOpen = true;
    state.previousFocus = document.activeElement;
    els.helpOverlay.hidden = false;
    setAppInert(true);
    window.requestAnimationFrame(function () {
      if (!els.helpOverlay.hidden) els.helpClose.focus({ preventScroll: true });
    });
  }

  function closeHelp() {
    if (!state.helpOpen) return;
    state.helpOpen = false;
    els.helpOverlay.hidden = true;
    setAppInert(false);
    finishModalFocus();
  }

  function updatePauseStats() {
    const m = state.mixed;
    const mixed = Boolean(m && m.running);
    els.pauseEnd.hidden = !mixed;
    document.querySelectorAll('.pause-stat-label').forEach(function (label, k) {
      label.textContent = mixed ? ['School year', 'Question', m.deadline ? 'Time left' : 'Time taken'][k] : ['School year', 'Clean streak', 'Year check'][k];
    });
    els.pauseYear.textContent = 'Year ' + state.year;
    if (mixed) {
      els.pauseStreak.textContent = (m.index + 1) + ' of ' + m.count;
      els.pauseCheck.textContent = m.deadline ? clockText(m.deadline - Date.now()) : clockText(Date.now() - m.startedAt);
      return;
    }
    els.pauseStreak.textContent = Math.min(state.cleanStreak, cleanTarget()) + ' / ' + cleanTarget();
    els.pauseCheck.textContent = state.screen === 'tutorial'
      ? 'Watching'
      : (hasPassed(state.operation, state.year) ? 'Passed' : (state.mode === 'test' ? 'Testing' : 'Learning'));
  }

  function openPause() {
    if (state.pauseOpen || state.helpOpen) return;
    if (state.screen === 'setup') return;
    state.pauseOpen = true;
    state.previousFocus = document.activeElement;
    updatePauseStats();
    els.pauseOverlay.hidden = false;
    setAppInert(true);
    window.requestAnimationFrame(function () {
      if (!els.pauseOverlay.hidden) els.resumeBtn.focus({ preventScroll: true });
    });
  }

  function closePause() {
    if (!state.pauseOpen) return;
    state.pauseOpen = false;
    els.pauseOverlay.hidden = true;
    setAppInert(false);
    finishModalFocus();
  }

  function quitToStart() {
    if (state.mixed && state.mixed.running) saveMixed();
    closePause();
    showSetup();
  }

  function trapTab(event, container) {
    if (event.key !== 'Tab') return false;
    const focusable = Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(function (el) {
        return !el.disabled && el.offsetParent !== null;
      });
    if (!focusable.length) return false;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return true;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
      return true;
    }
    return false;
  }

  function handleModalKeys(event) {
    if (state.helpOpen) {
      if (trapTab(event, els.helpOverlay)) return;
      if (event.key === 'Escape' || event.key === 'h' || event.key === 'H' || event.key === '?') {
        event.preventDefault();
        closeHelp();
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.target.closest('button')) return;
        event.preventDefault();
        closeHelp();
      }
      return;
    }
    if (state.mixedOpen) {
      if (trapTab(event, els.mixedOverlay)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMixedSetup();
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        moveMixedSetting(event.key === 'ArrowUp' ? -1 : 1, 0);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        moveMixedSetting(0, event.key === 'ArrowLeft' ? -1 : 1);
      } else if (event.key === 'Enter' && !(event.target.closest('button') && event.target !== els.mixedStart)) {
        event.preventDefault();
        startMixed();
      }
      return;
    }
    if (state.pauseOpen) {
      if (trapTab(event, els.pauseOverlay)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closePause();
        return;
      }
      if (event.key === 'q' || event.key === 'Q') {
        event.preventDefault();
        quitToStart();
        return;
      }
      if ((event.key === 'e' || event.key === 'E') && state.mixed && state.mixed.running) {
        event.preventDefault();
        endMixedNow();
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.target.closest('button')) return;
        event.preventDefault();
        closePause();
      }
    }
  }

  /* Mixed test: a set number of questions from every area for the school
     year, handed in one after another with no marking, then the marks, a
     grade and every answer. Questions are made from a seed, so a closed
     test is rebuilt exactly. A time limit counts down to a fixed moment, so
     pausing or closing the game does not stop the clock. */

  function gradeFor(percent) {
    return GRADES.find(function (grade) { return percent >= grade[0]; })[1];
  }

  function clockText(ms) {
    const seconds = Math.max(0, Math.round(ms / 1000));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  function removeStored(key) {
    try {
      if (window.localStorage) window.localStorage.removeItem(key);
    } catch (err) {
      if (!(err instanceof DOMException)) throw err;
    }
  }

  // A saved test counts only if it was made by this version of the
  // questions and every part of it makes sense. JSON.parse has no
  // non-throwing form.
  function readMixed() {
    const raw = readStored(STORAGE.mixed, null);
    if (raw === null) return null;
    let m;
    try {
      m = JSON.parse(raw);
    } catch (err) {
      if (err instanceof SyntaxError) return null;
      throw err;
    }
    if (!m || typeof m !== 'object' || m.version !== PLAY_VERSION) return null;
    if (YEARS.indexOf(m.year) === -1 || MIXED_LEVELS.indexOf(m.difficulty) === -1 || !Number.isInteger(m.seed)) return null;
    if (!Array.isArray(m.areas) || m.areas.length !== m.count || m.areas.some(function (a) { return AREAS.indexOf(a) === -1; })) return null;
    if (!Number.isInteger(m.index) || m.index < 0 || m.index > m.count || !Array.isArray(m.answers)) return null;
    if (m.deadline !== null && typeof m.deadline !== 'number') return null;
    m.running = false;
    return m;
  }

  function saveMixed() {
    const m = state.mixed;
    if (!m) return true;
    if (m.running && state.screen === 'playing' && state.mode === 'test') {
      m.current = { entries: Object.fromEntries(state.entries), selectedCellId: state.selectedCellId };
      keepMixedAnswer();
      updateMixedChips();
    }
    const copy = Object.assign({}, m);
    delete copy.running;
    return writeStored(STORAGE.mixed, JSON.stringify(copy));
  }

  function mixedQuestion(m, index) {
    return Engine.withSeed((m.seed + index * 7919) >>> 0, function () {
      return Engine.generateProblem(m.areas[index], m.year, m.difficulty);
    });
  }

  // Every area comes up about equally often, in a random order.
  function mixedAreas(count, seed) {
    return Engine.withSeed(seed, function () {
      let list = [];
      while (list.length < count) list = list.concat(Engine.kit.shuffle(AREAS));
      return Engine.kit.shuffle(list.slice(0, count));
    });
  }

  function updateMixedCard() {
    const m = state.mixed;
    if (!els.mixedNote) return;
    if (m && !m.finished) {
      els.mixedNote.textContent = 'Test in progress: question ' + Math.min(m.index + 1, m.count) + ' of ' + m.count +
        (m.deadline ? ', ' + clockText(m.deadline - Date.now()) + ' left' : '') + '. Press R to carry on.';
    } else if (m && m.finished) {
      els.mixedNote.textContent = 'Your last test is marked. Press R to see the results.';
    } else {
      els.mixedNote.textContent = 'Questions from every area for the school year. Choose how many, a time limit and how hard. Marks and a grade at the end.';
    }
  }

  function openMixedSetup() {
    if (state.screen !== 'setup' || state.helpOpen || state.pauseOpen) return;
    ensureAudio();
    if (state.mixed) {
      if (state.mixed.finished) showMixedResults(0);
      else resumeMixed();
      return;
    }
    state.mixedSetup = state.mixedSetup || { row: 0, count: 1, minutes: 0, level: 1 };
    state.mixedOpen = true;
    state.previousFocus = document.activeElement;
    els.mixedOverlay.hidden = false;
    setAppInert(true);
    renderMixedSetup();
    window.requestAnimationFrame(function () {
      if (!els.mixedOverlay.hidden) els.mixedStart.focus({ preventScroll: true });
    });
  }

  function closeMixedSetup() {
    if (!state.mixedOpen) return;
    state.mixedOpen = false;
    els.mixedOverlay.hidden = true;
    setAppInert(false);
    finishModalFocus();
  }

  function mixedChoices(setup) {
    return {
      count: MIXED_COUNTS[setup.count],
      minutes: MIXED_MINUTES[setup.minutes],
      difficulty: MIXED_LEVELS[setup.level]
    };
  }

  function renderMixedSetup() {
    const setup = state.mixedSetup;
    const picked = { count: setup.count, minutes: setup.minutes, level: setup.level };
    els.mixedRows.forEach(function (row, index) {
      const name = row.dataset.setting;
      row.classList.toggle('is-current', index === setup.row);
      row.querySelectorAll('[data-value]').forEach(function (button, k) {
        button.setAttribute('aria-pressed', String(k === picked[name]));
      });
    });
    const c = mixedChoices(setup);
    els.mixedSummary.textContent = c.count + ' questions from Year ' + state.progress.schoolYear + ', ' + c.difficulty + ', ' +
      (c.minutes ? c.minutes + ' minutes.' : 'no time limit.');
  }

  function moveMixedSetting(rowStep, valueStep) {
    const setup = state.mixedSetup;
    setup.row = (setup.row + rowStep + els.mixedRows.length) % els.mixedRows.length;
    const name = els.mixedRows[setup.row].dataset.setting;
    const size = { count: MIXED_COUNTS.length, minutes: MIXED_MINUTES.length, level: MIXED_LEVELS.length }[name];
    setup[name] = Math.max(0, Math.min(size - 1, setup[name] + valueStep));
    renderMixedSetup();
  }

  function startMixed() {
    const c = mixedChoices(state.mixedSetup);
    const seed = Math.floor(Math.random() * 2147483647);
    const now = Date.now();
    state.mixed = {
      version: PLAY_VERSION,
      seed: seed,
      year: state.progress.schoolYear,
      count: c.count,
      minutes: c.minutes,
      difficulty: c.difficulty,
      areas: mixedAreas(c.count, seed ^ 0x5bd1e995),
      index: 0,
      answers: [],
      current: null,
      startedAt: now,
      deadline: c.minutes ? now + c.minutes * 60000 : null,
      finished: false,
      timeUp: false,
      endedAt: null,
      running: true
    };
    closeMixedSetup();
    showMixedQuestion();
  }

  function resumeMixed() {
    const m = state.mixed;
    if (!m || m.finished) return;
    m.running = true;
    if (m.deadline && Date.now() >= m.deadline) {
      finishMixed(true);
      return;
    }
    showMixedQuestion();
  }

  function showMixedQuestion() {
    const m = state.mixed;
    const problem = mixedQuestion(m, m.index);
    state.operation = m.areas[m.index];
    state.year = m.year;
    state.mode = 'test';
    state.cleanStreak = 0;
    state.pendingYear = null;
    state.pendingTest = false;
    document.body.classList.add('is-mixed');
    // The question last on screen comes back with its selected box; one
    // visited before opens with what was typed in it.
    let saved = null;
    if (m.current && typeof m.current.entries === 'object') {
      saved = { entries: m.current.entries, selectedCellId: m.current.selectedCellId };
    } else if (m.answers[m.index] && typeof m.answers[m.index] === 'object') {
      saved = { entries: m.answers[m.index], selectedCellId: null };
    }
    // Open on screen: closing the game now brings it back here.
    m.open = true;
    loadProblem(problem, saved);
    updateMixedUI();
    startMixedTimer();
  }

  function updateMixedUI() {
    const m = state.mixed;
    if (!m || !m.running) return;
    const stage = document.createElement('span');
    stage.className = 'mode-stage';
    stage.textContent = 'Question ' + (m.index + 1) + ' of ' + m.count;
    els.modeChip.textContent = 'Mixed test';
    els.modeChip.appendChild(stage);
    els.modeShape.textContent = 'Year ' + m.year + ', ' + m.difficulty + ': ' + AREA_INFO[m.areas[m.index]].name;
    els.stageChip.textContent = 'Test';
    els.stepLine.textContent = 'Question ' + (m.index + 1) + ' of ' + m.count + '. Any answer can be changed until the test is handed in';
    els.sheetStatus.textContent = 'no marks until the end';
    els.subprompt.textContent = MIXED_HELP;
    const last = m.index === m.count - 1;
    els.handInLabel.textContent = last ? 'Hand in test' : 'Next';
    els.handInBtn.setAttribute('aria-label', last ? 'Hand in the test (Enter)' : 'Next question (Enter)');
    els.mixedPrevBtn.disabled = m.index === 0;
    els.mixedEndBtn.hidden = last;
    renderMixedChips();
    updateMixedClock();
  }

  // One numbered chip per question, filled in once it has an answer; a
  // click goes to that question. Keys do the same: N or Enter next, P back.
  function renderMixedChips() {
    const m = state.mixed;
    els.rowMap.innerHTML = '';
    els.rowMap.setAttribute('aria-label', 'Questions');
    for (let k = 0; k < m.count; k++) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.tabIndex = -1;
      chip.className = 'row-chip question-chip';
      chip.textContent = String(k + 1);
      chip.addEventListener('click', function () {
        goToMixedQuestion(k);
        chip.blur();
      });
      els.rowMap.appendChild(chip);
    }
    updateMixedChips();
  }

  function updateMixedChips() {
    const m = state.mixed;
    if (!m || !m.running) return;
    els.rowMap.querySelectorAll('.question-chip').forEach(function (chip, k) {
      const answered = mixedAnswered(m, k);
      chip.classList.toggle('is-answered', answered);
      chip.classList.toggle('is-active', k === m.index);
      chip.setAttribute('aria-label', 'Question ' + (k + 1) + (answered ? ', answered' : ', not answered'));
    });
  }

  function updateMixedClock() {
    const m = state.mixed;
    if (!m) return;
    const now = m.finished ? m.endedAt : Date.now();
    // Counting down while the test runs; once marked, the time it took.
    const countdown = Boolean(m.deadline) && !m.finished;
    els.gateLabel.textContent = countdown ? 'Time left' : 'Time taken';
    els.streakValue.textContent = countdown ? clockText(m.deadline - now) : clockText(now - m.startedAt);
    els.gateLine.textContent = m.minutes ? m.minutes + ' minute limit' : 'No time limit';
    els.streakChip.classList.toggle('is-full', false);
    els.streakChip.classList.toggle('is-late', Boolean(m.deadline && m.deadline - now < 60000));
    const done = m.finished ? m.count : mixedAnsweredCount(m);
    els.streakMeter.innerHTML = '';
    const bar = document.createElement('span');
    bar.className = 'mixed-progress';
    const fill = document.createElement('i');
    fill.style.width = Math.round(100 * done / m.count) + '%';
    bar.appendChild(fill);
    els.streakMeter.appendChild(bar);
    els.streakMeter.setAttribute('aria-valuemax', String(m.count));
    els.streakMeter.setAttribute('aria-valuenow', String(done));
    els.streakMeter.setAttribute('aria-valuetext', done + ' of ' + m.count + (m.finished ? ' questions handed in' : ' questions answered'));
  }

  function stopMixedTimer() {
    if (state.mixedTimer !== null) {
      window.clearInterval(state.mixedTimer);
      state.mixedTimer = null;
    }
  }

  function startMixedTimer() {
    stopMixedTimer();
    state.mixedTimer = window.setInterval(tickMixed, 1000);
  }

  function tickMixed() {
    const m = state.mixed;
    if (!m || !m.running) {
      stopMixedTimer();
      return;
    }
    if (m.deadline) {
      const left = m.deadline - Date.now();
      if (left <= 0) {
        finishMixed(true);
        return;
      }
      const secondsLeft = Math.round(left / 1000);
      if (secondsLeft === 300 || secondsLeft === 60) els.liveRegion.textContent = (secondsLeft / 60) + (secondsLeft === 60 ? ' minute' : ' minutes') + ' left.';
    }
    if (state.screen === 'playing') updateMixedClock();
    if (state.pauseOpen) updatePauseStats();
  }

  // What is typed in the question on screen is its answer at once, so
  // moving to another question, closing the game or the time running out
  // all keep it.
  function keepMixedAnswer() {
    const m = state.mixed;
    if (m && m.running && state.screen === 'playing' && state.mode === 'test' && m.index < m.count) {
      m.answers[m.index] = Object.fromEntries(state.entries);
    }
  }

  // The boxes a test marks: the inputs in the answer rows.
  function answerBoxIds(problem) {
    const ids = [];
    problem.rows.forEach(function (row) {
      if (problem.markRowIds.indexOf(row.id) === -1) return;
      row.cells.forEach(function (cell) { if (cell && cell.kind === 'input') ids.push(cell.id); });
    });
    return ids;
  }

  // A question is answered once one of its answer boxes holds something,
  // the same rule the marking uses.
  function mixedAnswered(m, index) {
    const entries = m.answers[index];
    if (!entries || typeof entries !== 'object') return false;
    if (!state.mixedMarked || state.mixedMarked.seed !== m.seed) state.mixedMarked = { seed: m.seed, ids: {} };
    let ids = state.mixedMarked.ids[index];
    if (!ids) {
      const problem = mixedQuestion(m, index);
      ids = isDraw(problem) ? { draw: problem } : answerBoxIds(problem);
      state.mixedMarked.ids[index] = ids;
    }
    // A drawing is answered once something is drawn on it.
    if (ids.draw) return Boolean(entries.board) && Engine.drawing.valid(ids.draw, entries.board) && Engine.drawing.touched(ids.draw, entries.board);
    return ids.some(function (id) { return entries[id]; });
  }

  function mixedAnsweredCount(m) {
    let count = 0;
    for (let i = 0; i < m.count; i++) if (mixedAnswered(m, i)) count += 1;
    return count;
  }

  // Questions can be visited in any order and changed until the test is
  // handed in.
  function goToMixedQuestion(index) {
    const m = state.mixed;
    if (!m || !m.running || state.screen !== 'playing') return;
    resetHandInWarning();
    if (index < 0 || index >= m.count || index === m.index) return;
    keepMixedAnswer();
    m.index = index;
    m.current = null;
    playSound('tick');
    showMixedQuestion();
    els.liveRegion.textContent = 'Question ' + (m.index + 1) + ' of ' + m.count +
      (mixedAnswered(m, m.index) ? ', answered. ' : '. ') + state.problem.question;
  }

  // Enter and N go on to the next question; from the last one they ask to
  // hand the test in.
  function mixedNext() {
    const m = state.mixed;
    if (!m || !m.running) return;
    if (m.index >= m.count - 1) {
      askMixedHandIn();
      return;
    }
    goToMixedQuestion(m.index + 1);
  }

  function numberList(numbers) {
    if (numbers.length === 1) return String(numbers[0]);
    return numbers.slice(0, -1).join(', ') + ' and ' + numbers[numbers.length - 1];
  }

  // E, or going on from the last question, asks once and lists any question
  // not answered yet; pressing E or Enter again hands the test in.
  function askMixedHandIn() {
    const m = state.mixed;
    if (!m || !m.running || state.screen !== 'playing') return;
    if (state.handInWarned) {
      finishMixed(false);
      return;
    }
    keepMixedAnswer();
    const missing = [];
    for (let i = 0; i < m.count; i++) if (!mixedAnswered(m, i)) missing.push(i + 1);
    let said;
    if (!missing.length) {
      said = 'All ' + m.count + ' questions are answered.';
    } else if (missing.length === 1) {
      said = 'Question ' + missing[0] + ' is not answered.';
    } else if (missing.length <= 8) {
      said = 'Questions ' + numberList(missing) + ' are not answered.';
    } else {
      said = missing.length + ' questions are not answered, starting with ' + numberList(missing.slice(0, 5)) + '.';
    }
    state.handInWarned = true;
    els.fixNote.textContent = said + ' Press E or Enter again to hand in the test for marking, or keep going.';
    els.fixNote.hidden = false;
    els.liveRegion.textContent = els.fixNote.textContent;
  }

  // Marks every question the same way a test is marked: each answer box
  // must hold exactly what the worked answer has.
  function markMixed(m) {
    const results = [];
    for (let i = 0; i < m.count; i++) {
      const problem = mixedQuestion(m, i);
      const entries = m.answers[i] || {};
      if (isDraw(problem)) {
        const board = entries.board && Engine.drawing.valid(problem, entries.board) ? entries.board : null;
        results.push({ area: m.areas[i], correct: Boolean(board) && Engine.drawing.mark(problem, board), answered: Boolean(board) && Engine.drawing.touched(problem, board) });
        continue;
      }
      const values = Engine.solutionOf(problem).values;
      const marked = answerBoxIds(problem);
      const answered = marked.some(function (id) { return entries[id]; });
      const correct = answered && marked.every(function (id) { return (entries[id] || '') === (values[id] || ''); });
      results.push({ area: m.areas[i], correct: correct, answered: answered });
    }
    return results;
  }

  function finishMixed(timeUp) {
    const m = state.mixed;
    if (!m || m.finished) return;
    // What was typed in the question on screen counts as handed in.
    keepMixedAnswer();
    stopMixedTimer();
    m.finished = true;
    m.timeUp = timeUp;
    m.endedAt = timeUp && m.deadline ? m.deadline : Date.now();
    m.current = null;
    m.running = false;
    if (state.pauseOpen) closePause();
    playSound(timeUp ? 'miss' : 'win');
    saveMixed();
    showMixedResults(0);
  }

  function showMixedResults(index) {
    const m = state.mixed;
    const results = markMixed(m);
    const score = results.filter(function (r) { return r.correct; }).length;
    const percent = Math.round(100 * score / m.count);
    const grade = gradeFor(percent);
    state.screen = 'mixedResults';
    state.reviewIndex = Math.max(0, Math.min(m.count - 1, index));
    document.body.classList.add('is-mixed');
    els.setupScreen.hidden = true;
    els.gameScreen.hidden = false;
    els.pauseBtn.hidden = true;
    els.console.classList.remove('is-tutorial');
    clearTimer();
    showMixedReview(state.reviewIndex, results);

    els.consoleMain.hidden = true;
    els.endPanel.hidden = false;
    els.endPanel.className = 'end-panel mixed-results ' + (grade === 'F' ? 'is-fail' : 'is-win');
    els.endKicker.textContent = (m.timeUp ? 'Time is up. ' : '') + 'Mixed test, Year ' + m.year + ', ' + m.difficulty;
    els.endTitle.textContent = score + ' out of ' + m.count;
    els.endAnswer.textContent = 'Grade ' + grade;
    const byArea = AREAS.filter(function (area) { return results.some(function (r) { return r.area === area; }); }).map(function (area) {
      const mine = results.filter(function (r) { return r.area === area; });
      return AREA_INFO[area].name + ' ' + mine.filter(function (r) { return r.correct; }).length + '/' + mine.length;
    });
    els.endDetail.textContent = percent + '%' + (grade === 'F' ? ', under 50%: not a pass yet.' : '.') + ' Time: ' + clockText(m.endedAt - m.startedAt) +
      (m.minutes ? ' of ' + m.minutes + ' minutes.' : '.') + ' ' + byArea.join(', ') + '.';
    els.endActions.innerHTML = '';
    printEndButton('Previous', '←', '', function () { stepReview(-1); });
    printEndButton('Next', '→', '', function () { stepReview(1); });
    // Questions that were not right are gone over first; once they have
    // been, Enter finishes.
    const goOver = score < m.count && !m.walked;
    let primary;
    if (goOver) {
      primary = printEndButton('Go over the ' + (m.count - score === 1 ? 'one' : m.count - score) + ' I missed', 'Enter', 'primary', startMixedWalkthrough);
      printEndButton('Finish', 'F', '', finishMixedReview);
    } else {
      if (score < m.count) printEndButton('Go over them again', 'W', '', startMixedWalkthrough);
      primary = printEndButton('Finish', 'Enter', 'primary', finishMixedReview);
    }
    focusButtonSoon(primary);
    els.liveRegion.textContent = score + ' out of ' + m.count + ', ' + percent + '%, grade ' + grade + '. ' +
      'Use the arrow keys to look at each question. ' + (goOver ? 'Press Enter to go over the ones that were not right, or F to finish.' : 'Press Enter to finish.');
  }

  // One question of a marked test: the child's boxes, marked, with the
  // proper working where an answer was wrong.
  function showMixedReview(index, results) {
    const m = state.mixed;
    const problem = mixedQuestion(m, index);
    const result = (results || markMixed(m))[index];
    state.reviewIndex = index;
    state.operation = m.areas[index];
    state.year = m.year;
    state.problem = problem;
    state.actions = problem.actions;
    state.mode = 'test';
    const entries = m.answers[index] || {};
    if (isDraw(problem)) setBoard(entries.board && Engine.drawing.valid(problem, entries.board) ? entries.board : Engine.drawing.start(problem));
    renderWorksheet(problem);
    showSpecialKeys(null);
    document.body.dataset.area = state.operation;
    if (isDraw(problem)) {
      renderBoard({ step: null, result: result.correct ? 'right' : 'wrong', solution: result.correct ? null : Engine.drawing.solved(problem) });
    } else {
      state.solution = Engine.solutionOf(problem);
      state.entries = new Map();
      Object.keys(entries).forEach(function (cellId) {
        const entry = state.cellEls.get(cellId);
        if (entry && isFillable(entry.cell) && entryFits(entry.cell, entries[cellId])) setEntry(cellId, entries[cellId]);
      });
      markTest(markedCellIds(), result.correct);
    }
    // A question never answered is said once, not on every box.
    if (!result.answered) els.worksheet.querySelectorAll('[data-was]').forEach(function (el) { delete el.dataset.was; });
    if (result.correct) {
      problem.answerRowIds.forEach(function (rowId) {
        const rowEl = state.rowEls.get(rowId);
        if (rowEl) rowEl.classList.add('answer-solved');
      });
    }
    const stage = document.createElement('span');
    stage.className = 'mode-stage';
    stage.textContent = 'Results';
    els.modeChip.textContent = 'Mixed test';
    els.modeChip.appendChild(stage);
    els.modeShape.textContent = 'Question ' + (index + 1) + ' of ' + m.count + ': ' + AREA_INFO[state.operation].name;
    els.sheetStatus.textContent = result.correct ? 'right' : (result.answered ? 'not quite' : 'not answered');
    els.sheetStatus.classList.toggle('is-win', result.correct);
    els.sheetStatus.classList.toggle('is-fail', !result.correct);
    updateMixedClock();
    // One chip per question, right or wrong, to jump between them.
    const all = results || markMixed(m);
    els.rowMap.innerHTML = '';
    all.forEach(function (r, k) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'row-chip question-chip' + (r.correct ? ' is-done' : ' is-missed') + (k === index ? ' is-active' : '');
      // A right chip gets its tick from the stylesheet, like a finished row.
      chip.textContent = (r.correct ? '' : '✗ ') + (k + 1);
      chip.setAttribute('aria-label', 'Question ' + (k + 1) + ', ' + (r.correct ? 'right' : 'not right'));
      chip.addEventListener('click', function () { showMixedReview(k); });
      els.rowMap.appendChild(chip);
    });
    const line = document.getElementById('reviewLine');
    if (line) {
      line.textContent = 'Question ' + (index + 1) + ': ' + (result.correct ? 'right. ' : (result.answered ? 'not quite. ' : 'not answered. ')) +
        'The answer is ' + problem.answer.expression + '.';
    }
    els.liveRegion.textContent = 'Question ' + (index + 1) + ' of ' + m.count + ', ' + AREA_INFO[state.operation].name + '. ' +
      (result.correct ? 'Right.' : 'Not right. The answer is ' + problem.answer.expression + '.');
  }

  function stepReview(step) {
    if (state.screen !== 'mixedResults') return;
    const m = state.mixed;
    const next = Math.max(0, Math.min(m.count - 1, state.reviewIndex + step));
    if (next !== state.reviewIndex) showMixedReview(next);
  }

  function finishMixedReview() {
    if (state.screen !== 'mixedResults') return;
    state.mixed = null;
    removeStored(STORAGE.mixed);
    showSetup();
  }

  // From the pause panel: hand in everything now.
  function endMixedNow() {
    if (!state.mixed || !state.mixed.running) return;
    finishMixed(false);
  }

  /* Keyboard */

  function isFocusedButton(event) {
    return Boolean(event.target && event.target.closest && event.target.closest('button'));
  }

  function onKeyDown(event) {
    if (event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (state.helpOpen || state.pauseOpen || state.mixedOpen) {
      handleModalKeys(event);
      return;
    }

    if (event.key === 't' || event.key === 'T') {
      event.preventDefault();
      cycleTheme();
      return;
    }
    if (event.key === 'c' || event.key === 'C') {
      event.preventDefault();
      toggleCvd();
      return;
    }
    if ((event.key === 'w' || event.key === 'W') && state.screen !== 'setup' && state.screen !== 'tutorial') {
      event.preventDefault();
      if (state.screen === 'testFailed') startWalkthrough();
      else if (state.screen === 'mixedResults') startMixedWalkthrough();
      else watchExample();
      return;
    }

    if (state.screen === 'tutorial') {
      if (event.key === 'Escape') {
        event.preventDefault();
        openPause();
      } else if (event.key === 'ArrowRight' || ((event.key === 'Enter' || event.key === ' ') && !isFocusedButton(event))) {
        event.preventDefault();
        if (!event.repeat || event.key === 'ArrowRight') tutorialNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        tutorialBack();
      } else if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        finishTutorial();
      } else if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        toggleSound();
      } else if (event.key === 'h' || event.key === 'H' || event.key === '?') {
        event.preventDefault();
        openHelp();
      }
      return;
    }

    if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      toggleSound();
      return;
    }
    if (event.key === 'h' || event.key === 'H' || event.key === '?') {
      event.preventDefault();
      openHelp();
      return;
    }

    if (state.screen === 'mixedResults') {
      const m = state.mixed;
      const missed = m && markMixed(m).some(function (r) { return !r.correct; });
      if (/^Arrow/.test(event.key)) {
        event.preventDefault();
        stepReview(event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1);
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        finishMixedReview();
      } else if (event.key === 'Enter' && !isFocusedButton(event)) {
        event.preventDefault();
        if (missed && !m.walked) startMixedWalkthrough();
        else finishMixedReview();
      }
      return;
    }

    if (state.screen === 'playing' && state.mode === 'test') {
      const mixed = Boolean(state.mixed && state.mixed.running);
      if (isDraw(state.problem) && drawKey(event)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        openPause();
      } else if (mixed && (event.key === 'n' || event.key === 'N' || event.key === 'PageDown')) {
        event.preventDefault();
        if (!event.repeat) mixedNext();
      } else if (mixed && (event.key === 'p' || event.key === 'P' || event.key === 'PageUp')) {
        event.preventDefault();
        if (!event.repeat) goToMixedQuestion(state.mixed.index - 1);
      } else if (mixed && (event.key === 'e' || event.key === 'E')) {
        event.preventDefault();
        if (!event.repeat) askMixedHandIn();
      } else if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        if (!event.repeat) testType(Number(event.key));
      } else if (COMPARE_KEYS[event.key] && state.problem.compareBox) {
        event.preventDefault();
        testCompare(COMPARE_KEYS[event.key]);
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        testBackspace();
      } else if (event.key === '-' || event.key === MINUS) {
        event.preventDefault();
        testMinus();
      } else if (/^Arrow/.test(event.key) || event.key === 'Tab') {
        event.preventDefault();
        testMove(event.key, event.shiftKey);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (!event.repeat) handIn();
      }
      return;
    }

    if (state.screen === 'testFailed') {
      if (event.key === 'Escape') {
        event.preventDefault();
        openPause();
        return;
      }
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        newProblem();
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ') && !isFocusedButton(event)) {
        event.preventDefault();
        startWalkthrough();
      }
      return;
    }

    if (state.screen === 'setup') {
      // Area keys are digits, and W for word problems in either case.
      const area = AREAS.find(function (name) { return AREA_INFO[name].key === event.key.toLowerCase(); });
      if (area) {
        event.preventDefault();
        startRun(area);
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        openMixedSetup();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault();
        selectYear(state.progress.schoolYear - 1);
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault();
        selectYear(state.progress.schoolYear + 1);
      }
      return;
    }

    if (state.screen === 'playing') {
      if (event.key === 'Escape') {
        event.preventDefault();
        openPause();
        return;
      }
      if (isDraw(state.problem) && drawKey(event)) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        if (!event.repeat) submitDigit(Number(event.key));
        return;
      }
      if (COMPARE_KEYS[event.key] && state.problem && state.problem.compareBox) {
        event.preventDefault();
        if (!event.repeat) submitCompare(COMPARE_KEYS[event.key]);
        return;
      }
      if (event.key === '-' || event.key === MINUS) {
        event.preventDefault();
        if (!event.repeat) submitMinus();
      }
      return;
    }

    if (state.screen === 'fixed') {
      if (event.key === 'Escape') {
        event.preventDefault();
        openPause();
        return;
      }
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        newProblem();
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ') && !isFocusedButton(event)) {
        event.preventDefault();
        retryProblem();
      }
      return;
    }

    if (state.screen === 'won') {
      if (event.key === 'Escape') {
        event.preventDefault();
        openPause();
        return;
      }
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        nextProblem();
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ') && !isFocusedButton(event)) {
        event.preventDefault();
        nextProblem();
      }
    }
  }

  /* Events */

  function bindEvents() {
    els.modeButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        ensureAudio();
        startRun(button.dataset.mode);
        button.blur();
      });
    });

    els.setupLadder.addEventListener('click', function (event) {
      const item = event.target.closest('li[data-year]');
      if (item) selectYear(Number(item.dataset.year));
    });

    els.worksheet.addEventListener('click', function (event) {
      if (state.screen !== 'playing' || state.mode !== 'test') return;
      const target = event.target.closest('[data-cell-id]');
      if (!target) return;
      const entry = state.cellEls.get(target.dataset.cellId);
      if (entry && isFillable(entry.cell)) {
        selectCell(target.dataset.cellId);
        savePlay();
      }
    });

    els.tutorNext.addEventListener('click', function () {
      tutorialNext();
      els.tutorNext.blur();
    });
    els.tutorBack.addEventListener('click', function () {
      tutorialBack();
      els.tutorBack.blur();
    });
    els.tutorSkip.addEventListener('click', function () {
      finishTutorial();
      els.tutorSkip.blur();
    });
    els.watchBtn.addEventListener('click', function () {
      watchExample();
      els.watchBtn.blur();
    });

    els.handInBtn.addEventListener('click', function () {
      handIn();
      els.handInBtn.blur();
    });
    els.mixedPrevBtn.addEventListener('click', function () {
      if (state.mixed) goToMixedQuestion(state.mixed.index - 1);
      els.mixedPrevBtn.blur();
    });
    els.mixedEndBtn.addEventListener('click', function () {
      askMixedHandIn();
      els.mixedEndBtn.blur();
    });

    els.themeBtn.addEventListener('click', function () {
      cycleTheme();
      els.themeBtn.blur();
    });

    els.cvdBtn.addEventListener('click', function () {
      toggleCvd();
      els.cvdBtn.blur();
    });

    els.soundBtn.addEventListener('click', function () {
      ensureAudio();
      toggleSound();
      els.soundBtn.blur();
    });

    els.helpBtn.addEventListener('click', function () {
      openHelp();
      els.helpBtn.blur();
    });

    els.pauseBtn.addEventListener('click', function () {
      openPause();
      els.pauseBtn.blur();
    });

    els.keypad.addEventListener('click', function (event) {
      const key = event.target.closest('button');
      if (!key || key.disabled) return;
      ensureAudio();
      if (key.dataset.digit !== undefined) {
        if (state.mode === 'test') testType(Number(key.dataset.digit));
        else submitDigit(Number(key.dataset.digit));
      } else if (key.dataset.compare) {
        if (state.mode === 'test') testCompare(key.dataset.compare);
        else submitCompare(key.dataset.compare);
      } else if (key === els.minusKey) {
        if (state.mode === 'test') testMinus();
        else submitMinus();
      }
      key.blur();
    });

    els.boardPad.addEventListener('click', function (event) {
      const key = event.target.closest('button');
      if (!key || key.disabled) return;
      ensureAudio();
      if (key.dataset.boardKey === 'Enter') {
        if (state.mode === 'test') handIn();
        else checkDrawStep('enter');
      } else {
        pressBoard(key.dataset.boardKey);
      }
      key.blur();
    });

    els.helpClose.addEventListener('click', closeHelp);
    els.helpGotIt.addEventListener('click', closeHelp);
    els.resumeBtn.addEventListener('click', closePause);
    els.quitBtn.addEventListener('click', quitToStart);
    els.pauseEnd.addEventListener('click', endMixedNow);

    els.mixedBtn.addEventListener('click', function () {
      openMixedSetup();
      els.mixedBtn.blur();
    });
    els.mixedStart.addEventListener('click', startMixed);
    els.mixedCancel.addEventListener('click', closeMixedSetup);
    els.mixedRows.forEach(function (row, index) {
      row.querySelectorAll('[data-value]').forEach(function (button, k) {
        button.addEventListener('click', function () {
          state.mixedSetup.row = index;
          state.mixedSetup[row.dataset.setting] = k;
          renderMixedSetup();
        });
      });
    });
    els.mixedOverlay.addEventListener('click', function (event) {
      if (event.target === els.mixedOverlay) closeMixedSetup();
    });

    let resizeTimer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () { if (state.problem) fitSheet(); }, 120);
    });

    els.helpOverlay.addEventListener('click', function (event) {
      if (event.target === els.helpOverlay) closeHelp();
    });
    els.pauseOverlay.addEventListener('click', function (event) {
      if (event.target === els.pauseOverlay) closePause();
    });

    document.addEventListener('keydown', onKeyDown);
  }

  window.__digitStack = {
    getState: function () {
      const levels = {};
      AREAS.forEach(function (area) { levels[area] = areaLevel(area); });
      return {
        screen: state.screen,
        operation: state.operation,
        year: state.year,
        schoolYear: state.progress.schoolYear,
        areaLevels: levels,
        cleanTarget: state.operation ? cleanTarget() : null,
        cleanStreak: state.cleanStreak,
        pendingYear: state.pendingYear,
        roundClean: state.roundClean,
        fixes: state.fixes,
        actionIndex: state.actionIndex,
        action: currentAction(),
        problem: state.problem,
        progress: JSON.parse(JSON.stringify(state.progress)),
        mode: state.mode,
        pendingTest: state.pendingTest,
        selectedCellId: state.selectedCellId,
        entries: isDraw(state.problem) ? {} : Object.fromEntries(state.entries),
        board: state.boardState,
        handInWarned: state.handInWarned,
        fillOrder: state.fillOrder.slice(),
        saving: state.saving,
        display: DISPLAY.get(),
        tutorial: state.tutorial ? {
          kind: state.tutorial.kind,
          questions: state.tutorial.questions,
          index: state.tutorial.index,
          step: state.tutorial.step,
          examples: state.tutorial.problems.map(function (problem) {
            return { title: problem.title, question: problem.question, steps: problem.actions.length };
          })
        } : null,
        mixedOpen: state.mixedOpen,
        mixedSetup: state.mixedSetup ? Object.assign({}, mixedChoices(state.mixedSetup), { row: state.mixedSetup.row }) : null,
        mixed: state.mixed ? {
          year: state.mixed.year,
          count: state.mixed.count,
          minutes: state.mixed.minutes,
          difficulty: state.mixed.difficulty,
          areas: state.mixed.areas.slice(),
          index: state.mixed.index,
          answered: mixedAnsweredCount(state.mixed),
          deadline: state.mixed.deadline,
          finished: state.mixed.finished,
          timeUp: state.mixed.timeUp,
          running: state.mixed.running,
          results: state.mixed.finished ? markMixed(state.mixed) : null,
          grade: state.mixed.finished ? (function () {
            const results = markMixed(state.mixed);
            return gradeFor(Math.round(100 * results.filter(function (r) { return r.correct; }).length / state.mixed.count));
          })() : null
        } : null,
        reviewIndex: state.reviewIndex
      };
    },
    gradeFor: gradeFor
  };

  function init() {
    seedPreferences();
    state.progress = readProgress();
    state.play = readPlay();
    state.mixed = readMixed();
    buildLadders();
    updateSoundUI();
    updateDisplayUI();
    bindEvents();
    // Opening the game picks up a mixed test still running, or else the
    // area that was left open.
    const openArea = state.play.operation;
    const openMixed = Boolean(state.mixed && !state.mixed.finished && state.mixed.open);
    showSetup();
    if (openMixed) resumeMixed();
    else if (openArea) beginArea(openArea);
  }

  init();
})();
