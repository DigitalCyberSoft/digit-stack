(function () {
  'use strict';

  const Engine = window.DigitStackEngine;
  if (!Engine) throw new Error('Digit Stack arithmetic engine failed to load.');

  const YEARS = Engine.YEARS;
  const AREAS = Engine.AREAS;
  const FIRST_YEAR = YEARS[0];
  const TOP_YEAR = YEARS[YEARS.length - 1];
  const MINUS = Engine.MINUS;

  const AREA_INFO = {
    divide: { key: '1', sign: '÷', name: 'Divide' },
    multiply: { key: '2', sign: '×', name: 'Multiply' },
    add: { key: '3', sign: '+', name: 'Add' },
    subtract: { key: '4', sign: MINUS, name: 'Subtract' }
  };

  // Ages follow the key stage tables on gov.uk ("The national curriculum").
  const YEAR_INFO = {
    1: {
      age: '5-6',
      multiply: 'Dot rows up to 100; 2, 5 and 10 tables',
      divide: 'Sharing and grouping; ÷ 2, 5 and 10',
      add: 'Facts to 20, 2-digit sums, missing numbers',
      subtract: 'Facts to 20, 2-digit take-aways, missing numbers'
    },
    2: {
      age: '6-7',
      multiply: '2, 3, 4, 5, 8, 10 tables; missing numbers',
      divide: '÷ 2, 3, 4, 5, 8, 10; missing numbers',
      add: '3-digit sentences, missing numbers, 2-3 digit columns',
      subtract: '3-digit sentences, missing numbers, 2-3 digit columns'
    },
    3: {
      age: '7-8',
      multiply: '2- or 3-digit × 1-digit',
      divide: '2- or 3-digit ÷ 1-digit, exact',
      add: '3- or 4-digit columns',
      subtract: '3- or 4-digit columns'
    },
    4: {
      age: '8-9',
      multiply: 'Up to 4-digit × 1-digit, 2-digit × 2-digit',
      divide: '3- or 4-digit ÷ 1-digit, remainders',
      add: '4- or 5-digit columns',
      subtract: '4- or 5-digit columns'
    },
    5: {
      age: '9-10',
      multiply: '3- or 4-digit × 2-digit',
      divide: '4-digit ÷ 1-digit, up to 4-digit ÷ 2-digit',
      add: '5- or 6-digit columns; below zero',
      subtract: '5- or 6-digit columns; below zero'
    },
    6: {
      age: '10-11',
      multiply: '4-digit × 2-digit, up to 4-digit × 3-digit',
      divide: '4- or 5-digit ÷ 2-digit',
      add: '6-digit columns; below zero to 100',
      subtract: '6-digit columns; below zero to 100'
    },
    7: {
      age: '11-12',
      multiply: '4- or 5-digit × 3-digit',
      divide: '5-digit ÷ 2-digit, 4-digit ÷ 3-digit',
      add: '6- or 7-digit columns; adding negatives',
      subtract: '6- or 7-digit columns; subtracting negatives'
    }
  };

  const STORAGE = {
    sound: 'digitstack.sound.v1',
    progress: 'digitstack.progress.v1',
    play: 'digitstack.play.v1'
  };

  // Saved rounds hold whole problems. Bump this when the engine's problem
  // layout changes, so rounds saved by older code are dropped, not misdrawn.
  const PLAY_VERSION = 1;

  const TEST_HELP = 'Arrows move between boxes; Tab follows the method. Type to fill a box, ' +
    'Backspace clears it. Small boxes are for working and are not marked. Press Enter to hand in.';

  function $(id) {
    return document.getElementById(id);
  }

  const els = {
    app: document.querySelector('.app'),
    setupScreen: $('setupScreen'),
    gameScreen: $('gameScreen'),
    setupLadder: $('setupLadder'),
    shapes: {
      divide: $('divideShape'),
      multiply: $('multiplyShape'),
      add: $('addShape'),
      subtract: $('subtractShape')
    },
    modeButtons: Array.from(document.querySelectorAll('[data-mode]')),
    handInBtn: $('handInBtn'),
    soundBtn: $('soundBtn'),
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
    saving: true
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
    return { schoolYear: FIRST_YEAR, passed: emptyPassed(), learned: emptyPassed() };
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
    const passed = emptyPassed();
    const learned = emptyPassed();
    AREAS.forEach(function (area) {
      passed[area] = knownYears(savedPassed[area]);
      learned[area] = knownYears(savedLearned[area]);
    });
    return {
      schoolYear: YEARS.indexOf(data.schoolYear) !== -1 ? data.schoolYear : FIRST_YEAR,
      passed: passed,
      learned: learned
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
      fixes: state.fixes
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
    if (state.operation) state.play.areas[state.operation] = currentRecord();
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
      pass.textContent = passedAreas.map(function (area) { return AREA_INFO[area].sign; }).join('');
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
    if (state.helpOpen) closeHelp();
    if (state.pauseOpen) closePause();
    state.screen = 'setup';
    state.operation = null;
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
    window.scrollTo(0, 0);
    blurFocus();
    els.liveRegion.textContent = 'Choose the school year with the arrow keys. Then press 1 to divide, ' +
      '2 to multiply, 3 to add or 4 to subtract.';
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
    // The dock only holds the Hand in button, so only a test shows it.
    els.console.classList.toggle('no-carry', state.mode !== 'test');
    els.footMinus.hidden = !problem.signBox;
    els.minusKey.hidden = !problem.signBox;
    els.keypad.classList.toggle('has-minus', Boolean(problem.signBox));
    els.console.classList.toggle('is-test', state.mode === 'test');
    els.handInBtn.disabled = state.mode !== 'test';
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

  // Redraws what a saved round had filled in, in the order it was typed and
  // without sounds or animation. A fix made before closing still counts.
  function restoreSteps(saved) {
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

  // Puts back the boxes typed in a test before it was closed. Only digits,
  // two-digit exchange values and a minus in the sign box are accepted.
  function restoreEntries(saved) {
    Object.keys(saved.entries).forEach(function (cellId) {
      const text = saved.entries[cellId];
      const entry = state.cellEls.get(cellId);
      if (!entry || !isFillable(entry.cell) || typeof text !== 'string') return;
      if (text === MINUS ? !entry.cell.signBox : !/^[0-9]{1,2}$/.test(text)) return;
      setEntry(cellId, text);
    });
    if (state.cellEls.has(saved.selectedCellId)) selectCell(saved.selectedCellId);
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
    }
    loadProblem(Engine.generateProblem(state.operation, state.year));
  }

  function updateModeUI() {
    if (!state.operation) return;
    const info = AREA_INFO[state.operation];
    const stage = document.createElement('span');
    stage.className = 'mode-stage';
    stage.textContent = state.mode === 'test' ? 'Test' : 'Learning';
    els.modeChip.textContent = info.name;
    els.modeChip.appendChild(stage);
    els.modeShape.textContent = 'Year ' + state.year + ': ' + YEAR_INFO[state.year][state.operation];
    // The area's book colour frames the page, the controls and the pause panel.
    document.body.dataset.area = state.operation;
  }

  /* Worksheet */

  function renderPicture(picture) {
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

  function renderWorksheet(problem) {
    els.worksheet.innerHTML = '';
    els.worksheet.classList.toggle('is-sentence', problem.method === 'fact');
    state.cellEls.clear();
    state.rowEls.clear();
    state.groupChips.clear();
    const template = (problem.noGutter ? '' : 'var(--gutter) ') +
      'repeat(' + problem.width + ', var(--cell))';
    const fragment = document.createDocumentFragment();
    if (problem.picture) fragment.appendChild(renderPicture(problem.picture));

    problem.rows.forEach(function (row) {
      const rowEl = document.createElement('div');
      rowEl.dataset.rowId = row.id;

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
        (row.isOperator ? ' is-operator' : '') +
        (row.kind === 'dividend' ? ' dividend' : '') +
        (row.kind === 'sum' ? ' sum' : '') +
        (row.inBracket ? ' in-bracket' : '') +
        (row.isExchange ? ' is-exchange' : '');
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
        let cellClass = 'cell ' + cell.kind;
        if (cell.kind === 'carry') cellClass += ' carry-slot';
        if (cell.shiftZero) cellClass += ' shift-zero';
        if (cell.sign) cellClass += ' sign-cell';
        if (cell.signBox) cellClass += ' sign-box';
        if (cell.remainderLabel) cellClass += ' remainder-label';
        if (cell.kind === 'bringdown') cellClass += ' pending';
        cellEl.className = cellClass;
        cellEl.dataset.cellId = cell.id;
        cellEl.dataset.col = String(col);
        if (cell.kind === 'given') {
          cellEl.textContent = String(cell.value);
        } else if (cell.kind === 'bringdown') {
          // In a test the child writes the brought-down digit themselves.
          if (state.mode === 'test') {
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

    els.worksheet.appendChild(fragment);
    els.sheetTitle.textContent = problem.title;
    els.rowMap.innerHTML = '';
    problem.groups.forEach(function (group) {
      const chip = document.createElement('span');
      chip.className = 'row-chip';
      chip.dataset.groupId = group.id;
      chip.textContent = group.label;
      state.groupChips.set(group.id, chip);
      els.rowMap.appendChild(chip);
    });
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
    if (!state.problem.groupWord) {
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
      if (!el || !el.isConnected || state.screen !== 'playing') return;
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
      handleMiss(action, String(digit), 'Not quite. This box needs ' + action.value + '. ' + action.why,
        String(action.value));
      return;
    }
    applyDigit(action, digit);
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
      ? (entry.cell.signBox ? 'sign box' : 'answer box')
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

  function testMinus() {
    if (state.screen !== 'playing' || state.mode !== 'test' || !state.problem.signBox) return;
    const sign = state.problem.rows[0].cells.find(function (cell) { return cell && cell.signBox; });
    if (!sign) return;
    resetHandInWarning();
    flashKey('#minusKey');
    setEntry(sign.id, state.entries.get(sign.id) === MINUS ? '' : MINUS);
    playSound('tick');
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
        'The clean count is back to 0.';
      primary = printEndButton('Next problem', 'Enter', 'primary', newProblem);
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
    els.pauseYear.textContent = 'Year ' + state.year;
    els.pauseStreak.textContent = Math.min(state.cleanStreak, cleanTarget()) + ' / ' + cleanTarget();
    els.pauseCheck.textContent = hasPassed(state.operation, state.year)
      ? 'Passed'
      : (state.mode === 'test' ? 'Testing' : 'Learning');
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
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.target.closest('button')) return;
        event.preventDefault();
        closePause();
      }
    }
  }

  /* Keyboard */

  function isFocusedButton(event) {
    return Boolean(event.target && event.target.closest && event.target.closest('button'));
  }

  function onKeyDown(event) {
    if (event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (state.helpOpen || state.pauseOpen) {
      handleModalKeys(event);
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

    if (state.screen === 'playing' && state.mode === 'test') {
      if (event.key === 'Escape') {
        event.preventDefault();
        openPause();
      } else if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        if (!event.repeat) testType(Number(event.key));
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
      if ((event.key === 'Enter' || event.key === ' ' || event.key === 'n' || event.key === 'N') &&
        !isFocusedButton(event)) {
        event.preventDefault();
        newProblem();
      }
      return;
    }

    if (state.screen === 'setup') {
      const area = AREAS.find(function (name) { return AREA_INFO[name].key === event.key; });
      if (area) {
        event.preventDefault();
        startRun(area);
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
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        if (!event.repeat) submitDigit(Number(event.key));
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

    els.handInBtn.addEventListener('click', function () {
      handIn();
      els.handInBtn.blur();
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
      } else if (key === els.minusKey) {
        if (state.mode === 'test') testMinus();
        else submitMinus();
      }
      key.blur();
    });

    els.helpClose.addEventListener('click', closeHelp);
    els.helpGotIt.addEventListener('click', closeHelp);
    els.resumeBtn.addEventListener('click', closePause);
    els.quitBtn.addEventListener('click', quitToStart);

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
        entries: Object.fromEntries(state.entries),
        handInWarned: state.handInWarned,
        fillOrder: state.fillOrder.slice(),
        saving: state.saving
      };
    }
  };

  function init() {
    seedPreferences();
    state.progress = readProgress();
    state.play = readPlay();
    buildLadders();
    updateSoundUI();
    bindEvents();
    // Opening the game picks up the area that was left open.
    const openArea = state.play.operation;
    showSetup();
    if (openArea) beginArea(openArea);
  }

  init();
})();
