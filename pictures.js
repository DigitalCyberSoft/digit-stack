/*
 * Digit Stack pictures: draws the picture a question comes with (a clock,
 * coins, a scale, a shape, a chart) as SVG from the plain data the engine
 * gives. Colours come from the page's theme through CSS classes, so dark
 * mode and colour-blind friendly colours apply here too.
 */
(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const MINUS = '−';

  function el(tag, attrs, text) {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] !== undefined && attrs[key] !== null) node.setAttribute(key, String(attrs[key]));
    });
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function svg(width, height, label) {
    const node = el('svg', { viewBox: '0 0 ' + width + ' ' + height, class: 'pic', role: 'img', 'aria-label': label || 'picture' });
    node.style.setProperty('--pic-ratio', String(width / height));
    return node;
  }

  function add(parent) {
    for (let i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]);
    return parent;
  }

  function text(x, y, value, cls, anchor, size) {
    return el('text', { x: x, y: y, class: 'pic-text' + (cls ? ' ' + cls : ''), 'text-anchor': anchor || 'middle', 'dominant-baseline': 'middle', 'font-size': size || 16 }, value);
  }

  function line(x1, y1, x2, y2, cls, extra) {
    return el('line', Object.assign({ x1: x1, y1: y1, x2: x2, y2: y2, class: cls || 'pic-line' }, extra || {}));
  }

  function polar(cx, cy, r, degrees) {
    const a = degrees * Math.PI / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  }

  // An arc for an angle between two directions (degrees, counted
  // anticlockwise from the right), drawn the short or the long way.
  function arc(cx, cy, r, from, to, cls) {
    let sweep = to - from;
    while (sweep < 0) sweep += 360;
    const a = polar(cx, cy, r, from);
    const b = polar(cx, cy, r, from + sweep);
    return el('path', { d: 'M ' + a[0] + ' ' + a[1] + ' A ' + r + ' ' + r + ' 0 ' + (sweep > 180 ? 1 : 0) + ' 0 ' + b[0] + ' ' + b[1], class: cls || 'pic-arc' });
  }

  function sector(cx, cy, r, from, to, cls) {
    const a = polar(cx, cy, r, from);
    const b = polar(cx, cy, r, to);
    const big = (to - from + 360) % 360 > 180 ? 1 : 0;
    return el('path', { d: 'M ' + cx + ' ' + cy + ' L ' + a[0] + ' ' + a[1] + ' A ' + r + ' ' + r + ' 0 ' + big + ' 0 ' + b[0] + ' ' + b[1] + ' Z', class: cls });
  }

  const R = {};

  /* Words: an expression or a number written out. */
  R.words = function (p) {
    const box = document.createElement('div');
    box.className = 'pic-words';
    box.textContent = p.text;
    return box;
  };

  /* Clocks, with Arabic or Roman numerals. */
  const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

  R.clock = function (p) {
    const s = svg(220, 220, 'A clock');
    add(s, el('circle', { cx: 110, cy: 110, r: 100, class: 'pic-face' }));
    for (let k = 0; k < 60; k++) {
      const outer = polar(110, 110, 96, 90 - k * 6);
      const inner = polar(110, 110, k % 5 === 0 ? 84 : 90, 90 - k * 6);
      add(s, line(inner[0], inner[1], outer[0], outer[1], k % 5 === 0 ? 'pic-line' : 'pic-thin'));
    }
    for (let k = 0; k < 12; k++) {
      const at = polar(110, 110, 70, 90 - k * 30);
      add(s, text(at[0], at[1] + 1, p.roman ? ROMAN[k] : (k === 0 ? 12 : k), 'pic-clock-number', 'middle', p.roman ? 15 : 19));
    }
    const hourAngle = 90 - ((p.h % 12) + p.m / 60) * 30;
    const minuteAngle = 90 - p.m * 6;
    const hourEnd = polar(110, 110, 48, hourAngle);
    const minuteEnd = polar(110, 110, 80, minuteAngle);
    add(s, line(110, 110, hourEnd[0], hourEnd[1], 'pic-hand pic-hour'), line(110, 110, minuteEnd[0], minuteEnd[1], 'pic-hand pic-minute'),
      el('circle', { cx: 110, cy: 110, r: 6, class: 'pic-dot' }));
    return s;
  };

  /* Coins: copper 1p and 2p, silver 5p to 50p, gold-coloured £1 and £2. */
  R.coins = function (p) {
    const sizes = { 1: 24, 2: 30, 5: 22, 10: 30, 20: 26, 50: 32, 100: 28, 200: 32 };
    let x = 10;
    const placed = p.coins.map(function (value) {
      const r = sizes[value] || 26;
      const at = x + r;
      x += 2 * r + 12;
      return { value: value, r: r, x: at };
    });
    const s = svg(x, 80, 'Coins');
    placed.forEach(function (c) {
      const metal = c.value <= 2 ? 'pic-copper' : (c.value >= 100 ? 'pic-gold' : 'pic-silver');
      add(s, el('circle', { cx: c.x, cy: 40, r: c.r, class: 'pic-coin ' + metal }),
        el('circle', { cx: c.x, cy: 40, r: c.r - 5, class: 'pic-coin-rim' }),
        text(c.x, 41, c.value >= 100 ? '£' + c.value / 100 : c.value + 'p', 'pic-coin-text', 'middle', c.r > 26 ? 17 : 14));
    });
    return s;
  };

  /* A ruler with a pencil lying along it, starting at 0. */
  R.ruler = function (p) {
    const unit = 24;
    const width = p.max * unit + 40;
    const s = svg(width, 110, 'A pencil on a ruler');
    add(s, el('rect', { x: 10, y: 58, width: p.max * unit + 20, height: 42, rx: 4, class: 'pic-ruler' }));
    for (let k = 0; k <= p.max * 2; k++) {
      const x = 20 + k * unit / 2;
      add(s, line(x, 58, x, 58 + (k % 2 ? 9 : 16), 'pic-line'));
      if (k % 2 === 0) add(s, text(x, 87, k / 2, '', 'middle', 13));
    }
    add(s, text(width - 16, 87, 'cm', 'pic-small', 'end', 11));
    const end = 20 + p.length * unit;
    add(s, el('path', { d: 'M 20 26 L ' + (end - 16) + ' 26 L ' + end + ' 36 L ' + (end - 16) + ' 46 L 20 46 Z', class: 'pic-pencil' }),
      el('path', { d: 'M ' + (end - 16) + ' 26 L ' + end + ' 36 L ' + (end - 16) + ' 46 Z', class: 'pic-pencil-tip' }),
      line(20, 20, 20, 58, 'pic-guide'), line(end, 20, end, 58, 'pic-guide'));
    return s;
  };

  /* A thermometer or a measuring jug: a vertical scale with marks every
     `step` and numbers every few marks. */
  R.scale = function (p) {
    const steps = (p.max - p.min) / p.step;
    const labelEvery = steps > 12 ? (steps % 4 === 0 && steps / 4 <= 10 ? steps / 10 : Math.ceil(steps / 8)) : (steps > 6 ? 2 : 1);
    const top = 24;
    const bottom = 244;
    const yOf = function (v) { return bottom - (v - p.min) / (p.max - p.min) * (bottom - top); };
    const s = svg(200, 280, p.style === 'jug' ? 'A measuring jug' : 'A thermometer');
    if (p.style === 'jug') {
      add(s, el('path', { d: 'M 70 ' + (top - 10) + ' L 70 ' + bottom + ' Q 70 ' + (bottom + 12) + ' 82 ' + (bottom + 12) + ' L 168 ' + (bottom + 12) + ' Q 180 ' + (bottom + 12) + ' 180 ' + bottom + ' L 180 ' + (top - 10), class: 'pic-jug' }),
        el('rect', { x: 71, y: yOf(p.value), width: 108, height: bottom + 11 - yOf(p.value), class: 'pic-water' }));
      for (let k = 0; k <= steps; k++) {
        const y = yOf(p.min + k * p.step);
        const labelled = k % labelEvery === 0;
        add(s, line(70, y, 70 + (labelled ? 22 : 12), y, 'pic-line'));
        if (labelled) add(s, text(62, y, p.min + k * p.step, '', 'end', 13));
      }
      add(s, text(125, 12, p.unit, 'pic-small', 'middle', 12));
      return s;
    }
    add(s, el('rect', { x: 100, y: top - 12, width: 22, height: bottom - top + 24, rx: 11, class: 'pic-tube' }),
      el('circle', { cx: 111, cy: bottom + 20, r: 18, class: 'pic-bulb' }),
      el('rect', { x: 105, y: yOf(p.value), width: 12, height: bottom + 8 - yOf(p.value), class: 'pic-mercury' }));
    for (let k = 0; k <= steps; k++) {
      const v = p.min + k * p.step;
      const y = yOf(v);
      const labelled = k % labelEvery === 0;
      add(s, line(labelled ? 74 : 84, y, 98, y, 'pic-line'));
      if (labelled) add(s, text(70, y, v < 0 ? MINUS + Math.abs(v) : v, '', 'end', 13));
    }
    add(s, text(150, 20, p.unit, 'pic-small', 'middle', 13));
    return s;
  };

  /* A shape cut into equal parts, some shaded. */
  R.fraction = function (p) {
    if (p.shape === 'circle') {
      const s = svg(180, 180, 'A circle cut into ' + p.parts + ' equal parts');
      for (let k = 0; k < p.parts; k++) {
        add(s, sector(90, 90, 80, 90 - (k + 1) * 360 / p.parts, 90 - k * 360 / p.parts, k < p.shaded ? 'pic-shaded' : 'pic-part'));
      }
      if (p.parts === 1) add(s, el('circle', { cx: 90, cy: 90, r: 80, class: p.shaded ? 'pic-shaded' : 'pic-part' }));
      return s;
    }
    const tall = p.shape === 'rect';
    const width = 300;
    const height = tall ? 150 : 70;
    const s = svg(width + 20, height + 20, 'A shape cut into ' + p.parts + ' equal parts');
    for (let k = 0; k < p.parts; k++) {
      add(s, el('rect', { x: 10 + k * width / p.parts, y: 10, width: width / p.parts, height: height, class: k < p.shaded ? 'pic-shaded' : 'pic-part' }));
    }
    return s;
  };

  /* Polygons from corner points (x right, y up), with side labels, angle
     labels, equal-side ticks, right-angle squares, a mirror line or a
     dashed height. */
  R.shape = function (p) {
    const W = 320;
    const H = 230;
    if (p.circle) {
      const s = svg(W, H, 'A circle');
      add(s, el('circle', { cx: W / 2, cy: H / 2, r: 90, class: p.fill ? 'pic-shape pic-filled' : 'pic-shape' }));
      return s;
    }
    const pts = p.points;
    const xs = pts.map(function (q) { return q[0]; });
    const ys = pts.map(function (q) { return q[1]; });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    const pad = 46;
    const scale = Math.min((W - 2 * pad) / Math.max(maxX - minX, 0.001), (H - 2 * pad) / Math.max(maxY - minY, 0.001));
    const offX = (W - (maxX - minX) * scale) / 2;
    const offY = (H - (maxY - minY) * scale) / 2;
    const at = function (q) { return [offX + (q[0] - minX) * scale, H - offY - (q[1] - minY) * scale]; };
    const screen = pts.map(at);
    const cx = screen.reduce(function (t, q) { return t + q[0]; }, 0) / screen.length;
    const cy = screen.reduce(function (t, q) { return t + q[1]; }, 0) / screen.length;
    const s = svg(W, H, 'A shape');
    add(s, el('polygon', { points: screen.map(function (q) { return q.join(','); }).join(' '), class: p.fill ? 'pic-shape pic-filled' : 'pic-shape' }));
    const n = screen.length;
    const angleAt = function (k) {
      const a = screen[(k + n - 1) % n];
      const b = screen[k];
      const c = screen[(k + 1) % n];
      const v1 = [a[0] - b[0], a[1] - b[1]];
      const v2 = [c[0] - b[0], c[1] - b[1]];
      return Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]))) * 180 / Math.PI;
    };
    // Right angles: every 90-degree corner, or the corners listed.
    const squares = p.rightAngles === true ? screen.map(function (q, k) { return k; }).filter(function (k) { return Math.abs(angleAt(k) - 90) < 0.5; })
      : (p.rightAngles || []);
    squares.forEach(function (k) {
      const b = screen[k];
      const a = screen[(k + n - 1) % n];
      const c = screen[(k + 1) % n];
      const u = [(a[0] - b[0]) / Math.hypot(a[0] - b[0], a[1] - b[1]), (a[1] - b[1]) / Math.hypot(a[0] - b[0], a[1] - b[1])];
      const v = [(c[0] - b[0]) / Math.hypot(c[0] - b[0], c[1] - b[1]), (c[1] - b[1]) / Math.hypot(c[0] - b[0], c[1] - b[1])];
      const m = 14;
      add(s, el('path', { d: 'M ' + (b[0] + u[0] * m) + ' ' + (b[1] + u[1] * m) + ' L ' + (b[0] + (u[0] + v[0]) * m) + ' ' + (b[1] + (u[1] + v[1]) * m) +
        ' L ' + (b[0] + v[0] * m) + ' ' + (b[1] + v[1] * m), class: 'pic-thin pic-open' }));
    });
    (p.ticks || []).forEach(function (tick) {
      const a = screen[tick[0]];
      const b = screen[(tick[0] + 1) % n];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const normal = [-d[1], d[0]];
      for (let k = 0; k < tick[1]; k++) {
        const o = (k - (tick[1] - 1) / 2) * 6;
        const c = [mid[0] + d[0] * o, mid[1] + d[1] * o];
        add(s, line(c[0] - normal[0] * 7, c[1] - normal[1] * 7, c[0] + normal[0] * 7, c[1] + normal[1] * 7, 'pic-line'));
      }
    });
    (p.sideLabels || []).forEach(function (label, k) {
      if (!label) return;
      const a = screen[k];
      const b = screen[(k + 1) % n];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let normal = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
      if ((mid[0] - cx) * normal[0] + (mid[1] - cy) * normal[1] < 0) normal = [-normal[0], -normal[1]];
      add(s, text(mid[0] + normal[0] * 20, mid[1] + normal[1] * 18, label, label === '?' ? 'pic-ask' : '', 'middle', 15));
    });
    (p.angleLabels || []).forEach(function (label, k) {
      if (!label) return;
      const b = screen[k];
      const toward = [cx - b[0], cy - b[1]];
      const len = Math.hypot(toward[0], toward[1]);
      add(s, text(b[0] + toward[0] / len * 30, b[1] + toward[1] / len * 30, label, label === '?' ? 'pic-ask' : '', 'middle', 15));
    });
    if (p.mirror) {
      const x = at([p.mirror.x, 0])[0];
      add(s, line(x, 8, x, H - 8, 'pic-mirror'));
    }
    if (p.height) {
      const a = at(p.height.from);
      const b = at(p.height.to);
      add(s, line(a[0], a[1], b[0], b[1], 'pic-dashed'), el('path', { d: 'M ' + (b[0] + 10) + ' ' + b[1] + ' L ' + (b[0] + 10) + ' ' + (b[1] - 10) + ' L ' + b[0] + ' ' + (b[1] - 10), class: 'pic-thin pic-open' }),
        text((a[0] + b[0]) / 2 + 8, (a[1] + b[1]) / 2, p.height.text, '', 'start', 15));
    }
    if (p.notToScale) add(s, text(W - 6, H - 8, 'not to scale', 'pic-small', 'end', 11));
    return s;
  };

  /* Area: a shape made of squares on a grid. */
  R.areaGrid = function (p) {
    const size = 34;
    const s = svg(p.cols * size + 20, p.rows * size + 20, 'A shape on squared paper');
    for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) add(s, el('rect', { x: 10 + c * size, y: 10 + r * size, width: size, height: size, class: 'pic-gridsquare' }));
    p.cells.forEach(function (cell) { add(s, el('rect', { x: 10 + cell[1] * size, y: 10 + cell[0] * size, width: size, height: size, class: 'pic-shaded pic-square' })); });
    return s;
  };

  /* Isometric drawings: one unit cube, a cuboid of cubes, a labelled box. */
  function iso(x, y, z, u) {
    return [(x - y) * u * 0.866, (x + y) * u * 0.5 - z * u];
  }

  function cube(s, ox, oy, x, y, z, u) {
    const corner = function (a, b, c) { const q = iso(a, b, c, u); return (ox + q[0]) + ',' + (oy + q[1]); };
    add(s, el('polygon', { points: [corner(x, y, z + 1), corner(x + 1, y, z + 1), corner(x + 1, y + 1, z + 1), corner(x, y + 1, z + 1)].join(' '), class: 'pic-cube-top' }),
      el('polygon', { points: [corner(x, y + 1, z), corner(x + 1, y + 1, z), corner(x + 1, y + 1, z + 1), corner(x, y + 1, z + 1)].join(' '), class: 'pic-cube-left' }),
      el('polygon', { points: [corner(x + 1, y, z), corner(x + 1, y + 1, z), corner(x + 1, y + 1, z + 1), corner(x + 1, y, z + 1)].join(' '), class: 'pic-cube-right' }));
  }

  R.cubes = function (p) {
    const u = 30;
    const width = (p.l + p.w) * u * 0.866 + 40;
    const height = (p.l + p.w) * u * 0.5 + p.h * u + 40;
    const s = svg(width, height, 'A cuboid made of cubes');
    const ox = p.w * u * 0.866 + 20;
    const oy = p.h * u + 20;
    // Paint far cubes first: smaller x + y, then lower z.
    const order = [];
    for (let z = 0; z < p.h; z++) for (let y = 0; y < p.w; y++) for (let x = 0; x < p.l; x++) order.push([x, y, z]);
    order.sort(function (a, b) { return (a[0] + a[1]) - (b[0] + b[1]) || a[2] - b[2]; });
    order.forEach(function (c) { cube(s, ox, oy, c[0], c[1], c[2], u); });
    return s;
  };

  R.cuboid = function (p) {
    const u = Math.min(22, 220 / (p.l + p.w + p.h));
    const width = (p.l + p.w) * u * 0.866 + 120;
    const height = (p.l + p.w) * u * 0.5 + p.h * u + 60;
    const s = svg(width, height, 'A cuboid');
    const ox = p.w * u * 0.866 + 50;
    const oy = p.h * u + 30;
    const pt = function (a, b, c) { const q = iso(a, b, c, u); return [ox + q[0], oy + q[1]]; };
    const poly = function (list, cls) { add(s, el('polygon', { points: list.map(function (q) { return q.join(','); }).join(' '), class: cls })); };
    poly([pt(0, 0, p.h), pt(p.l, 0, p.h), pt(p.l, p.w, p.h), pt(0, p.w, p.h)], 'pic-cube-top');
    poly([pt(0, p.w, 0), pt(p.l, p.w, 0), pt(p.l, p.w, p.h), pt(0, p.w, p.h)], 'pic-cube-left');
    poly([pt(p.l, 0, 0), pt(p.l, p.w, 0), pt(p.l, p.w, p.h), pt(p.l, 0, p.h)], 'pic-cube-right');
    const mid = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    const l = mid(pt(0, p.w, 0), pt(p.l, p.w, 0));
    const w = mid(pt(p.l, 0, 0), pt(p.l, p.w, 0));
    const h = mid(pt(p.l, 0, 0), pt(p.l, 0, p.h));
    add(s, text(l[0] - 8, l[1] + 16, p.l + ' ' + p.unit, '', 'middle', 14), text(w[0] + 10, w[1] + 14, p.w + ' ' + p.unit, '', 'start', 14),
      text(h[0] + 10, h[1], p.h + ' ' + p.unit, '', 'start', 14));
    return s;
  };

  /* A circle with its radius or diameter drawn and labelled. */
  R.circle = function (p) {
    const s = svg(300, 220, 'A circle');
    add(s, el('circle', { cx: 150, cy: 110, r: 90, class: 'pic-shape pic-filled' }), el('circle', { cx: 150, cy: 110, r: 4, class: 'pic-dot' }));
    if (p.diameter) add(s, line(60, 110, 240, 110, 'pic-line'));
    else add(s, line(150, 110, 240, 110, 'pic-line'));
    add(s, text(p.diameter ? 150 : 195, 96, p.label.replace(/^(radius|diameter) /, ''), '', 'middle', 15));
    return s;
  };

  /* 3-D shapes. */
  R.solid = function (p) {
    const s = svg(240, 200, 'A ' + p.name);
    const shape = function (d, cls) { add(s, el('path', { d: d, class: cls || 'pic-shape pic-filled' })); };
    const hidden = function (d) { add(s, el('path', { d: d, class: 'pic-dashed pic-open' })); };
    if (p.name === 'cube' || p.name === 'cuboid') {
      const w = p.name === 'cube' ? 100 : 150;
      const h = p.name === 'cube' ? 100 : 80;
      const x = (240 - w - 40) / 2;
      const y = 60;
      shape('M ' + x + ' ' + y + ' h ' + w + ' v ' + h + ' h ' + (-w) + ' Z');
      shape('M ' + x + ' ' + y + ' l 40 -36 h ' + w + ' l -40 36 Z', 'pic-shape pic-cube-top');
      shape('M ' + (x + w) + ' ' + y + ' l 40 -36 v ' + h + ' l -40 36 Z', 'pic-shape pic-cube-right');
      hidden('M ' + (x + 40) + ' ' + (y - 36) + ' v ' + h + ' h ' + w + ' M ' + (x + 40) + ' ' + (y - 36 + h) + ' l -40 36');
    } else if (p.name === 'pyramid') {
      shape('M 40 150 L 160 150 L 120 32 Z');
      shape('M 160 150 L 205 120 L 120 32 Z', 'pic-shape pic-cube-right');
      hidden('M 40 150 L 85 120 L 205 120 M 85 120 L 120 32');
    } else if (p.name === 'tetrahedron') {
      shape('M 40 160 L 170 160 L 115 30 Z');
      shape('M 170 160 L 205 120 L 115 30 Z', 'pic-shape pic-cube-right');
      hidden('M 40 160 L 205 120');
    } else if (p.name === 'prism') {
      shape('M 30 150 L 90 150 L 60 90 Z', 'pic-shape pic-cube-top');
      shape('M 90 150 L 210 120 L 180 60 L 60 90 Z', 'pic-shape pic-cube-right');
      shape('M 30 150 L 90 150 L 210 120');
      hidden('M 30 150 L 150 120 L 210 120 M 150 120 L 180 60');
    } else if (p.name === 'sphere') {
      add(s, el('circle', { cx: 120, cy: 100, r: 75, class: 'pic-shape pic-filled' }), el('ellipse', { cx: 120, cy: 100, rx: 75, ry: 20, class: 'pic-dashed pic-open' }));
    } else if (p.name === 'cylinder') {
      shape('M 60 50 L 60 150 A 60 18 0 0 0 180 150 L 180 50');
      add(s, el('ellipse', { cx: 120, cy: 50, rx: 60, ry: 18, class: 'pic-shape pic-cube-top' }));
      hidden('M 60 150 A 60 18 0 0 1 180 150');
    } else {
      shape('M 50 150 L 120 30 L 190 150 A 70 20 0 0 1 50 150 Z');
      hidden('M 50 150 A 70 20 0 0 1 190 150');
    }
    return s;
  };

  /* An arrow pointing up, with the way it turns. */
  R.arrow = function (p) {
    const s = svg(220, 200, 'An arrow pointing up');
    add(s, el('path', { d: 'M 110 30 L 140 70 L 122 70 L 122 160 L 98 160 L 98 70 L 80 70 Z', class: 'pic-arrow' }));
    const turn = p.clockwise ? arc(110, 100, 80, 70, 20) : arc(110, 100, 80, 110, 160);
    turn.setAttribute('class', 'pic-turn');
    const tip = p.clockwise ? polar(110, 100, 80, 20) : polar(110, 100, 80, 160);
    add(s, turn, el('circle', { cx: tip[0], cy: tip[1], r: 5, class: 'pic-dot' }), text(110, 188, p.clockwise ? 'clockwise' : 'anticlockwise', 'pic-small', 'middle', 13));
    return s;
  };

  /* An angle between two arms, on a protractor when it is to be measured. */
  R.angle = function (p) {
    if (p.protractor) {
      const s = svg(320, 190, 'An angle on a protractor');
      add(s, el('path', { d: 'M 20 170 A 140 140 0 0 1 300 170 Z', class: 'pic-protractor' }));
      for (let d = 0; d <= 180; d += 5) {
        const a = polar(160, 170, 140, d);
        const b = polar(160, 170, d % 10 === 0 ? 124 : 132, d);
        add(s, line(a[0], a[1], b[0], b[1], d % 10 === 0 ? 'pic-line' : 'pic-thin'));
        if (d % 20 === 0) {
          const t = polar(160, 170, 110, d);
          add(s, text(t[0], t[1], d, 'pic-small', 'middle', 11));
        }
      }
      const end = polar(160, 170, 150, p.degrees);
      add(s, line(160, 170, 310, 170, 'pic-arm'), line(160, 170, end[0], end[1], 'pic-arm'), arc(160, 170, 34, 0, p.degrees), el('circle', { cx: 160, cy: 170, r: 4, class: 'pic-dot' }));
      return s;
    }
    const s = svg(260, 200, 'An angle');
    const base = p.rotate || 0;
    const reflex = p.degrees > 180;
    const cx = reflex ? 130 : 70;
    const cy = reflex ? 100 : 150;
    const a = polar(cx, cy, 110, base);
    const b = polar(cx, cy, 110, base + p.degrees);
    add(s, line(cx, cy, a[0], a[1], 'pic-arm'), line(cx, cy, b[0], b[1], 'pic-arm'));
    if (p.degrees === 90) {
      const u = polar(cx, cy, 18, base);
      const v = polar(cx, cy, 18, base + 90);
      add(s, el('path', { d: 'M ' + u[0] + ' ' + u[1] + ' L ' + (u[0] + v[0] - cx) + ' ' + (u[1] + v[1] - cy) + ' L ' + v[0] + ' ' + v[1], class: 'pic-thin pic-open' }));
    } else {
      add(s, arc(cx, cy, 30, base, base + p.degrees));
    }
    add(s, el('circle', { cx: cx, cy: cy, r: 4, class: 'pic-dot' }));
    return s;
  };

  /* Two lines: parallel, perpendicular or neither. */
  R.lines = function (p) {
    const s = svg(260, 200, 'Two lines');
    const g = el('g', { transform: 'rotate(' + (-(p.rotate || 0)) + ' 130 100)' });
    if (p.relation === 'parallel') add(g, line(40, 70, 220, 70, 'pic-arm'), line(40, 130, 220, 130, 'pic-arm'));
    else if (p.relation === 'perpendicular') {
      add(g, line(40, 140, 220, 140, 'pic-arm'), line(130, 30, 130, 140, 'pic-arm'),
        el('path', { d: 'M 130 124 L 146 124 L 146 140', class: 'pic-thin pic-open' }));
    } else add(g, line(40, 70, 220, 90, 'pic-arm'), line(40, 150, 220, 120, 'pic-arm'));
    add(s, g);
    return s;
  };

  /* A coordinate grid with labelled points. */
  R.grid = function (p) {
    const cells = p.max - p.min;
    const size = Math.min(28, 300 / cells);
    const pad = 26;
    const width = cells * size + 2 * pad;
    const s = svg(width, width, 'A coordinate grid');
    const X = function (x) { return pad + (x - p.min) * size; };
    const Y = function (y) { return pad + (p.max - y) * size; };
    for (let k = p.min; k <= p.max; k++) {
      add(s, line(X(k), Y(p.min), X(k), Y(p.max), k === 0 ? 'pic-axis' : 'pic-gridline'), line(X(p.min), Y(k), X(p.max), Y(k), k === 0 ? 'pic-axis' : 'pic-gridline'));
      if (k !== 0 || p.min === 0) {
        add(s, text(X(k), Y(Math.max(p.min, 0)) + 14, k < 0 ? MINUS + Math.abs(k) : k, 'pic-small', 'middle', 10));
        if (k !== 0) add(s, text(X(Math.max(p.min, 0)) - 8, Y(k), k < 0 ? MINUS + Math.abs(k) : k, 'pic-small', 'end', 10));
      }
    }
    add(s, text(X(p.max) + 10, Y(Math.max(p.min, 0)), 'x', 'pic-small', 'middle', 12), text(X(Math.max(p.min, 0)), Y(p.max) - 12, 'y', 'pic-small', 'middle', 12));
    if (p.mirror !== undefined) add(s, line(X(p.mirror), Y(p.min), X(p.mirror), Y(p.max), 'pic-mirror'));
    if (p.axisLine === 'x') add(s, line(X(p.min), Y(0), X(p.max), Y(0), 'pic-mirror'));
    if (p.axisLine === 'y') add(s, line(X(0), Y(p.min), X(0), Y(p.max), 'pic-mirror'));
    p.points.forEach(function (pt) {
      add(s, el('circle', { cx: X(pt.x), cy: Y(pt.y), r: 5, class: 'pic-point' }), text(X(pt.x) + 9, Y(pt.y) - 9, pt.label, 'pic-label', 'start', 14));
    });
    return s;
  };

  /* Angles on a straight line and around a point. */
  R.anglesLine = function (p) {
    const s = svg(320, 170, 'Angles on a straight line');
    const cx = 160;
    const cy = 140;
    const ray = polar(cx, cy, 130, p.angles[0]);
    add(s, line(20, cy, 300, cy, 'pic-arm'), line(cx, cy, ray[0], ray[1], 'pic-arm'), arc(cx, cy, 34, 0, p.angles[0]), arc(cx, cy, 44, p.angles[0], 180));
    const l1 = polar(cx, cy, 64, p.angles[0] / 2);
    const l2 = polar(cx, cy, 72, p.angles[0] + p.angles[1] / 2);
    add(s, text(l1[0], l1[1], p.labels[0], p.labels[0] === '?' ? 'pic-ask' : '', 'middle', 15), text(l2[0], l2[1], p.labels[1], p.labels[1] === '?' ? 'pic-ask' : '', 'middle', 15),
      el('circle', { cx: cx, cy: cy, r: 4, class: 'pic-dot' }));
    return s;
  };

  R.anglesPoint = function (p) {
    const s = svg(260, 260, 'Angles around a point');
    const cx = 130;
    const cy = 130;
    let from = 20;
    p.angles.forEach(function (a, k) {
      const end = polar(cx, cy, 115, from);
      // Each angle gets its own radius, so the arcs read as separate angles.
      add(s, line(cx, cy, end[0], end[1], 'pic-arm'), arc(cx, cy, 22 + k * 9, from, from + a));
      const label = polar(cx, cy, 64, from + a / 2);
      add(s, text(label[0], label[1], p.labels[k], p.labels[k] === '?' ? 'pic-ask' : '', 'middle', 15));
      from += a;
    });
    add(s, el('circle', { cx: cx, cy: cy, r: 4, class: 'pic-dot' }));
    return s;
  };

  // The four angles where two lines cross: 0 between the right arm and the
  // upper arm, then anticlockwise.
  function crossingAngles(s, cx, cy, angle, labels) {
    const bounds = [0, angle, 180, 180 + angle, 360];
    for (let k = 0; k < 4; k++) {
      if (!labels[k]) continue;
      add(s, arc(cx, cy, 24 + (k % 2) * 6, bounds[k], bounds[k + 1]));
      const at = polar(cx, cy, 46, (bounds[k] + bounds[k + 1]) / 2);
      add(s, text(at[0], at[1], labels[k], labels[k] === '?' ? 'pic-ask' : '', 'middle', 14));
    }
  }

  R.crossing = function (p) {
    const s = svg(300, 220, 'Two crossing lines');
    const a = polar(150, 110, 130, p.angle);
    const b = polar(150, 110, 130, p.angle + 180);
    add(s, line(20, 110, 280, 110, 'pic-arm'), line(a[0], a[1], b[0], b[1], 'pic-arm'));
    const labels = ['', '', '', ''];
    labels[p.given] = p.angle + '°';
    labels[p.asked] = '?';
    crossingAngles(s, 150, 110, p.angle, labels);
    return s;
  };

  R.parallel = function (p) {
    const s = svg(320, 240, 'Two parallel lines crossed by a third');
    const y1 = 70;
    const y2 = 170;
    // The crossing line rises to the right at p.angle, so at each crossing
    // the arm going up is at p.angle, as crossingAngles expects.
    const dx = (y2 - y1) / Math.tan(p.angle * Math.PI / 180);
    const x1 = 160 + dx / 2;
    const x2 = 160 - dx / 2;
    const ext = 60;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const u = [(x1 - x2) / len, (y1 - y2) / len];
    add(s, line(20, y1, 300, y1, 'pic-arm'), line(20, y2, 300, y2, 'pic-arm'),
      line(x1 + u[0] * ext, y1 + u[1] * ext, x2 - u[0] * ext, y2 - u[1] * ext, 'pic-arm'),
      el('path', { d: 'M 236 ' + (y1 - 7) + ' L 248 ' + y1 + ' L 236 ' + (y1 + 7), class: 'pic-thin pic-open' }),
      el('path', { d: 'M 236 ' + (y2 - 7) + ' L 248 ' + y2 + ' L 236 ' + (y2 + 7), class: 'pic-thin pic-open' }));
    const top = ['', '', '', ''];
    const bottom = ['', '', '', ''];
    const mark = function (pos, label) { if (pos < 4) top[pos] = label; else bottom[pos - 4] = label; };
    mark(p.given, p.angle + '°');
    mark(p.asked, '?');
    crossingAngles(s, x1, y1, p.angle, top);
    crossingAngles(s, x2, y2, p.angle, bottom);
    return s;
  };

  /* Nets of a cube, a square-based pyramid and a triangular prism. */
  R.net = function (p) {
    const s = svg(300, 230, 'A net');
    const sq = function (x, y, a) { add(s, el('rect', { x: x, y: y, width: a, height: a, class: 'pic-shape pic-filled' })); };
    const tri = function (pts) { add(s, el('polygon', { points: pts.map(function (q) { return q.join(','); }).join(' '), class: 'pic-shape pic-filled' })); };
    if (p.name === 'cube') {
      const a = 52;
      sq(20, 20 + a, a); sq(20 + a, 20 + a, a); sq(20 + 2 * a, 20 + a, a); sq(20 + 3 * a, 20 + a, a); sq(20 + a, 20, a); sq(20 + a, 20 + 2 * a, a);
    } else if (p.name === 'pyramid') {
      const a = 70;
      const x = 115;
      const y = 80;
      sq(x, y, a);
      tri([[x, y], [x + a, y], [x + a / 2, y - 60]]); tri([[x, y + a], [x + a, y + a], [x + a / 2, y + a + 60]]);
      tri([[x, y], [x, y + a], [x - 60, y + a / 2]]); tri([[x + a, y], [x + a, y + a], [x + a + 60, y + a / 2]]);
    } else {
      const w = 60;
      const h = 80;
      const x = 60;
      const y = 75;
      for (let k = 0; k < 3; k++) add(s, el('rect', { x: x + k * w, y: y, width: w, height: h, class: 'pic-shape pic-filled' }));
      tri([[x + w, y], [x + 2 * w, y], [x + 1.5 * w, y - 52]]); tri([[x + w, y + h], [x + 2 * w, y + h], [x + 1.5 * w, y + h + 52]]);
    }
    return s;
  };

  /* Charts. */
  function tallyMarks(s, x, y, count) {
    let at = x;
    for (let k = 0; k < count; k++) {
      const inGate = k % 5;
      if (inGate === 4) {
        add(s, line(at - 4 * 9 - 4, y + 18, at + 2, y - 2, 'pic-tally'));
        at += 12;
      } else {
        add(s, line(at, y - 2, at, y + 18, 'pic-tally'));
        at += 9;
      }
    }
  }

  R.tally = function (p) {
    const rowH = 34;
    const s = svg(340, p.labels.length * rowH + 20, 'A tally chart');
    p.labels.forEach(function (label, k) {
      const y = 10 + k * rowH;
      add(s, el('rect', { x: 8, y: y, width: 324, height: rowH, class: 'pic-cellbox' }), line(110, y, 110, y + rowH, 'pic-thin'),
        text(18, y + rowH / 2, label, '', 'start', 14));
      tallyMarks(s, 124, y + 7, p.counts[k]);
    });
    return s;
  };

  R.pictogram = function (p) {
    const rowH = 36;
    const s = svg(340, p.labels.length * rowH + 50, 'A pictogram');
    p.labels.forEach(function (label, k) {
      const y = 10 + k * rowH;
      add(s, text(14, y + rowH / 2, label, '', 'start', 14));
      const symbols = p.values[k] / p.key;
      const whole = Math.floor(symbols);
      for (let c = 0; c < whole; c++) add(s, el('circle', { cx: 122 + c * 28, cy: y + rowH / 2, r: 11, class: 'pic-shaded' }));
      if (symbols > whole) {
        const cx = 122 + whole * 28;
        add(s, el('path', { d: 'M ' + cx + ' ' + (y + rowH / 2 - 11) + ' A 11 11 0 0 0 ' + cx + ' ' + (y + rowH / 2 + 11) + ' Z', class: 'pic-shaded' }));
      }
    });
    const ky = 18 + p.labels.length * rowH;
    add(s, el('circle', { cx: 122, cy: ky, r: 9, class: 'pic-shaded' }), text(138, ky, '= ' + p.key, '', 'start', 14));
    return s;
  };

  function axes(s, left, top, width, height, max, step, unit) {
    const labelStep = max / step > 10 ? step * 2 : step;
    for (let v = 0; v <= max; v += step) {
      const y = top + height - v / max * height;
      add(s, line(left, y, left + width, y, v === 0 ? 'pic-axis' : 'pic-gridline'));
      if (v % labelStep === 0) add(s, text(left - 6, y, v, 'pic-small', 'end', 11));
    }
    add(s, line(left, top - 6, left, top + height, 'pic-axis'));
    if (unit) add(s, text(left, top - 14, unit, 'pic-small', 'middle', 11));
  }

  R.bars = function (p) {
    const s = svg(360, 260, p.blocks ? 'A block diagram' : 'A bar chart');
    const max = Math.ceil(Math.max.apply(null, p.values) / p.step + 1) * p.step;
    const left = 46;
    const top = 20;
    const width = 300;
    const height = 190;
    axes(s, left, top, width, height, max, p.step);
    const slot = width / p.labels.length;
    p.labels.forEach(function (label, k) {
      const x = left + k * slot + slot * 0.2;
      const w = slot * 0.6;
      if (p.blocks) {
        for (let b = 0; b < p.values[k]; b++) add(s, el('rect', { x: x, y: top + height - (b + 1) / max * height, width: w, height: height / max, class: 'pic-shaded pic-square' }));
      } else {
        add(s, el('rect', { x: x, y: top + height - p.values[k] / max * height, width: w, height: p.values[k] / max * height, class: 'pic-shaded' }));
      }
      add(s, text(x + w / 2, top + height + 18, label, 'pic-small', 'middle', 12));
    });
    return s;
  };

  R.table = function (p) {
    const table = document.createElement('table');
    table.className = 'pic-table';
    const head = document.createElement('tr');
    p.head.forEach(function (h) { const th = document.createElement('th'); th.textContent = h; head.appendChild(th); });
    table.appendChild(head);
    p.rows.forEach(function (row) {
      const tr = document.createElement('tr');
      row.forEach(function (cell, k) { const td = document.createElement(k ? 'td' : 'th'); td.textContent = cell; tr.appendChild(td); });
      table.appendChild(tr);
    });
    return table;
  };

  R.line = function (p) {
    const s = svg(380, 260, 'A line graph');
    const max = Math.ceil(Math.max.apply(null, p.values) / p.step + 1) * p.step;
    const left = 46;
    const top = 26;
    const width = 316;
    const height = 180;
    axes(s, left, top, width, height, max, p.step, p.unit);
    for (let v = 0; v <= max; v += 1) {
      const y = top + height - v / max * height;
      if (v % p.step) add(s, line(left, y, left + width, y, 'pic-faint'));
    }
    const X = function (k) { return left + 16 + k * (width - 32) / (p.labels.length - 1); };
    const Y = function (v) { return top + height - v / max * height; };
    add(s, el('polyline', { points: p.values.map(function (v, k) { return X(k) + ',' + Y(v); }).join(' '), class: 'pic-graph' }));
    p.values.forEach(function (v, k) {
      add(s, el('circle', { cx: X(k), cy: Y(v), r: 4, class: 'pic-point' }), text(X(k), top + height + 18, p.labels[k], 'pic-small', 'middle', 10));
    });
    return s;
  };

  R.pie = function (p) {
    const s = svg(360, 240, 'A pie chart');
    let from = 90;
    p.degrees.forEach(function (d, k) {
      const to = from - d;
      add(s, sector(130, 120, 100, to, from, 'pic-pie pic-pie-' + (k % 4)));
      const mid = polar(130, 120, 62, (from + to) / 2);
      add(s, text(mid[0], mid[1], d + '°', 'pic-small', 'middle', 12));
      from = to;
    });
    p.labels.forEach(function (label, k) {
      add(s, el('rect', { x: 250, y: 60 + k * 30, width: 16, height: 16, class: 'pic-pie pic-pie-' + (k % 4) }), text(274, 68 + k * 30, label, '', 'start', 14));
    });
    return s;
  };

  R.scatter = function (p) {
    const s = svg(300, 260, 'A scatter graph');
    const left = 30;
    const top = 16;
    const size = 220;
    add(s, line(left, top, left, top + size, 'pic-axis'), line(left, top + size, left + size + 30, top + size, 'pic-axis'));
    p.points.forEach(function (pt) { add(s, el('circle', { cx: left + pt[0] * 11, cy: top + size - pt[1] * 9, r: 4.5, class: 'pic-point' })); });
    return s;
  };

  /* A repeating pattern of shapes, with a dashed box for the next one. */
  R.pattern = function (p) {
    const gap = 46;
    const s = svg((p.shapes.length + 1) * gap + 20, 70, 'A pattern of shapes');
    const draw = function (shape, x) {
      if (shape === 'circle') return el('circle', { cx: x, cy: 35, r: 15, class: 'pic-shape pic-filled' });
      if (shape === 'square') return el('rect', { x: x - 14, y: 21, width: 28, height: 28, class: 'pic-shape pic-filled' });
      return el('polygon', { points: (x - 16) + ',49 ' + (x + 16) + ',49 ' + x + ',19', class: 'pic-shape pic-filled' });
    };
    p.shapes.forEach(function (shape, k) { add(s, draw(shape, 30 + k * gap)); });
    add(s, el('rect', { x: 30 + p.shapes.length * gap - 18, y: 17, width: 36, height: 36, class: 'pic-dashed pic-open' }), text(30 + p.shapes.length * gap, 36, '?', 'pic-ask', 'middle', 18));
    return s;
  };

  function render(picture) {
    const draw = R[picture.kind];
    if (!draw) throw new Error('No picture for ' + picture.kind);
    const node = draw(picture);
    const holder = document.createElement('div');
    holder.className = 'picture pic-' + picture.kind;
    holder.appendChild(node);
    return holder;
  }

  root.DigitStackPictures = { render: render, kinds: Object.keys(R) };
})(typeof window !== 'undefined' ? window : this);
