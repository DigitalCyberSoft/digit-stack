// Display settings, applied in <head> before the page draws so it never
// flashes the wrong colours: the theme (auto follows the device, or light,
// or dark) and colour-blind friendly colours. The game saves changes; the
// guides only read them.
(function () {
  'use strict';

  const KEYS = { theme: 'digitstack.theme.v1', cvd: 'digitstack.cvd.v1' };
  const THEMES = ['auto', 'light', 'dark'];
  const root = document.documentElement;
  const media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  // Storage can be missing or blocked; then the defaults apply.
  function read(key) {
    try {
      const storage = window.localStorage;
      return storage ? storage.getItem(key) : null;
    } catch (err) {
      if (!(err instanceof DOMException)) throw err;
      return null;
    }
  }

  const savedTheme = read(KEYS.theme);
  const settings = {
    theme: THEMES.indexOf(savedTheme) !== -1 ? savedTheme : 'auto',
    cvd: read(KEYS.cvd) === 'on'
  };

  function apply() {
    const dark = settings.theme === 'dark' ||
      (settings.theme === 'auto' && media !== null && media.matches);
    root.dataset.theme = settings.theme;
    root.dataset.mode = dark ? 'dark' : 'light';
    root.dataset.cvd = settings.cvd ? 'on' : 'off';
    root.style.colorScheme = dark ? 'dark' : 'light';
  }

  apply();
  // On auto, a change of the device's setting applies straight away.
  if (media !== null) {
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', apply);
    } else if (typeof media.addListener === 'function') {
      media.addListener(apply);
    }
  }

  window.DigitStackDisplay = {
    keys: KEYS,
    themes: THEMES.slice(),
    get: function () {
      return { theme: settings.theme, cvd: settings.cvd, mode: root.dataset.mode };
    },
    set: function (next) {
      if (next.theme !== undefined) {
        if (THEMES.indexOf(next.theme) === -1) throw new Error('Unknown theme: ' + next.theme);
        settings.theme = next.theme;
      }
      if (next.cvd !== undefined) settings.cvd = Boolean(next.cvd);
      apply();
    }
  };
})();
