(function () {
  'use strict';

  const Engine = window.DigitStackEngine;
  if (!Engine) throw new Error('Digit Stack arithmetic engine failed to load.');

  const MAX_STAGE = 4;
  const CLEAN_TARGET = 10;

  const STAGE_INFO = {
    multiply: {
      1: { shape: '1-digit × 1-digit' },
      2: { shape: '2-digit × 1-digit' },
      3: { shape: '3-digit × 1-digit' },
      4: { shape: '4-digit × 1-digit' }
    },
    divide: {
      1: { shape: '1-digit ÷ 1-digit' },
      2: { shape: '2-digit ÷ 1-digit' },
      3: { shape: '3-digit ÷ 1-digit' },
      4: { shape: '4-digit ÷ 1-digit' }
    }
  };

  const STORAGE = {
    sound: 'digitstack.sound.v1'
  };

  function $(id) {
    return document.getElementById(id);
  }

  const els = {
    app: document.querySelector('.app'),
    setupScreen: $('setupScreen'),
    gameScreen: $('gameScreen'),
    modeButtons: Array.from(document.querySelectorAll('[data-mode]')),
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
    carryBtn: $('carryBtn'),
    carryBtnLabel: $('carryBtnLabel'),
    keypad: $('keypad'),
    footCarry: $('footCarry'),
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
    pauseStage: $('pauseStage'),
    pauseStreak: $('pauseStreak'),
    pauseGate: $('pauseGate'),
    resumeBtn: $('resumeBtn'),
    quitBtn: $('quitBtn'),
    liveRegion: $('liveRegion')
  };

  const state = {
    screen: 'setup',
    operation: null,
    stage: 1,
    cleanStreak: 0,
    pendingStage: null,
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
    previousFocus: null
  };

  /* Storage is optional. A blocked store should not stop the game. */

  function readStored(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (err) {
      return fallback;
    }
  }

  function writeStored(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch (err) {
      // Preferences and best scores are not required to play.
    }
  }

  function seedPreferences() {
    state.soundOn = readStored(STORAGE.sound, 'on') !== 'off';
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
    } else if (name === 'fail') {
      tone(180, 0.3, { endFrequency: 72, type: 'sawtooth', gain: 0.038 });
      tone(118, 0.34, { type: 'square', gain: 0.014, delay: 0.02 });
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

  function digitWord(number) {
    return number + (number === 1 ? ' digit' : ' digits');
  }

  function blurFocus() {
    const active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === 'function') {
      active.blur();
    }
  }

  /* Screens */

  function showSetup() {
    clearTimer();
    if (state.helpOpen) closeHelp();
    if (state.pauseOpen) closePause();
    state.screen = 'setup';
    state.operation = null;
    state.stage = 1;
    state.cleanStreak = 0;
    state.pendingStage = null;
    state.problem = null;
    state.actions = [];
    state.actionIndex = 0;
    state.lockInput = false;
    els.setupScreen.hidden = false;
    els.gameScreen.hidden = true;
    els.pauseBtn.hidden = true;
    els.consoleMain.hidden = false;
    els.endPanel.hidden = true;
    window.scrollTo(0, 0);
    blurFocus();
    els.liveRegion.textContent = 'Choose divide or multiply. Press 1 or 2.';
  }

  function startRun(operation) {
    if (state.screen !== 'setup') return;
    ensureAudio();
    state.operation = operation;
    state.stage = 1;
    state.cleanStreak = 0;
    state.pendingStage = null;
    state.screen = 'playing';
    window.scrollTo(0, 0);
    loadProblem(Engine.generateProblem(operation, 1));
  }

  function loadProblem(problem) {
    clearTimer();
    state.problem = problem;
    state.actions = problem.actions;
    state.actionIndex = 0;
    state.screen = 'playing';
    state.lockInput = false;
    els.setupScreen.hidden = true;
    els.gameScreen.hidden = false;
    els.pauseBtn.hidden = false;
    els.consoleMain.hidden = false;
    els.endPanel.hidden = true;
    els.endPanel.className = 'end-panel';
    els.sheetStatus.classList.remove('is-win', 'is-fail');
    els.console.classList.toggle('is-division', problem.operation === 'divide');
    els.footCarry.hidden = problem.operation === 'divide';
    updateModeUI();
    renderWorksheet(problem);
    updateLadder();
    updateStreak();
    setIdleCarry();
    setKeypadEnabled(true);
    activateAction();
    blurFocus();
  }

  function retryProblem() {
    if (state.screen !== 'failed' || !state.problem) return;
    ensureAudio();
    loadProblem(state.problem);
  }

  function newProblem() {
    if (state.screen !== 'failed') return;
    ensureAudio();
    loadProblem(Engine.generateProblem(state.operation, state.stage));
  }

  function nextProblem() {
    if (state.screen !== 'won') return;
    ensureAudio();
    const pending = state.pendingStage;
    state.pendingStage = null;
    if (pending) {
      state.stage = pending;
      state.cleanStreak = 0;
    }
    loadProblem(Engine.generateProblem(state.operation, state.stage));
  }

  function updateModeUI() {
    if (!state.operation) return;
    els.modeChip.textContent = state.operation === 'divide' ? '÷ Divide' : '× Multiply';
    const info = STAGE_INFO[state.operation][state.stage];
    els.modeShape.textContent = info ? info.shape : '';
  }

  /* Worksheet */

  function renderWorksheet(problem) {
    els.worksheet.innerHTML = '';
    state.cellEls.clear();
    state.rowEls.clear();
    state.groupChips.clear();
    const template = 'var(--gutter) repeat(' + problem.width + ', var(--cell))';
    const fragment = document.createDocumentFragment();

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
        (row.kind === 'sum' ? ' sum' : '');
      rowEl.style.gridTemplateColumns = template;

      const gutter = document.createElement('div');
      gutter.className = 'gutter';
      let gutterText = row.gutter || '';
      if (row.kind === 'sum' && !gutterText) gutterText = '=';
      gutter.textContent = gutterText;
      gutter.setAttribute('aria-hidden', 'true');
      rowEl.appendChild(gutter);

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
        if (cell.kind === 'bringdown') cellClass += ' pending';
        cellEl.className = cellClass;
        cellEl.dataset.cellId = cell.id;
        cellEl.dataset.col = String(col);
        if (cell.kind === 'given') {
          cellEl.textContent = String(cell.value);
        } else if (cell.kind === 'bringdown') {
          cellEl.textContent = '↓';
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
    els.worksheet.querySelectorAll('.cell.active, .cell.carry-target, .cell.bringdown-active').forEach(function (el) {
      el.classList.remove('active', 'carry-target', 'bringdown-active');
      el.removeAttribute('data-flag');
    });
    els.worksheet.querySelectorAll('.row.is-active, .row.is-carry-target').forEach(function (el) {
      el.classList.remove('is-active', 'is-carry-target');
    });
  }

  function setKeypadEnabled(enabled) {
    els.keypad.classList.toggle('is-locked', !enabled);
    els.keypad.setAttribute('aria-disabled', String(!enabled));
    els.keypad.querySelectorAll('button').forEach(function (button) {
      button.disabled = !enabled;
    });
  }

  function setIdleCarry() {
    els.carryBtn.disabled = true;
    els.carryBtn.classList.remove('is-live');
    els.carryBtnLabel.textContent = 'Carry';
    els.carryBtn.setAttribute('aria-label', 'Carry, not needed right now');
  }

  function setLiveCarry(value) {
    els.carryBtn.disabled = false;
    els.carryBtn.classList.add('is-live');
    els.carryBtnLabel.textContent = 'Carry ' + value;
    els.carryBtn.setAttribute('aria-label', 'Carry ' + value + ' to the next column');
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

    if (action.kind === 'digit') {
      entry.el.classList.add('active');
      entry.el.dataset.flag = 'type';
      if (rowEl) rowEl.classList.add('is-active');
      setIdleCarry();
      setKeypadEnabled(true);
    } else if (action.kind === 'carry') {
      entry.el.classList.add('active');
      entry.el.dataset.flag = 'carry';
      if (rowEl) rowEl.classList.add('is-active');
      const targetRow = state.rowEls.get(action.targetRowId);
      if (targetRow) targetRow.classList.add('is-carry-target');
      const targetEntry = state.cellEls.get(action.targetCellId);
      if (targetEntry) targetEntry.el.classList.add('carry-target');
      setLiveCarry(action.value);
      setKeypadEnabled(false);
    } else if (action.kind === 'bringdown') {
      state.lockInput = true;
      entry.el.classList.add('bringdown-active');
      if (rowEl) rowEl.classList.add('is-active');
      setIdleCarry();
      setKeypadEnabled(false);
      state.timer = window.setTimeout(function () {
        resolveBringdown(action);
      }, 480);
    }

    updateActionUI(action);
    announceAction(action);
    if (action.kind === 'bringdown') {
      revealActiveCell(entry.el);
      return;
    }
    revealActiveCell(entry.el);
  }

  function updateActionUI(action) {
    els.stageChip.textContent = titleCase(action.stage);
    els.prompt.textContent = action.prompt;
    els.subprompt.textContent = action.subprompt;
    const groupIndex = Math.max(0, state.problem.groups.findIndex(function (group) {
      return group.id === action.groupId;
    }));
    const word = state.problem.operation === 'divide' ? 'Step' : 'Row';
    const label = word + ' ' + (groupIndex + 1) + ' of ' + state.problem.groups.length;
    els.stepLine.textContent = label;
    els.sheetStatus.textContent = label.toLowerCase();
    els.sheetStatus.classList.remove('is-win', 'is-fail');
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

  function updateRowMapForFailure(groupId) {
    const groups = state.problem.groups;
    const current = groups.findIndex(function (group) { return group.id === groupId; });
    groups.forEach(function (group, index) {
      const chip = state.groupChips.get(group.id);
      if (!chip) return;
      chip.classList.toggle('is-done', index < current);
      chip.classList.toggle('is-missed', index === current);
      chip.classList.remove('is-active');
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
    if (action.kind === 'digit') message += ' Type a digit.';
    if (action.kind === 'carry') message += ' Press Space or Enter to carry.';
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

  function flashKey(digit) {
    const key = els.keypad.querySelector('button[data-digit="' + digit + '"]');
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

  function submitDigit(digit) {
    if (state.screen !== 'playing' || state.lockInput) return;
    const action = currentAction();
    if (!action) return;
    ensureAudio();

    if (action.kind !== 'digit') {
      if (action.kind === 'carry') nudgeCarry();
      return;
    }

    flashKey(digit);
    if (digit !== action.value) {
      failProblem(action, digit);
      return;
    }

    fillCell(state.cellEls.get(action.cellId), digit, 'just-filled');
    playSound('tick');
    state.actionIndex += 1;
    if (state.actionIndex >= state.actions.length) {
      finishProblem();
      return;
    }
    activateAction();
  }

  function performCarry() {
    if (state.screen !== 'playing' || state.lockInput) return;
    const action = currentAction();
    if (!action || action.kind !== 'carry') return;
    ensureAudio();
    fillCell(state.cellEls.get(action.cellId), action.value, 'just-carried');
    playSound('carry');
    state.actionIndex += 1;
    if (state.actionIndex >= state.actions.length) {
      finishProblem();
      return;
    }
    activateAction();
  }

  function nudgeCarry() {
    els.carryBtn.classList.remove('is-nudged');
    void els.carryBtn.offsetWidth;
    els.carryBtn.classList.add('is-nudged');
    window.setTimeout(function () { els.carryBtn.classList.remove('is-nudged'); }, 320);
    els.liveRegion.textContent = 'Press Space or Enter to carry.';
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
    state.actionIndex += 1;
    if (state.actionIndex >= state.actions.length) {
      finishProblem();
      return;
    }
    activateAction();
  }

  function clearTimer() {
    if (state.timer !== null) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
  }

  /* Ladder and clean-round meter */

  function updateLadder() {
    const promotionWin = state.screen === 'won' && state.pendingStage !== null;
    Array.from(els.gameLadder.children).forEach(function (item) {
      const stage = Number(item.dataset.stage);
      item.classList.remove('is-done', 'is-current', 'is-next');
      if (stage < state.stage) {
        item.classList.add('is-done');
      } else if (stage === state.stage) {
        item.classList.add(promotionWin ? 'is-done' : 'is-current');
      }
      if (state.pendingStage === stage && promotionWin) {
        item.classList.add('is-next');
      }
    });
  }

  function buildStreakMeter() {
    els.streakMeter.innerHTML = '';
    for (let i = 0; i < CLEAN_TARGET; i++) {
      const pip = document.createElement('span');
      pip.setAttribute('aria-hidden', 'true');
      els.streakMeter.appendChild(pip);
    }
  }

  function updateStreak() {
    const shown = Math.max(0, Math.min(state.cleanStreak, CLEAN_TARGET));
    const pips = els.streakMeter.children;
    for (let i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('is-on', i < shown);
    }
    els.streakMeter.setAttribute('aria-valuenow', String(shown));
    els.streakMeter.setAttribute('aria-valuetext', shown + ' of ' + CLEAN_TARGET + ' clean rounds');
    if (state.stage === MAX_STAGE) {
      els.streakChip.classList.remove('is-full');
      els.streakMeter.hidden = true;
      els.gateLabel.textContent = 'Digit level';
      els.streakValue.textContent = 'Top';
      els.gateLine.textContent = '4 digits reached';
    } else {
      els.streakChip.classList.toggle('is-full', shown >= CLEAN_TARGET);
      els.streakMeter.hidden = false;
      els.gateLabel.textContent = 'Clean streak';
      els.streakValue.textContent = shown + ' / ' + CLEAN_TARGET;
      els.gateLine.textContent = state.pendingStage
        ? state.pendingStage + ' digits unlocked'
        : 'to ' + (state.stage + 1) + ' digits';
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

  function failProblem(action, typedDigit) {
    clearTimer();
    state.screen = 'failed';
    state.lockInput = true;
    state.cleanStreak = 0;
    state.pendingStage = null;

    clearActiveMarks();
    const entry = state.cellEls.get(action.cellId);
    if (entry) {
      entry.el.textContent = String(typedDigit);
      entry.el.classList.add('wrong');
      entry.el.dataset.correct = String(action.value);
      const rowEl = state.rowEls.get(action.rowId);
      if (rowEl) rowEl.classList.add('is-failed');
    }

    setIdleCarry();
    setKeypadEnabled(false);
    els.sheetStatus.textContent = 'Wrong digit';
    els.sheetStatus.classList.remove('is-win');
    els.sheetStatus.classList.add('is-fail');
    updateLadder();
    updateStreak();
    updateRowMapForFailure(action.groupId);

    els.sheet.classList.remove('is-shaking');
    void els.sheet.offsetWidth;
    els.sheet.classList.add('is-shaking');
    window.setTimeout(function () { els.sheet.classList.remove('is-shaking'); }, 500);

    playSound('fail');
    showFailurePanel(action);
    els.liveRegion.textContent = 'Wrong digit. The box needed ' + action.value + '. ' +
      action.why + ' The ten count is back to zero. You stay at digit level ' +
      state.stage + '.';
  }

  function showFailurePanel(action) {
    els.consoleMain.hidden = true;
    els.endPanel.hidden = false;
    els.endPanel.className = 'end-panel is-fail';
    els.endKicker.textContent = 'Round over';
    els.endTitle.textContent = 'Wrong digit.';
    els.endAnswer.textContent = 'This box needed ' + action.value + '. ' + action.why;
    els.endDetail.textContent = state.stage === MAX_STAGE
      ? 'The clean streak is back to 0. You stay at the top digit level.'
      : 'The clean streak is back to 0. You stay at digit level ' + state.stage +
        '. Ten clean rounds in a row add a digit.';
    els.endActions.innerHTML = '';
    const primary = printEndButton('Try again', 'Enter', 'primary', retryProblem);
    printEndButton('New problem', 'N', '', newProblem);
    printEndButton('Pause', 'Esc', 'ghost', openPause);
    focusButtonSoon(primary);
  }

  function finishProblem() {
    clearTimer();
    state.screen = 'won';
    state.lockInput = true;
    state.cleanStreak += 1;
    if (state.stage === MAX_STAGE) {
      state.cleanStreak = Math.min(state.cleanStreak, CLEAN_TARGET);
    }

    let promotion = false;
    if (state.stage < MAX_STAGE && state.cleanStreak >= CLEAN_TARGET) {
      state.pendingStage = state.stage + 1;
      promotion = true;
    } else {
      state.pendingStage = null;
    }

    clearActiveMarks();
    setIdleCarry();
    setKeypadEnabled(false);
    els.sheetStatus.textContent = 'Solved';
    els.sheetStatus.classList.remove('is-fail');
    els.sheetStatus.classList.add('is-win');
    state.problem.answerRowIds.forEach(function (rowId) {
      const rowEl = state.rowEls.get(rowId);
      if (rowEl) rowEl.classList.add('answer-solved');
    });

    updateLadder();
    updateStreak();
    markAllGroupsDone();
    playSound('win');
    showWinPanel(promotion);

    let spoken = 'Solved. ' + state.problem.answer.expression + '. Clean streak ' +
      state.cleanStreak + '. ';
    if (promotion) {
      spoken += 'Ten clean rounds. Digit level ' + state.pendingStage + ' unlocked.';
    } else if (state.stage === MAX_STAGE) {
      spoken += 'Top digit level.';
    } else {
      spoken += state.cleanStreak + ' of 10 clean rounds toward the next digit.';
    }
    els.liveRegion.textContent = spoken;
  }

  function showWinPanel(promotion) {
    els.consoleMain.hidden = true;
    els.endPanel.hidden = false;
    els.endPanel.className = 'end-panel is-win';
    els.endKicker.textContent = promotion ? 'Ten clean rounds' : 'Clean round';
    els.endTitle.textContent = 'Solved.';
    els.endAnswer.textContent = state.problem.answer.expression;

    if (promotion) {
      els.endDetail.textContent = 'That is 10 clean rounds in a row at this digit level. ' +
        'Digit level ' + state.pendingStage + ' is unlocked. The clean streak starts again at 0.';
    } else if (state.stage === MAX_STAGE) {
      els.endDetail.textContent = 'Top digit level. Clean streak ' +
        Math.min(state.cleanStreak, CLEAN_TARGET) + ' of 10.';
    } else {
      els.endDetail.textContent = state.cleanStreak + ' of 10 clean rounds toward digit level ' +
        (state.stage + 1) + '.';
    }

    els.endActions.innerHTML = '';
    const label = promotion ? 'Start ' + state.pendingStage + ' digits' : 'Next problem';
    const primary = printEndButton(label, 'Enter', 'primary', nextProblem);
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
    els.pauseStage.textContent = digitWord(state.stage);
    els.pauseStreak.textContent = Math.min(state.cleanStreak, CLEAN_TARGET) + ' / ' + CLEAN_TARGET;
    els.pauseGate.textContent = state.stage === MAX_STAGE
      ? 'Top level'
      : digitWord(state.stage + 1);
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

    if (state.screen === 'setup') {
      if (event.key === '1') {
        event.preventDefault();
        startRun('divide');
      } else if (event.key === '2') {
        event.preventDefault();
        startRun('multiply');
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
      if (event.key === ' ' || event.key === 'Enter') {
        const action = currentAction();
        if (action && action.kind === 'carry' && !state.lockInput) {
          event.preventDefault();
          if (!event.repeat) performCarry();
        }
      }
      return;
    }

    if (state.screen === 'failed') {
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
      const key = event.target.closest('button[data-digit]');
      if (!key || key.disabled) return;
      ensureAudio();
      submitDigit(Number(key.dataset.digit));
      key.blur();
    });

    els.carryBtn.addEventListener('click', function () {
      ensureAudio();
      performCarry();
      els.carryBtn.blur();
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
      return {
        screen: state.screen,
        operation: state.operation,
        stage: state.stage,
        cleanStreak: state.cleanStreak,
        pendingStage: state.pendingStage,
        actionIndex: state.actionIndex,
        action: currentAction(),
        problem: state.problem
      };
    }
  };

  function init() {
    seedPreferences();
    buildStreakMeter();
    updateSoundUI();
    bindEvents();
    showSetup();
  }

  init();
})();
