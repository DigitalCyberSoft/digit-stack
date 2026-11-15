/*
 * Digit Stack topics: the six areas beyond the four calculations, Number,
 * Fractions, Measures, Shape, Data and Algebra, for Years 1 to 7 of the
 * national curriculum in England (programmes of study, gov.uk, updated
 * 28 September 2021). Every question is a sentence with answer boxes,
 * typed on the keyboard, sometimes with a picture. Each year is pitched for
 * a strong pupil: its own content at the top of the range, and some of the
 * next year's.
 *
 * Every problem carries a `check` that tests/engine.check.js verifies with
 * its own arithmetic: 'statement' means the finished sentence is true; the
 * other kinds name what the answer must be worked out from.
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
  // Questions answered by drawing (drawing.js), added to each area below.
  const DRAW = Engine.drawing.kinds;
  const randInt = K.randInt;
  const pick = K.pick;
  const shuffle = K.shuffle;
  const weighted = K.weighted;
  const gcd = K.gcd;
  const roundTo = K.roundTo;
  const grouped = K.grouped;
  const decimalText = K.decimalText;
  const digitsNumber = K.digitsNumber;
  const placeName = K.placeName;
  const signed = K.signed;
  const fill = K.fill;

  const YES_NO = [[1, 'yes'], [0, 'no']];

  function sentence(area, year, title, stage, prompt, why, tokens, extra) {
    return K.buildSentence(Object.assign({
      area: area, year: year, title: title, stage: stage, prompt: prompt, why: why, tokens: tokens
    }, extra || {}));
  }

  // Tries a generator until it returns a problem that fits: within 15
  // cells, so a phone screen shows the whole sentence.
  function fits(make) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const problem = make();
      if (problem && problem.width <= 15) return problem;
    }
    throw new Error('No problem fitted');
  }

  function lcm(a, b) {
    return a / gcd(a, b) * b;
  }

  function isPrime(n) {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
  }

  function smallestFactor(n) {
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return d;
    return n;
  }

  function primeFactors(n) {
    const out = [];
    let rest = n;
    while (rest > 1) {
      const p = smallestFactor(rest);
      out.push(p);
      rest /= p;
    }
    return out;
  }

  // An integer as text, with MINUS for negatives.
  function int(value) {
    return value < 0 ? MINUS + Math.abs(value) : String(value);
  }

  function plural(count, one, many) {
    return count + ' ' + (count === 1 ? one : many);
  }

  /* Number words, in British style: 1,205 is "one thousand, two hundred and
     five" and 4,007 is "four thousand and seven". */

  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
    'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function under100(n) {
    if (n < 20) return ONES[n];
    return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  }

  function under1000(n) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    if (!hundreds) return under100(rest);
    return ONES[hundreds] + ' hundred' + (rest ? ' and ' + under100(rest) : '');
  }

  function numberWords(n) {
    if (n === 0) return 'zero';
    const parts = [];
    const millions = Math.floor(n / 1000000);
    const thousands = Math.floor(n / 1000) % 1000;
    const rest = n % 1000;
    if (millions) parts.push(under1000(millions) + ' million');
    if (thousands) parts.push(under1000(thousands) + ' thousand');
    if (rest) parts.push((parts.length && rest < 100 ? 'and ' : '') + under1000(rest));
    return parts.join(', ').replace(', and ', ' and ');
  }

  const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

  function romanParts(n) {
    const parts = [];
    let rest = n;
    ROMAN.forEach(function (pair) {
      while (rest >= pair[0]) {
        parts.push(pair);
        rest -= pair[0];
      }
    });
    return parts;
  }

  function roman(n) {
    return romanParts(n).map(function (pair) { return pair[1]; }).join('');
  }

  // Runs a kind chosen by weight for the year, again if what it made is too
  // wide for a phone (15 cells).
  function chooser(kinds, weights, area) {
    return function (year) {
      const name = weighted(weights[year]);
      for (let attempt = 0; attempt < 100; attempt++) {
        const problem = kinds[name](year);
        if (problem && problem.width <= 15) return problem;
      }
      throw new Error(area + ' ' + name + ' made nothing that fits for year ' + year);
    };
  }

  /* Number: place value, counting, comparing, rounding, Roman numerals,
     negative numbers, factors, primes, powers and the order of operations. */

  const NUMBER = {};

  // Years 1 to 4: 1, 10, 100 or 1,000 more or less, half the time across a
  // boundary (1 more than 199, 10 less than 405).
  NUMBER.moreLess = function (year) {
    const step = pick({ 1: [1, 1, 10], 2: [1, 10, 10], 3: [10, 100], 4: [100, 1000] }[year]);
    const top = { 1: 100, 2: 100, 3: 1000, 4: 10000 }[year];
    for (let attempt = 0; attempt < 500; attempt++) {
      const more = randInt(0, 1) === 1;
      let n = randInt(step, top - step - 1);
      const crossing = randInt(0, 1) === 1;
      if (crossing) {
        const digit = Math.floor(n / step) % 10;
        n += ((more ? 9 : 0) - digit) * step;
      }
      const result = more ? n + step : n - step;
      if (n < 1 || result < 0 || result > top) continue;
      const tokens = [{ n: n }, { s: more ? '+' : MINUS }, { n: step }, { s: '=' }, { ask: result }];
      return sentence('number', year, 'More or less', 'COUNT',
        'What is ' + grouped(step) + (more ? ' more' : ' less') + ' than ' + grouped(n) + '?',
        (more ? 'Count on ' : 'Count back ') + grouped(step) + ' from ' + grouped(n) + ': ' + grouped(result) + '.' +
          (Math.floor(n / (step * 10)) !== Math.floor(result / (step * 10)) ? ' The next column changes too.' : ''),
        tokens);
    }
    return null;
  };

  function compareWhy(a, b, show) {
    const sym = a < b ? '<' : (a > b ? '>' : '=');
    const word = a < b ? 'less than' : (a > b ? 'more than' : 'the same as');
    if (a === b) return 'They are the same number, so ' + show(a) + ' = ' + show(b) + '.';
    if (a < 0 || b < 0) {
      return show(a) + ' is ' + (a < b ? 'further below' : 'nearer to or above') + ' zero than ' + show(b) +
        ' on a number line, so ' + show(a) + ' ' + sym + ' ' + show(b) + '.';
    }
    const ta = String(a);
    const tb = String(b);
    if (ta.length !== tb.length) {
      return show(a) + ' has ' + (ta.length < tb.length ? 'fewer' : 'more') + ' digits, so it is ' + word + ' ' +
        show(b) + ': ' + show(a) + ' ' + sym + ' ' + show(b) + '.';
    }
    let i = 0;
    while (ta[i] === tb[i]) i++;
    const place = placeName(ta.length - 1 - i);
    return 'Compare from the left. The first different digits are in the ' + place + ': ' + ta[i] + ' ' +
      (Number(ta[i]) < Number(tb[i]) ? 'is less than ' : 'is more than ') + tb[i] + ', so ' + show(a) + ' ' + sym + ' ' +
      show(b) + '.';
  }

  function decimalCompareWhy(a, b) {
    const pa = K.parseDecimal(a);
    const pb = K.parseDecimal(b);
    const places = Math.max(pa.places, pb.places);
    const x = K.scaleTo(a, places);
    const y = K.scaleTo(b, places);
    const sym = x < y ? '<' : (x > y ? '>' : '=');
    if (x === y) return a + ' and ' + b + ' are the same, so ' + a + ' = ' + b + '.';
    if (x < 0 || y < 0) {
      return a + ' is ' + (x < y ? 'further below' : 'nearer to or above') + ' zero than ' + b + ', so ' + a + ' ' +
        sym + ' ' + b + '.';
    }
    const wa = decimalText(x, places);
    const wb = decimalText(y, places);
    return 'Write both with ' + places + ' decimal places: ' + wa + ' and ' + wb + '. Compare from the left: ' +
      wa + ' ' + sym + ' ' + wb + ', so ' + a + ' ' + sym + ' ' + b + '.';
  }

  // Years 1 to 7: <, > or =. Most pairs share their first digits, so the
  // child has to look further along.
  NUMBER.compare = function (year) {
    if (year === 7) {
      return fits(function () {
        let a;
        let b;
        if (randInt(0, 1)) {
          a = K.randomDecimal(1, randInt(1, 3));
          b = K.randomDecimal(1, randInt(1, 3));
          if (randInt(0, 1)) b = a.slice(0, 2) + b.slice(2);
          if (randInt(0, 2) === 0) {
            a = MINUS + a;
            if (randInt(0, 1)) b = MINUS + b;
          }
        } else {
          a = String(-randInt(1, 40));
          b = String(randInt(-40, 40));
        }
        a = a.replace('-', MINUS);
        b = b.replace('-', MINUS);
        const order = K.compareDecimals(a, b);
        const sym = order < 0 ? '<' : (order > 0 ? '>' : '=');
        return sentence('number', year, 'Compare', 'COMPARE', 'Which sign goes between ' + a + ' and ' + b + '?',
          decimalCompareWhy(a, b), [{ n: a }, { cmp: sym }, { n: b }]);
      });
    }
    const range = { 1: [1, 2], 2: [2, 2], 3: [3, 3], 4: [4, 4], 5: [5, 6], 6: [6, 7] }[year];
    return fits(function () {
      let a;
      let b;
      const roll = randInt(1, 10);
      if ((year === 5 || year === 6) && roll <= 2) {
        const limit = year === 5 ? 20 : 100;
        a = -randInt(1, limit);
        b = randInt(0, 1) ? -randInt(1, limit) : randInt(0, limit);
        if (randInt(0, 1)) {
          const t = a;
          a = b;
          b = t;
        }
      } else {
        const digits = randInt(range[0], range[1]);
        a = digitsNumber(digits);
        if (roll === 3) {
          b = a;
        } else if (roll <= 8 && digits > 1) {
          const chars = String(a).split('');
          const i = randInt(1, chars.length - 1);
          chars[i] = String(randInt(0, 9));
          b = Number(chars.join(''));
        } else {
          b = digitsNumber(randInt(range[0], range[1]));
        }
      }
      const sym = a < b ? '<' : (a > b ? '>' : '=');
      return sentence('number', year, 'Compare', 'COMPARE',
        'Which sign goes between ' + grouped(int(a)) + ' and ' + grouped(int(b)) + '?',
        compareWhy(a, b, function (v) { return grouped(int(v)); }), [{ n: int(a) }, { cmp: sym }, { n: int(b) }]);
    });
  };

  // Years 1 to 3: tens and ones (and hundreds) put together or taken apart.
  NUMBER.partition = function (year) {
    const n = year === 3 ? randInt(101, 999) : randInt(11, 99);
    const parts = String(n).split('').map(function (d, i, all) {
      return Number(d) * Math.pow(10, all.length - 1 - i);
    }).filter(Boolean);
    if (parts.length < 2) return NUMBER.partition(year);
    if (year === 1 || randInt(0, 1)) {
      const tokens = [];
      parts.forEach(function (p, i) {
        if (i) tokens.push({ s: '+' });
        tokens.push({ n: p });
      });
      tokens.push({ s: '=' }, { ask: n });
      return sentence('number', year, 'Partition', 'PLACE VALUE', 'Put the parts together.',
        parts.join(' + ') + ' = ' + n + ': each part fills its own column.', tokens);
    }
    const k = randInt(0, parts.length - 1);
    const tokens = [{ n: n }, { s: '=' }];
    parts.forEach(function (p, i) {
      if (i) tokens.push({ s: '+' });
      tokens.push(i === k ? { ask: p } : { n: p });
    });
    return sentence('number', year, 'Partition', 'PLACE VALUE', 'What number goes in the box?',
      n + ' = ' + parts.join(' + ') + '. The missing part is ' + parts[k] + '.', tokens);
  };

  // Years 2 to 7: what one digit is worth.
  NUMBER.placeValue = function (year) {
    return fits(function () {
      if (year === 7) {
        const text = K.randomDecimal(randInt(1, 2), 3);
        const point = text.indexOf('.');
        const i = randInt(0, text.length - 1);
        if (i === point || text[i] === '0') return null;
        const fromPoint = i < point ? point - 1 - i : -(i - point);
        const value = fromPoint >= 0
          ? String(Number(text[i]) * Math.pow(10, fromPoint))
          : '0.' + '0'.repeat(-fromPoint - 1) + text[i];
        return sentence('number', year, 'Place value', 'PLACE VALUE', 'In ' + text + ', what is the ' + text[i] + ' worth?',
          'The ' + text[i] + ' is in the ' + placeName(fromPoint) + ' place, so it is worth ' + value + '.',
          [{ n: text, mark: i }, { s: '→' }, { ask: value }], { check: { kind: 'digitValue', number: text, index: i } });
      }
      const digits = { 2: 2, 3: 3, 4: 4, 5: randInt(5, 6), 6: randInt(6, 7) }[year];
      const n = digitsNumber(digits);
      const text = String(n);
      const i = randInt(0, digits - 2);
      if (text[i] === '0') return null;
      const value = Number(text[i]) * Math.pow(10, digits - 1 - i);
      return sentence('number', year, 'Place value', 'PLACE VALUE',
        'In ' + grouped(n) + ', what is the ' + text[i] + ' worth?',
        'The ' + text[i] + ' is in the ' + placeName(digits - 1 - i) + ' place, so it is worth ' + grouped(value) + '.',
        [{ n: n, mark: i }, { s: '→' }, { ask: value }], { check: { kind: 'digitValue', number: text, index: i } });
    });
  };

  const COUNT_STEPS = { 1: [2, 5, 10], 2: [2, 3, 5, 10], 3: [4, 8, 50, 100], 4: [6, 7, 9, 25, 1000], 5: [10, 100, 1000] };

  // Years 1 to 5: counting in steps, forwards and backwards; through 0 in
  // Years 4 and 5.
  NUMBER.count = function (year) {
    return fits(function () {
      let step = pick(COUNT_STEPS[year]);
      let start;
      const up = randInt(0, 2) > 0;
      const length = 4;
      if (year >= 4 && randInt(0, 3) === 0) {
        // Through zero: small steps across 0.
        step = randInt(1, year === 4 ? 3 : 5);
        start = up ? -randInt(2, 3) * step - randInt(0, step - 1) : randInt(1, 2) * step + randInt(0, step - 1);
      } else if (year <= 3 || step === 25) {
        start = step * randInt(0, year === 1 ? 6 : 9);
        if (!up) start += step * (length - 1);
        if (year === 2 && step === 10) start = randInt(1, 60);
      } else {
        start = randInt(1, year === 5 ? 9000 : 900) + (up ? 0 : step * (length - 1));
      }
      const terms = [];
      for (let k = 0; k < length; k++) terms.push(start + (up ? 1 : -1) * k * step);
      if (terms.some(function (t) { return Math.abs(t) > 9999; })) return null;
      if (year < 4 && terms.some(function (t) { return t < 0; })) return null;
      const long = terms.some(function (t) { return String(Math.abs(t)).length > 3; });
      const shown = long ? terms.slice(1) : terms;
      const blank = randInt(0, 3) === 0 && shown.length === 4 ? randInt(1, 2) : shown.length - 1;
      const tokens = [];
      shown.forEach(function (t, k) {
        if (k) tokens.push({ s: ',' });
        tokens.push(k === blank ? { ask: int(t), sign: t < 0 || shown.some(function (x) { return x < 0; }) } : { n: int(t) });
      });
      return sentence('number', year, 'Counting', 'COUNT',
        'Count in ' + grouped(step) + 's' + (up ? '' : ' backwards') + '. What number is missing?',
        'Each number is ' + grouped(step) + (up ? ' more' : ' less') + ' than the one before: ' +
          shown.map(int).join(', ') + '.',
        tokens, { check: { kind: 'sequence', terms: shown, index: blank } });
    });
  };

  // Years 1 to 6: numbers written in words, typed in digits.
  NUMBER.words = function (year) {
    const ranges = { 1: [11, 20], 2: [21, 100], 3: [100, 999], 4: [1000, 9999], 5: [10000, 999999], 6: [1000000, 9999999] };
    let n = randInt(ranges[year][0], ranges[year][1]);
    // Zeros inside the number are the hard part, so they come up often.
    if (year >= 3 && randInt(0, 1)) {
      const chars = String(n).split('');
      chars[randInt(1, chars.length - 2)] = '0';
      n = Number(chars.join(''));
    }
    const words = numberWords(n);
    const zeros = String(n).split('').map(function (d, i, all) {
      return d === '0' ? placeName(all.length - 1 - i) : null;
    }).filter(Boolean);
    return sentence('number', year, 'Number words', 'WRITE', 'Write this number in digits.',
      '"' + words + '" is ' + grouped(n) + '.' + (zeros.length ? ' A 0 holds the ' + zeros.join(' and the ') +
        (zeros.length > 1 ? ' places.' : ' place.') : ''),
      [{ ask: n }], { picture: { kind: 'words', text: words }, check: { kind: 'words', text: words } });
  };

  // Years 4 to 6: rounding to a power of ten.
  NUMBER.round = function (year) {
    return fits(function () {
      let n;
      let unit;
      if (year === 4) {
        n = randInt(1000, 9999);
        unit = pick([10, 100, 1000]);
      } else if (year === 5) {
        n = digitsNumber(randInt(4, 6));
        unit = pick([10, 100, 1000, 10000, 100000].filter(function (u) { return u < n; }));
      } else {
        n = digitsNumber(randInt(5, 7));
        unit = pick([100, 1000, 10000, 100000, 1000000].filter(function (u) { return u < n; }));
      }
      if (n % unit === 0) return null;
      const rounded = roundTo(n, unit);
      const next = Math.floor(n / (unit / 10)) % 10;
      return sentence('number', year, 'Rounding', 'ROUND', 'Round ' + grouped(n) + ' to the nearest ' + grouped(unit) + '.',
        'Look at the ' + placeName(String(unit / 10).length - 1) + ' digit: ' + next + '. ' +
          (next >= 5 ? '5 or more rounds up' : 'Less than 5 rounds down') + ', so ' + grouped(n) + ' rounds to ' +
          grouped(rounded) + '.',
        [{ n: n }, { s: '≈' }, { ask: rounded }], { check: { kind: 'round', value: String(n), unit: unit } });
    });
  };

  // Year 7: rounding to decimal places and significant figures.
  NUMBER.roundDp = function (year) {
    return fits(function () {
      if (randInt(0, 1)) {
        const text = K.randomDecimal(randInt(1, 2), 4);
        const dp = randInt(1, 3);
        const d = K.parseDecimal(text);
        const unit = Math.pow(10, 4 - dp);
        const rounded = roundTo(d.scaled, unit) / unit;
        const answer = decimalText(rounded, dp);
        const next = text.split('.')[1][dp];
        return sentence('number', year, 'Rounding', 'ROUND', 'Round ' + text + ' to ' + plural(dp, 'decimal place', 'decimal places') + '.',
          'Look at the next decimal place: ' + next + '. ' + (Number(next) >= 5 ? '5 or more rounds up' : 'Less than 5 rounds down') +
            ', so ' + text + ' rounds to ' + answer + '.',
          [{ n: text }, { s: '≈' }, { ask: answer }], { check: { kind: 'round', value: text, dp: dp } });
      }
      const n = digitsNumber(randInt(4, 6));
      const sf = randInt(1, 3);
      const unit = Math.pow(10, String(n).length - sf);
      if (n % unit === 0) return null;
      const rounded = roundTo(n, unit);
      const next = String(n)[sf];
      return sentence('number', year, 'Rounding', 'ROUND',
        'Round ' + grouped(n) + ' to ' + plural(sf, 'significant figure', 'significant figures') + '.',
        'Keep the first ' + plural(sf, 'digit', 'digits') + ' and look at the next one: ' + next + '. ' +
          (Number(next) >= 5 ? '5 or more rounds up' : 'Less than 5 rounds down') + ', so ' + grouped(n) + ' rounds to ' +
          grouped(rounded) + '.',
        [{ n: n }, { s: '≈' }, { ask: rounded }], { check: { kind: 'round', value: String(n), sf: sf } });
    });
  };

  // Years 3 to 5: Roman numerals to XII (clocks), C and M (years).
  NUMBER.roman = function (year) {
    const n = year === 3 ? randInt(1, 12) : (year === 4 ? randInt(13, 100) : (randInt(0, 1) ? randInt(101, 1000) : randInt(1900, 2030)));
    const text = roman(n);
    const parts = romanParts(n);
    // Group the parts by symbol so XXX reads as 30, not 10 + 10 + 10.
    const groups = [];
    parts.forEach(function (pair) {
      const last = groups[groups.length - 1];
      if (last && last.symbol === pair[1] && pair[1].length === 1) {
        last.text += pair[1];
        last.value += pair[0];
      } else {
        groups.push({ symbol: pair[1], text: pair[1], value: pair[0] });
      }
    });
    const why = groups.length > 1
      ? text + ' is ' + groups.map(function (g) { return g.text + ' (' + g.value + ')'; }).join(' + ') + ' = ' + n + '.'
      : text + ' is ' + n + '.';
    return sentence('number', year, 'Roman numerals', 'READ', 'What number is ' + text + '?', why,
      [{ t: text }, { s: '=' }, { ask: n }], { check: { kind: 'roman', text: text } });
  };

  // Years 5 and 6: negative numbers in context.
  NUMBER.temperature = function (year) {
    return fits(function () {
      const limit = year === 5 ? 10 : 20;
      const start = randInt(-limit, limit - 2);
      const change = randInt(2, limit);
      const warmer = start < 0 ? randInt(0, 3) > 0 : randInt(0, 3) === 0;
      const end = warmer ? start + change : start - change;
      if (end === 0 || start === 0) return null;
      if ((start < 0) === (end < 0)) return null;
      return sentence('number', year, 'Temperature', 'BELOW ZERO',
        'The thermometer shows ' + int(start) + ' °C. It gets ' + change + ' degrees ' + (warmer ? 'warmer' : 'colder') +
          '. What is the temperature now?',
        'Count ' + (warmer ? 'up' : 'down') + ' ' + change + ' from ' + int(start) + ': ' + Math.abs(start) + ' to reach 0, then ' +
          Math.abs(end) + ' more. It is ' + int(end) + ' °C.',
        [{ ask: int(end), sign: true }, { t: '°C' }],
        {
          picture: { kind: 'scale', min: -limit, max: limit, step: year === 5 ? 2 : 5, value: start, unit: '°C', style: 'thermometer' },
          check: { kind: 'value', expr: '(' + start + ')' + (warmer ? '+' : '-') + change }
        });
    });
  };

  // Year 6: "calculate intervals across 0".
  NUMBER.interval = function (year) {
    const low = -randInt(2, 30);
    const high = randInt(2, 40);
    return sentence('number', year, 'Across zero', 'BELOW ZERO',
      'How many degrees is it from ' + int(low) + ' °C up to ' + high + ' °C?',
      'From ' + int(low) + ' up to 0 is ' + Math.abs(low) + ' degrees, then ' + high + ' more: ' + Math.abs(low) + ' + ' + high +
        ' = ' + (high - low) + '.',
      [{ ask: high - low }, { t: 'degrees' }], { check: { kind: 'value', expr: high + '-(' + low + ')' } });
  };

  // Year 4: "recognise and use factor pairs".
  NUMBER.factorPairs = function (year) {
    const a = randInt(2, 12);
    const b = randInt(2, 12);
    const n = a * b;
    return sentence('number', year, 'Factor pairs', 'FACTORS', 'What number makes a factor pair of ' + n + '?',
      n + ' ÷ ' + a + ' = ' + b + ', so ' + a + ' × ' + b + ' = ' + n + '.',
      [{ n: n }, { s: '=' }, { n: a }, { s: '×' }, { ask: b }]);
  };

  // Year 5: factors and primes, answered yes (1) or no (0).
  NUMBER.isFactor = function (year) {
    const a = randInt(3, 12);
    const yes = randInt(0, 1) === 1;
    let n;
    do {
      n = randInt(20, 144);
    } while ((n % a === 0) !== yes);
    const r = n % a;
    return sentence('number', year, 'Factors', 'FACTORS', 'Is ' + a + ' a factor of ' + n + '? Type 1 for yes or 0 for no.',
      yes ? n + ' ÷ ' + a + ' = ' + (n / a) + ' exactly, so ' + a + ' is a factor of ' + n + '.'
        : n + ' ÷ ' + a + ' = ' + ((n - r) / a) + ' r ' + r + ', so ' + a + ' is not a factor of ' + n + '.',
      [{ n: a }, { t: 'factor of', span: 3 }, { n: n }, { s: '?' }, { pick: yes ? 1 : 0, options: YES_NO }],
      { check: { kind: 'factor', a: a, n: n } });
  };

  NUMBER.isPrime = function (year) {
    const prime = randInt(0, 1) === 1;
    let n;
    do {
      n = randInt(year === 5 ? 11 : 20, year === 5 ? 100 : 150);
    } while (isPrime(n) !== prime || (!prime && n % 2 === 0 && randInt(0, 2) > 0));
    const f = smallestFactor(n);
    return sentence('number', year, 'Primes', 'PRIMES', 'Is ' + n + ' a prime number? Type 1 for yes or 0 for no.',
      prime ? 'No number from 2 up to ' + Math.floor(Math.sqrt(n)) + ' divides ' + n + ' exactly, so its only factors are 1 and ' + n +
        ': it is prime.' : n + ' = ' + f + ' × ' + (n / f) + ', so it has a factor other than 1 and itself: it is not prime.',
      [{ n: n }, { t: 'prime?', span: 2 }, { pick: prime ? 1 : 0, options: YES_NO }],
      { check: { kind: 'prime', n: n } });
  };

  // Years 5 to 7: squares, cubes, other powers and roots.
  NUMBER.power = function (year) {
    const roll = randInt(1, 3);
    if (year === 7 && roll === 1) {
      const cube = randInt(0, 1) === 1;
      const r = cube ? randInt(2, 6) : randInt(4, 15);
      const n = cube ? r * r * r : r * r;
      return sentence('number', year, 'Roots', 'POWERS', 'What is the ' + (cube ? 'cube' : 'square') + ' root of ' + n + '?',
        r + (cube ? ' × ' + r + ' × ' + r : ' × ' + r) + ' = ' + n + ', so the ' + (cube ? 'cube' : 'square') + ' root of ' + n +
          ' is ' + r + '.',
        [{ s: cube ? '∛' : '√' }, { n: n }, { s: '=' }, { ask: r }]);
    }
    let base;
    let power;
    if (year === 5) {
      power = randInt(0, 2) ? 2 : 3;
      base = power === 2 ? randInt(2, 12) : randInt(2, 5);
    } else if (year === 6) {
      power = randInt(0, 1) ? 2 : 3;
      base = power === 2 ? randInt(6, 15) : randInt(2, 6);
    } else {
      base = randInt(2, 5);
      power = randInt(2, base === 2 ? 7 : 4);
    }
    const value = Math.pow(base, power);
    const chain = [];
    for (let k = 0; k < power; k++) chain.push(base);
    return sentence('number', year, power === 2 ? 'Squares' : (power === 3 ? 'Cubes' : 'Powers'), 'POWERS',
      'What is ' + base + ' to the power ' + power + '?',
      base + ' to the power ' + power + ' means ' + chain.join(' × ') + ' = ' + value + '.',
      [{ n: base }, { sup: power }, { s: '=' }, { ask: value }]);
  };

  // Years 5 and 6: multiply and divide by 10, 100 and 1,000, with decimals.
  NUMBER.times10 = function (year) {
    return fits(function () {
      const power = randInt(1, 3);
      const factor = Math.pow(10, power);
      const multiply = randInt(0, 1) === 1;
      const places = randInt(0, year === 5 ? 2 : 3);
      const text = places ? K.randomDecimal(randInt(1, 2), places) : String(randInt(2, 999));
      const d = K.parseDecimal(text);
      // value = scaled / 10^places; the answer moves the point `power` places.
      const answerPlaces = multiply ? Math.max(0, d.places - power) : d.places + power;
      const answerScaled = multiply ? d.scaled * Math.pow(10, Math.max(0, power - d.places)) : d.scaled;
      if (answerPlaces > 3) return null;
      const answer = decimalText(answerScaled, answerPlaces, true);
      return sentence('number', year, 'Times and divide by 10', 'PLACE VALUE',
        'What is ' + text + (multiply ? ' × ' : ' ÷ ') + grouped(factor) + '?',
        (multiply ? 'Multiplying' : 'Dividing') + ' by ' + grouped(factor) + ' moves every digit ' + plural(power, 'place', 'places') +
          (multiply ? ' to the left' : ' to the right') + ': ' + text + ' becomes ' + answer + '.',
        [{ n: text }, { s: multiply ? '×' : '÷' }, { n: factor }, { s: '=' }, { ask: answer }]);
    });
  };

  // Years 6 and 7: the order of operations, then brackets and powers.
  NUMBER.order = function (year) {
    return fits(function () {
      const a = randInt(2, 12);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const template = randInt(1, year === 7 ? 6 : 4);
      let tokens;
      let value;
      let why;
      if (template === 1) {
        value = a + b * c;
        tokens = [{ n: a }, { s: '+' }, { n: b }, { s: '×' }, { n: c }];
        why = 'Multiply before adding: ' + b + ' × ' + c + ' = ' + (b * c) + ', then ' + a + ' + ' + (b * c) + ' = ' + value + '.';
      } else if (template === 2) {
        const big = b * c + randInt(0, 20);
        value = big - b * c;
        tokens = [{ n: big }, { s: MINUS }, { n: b }, { s: '×' }, { n: c }];
        why = 'Multiply before subtracting: ' + b + ' × ' + c + ' = ' + (b * c) + ', then ' + big + ' ' + MINUS + ' ' + (b * c) + ' = ' + value + '.';
      } else if (template === 3) {
        value = (a + b) * c;
        tokens = [{ s: '(' }, { n: a }, { s: '+' }, { n: b }, { s: ')' }, { s: '×' }, { n: c }];
        why = 'Brackets first: ' + a + ' + ' + b + ' = ' + (a + b) + ', then ' + (a + b) + ' × ' + c + ' = ' + value + '.';
      } else if (template === 4) {
        const dividend = b * c;
        value = a + dividend / c;
        tokens = [{ n: a }, { s: '+' }, { n: dividend }, { s: '÷' }, { n: c }];
        why = 'Divide before adding: ' + dividend + ' ÷ ' + c + ' = ' + b + ', then ' + a + ' + ' + b + ' = ' + value + '.';
      } else if (template === 5) {
        value = a * b * b + c;
        tokens = [{ n: a }, { s: '×' }, { n: b }, { sup: 2 }, { s: '+' }, { n: c }];
        why = 'Powers first: ' + b + '² = ' + (b * b) + '. Then multiply: ' + a + ' × ' + (b * b) + ' = ' + (a * b * b) +
          '. Then add: ' + (a * b * b) + ' + ' + c + ' = ' + value + '.';
      } else {
        const sum = b + c;
        value = sum * sum - a;
        tokens = [{ s: '(' }, { n: b }, { s: '+' }, { n: c }, { s: ')' }, { sup: 2 }, { s: MINUS }, { n: a }];
        why = 'Brackets first: ' + b + ' + ' + c + ' = ' + sum + '. Then the power: ' + sum + '² = ' + (sum * sum) + '. Then ' +
          (sum * sum) + ' ' + MINUS + ' ' + a + ' = ' + value + '.';
      }
      if (value < 0) return null;
      return sentence('number', year, 'Order of operations', 'ORDER', 'Work it out in the right order.', why,
        tokens.concat([{ s: '=' }, { ask: value }]));
    });
  };

  // Years 6 and 7: highest common factor and lowest common multiple.
  NUMBER.hcf = function (year) {
    return fits(function () {
      const highest = randInt(0, 1) === 1;
      let a;
      let b;
      if (highest) {
        const g = randInt(2, 12);
        a = g * randInt(2, 9);
        b = g * randInt(2, 9);
      } else {
        a = randInt(3, 15);
        b = randInt(3, 15);
      }
      if (a === b) return null;
      const value = highest ? gcd(a, b) : lcm(a, b);
      if (!highest && value > 120) return null;
      return sentence('number', year, highest ? 'Highest common factor' : 'Lowest common multiple', 'FACTORS',
        highest ? 'What is the highest common factor (HCF) of ' + a + ' and ' + b + '? It is the biggest number that divides both.'
          : 'What is the lowest common multiple (LCM) of ' + a + ' and ' + b + '? It is the smallest number both divide into.',
        highest ? value + ' divides ' + a + ' (' + a + ' ÷ ' + value + ' = ' + (a / value) + ') and ' + b + ' (' + b + ' ÷ ' + value +
          ' = ' + (b / value) + '), and ' + (a / value) + ' and ' + (b / value) + ' have no common factor bigger than 1.'
          : 'Count in ' + Math.max(a, b) + 's until you reach a multiple of ' + Math.min(a, b) + ': ' + value + '.',
        [{ t: highest ? 'HCF' : 'LCM' }, { s: '(' }, { n: a }, { s: ',' }, { n: b }, { s: ')' }, { s: '=' }, { ask: value }],
        { check: { kind: highest ? 'hcf' : 'lcm', a: a, b: b } });
    });
  };

  // Year 7: "prime factorisation, including using product notation".
  NUMBER.primeFactors = function (year) {
    return fits(function () {
      const n = randInt(12, 200);
      const factors = primeFactors(n);
      if (factors.length < 2 || factors.length > 5 || factors[factors.length - 1] > 13) return null;
      const tokens = [{ n: n }, { s: '=' }];
      factors.forEach(function (p, i) {
        if (i) tokens.push({ s: '×' });
        tokens.push({ ask: p });
      });
      const steps = [];
      let rest = n;
      factors.forEach(function (p) {
        steps.push(rest + ' ÷ ' + p + ' = ' + (rest / p));
        rest /= p;
      });
      return sentence('number', year, 'Prime factors', 'PRIMES', 'Write ' + n + ' as a product of primes, smallest first.',
        'Divide by the smallest prime each time: ' + steps.join(', ') + '. So ' + n + ' = ' + factors.join(' × ') + '.',
        tokens, { check: { kind: 'primeFactors', n: n } });
    });
  };

  // Year 7: standard form, A x 10^n with 1 <= A < 10.
  NUMBER.standardForm = function (year) {
    return fits(function () {
      const mantissa = K.randomDecimal(1, randInt(1, 2));
      const negative = randInt(0, 3) === 0;
      const power = negative ? -randInt(1, 4) : randInt(2, 5);
      const m = K.parseDecimal(mantissa);
      const placesAfter = m.places - power;
      const ordinary = placesAfter > 0
        ? decimalText(m.scaled, placesAfter)
        : String(m.scaled * Math.pow(10, -placesAfter));
      if (randInt(0, 1)) {
        return sentence('number', year, 'Standard form', 'STANDARD FORM', 'Write ' + grouped(ordinary) + ' in standard form.',
          'Move the point so one digit is in front of it: ' + mantissa + '. It moved ' + plural(Math.abs(power), 'place', 'places') +
            (power > 0 ? ' to the left, so the power is ' + power : ' to the right, so the power is ' + int(power)) + '.',
          [{ n: ordinary }, { s: '=' }, { n: mantissa }, { s: '×' }, { n: 10 }, { sup: { ask: int(power), sign: power < 0 || randInt(0, 1) === 1 } }]);
      }
      return sentence('number', year, 'Standard form', 'STANDARD FORM', 'Write ' + mantissa + ' × 10 to the power ' + int(power) + ' as an ordinary number.',
        'The power ' + int(power) + ' moves the point ' + plural(Math.abs(power), 'place', 'places') + (power > 0 ? ' to the right' : ' to the left') +
          ': ' + grouped(ordinary) + '.',
        [{ n: mantissa }, { s: '×' }, { n: 10 }, { sup: int(power) }, { s: '=' }, { ask: ordinary }]);
    });
  };

  const NUMBER_KINDS = {
    1: [[3, 'moreLess'], [2, 'compare'], [1, 'partition'], [3, 'count'], [2, 'words']],
    2: [[2, 'moreLess'], [2, 'compare'], [2, 'partition'], [2, 'placeValue'], [2, 'count'], [1, 'words']],
    3: [[2, 'moreLess'], [1, 'compare'], [1, 'partition'], [2, 'placeValue'], [2, 'count'], [1, 'words'], [2, 'roman']],
    4: [[1, 'moreLess'], [1, 'compare'], [1, 'placeValue'], [2, 'count'], [2, 'round'], [2, 'roman'], [2, 'factorPairs'], [1, 'words']],
    5: [[1, 'placeValue'], [1, 'compare'], [2, 'round'], [1, 'roman'], [1, 'temperature'], [1, 'isFactor'], [1, 'isPrime'],
      [2, 'power'], [2, 'times10'], [1, 'count'], [1, 'words']],
    6: [[1, 'placeValue'], [1, 'round'], [1, 'interval'], [1, 'isPrime'], [2, 'hcf'], [3, 'order'], [1, 'times10'], [1, 'power'],
      [1, 'compare'], [1, 'words']],
    7: [[3, 'order'], [2, 'primeFactors'], [1, 'hcf'], [2, 'power'], [2, 'standardForm'], [2, 'roundDp'], [1, 'compare'], [1, 'placeValue']]
  };

  NUMBER.drawLine = DRAW.numberLine;
  [1, 2, 3, 4, 5, 6, 7].forEach(function (year) { NUMBER_KINDS[year].push([2, 'drawLine']); });

  Engine.addArea('number', chooser(NUMBER, NUMBER_KINDS, 'number'));

  /* Fractions: fractions, decimals and percentages, then ratio and
     proportion from Year 6. Answers are in their simplest form when the
     question says so; otherwise the bottom number is given, so only one
     answer fits the boxes. */

  function simplest(n, d) {
    const g = gcd(n, d);
    return [n / g, d / g];
  }

  function fracText(n, d) {
    return (n < 0 ? MINUS : '') + Math.abs(n) + '/' + d;
  }

  // A proper fraction already in its simplest form.
  function proper(dMin, dMax) {
    for (;;) {
      const d = randInt(dMin, dMax);
      const n = randInt(1, d - 1);
      if (gcd(n, d) === 1) return [n, d];
    }
  }

  function mixedText(n, d) {
    if (n % d === 0) return String(n / d);
    if (n < d) return n + '/' + d;
    return Math.floor(n / d) + ' ' + (n % d) + '/' + d;
  }

  // Tokens for n/d: a whole number when it divides exactly, otherwise a
  // mixed number or a fraction; `ask` makes every part a box.
  function fractionTokens(n, d, ask, mixed) {
    const box = function (v) { return ask ? { ask: v } : v; };
    if (n % d === 0) return [ask ? { ask: n / d } : { n: n / d }];
    if (mixed && n > d) {
      return [ask ? { ask: Math.floor(n / d) } : { n: Math.floor(n / d) }, { frac: [box(n % d), box(d)] }];
    }
    return [{ frac: [box(n), box(d)] }];
  }

  const FRACTIONS = {};

  // Year 1: half and quarter of a quantity, with dots in equal rows.
  FRACTIONS.halfQuarter = function (year) {
    const parts = randInt(0, 2) ? 2 : 4;
    const size = randInt(2, parts === 2 ? 10 : 5);
    const whole = parts * size;
    const name = parts === 2 ? 'half' : 'quarter';
    return sentence('fractions', year, 'Half and quarter', 'SHARE', 'What is a ' + name + ' of ' + whole + '?',
      'Share ' + whole + ' into ' + parts + ' equal rows: each row has ' + size + '. A ' + name + ' of ' + whole + ' is ' + size + '.',
      [{ t: name + ' of', span: parts === 2 ? 2 : 3 }, { n: whole }, { s: '=' }, { ask: size }],
      { picture: { rows: parts, cols: size }, check: { kind: 'value', expr: whole + '/' + parts } });
  };

  // Year 1: which part of a shape is shaded.
  FRACTIONS.shadedName = function (year) {
    const parts = randInt(0, 1) ? 2 : 4;
    const shape = pick(['circle', 'rect', 'bar']);
    return sentence('fractions', year, 'Name the part', 'FRACTION', 'The shape is cut into equal parts. What part is shaded?',
      'There are ' + parts + ' equal parts and 1 is shaded, so ' + (parts === 2 ? 'a half' : 'a quarter') + ' is shaded.',
      [{ t: 'shaded:', span: 2 }, { pick: parts === 2 ? 1 : 2, options: [[1, 'a half'], [2, 'a quarter']] }],
      { picture: { kind: 'fraction', shape: shape, parts: parts, shaded: 1 }, check: { kind: 'fractionPicture', name: true } });
  };

  // Years 2 to 4: a fraction of an amount.
  FRACTIONS.fractionOf = function (year) {
    let d;
    let k;
    if (year === 2) {
      const choice = pick([[1, 2], [1, 3], [1, 4], [2, 4], [3, 4]]);
      k = choice[0];
      d = choice[1];
    } else {
      d = randInt(2, year === 3 ? 6 : 10);
      k = randInt(1, d - 1);
    }
    const unit = randInt(2, year === 2 ? 6 : (year === 3 ? 9 : 12));
    const whole = unit * d;
    const value = unit * k;
    return sentence('fractions', year, 'Fraction of an amount', 'FRACTION', 'What is ' + k + '/' + d + ' of ' + whole + '?',
      'Find 1/' + d + ' first: ' + whole + ' ÷ ' + d + ' = ' + unit + '.' + (k > 1 ? ' Then ' + k + ' lots: ' + unit + ' × ' + k + ' = ' + value + '.' : ''),
      [{ frac: [k, d] }, { t: 'of' }, { n: whole }, { s: '=' }, { ask: value }]);
  };

  // Years 2 and 3: name the shaded fraction of a shape.
  FRACTIONS.nameShaded = function (year) {
    const d = year === 2 ? randInt(2, 4) : randInt(3, 8);
    const k = randInt(1, d - 1);
    return sentence('fractions', year, 'Shaded fraction', 'FRACTION', 'What fraction of the shape is shaded?',
      'There are ' + d + ' equal parts and ' + k + (k === 1 ? ' is' : ' are') + ' shaded: ' + k + '/' + d + '.',
      [{ frac: [{ ask: k }, { ask: d }] }, { t: 'shaded', span: 2 }],
      { picture: { kind: 'fraction', shape: pick(['circle', 'bar', 'rect']), parts: d, shaded: k }, check: { kind: 'fractionPicture' } });
  };

  // Years 2 to 5: equivalent fractions.
  FRACTIONS.equivalent = function (year) {
    let n;
    let d;
    let m;
    if (year === 2) {
      n = 1;
      d = 2;
      m = 2;
    } else if (year === 3) {
      d = randInt(2, 5);
      n = randInt(1, d - 1);
      m = randInt(2, 3);
    } else if (year === 4) {
      d = randInt(2, 6);
      n = randInt(1, d - 1);
      m = randInt(2, 6);
    } else {
      d = 10;
      n = randInt(1, 9);
      m = 10;
    }
    const big = [n * m, d * m];
    const small = [n, d];
    const flip = randInt(0, 1) === 1;
    const left = flip ? big : small;
    const right = flip ? small : big;
    const hide = randInt(0, 1);
    const rightTokens = { frac: [hide === 0 ? { ask: right[0] } : right[0], hide === 1 ? { ask: right[1] } : right[1]] };
    return sentence('fractions', year, 'Equivalent fractions', 'EQUIVALENT', 'What number goes in the box?',
      'Multiply or divide the top and bottom by the same number. ' + n + '/' + d + ' = ' + big[0] + '/' + big[1] +
        ' (both × ' + m + ').',
      [{ frac: left }, { s: '=' }, rightTokens]);
  };

  // Year 3: tenths from dividing by 10, and ten tenths make one.
  FRACTIONS.tenths = function (year) {
    if (randInt(0, 2) === 0) {
      const ones = randInt(1, 4);
      return sentence('fractions', year, 'Tenths', 'TENTHS', 'How many tenths make ' + ones + '?',
        'Ten tenths make one, so ' + ones + ' = ' + (ones * 10) + '/10.',
        [{ n: ones }, { s: '=' }, { frac: [{ ask: ones * 10 }, 10] }]);
    }
    const n = randInt(1, 9);
    return sentence('fractions', year, 'Tenths', 'TENTHS', 'What is ' + n + ' ÷ 10 as a fraction?',
      'Share ' + n + ' into 10 equal parts: each part is ' + n + ' tenths, ' + n + '/10.',
      [{ n: n }, { s: '÷' }, { n: 10 }, { s: '=' }, { frac: [{ ask: n }, { ask: 10 }] }]);
  };

  // Years 3 to 5: adding and subtracting fractions with the same bottom
  // number (Year 5: bottoms where one is a multiple of the other).
  FRACTIONS.addSame = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const add = randInt(0, 1) === 1;
      if (year === 5) {
        const d1 = randInt(2, 6);
        const m = randInt(2, 3);
        const d2 = d1 * m;
        const a = randInt(1, d1 - 1);
        const b = randInt(1, d2 - 1);
        const top = add ? a * m + b : a * m - b;
        if (top <= 0) continue;
        return sentence('fractions', year, 'Adding fractions', add ? 'ADD' : 'SUBTRACT',
          'Work it out. Give the answer in ' + d2 + 'ths.'.replace('2ths', '2nds').replace('3ths', '3rds'),
          'Change ' + a + '/' + d1 + ' into ' + d2 + 'ths: ' + (a * m) + '/' + d2 + '. Then ' + (a * m) + (add ? ' + ' : ' ' + MINUS + ' ') + b +
            ' = ' + top + ', so the answer is ' + top + '/' + d2 + '.',
          [{ frac: [a, d1] }, { s: add ? '+' : MINUS }, { frac: [b, d2] }, { s: '=' }, { frac: [{ ask: top }, d2] }]);
      }
      const d = randInt(year === 3 ? 4 : 5, year === 3 ? 10 : 12);
      const a = randInt(1, d - 1);
      const b = randInt(1, d - 1);
      const top = add ? a + b : a - b;
      if (top <= 0) continue;
      if (year === 3 && top > d) continue;
      return sentence('fractions', year, 'Adding fractions', add ? 'ADD' : 'SUBTRACT', 'Work it out.',
        'The bottom number stays ' + d + ': only the parts are ' + (add ? 'added' : 'taken away') + '. ' + a + (add ? ' + ' : ' ' + MINUS + ' ') +
          b + ' = ' + top + ', so the answer is ' + top + '/' + d + '.',
        [{ frac: [a, d] }, { s: add ? '+' : MINUS }, { frac: [b, d] }, { s: '=' }, { frac: [{ ask: top }, d] }]);
    }
    return null;
  };

  // Years 3 to 6: <, > or = between fractions.
  FRACTIONS.compare = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      let a;
      let b;
      if (year === 3) {
        if (randInt(0, 1)) {
          a = [1, randInt(2, 10)];
          b = [1, randInt(2, 10)];
        } else {
          const d = randInt(3, 10);
          a = [randInt(1, d - 1), d];
          b = [randInt(1, d - 1), d];
        }
      } else if (year === 5) {
        const d = randInt(2, 6);
        const m = randInt(2, 3);
        a = [randInt(1, d - 1), d];
        b = [randInt(1, d * m - 1), d * m];
      } else {
        a = [randInt(1, 9), randInt(2, 9)];
        b = [randInt(1, 9), randInt(2, 9)];
        if (gcd(a[0], a[1]) !== 1 || gcd(b[0], b[1]) !== 1) continue;
      }
      if (randInt(0, 1)) {
        const t = a;
        a = b;
        b = t;
      }
      const x = a[0] * b[1];
      const y = b[0] * a[1];
      const sym = x < y ? '<' : (x > y ? '>' : '=');
      if (sym === '=' && randInt(0, 2) > 0) continue;
      const common = a[1] * b[1] / gcd(a[1], b[1]);
      const why = a[0] === b[0] && a[0] === 1 && a[1] !== b[1]
        ? 'The more parts a whole is cut into, the smaller each part: 1/' + a[1] + ' ' + sym + ' 1/' + b[1] + '.'
        : (a[1] === b[1]
          ? 'Same bottom numbers, so compare the tops: ' + a[0] + ' ' + sym + ' ' + b[0] + '.'
          : 'Write both in ' + common + 'ths: ' + (a[0] * common / a[1]) + '/' + common + ' and ' + (b[0] * common / b[1]) + '/' + common +
            '. So ' + a[0] + '/' + a[1] + ' ' + sym + ' ' + b[0] + '/' + b[1] + '.');
      return sentence('fractions', year, 'Compare fractions', 'COMPARE',
        'Which sign goes between ' + a[0] + '/' + a[1] + ' and ' + b[0] + '/' + b[1] + '?', why,
        [{ frac: a }, { cmp: sym }, { frac: b }]);
    }
    return null;
  };

  // Year 4: decimal equivalents of tenths, hundredths, quarters and halves.
  FRACTIONS.decimalEquivalent = function (year) {
    const roll = randInt(1, 4);
    if (roll === 1) {
      const n = randInt(1, 99);
      return sentence('fractions', year, 'Decimals', 'DECIMALS', 'Write ' + n + '/100 as a decimal.',
        n + ' hundredths is ' + decimalText(n, 2) + ': the last digit is in the hundredths place.',
        [{ frac: [n, 100] }, { s: '=' }, { ask: decimalText(n, 2) }]);
    }
    if (roll === 2) {
      const n = randInt(1, 9);
      return sentence('fractions', year, 'Decimals', 'DECIMALS', 'Write 0.' + n + ' as a fraction.',
        '0.' + n + ' is ' + n + ' tenths: ' + n + '/10.',
        [{ n: '0.' + n }, { s: '=' }, { frac: [{ ask: n }, 10] }]);
    }
    const pair = pick([[1, 2, '0.5'], [1, 4, '0.25'], [3, 4, '0.75']]);
    return sentence('fractions', year, 'Decimals', 'DECIMALS', 'Write ' + pair[0] + '/' + pair[1] + ' as a decimal.',
      pair[0] + '/' + pair[1] + ' = ' + (pair[0] * 100 / pair[1]) + '/100 = ' + pair[2] + '.',
      [{ frac: [pair[0], pair[1]] }, { s: '=' }, { ask: pair[2] }]);
  };

  // Year 4: "find the effect of dividing a one- or two-digit number by 10 and
  // 100".
  FRACTIONS.divide10 = function (year) {
    const n = randInt(1, 99);
    const by = randInt(0, 1) ? 10 : 100;
    const places = by === 10 ? 1 : 2;
    const answer = decimalText(n, places, true);
    return sentence('fractions', year, 'Dividing by 10 and 100', 'DECIMALS', 'What is ' + n + ' ÷ ' + by + '?',
      'Dividing by ' + by + ' moves each digit ' + plural(places, 'place', 'places') + ' to the right: ' + n + ' becomes ' + answer + '.',
      [{ n: n }, { s: '÷' }, { n: by }, { s: '=' }, { ask: answer }]);
  };

  // Years 4 and 5: rounding decimals.
  FRACTIONS.roundDecimal = function (year) {
    const places = year === 4 ? 1 : 2;
    const text = K.randomDecimal(randInt(1, 2), places);
    const toWhole = year === 4 || randInt(0, 1) === 1;
    const d = K.parseDecimal(text);
    const unit = toWhole ? Math.pow(10, places) : 10;
    const rounded = roundTo(d.scaled, unit) / unit;
    const answer = toWhole ? String(rounded) : decimalText(rounded, 1);
    const next = toWhole ? text.split('.')[1][0] : text.split('.')[1][1];
    return sentence('fractions', year, 'Rounding decimals', 'ROUND',
      'Round ' + text + ' to the nearest ' + (toWhole ? 'whole number' : 'tenth (1 decimal place)') + '.',
      'Look at the ' + (toWhole ? 'tenths' : 'hundredths') + ' digit: ' + next + '. ' + (Number(next) >= 5 ? '5 or more rounds up' : 'Less than 5 rounds down') +
        ', so ' + text + ' rounds to ' + answer + '.',
      [{ n: text }, { s: '≈' }, { ask: answer }],
      { check: toWhole ? { kind: 'round', value: text, unit: 1 } : { kind: 'round', value: text, dp: 1 } });
  };

  // Years 4 and 5: compare decimals.
  FRACTIONS.compareDecimal = function (year) {
    const places = year === 4 ? 2 : 3;
    let a = K.randomDecimal(1, randInt(1, places));
    let b = K.randomDecimal(1, randInt(1, places));
    if (year === 4) {
      a = '0.' + String(randInt(1, 99)).padStart(2, '0');
      b = '0.' + String(randInt(1, 99)).padStart(2, '0');
    } else if (randInt(0, 1)) {
      b = a.slice(0, 3) + b.slice(3);
    }
    const order = K.compareDecimals(a, b);
    const sym = order < 0 ? '<' : (order > 0 ? '>' : '=');
    return sentence('fractions', year, 'Compare decimals', 'COMPARE', 'Which sign goes between ' + a + ' and ' + b + '?',
      decimalCompareWhy(a, b), [{ n: a }, { cmp: sym }, { n: b }]);
  };

  // Year 5: improper fractions and mixed numbers.
  FRACTIONS.mixed = function (year) {
    const d = randInt(2, 9);
    const whole = randInt(1, 4);
    const rest = randInt(1, d - 1);
    const top = whole * d + rest;
    if (randInt(0, 1)) {
      return sentence('fractions', year, 'Mixed numbers', 'MIXED', 'Write ' + top + '/' + d + ' as a mixed number.',
        top + ' ÷ ' + d + ' = ' + whole + ' r ' + rest + ', so ' + top + '/' + d + ' = ' + whole + ' ' + rest + '/' + d + '.',
        [{ frac: [top, d] }, { s: '=' }, { ask: whole }, { frac: [{ ask: rest }, d] }]);
    }
    return sentence('fractions', year, 'Mixed numbers', 'MIXED', 'Write ' + whole + ' ' + rest + '/' + d + ' as an improper fraction.',
      whole + ' whole ' + (whole === 1 ? 'one is ' : 'ones are ') + (whole * d) + '/' + d + ', and ' + (whole * d) + ' + ' + rest + ' = ' + top +
        ', so ' + whole + ' ' + rest + '/' + d + ' = ' + top + '/' + d + '.',
      [{ n: whole }, { frac: [rest, d] }, { s: '=' }, { frac: [{ ask: top }, d] }]);
  };

  // Year 5: "multiply proper fractions ... by whole numbers".
  FRACTIONS.multiplyWhole = function (year) {
    const d = randInt(3, 9);
    const n = randInt(1, d - 1);
    const w = randInt(2, 6);
    return sentence('fractions', year, 'Fraction times a number', 'MULTIPLY', 'Work out ' + n + '/' + d + ' × ' + w + '.',
      w + ' lots of ' + n + '/' + d + ': ' + n + ' × ' + w + ' = ' + (n * w) + ', so ' + (n * w) + '/' + d + '.',
      [{ frac: [n, d] }, { s: '×' }, { n: w }, { s: '=' }, { frac: [{ ask: n * w }, d] }]);
  };

  // Year 5: decimals as fractions, and thousandths.
  FRACTIONS.decimalFraction = function (year) {
    const places = randInt(2, 3);
    const n = randInt(1, Math.pow(10, places) - 1);
    if (n % 10 === 0) return FRACTIONS.decimalFraction(year);
    const text = decimalText(n, places);
    const bottom = Math.pow(10, places);
    if (randInt(0, 1)) {
      return sentence('fractions', year, 'Decimals and fractions', 'DECIMALS', 'Write ' + text + ' as a fraction.',
        'The last digit of ' + text + ' is in the ' + placeName(-places) + ' place, so ' + text + ' = ' + n + '/' + grouped(bottom) + '.',
        [{ n: text }, { s: '=' }, { frac: [{ ask: n }, bottom] }]);
    }
    return sentence('fractions', year, 'Decimals and fractions', 'DECIMALS', 'Write ' + n + '/' + grouped(bottom) + ' as a decimal.',
      n + ' ' + placeName(-places) + ' is ' + text + '.',
      [{ frac: [n, bottom] }, { s: '=' }, { ask: text }]);
  };

  // Years 5 and 6: percentages, fractions and decimals.
  FRACTIONS.percent = function (year) {
    const roll = randInt(1, year === 5 ? 4 : 5);
    if (roll === 1) {
      const p = randInt(1, 99);
      return sentence('fractions', year, 'Percentages', 'PERCENT', 'Write ' + p + '% as a fraction out of 100.',
        'Per cent means "out of 100", so ' + p + '% = ' + p + '/100.',
        [{ n: p }, { t: '%' }, { s: '=' }, { frac: [{ ask: p }, 100] }]);
    }
    if (roll === 2) {
      const p = randInt(1, 99);
      return sentence('fractions', year, 'Percentages', 'PERCENT', 'Write ' + decimalText(p, 2, true) + ' as a percentage.',
        decimalText(p, 2, true) + ' = ' + p + '/100 = ' + p + '%.',
        [{ n: decimalText(p, 2, true) }, { s: '=' }, { ask: p }, { t: '%' }]);
    }
    if (roll === 3) {
      const pair = pick([[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10], [1, 20], [3, 25], [9, 50]]);
      const p = pair[0] * 100 / pair[1];
      return sentence('fractions', year, 'Percentages', 'PERCENT', 'Write ' + pair[0] + '/' + pair[1] + ' as a percentage.',
        pair[0] + '/' + pair[1] + ' = ' + p + '/100 (top and bottom × ' + (100 / pair[1]) + '), so ' + p + '%.',
        [{ frac: pair }, { s: '=' }, { ask: p }, { t: '%' }]);
    }
    if (roll === 4) {
      const p = pick([10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90]);
      const s = simplest(p, 100);
      return sentence('fractions', year, 'Percentages', 'PERCENT', 'Write ' + p + '% as a fraction in its simplest form.',
        p + '% = ' + p + '/100. Divide top and bottom by ' + gcd(p, 100) + ': ' + s[0] + '/' + s[1] + '.',
        [{ n: p }, { t: '%' }, { s: '=' }, { frac: [{ ask: s[0] }, { ask: s[1] }] }], { check: { kind: 'statement', simplest: true } });
    }
    const p = randInt(1, 19) * 5;
    return sentence('fractions', year, 'Percentages', 'PERCENT', 'Write ' + decimalText(p, 2, true) + ' as a percentage.',
      decimalText(p, 2, true) + ' is ' + p + ' hundredths, so ' + p + '%.',
      [{ n: decimalText(p, 2, true) }, { s: '=' }, { ask: p }, { t: '%' }]);
  };

  // Year 6: simplifying, and adding fractions with different bottoms.
  FRACTIONS.simplify = function (year) {
    const d = randInt(2, 9);
    const n = randInt(1, d - 1);
    const s = simplest(n, d);
    const m = randInt(2, 6);
    return sentence('fractions', year, 'Simplify', 'SIMPLIFY', 'Write ' + (n * m) + '/' + (d * m) + ' in its simplest form.',
      'Divide the top and bottom by ' + gcd(n * m, d * m) + ', the highest common factor: ' + s[0] + '/' + s[1] + '.',
      [{ frac: [n * m, d * m] }, { s: '=' }, { frac: [{ ask: s[0] }, { ask: s[1] }] }], { check: { kind: 'statement', simplest: true } });
  };

  FRACTIONS.addDifferent = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const d1 = randInt(2, 8);
      const d2 = randInt(2, 8);
      if (d1 === d2) continue;
      const n1 = randInt(1, d1 - 1);
      const n2 = randInt(1, d2 - 1);
      if (gcd(n1, d1) !== 1 || gcd(n2, d2) !== 1) continue;
      const add = randInt(0, 1) === 1;
      const common = d1 * d2 / gcd(d1, d2);
      const top = add ? n1 * common / d1 + n2 * common / d2 : n1 * common / d1 - n2 * common / d2;
      if (top <= 0) continue;
      const s = simplest(top, common);
      const mixed = s[0] > s[1];
      return sentence('fractions', year, 'Adding fractions', add ? 'ADD' : 'SUBTRACT',
        'Work it out. Give the answer in its simplest form' + (mixed ? ', as a mixed number.' : '.'),
        'Use ' + common + 'ths: ' + (n1 * common / d1) + '/' + common + (add ? ' + ' : ' ' + MINUS + ' ') + (n2 * common / d2) + '/' + common +
          ' = ' + top + '/' + common + (s[0] !== top ? ' = ' + s[0] + '/' + s[1] : '') + (mixed ? ' = ' + mixedText(s[0], s[1]) : '') + '.',
        [{ frac: [n1, d1] }, { s: add ? '+' : MINUS }, { frac: [n2, d2] }, { s: '=' }].concat(fractionTokens(s[0], s[1], true, true)),
        { check: { kind: 'statement', simplest: true } });
    }
    return null;
  };

  // Year 6: mixed numbers added or subtracted.
  FRACTIONS.mixedAdd = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const d1 = randInt(2, 6);
      const d2 = randInt(2, 6);
      const w1 = randInt(1, 4);
      const w2 = randInt(1, 3);
      const n1 = randInt(1, d1 - 1);
      const n2 = randInt(1, d2 - 1);
      if (gcd(n1, d1) !== 1 || gcd(n2, d2) !== 1) continue;
      const add = randInt(0, 1) === 1;
      const common = d1 * d2 / gcd(d1, d2);
      const a = (w1 * d1 + n1) * common / d1;
      const b = (w2 * d2 + n2) * common / d2;
      const top = add ? a + b : a - b;
      if (top <= 0) continue;
      const s = simplest(top, common);
      return sentence('fractions', year, 'Mixed numbers', add ? 'ADD' : 'SUBTRACT',
        'Work it out. Give the answer in its simplest form' + (s[0] > s[1] ? ', as a mixed number.' : '.'),
        'Change to ' + common + 'ths: ' + a + '/' + common + (add ? ' + ' : ' ' + MINUS + ' ') + b + '/' + common + ' = ' + top + '/' + common +
          ' = ' + mixedText(s[0], s[1]) + '.',
        [{ n: w1 }, { frac: [n1, d1] }, { s: add ? '+' : MINUS }, { n: w2 }, { frac: [n2, d2] }, { s: '=' }].concat(fractionTokens(s[0], s[1], true, true)),
        { check: { kind: 'statement', simplest: true } });
    }
    return null;
  };

  // Year 6: multiplying fractions, and dividing a fraction by a whole number.
  FRACTIONS.multiply = function (year) {
    const f1 = proper(2, 6);
    const f2 = proper(2, 6);
    const n1 = f1[0];
    const d1 = f1[1];
    const n2 = f2[0];
    const d2 = f2[1];
    if (randInt(0, 1)) {
      const s = simplest(n1 * n2, d1 * d2);
      return sentence('fractions', year, 'Multiplying fractions', 'MULTIPLY',
        'Work out ' + n1 + '/' + d1 + ' × ' + n2 + '/' + d2 + '. Give the answer in its simplest form.',
        'Multiply the tops and the bottoms: ' + (n1 * n2) + '/' + (d1 * d2) + (s[0] !== n1 * n2 ? ' = ' + s[0] + '/' + s[1] : '') + '.',
        [{ frac: [n1, d1] }, { s: '×' }, { frac: [n2, d2] }, { s: '=' }, { frac: [{ ask: s[0] }, { ask: s[1] }] }],
        { check: { kind: 'statement', simplest: true } });
    }
    const w = randInt(2, 5);
    const s = simplest(n1, d1 * w);
    return sentence('fractions', year, 'Dividing fractions', 'DIVIDE',
      'Work out ' + n1 + '/' + d1 + ' ÷ ' + w + '. Give the answer in its simplest form.',
      'Dividing by ' + w + ' makes each part ' + w + ' times smaller: ' + n1 + '/' + (d1 * w) + (s[0] !== n1 ? ' = ' + s[0] + '/' + s[1] : '') + '.',
      [{ frac: [n1, d1] }, { s: '÷' }, { n: w }, { s: '=' }, { frac: [{ ask: s[0] }, { ask: s[1] }] }],
      { check: { kind: 'statement', simplest: true } });
  };

  // Year 6: "calculate decimal fraction equivalents (for example 0.375) for a
  // simple fraction (for example 3/8)".
  FRACTIONS.fractionDecimal = function (year) {
    const pair = pick([[1, 8], [3, 8], [5, 8], [7, 8], [1, 5], [2, 5], [3, 5], [4, 5], [1, 4], [3, 4], [1, 20], [3, 20], [7, 20], [1, 25], [4, 25]]);
    const scaled = pair[0] * 1000 / pair[1];
    const text = decimalText(scaled, 3, true);
    return sentence('fractions', year, 'Fractions as decimals', 'DECIMALS', 'Write ' + pair[0] + '/' + pair[1] + ' as a decimal.',
      'A fraction is a division: ' + pair[0] + ' ÷ ' + pair[1] + ' = ' + text + '.',
      [{ frac: pair }, { s: '=' }, { ask: text }]);
  };

  // Year 6: a decimal with one digit before the point times a whole number.
  FRACTIONS.decimalTimes = function (year) {
    const text = K.randomDecimal(1, randInt(1, 2));
    const w = randInt(2, 9);
    const d = K.parseDecimal(text);
    const answer = decimalText(d.scaled * w, d.places, true);
    return sentence('fractions', year, 'Decimal times', 'MULTIPLY', 'Work out ' + text + ' × ' + w + '.',
      'Work out ' + d.scaled + ' × ' + w + ' = ' + (d.scaled * w) + ', then put the point back: ' + plural(d.places, 'decimal place', 'decimal places') +
        ', so ' + answer + '.',
      [{ n: text }, { s: '×' }, { n: w }, { s: '=' }, { ask: answer }]);
  };

  // Year 6: percentages of amounts; Year 7: over 100% and percentage change.
  FRACTIONS.percentOf = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const p = year === 6 ? pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]) : pick([5, 15, 35, 45, 120, 125, 150, 175, 250]);
      const amount = randInt(2, 40) * 20;
      const value = p * amount / 100;
      if (value !== Math.floor(value)) continue;
      return sentence('fractions', year, 'Percentage of an amount', 'PERCENT', 'Work out ' + p + '% of ' + amount + '.',
        '10% of ' + amount + ' is ' + (amount / 10) + ', so 1% is ' + decimalText(amount, 2, true) + '. ' + p + '% is ' + p + ' × ' +
          decimalText(amount, 2, true) + ' = ' + value + '.',
        [{ n: p }, { t: '%' }, { t: 'of' }, { n: amount }, { s: '=' }, { ask: value }]);
    }
    return null;
  };

  FRACTIONS.percentChange = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const p = pick([5, 10, 15, 20, 25, 30, 35, 40]);
      const amount = randInt(2, 30) * 20;
      const up = randInt(0, 1) === 1;
      const change = p * amount / 100;
      if (change !== Math.floor(change)) continue;
      const value = up ? amount + change : amount - change;
      return sentence('fractions', year, 'Percentage change', 'PERCENT', (up ? 'Increase ' : 'Decrease ') + amount + ' by ' + p + '%.',
        p + '% of ' + amount + ' is ' + change + '. ' + amount + (up ? ' + ' : ' ' + MINUS + ' ') + change + ' = ' + value + '.',
        [{ ask: value }], { check: { kind: 'value', expr: amount + '*' + (100 + (up ? p : -p)) + '/100' } });
    }
    return null;
  };

  FRACTIONS.percentOfWhole = function (year) {
    const whole = pick([20, 25, 40, 50, 80, 200]);
    const part = randInt(1, whole - 1);
    const p = part * 100 / whole;
    if (p !== Math.floor(p)) return FRACTIONS.percentOfWhole(year);
    return sentence('fractions', year, 'As a percentage', 'PERCENT', 'What percentage of ' + whole + ' is ' + part + '?',
      part + '/' + whole + ' = ' + p + '/100, so ' + p + '%.',
      [{ n: part }, { t: 'out of', span: 2 }, { n: whole }, { s: '=' }, { ask: p }, { t: '%' }],
      { check: { kind: 'value', expr: part + '*100/' + whole } });
  };

  // Year 7: the four operations with fractions, mixed numbers and negatives.
  FRACTIONS.fractionOps = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const roll = randInt(1, 3);
      if (roll === 1) {
        const d1 = randInt(2, 5);
        const d2 = randInt(2, 5);
        const w1 = randInt(1, 3);
        const n1 = randInt(1, d1 - 1);
        const n2 = randInt(1, d2 - 1);
        if (gcd(n1, d1) !== 1 || gcd(n2, d2) !== 1) continue;
        const top = (w1 * d1 + n1) * n2;
        const bottom = d1 * d2;
        const s = simplest(top, bottom);
        return sentence('fractions', year, 'Fraction calculations', 'MULTIPLY',
          'Work it out. Give the answer in its simplest form' + (s[0] > s[1] ? ', as a mixed number.' : '.'),
          'Change ' + w1 + ' ' + n1 + '/' + d1 + ' to ' + (w1 * d1 + n1) + '/' + d1 + '. Multiply tops and bottoms: ' + top + '/' + bottom + ' = ' +
            mixedText(s[0], s[1]) + '.',
          [{ n: w1 }, { frac: [n1, d1] }, { s: '×' }, { frac: [n2, d2] }, { s: '=' }].concat(fractionTokens(s[0], s[1], true, true)),
          { check: { kind: 'statement', simplest: true } });
      }
      if (roll === 2) {
        const d1 = randInt(2, 9);
        const n1 = randInt(1, d1 - 1);
        const d2 = randInt(2, 12);
        const n2 = randInt(1, d2 - 1);
        if (gcd(n1, d1) !== 1 || gcd(n2, d2) !== 1) continue;
        const top = n1 * d2;
        const bottom = d1 * n2;
        const s = simplest(top, bottom);
        if (s[1] > 12) continue;
        return sentence('fractions', year, 'Fraction calculations', 'DIVIDE',
          'Work it out. Give the answer in its simplest form' + (s[0] > s[1] ? ', as a mixed number.' : '.'),
          'Dividing by ' + n2 + '/' + d2 + ' is multiplying by ' + d2 + '/' + n2 + ': ' + n1 + '/' + d1 + ' × ' + d2 + '/' + n2 + ' = ' + top + '/' +
            bottom + ' = ' + mixedText(s[0], s[1]) + '.',
          [{ frac: [n1, d1] }, { s: '÷' }, { frac: [n2, d2] }, { s: '=' }].concat(fractionTokens(s[0], s[1], true, true)),
          { check: { kind: 'statement', simplest: true } });
      }
      const d1 = randInt(2, 6);
      const d2 = randInt(2, 6);
      if (d1 === d2) continue;
      const n1 = randInt(1, d1 - 1);
      const n2 = randInt(1, d2 - 1);
      if (gcd(n1, d1) !== 1 || gcd(n2, d2) !== 1) continue;
      const common = d1 * d2 / gcd(d1, d2);
      const a = -n1 * common / d1;
      const b = n2 * common / d2;
      const top = a + b;
      if (top === 0) continue;
      const s = simplest(Math.abs(top), common);
      return sentence('fractions', year, 'Fraction calculations', 'ADD',
        'Work it out. Give the answer in its simplest form.',
        'Use ' + common + 'ths: ' + int(a) + '/' + common + ' + ' + b + '/' + common + ' = ' + int(top) + '/' + common +
          (s[0] !== Math.abs(top) ? ' = ' + (top < 0 ? MINUS : '') + s[0] + '/' + s[1] : '') + '.',
        [{ s: MINUS }, { frac: [n1, d1] }, { s: '+' }, { frac: [n2, d2] }, { s: '=' },
          { signBox: top < 0 ? MINUS : '+' }, { frac: [{ ask: s[0] }, { ask: s[1] }] }],
        { check: { kind: 'statement', simplest: true } });
    }
    return null;
  };

  // Year 7: terminating decimals and their fractions.
  FRACTIONS.decimalToFraction = function (year) {
    const pair = pick([[3, 8], [5, 8], [7, 8], [1, 8], [3, 4], [2, 5], [3, 5], [4, 5], [7, 20], [9, 20], [3, 25], [7, 2], [9, 4], [11, 5], [13, 8]]);
    const scaled = pair[0] * 1000 / pair[1];
    const text = decimalText(scaled, 3, true);
    if (randInt(0, 1)) {
      return sentence('fractions', year, 'Decimals and fractions', 'DECIMALS', 'Write ' + text + ' as a fraction in its simplest form.',
        text + ' = ' + grouped(scaled) + '/1000. Divide top and bottom by ' + gcd(scaled, 1000) + ': ' + pair[0] + '/' + pair[1] + '.',
        [{ n: text }, { s: '=' }, { frac: [{ ask: pair[0] }, { ask: pair[1] }] }], { check: { kind: 'statement', simplest: true } });
    }
    return sentence('fractions', year, 'Decimals and fractions', 'DECIMALS', 'Write ' + pair[0] + '/' + pair[1] + ' as a decimal.',
      pair[0] + ' ÷ ' + pair[1] + ' = ' + text + '.', [{ frac: pair }, { s: '=' }, { ask: text }]);
  };

  // Year 6 ratio and proportion: relative sizes, scale factors and
  // unequal sharing.
  FRACTIONS.ratio = function (year) {
    const roll = randInt(1, 3);
    if (roll === 1) {
      const a = randInt(1, 5);
      const b = randInt(2, 7);
      if (a === b) return FRACTIONS.ratio(year);
      const k = randInt(2, 6);
      return sentence('fractions', year, 'Ratio', 'RATIO',
        'A bead pattern has ' + b + ' blue beads for every ' + a + ' red ' + (a === 1 ? 'bead' : 'beads') + '. There are ' + (a * k) +
          ' red beads. How many blue beads are there?',
        (a * k) + ' red is ' + k + ' lots of ' + a + ', so there are ' + k + ' lots of ' + b + ' blue: ' + k + ' × ' + b + ' = ' + (k * b) + '.',
        [{ ask: k * b }, { t: 'blue', span: 2 }], { check: { kind: 'value', expr: (a * k) + '/' + a + '*' + b } });
    }
    if (roll === 2) {
      const f = randInt(2, 5);
      const side = randInt(2, 12);
      return sentence('fractions', year, 'Scale factor', 'RATIO',
        'A shape is enlarged by scale factor ' + f + '. One side was ' + side + ' cm. How long is it now?',
        'Scale factor ' + f + ' makes every length ' + f + ' times as long: ' + side + ' × ' + f + ' = ' + (side * f) + ' cm.',
        [{ ask: side * f }, { t: 'cm' }], { check: { kind: 'value', expr: side + '*' + f } });
    }
    const a = randInt(1, 5);
    const b = randInt(2, 7);
    if (a === b) return FRACTIONS.ratio(year);
    const k = randInt(2, 8);
    const total = (a + b) * k;
    return sentence('fractions', year, 'Sharing', 'RATIO',
      total + ' sweets are shared so that for every ' + a + ' Sam gets, Ali gets ' + b + '. How many does each get?',
      'Each share of ' + a + ' and ' + b + ' uses ' + (a + b) + ' sweets. ' + total + ' ÷ ' + (a + b) + ' = ' + k + ' shares. Sam gets ' + a +
        ' × ' + k + ' = ' + (a * k) + ' and Ali gets ' + b + ' × ' + k + ' = ' + (b * k) + '.',
      [{ t: 'Sam', span: 2 }, { ask: a * k, sub: 'Type how many Sam gets.' }, { t: 'Ali', span: 2 }, { ask: b * k, sub: 'Now how many Ali gets.' }],
      { check: { kind: 'share', total: total, ratio: [a, b] } });
  };

  // Year 7: ratio notation, sharing in a ratio, proportion and reverse
  // percentages.
  FRACTIONS.ratio7 = function (year) {
    const roll = randInt(1, 4);
    if (roll === 1) {
      const a = randInt(1, 9);
      const b = randInt(1, 9);
      if (gcd(a, b) !== 1 || a === b) return FRACTIONS.ratio7(year);
      const k = randInt(2, 9);
      return sentence('fractions', year, 'Ratio', 'RATIO', 'Write ' + (a * k) + ' : ' + (b * k) + ' in its simplest form.',
        'Divide both parts by ' + k + ', their highest common factor: ' + a + ' : ' + b + '.',
        [{ n: a * k }, { s: ':' }, { n: b * k }, { s: '=' }, { ask: a, sub: 'Type the first part.' }, { s: ':' }, { ask: b, sub: 'Now the second part.' }],
        { check: { kind: 'ratio', given: [a * k, b * k] } });
    }
    if (roll === 2) {
      const a = randInt(1, 7);
      const b = randInt(2, 9);
      const k = randInt(2, 12);
      const total = (a + b) * k;
      return sentence('fractions', year, 'Sharing in a ratio', 'RATIO', 'Share ' + total + ' in the ratio ' + a + ' : ' + b + '.',
        a + ' + ' + b + ' = ' + (a + b) + ' parts. One part is ' + total + ' ÷ ' + (a + b) + ' = ' + k + '. So ' + (a * k) + ' and ' + (b * k) + '.',
        [{ n: total }, { s: '→' }, { ask: a * k, sub: 'Type the first share.' }, { s: ':' }, { ask: b * k, sub: 'Now the second share.' }],
        { check: { kind: 'share', total: total, ratio: [a, b] } });
    }
    if (roll === 3) {
      const n = randInt(2, 6);
      const price = randInt(2, 9) * n;
      const m = n * randInt(2, 4);
      return sentence('fractions', year, 'Proportion', 'PROPORTION',
        n + ' pens cost £' + price + '. How much do ' + m + ' pens cost?',
        'One pen costs £' + price + ' ÷ ' + n + ' = £' + (price / n) + '. ' + m + ' pens cost ' + m + ' × £' + (price / n) + ' = £' + (price / n * m) + '.',
        [{ t: '£' }, { ask: price / n * m }], { check: { kind: 'value', expr: price + '/' + n + '*' + m } });
    }
    const p = pick([10, 20, 25, 50]);
    const original = randInt(2, 20) * 4;
    const after = original * (100 + p) / 100;
    if (after !== Math.floor(after)) return FRACTIONS.ratio7(year);
    return sentence('fractions', year, 'Reverse percentage', 'PERCENT',
      'After a ' + p + '% rise, a price is £' + after + '. What was it before?',
      'The new price is ' + (100 + p) + '% of the old one. 1% is £' + after + ' ÷ ' + (100 + p) + ', so 100% is £' + original + '.',
      [{ t: '£' }, { ask: original }], { check: { kind: 'value', expr: after + '*100/' + (100 + p) } });
  };

  const FRACTION_KINDS = {
    1: [[3, 'halfQuarter'], [2, 'shadedName']],
    2: [[3, 'fractionOf'], [2, 'nameShaded'], [1, 'equivalent']],
    3: [[2, 'fractionOf'], [1, 'nameShaded'], [2, 'equivalent'], [2, 'tenths'], [2, 'addSame'], [2, 'compare']],
    4: [[2, 'fractionOf'], [2, 'equivalent'], [2, 'addSame'], [2, 'decimalEquivalent'], [2, 'divide10'], [1, 'roundDecimal'],
      [1, 'compareDecimal']],
    5: [[1, 'compare'], [1, 'equivalent'], [2, 'mixed'], [2, 'addSame'], [1, 'multiplyWhole'], [2, 'decimalFraction'],
      [1, 'roundDecimal'], [1, 'compareDecimal'], [2, 'percent']],
    6: [[1, 'simplify'], [1, 'compare'], [2, 'addDifferent'], [1, 'mixedAdd'], [2, 'multiply'], [1, 'fractionDecimal'],
      [1, 'decimalTimes'], [1, 'percent'], [2, 'percentOf'], [2, 'ratio']],
    7: [[3, 'fractionOps'], [1, 'decimalToFraction'], [1, 'percentOf'], [2, 'percentChange'], [1, 'percentOfWhole'], [3, 'ratio7']]
  };

  FRACTIONS.drawShade = DRAW.shade;
  [1, 2, 3, 4, 5, 6].forEach(function (year) { FRACTION_KINDS[year].push([year <= 3 ? 3 : 2, 'drawShade']); });

  Engine.addArea('fractions', chooser(FRACTIONS, FRACTION_KINDS, 'fractions'));

  /* Measures: money, time, length, mass, capacity, perimeter, area and
     volume, read from pictures or worked out. */

  // Each unit with how many of the smaller unit it holds.
  const UNIT_PAIRS = {
    length: [['km', 'm', 1000], ['m', 'cm', 100], ['cm', 'mm', 10], ['m', 'mm', 1000]],
    mass: [['kg', 'g', 1000]],
    capacity: [['l', 'ml', 1000]],
    time: [['hours', 'minutes', 60], ['minutes', 'seconds', 60], ['days', 'hours', 24], ['weeks', 'days', 7], ['years', 'months', 12]]
  };

  const COINS = [1, 2, 5, 10, 20, 50, 100, 200];

  function coinName(value) {
    return value >= 100 ? '£' + (value / 100) : value + 'p';
  }

  function money(pence) {
    return '£' + decimalText(pence, 2);
  }

  function clockWords(h, m) {
    if (m === 0) return h + " o'clock";
    if (m === 30) return 'half past ' + h;
    if (m === 15) return 'quarter past ' + h;
    if (m === 45) return 'quarter to ' + (h % 12 + 1);
    return m < 30 ? m + ' minutes past ' + h : (60 - m) + ' minutes to ' + (h % 12 + 1);
  }

  function clockWhy(h, m) {
    if (m === 0) return 'The minute hand points to 12 and the hour hand points to ' + h + ': ' + h + " o'clock.";
    return 'The minute hand points to ' + (m / 5 === 0 ? 12 : m / 5) + ', which is ' + m + ' minutes past. The hour hand is ' +
      (m <= 30 ? 'just past ' + h : 'nearly at ' + (h % 12 + 1)) + ': ' + clockWords(h, m) + '.';
  }

  const MEASURES = {};

  // Year 1: coins, up to 20p.
  MEASURES.coins = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const count = randInt(2, year === 1 ? 4 : 5);
      const coins = [];
      for (let k = 0; k < count; k++) coins.push(pick(year === 1 ? [1, 2, 5, 10] : [1, 2, 5, 10, 20, 50]));
      coins.sort(function (a, b) { return b - a; });
      const total = coins.reduce(function (sum, c) { return sum + c; }, 0);
      if (total > (year === 1 ? 20 : 100)) continue;
      return sentence('measures', year, 'Coins', 'MONEY', 'How much money is there?',
        'Add the biggest coins first: ' + coins.map(coinName).join(' + ') + ' = ' + total + 'p.',
        [{ ask: total }, { t: 'p' }], { picture: { kind: 'coins', coins: coins }, check: { kind: 'coins' } });
    }
    return null;
  };

  // Year 1: o'clock and half past.
  MEASURES.clockHour = function (year) {
    const h = randInt(1, 12);
    const m = randInt(0, 1) ? 0 : 30;
    const tokens = m === 0 ? [{ ask: h }, { t: "o'clock", span: 3 }] : [{ t: 'half past', span: 3 }, { ask: h }];
    return sentence('measures', year, 'Telling the time', 'TIME', 'What time does the clock show?', clockWhy(h, m), tokens,
      { picture: { kind: 'clock', h: h, m: m }, check: { kind: 'clock' } });
  };

  // Year 2: to five minutes, with quarter past and quarter to.
  MEASURES.clock5 = function (year) {
    const h = randInt(1, 12);
    const m = 5 * randInt(1, 11);
    const next = h % 12 + 1;
    let tokens;
    if (m === 15) tokens = [{ t: 'quarter past', span: 4 }, { ask: h }];
    else if (m === 30) tokens = [{ t: 'half past', span: 3 }, { ask: h }];
    else if (m === 45) tokens = [{ t: 'quarter to', span: 4 }, { ask: next }];
    else if (m < 30) tokens = [{ ask: m }, { t: 'minutes past', span: 4 }, { ask: h }];
    else tokens = [{ ask: 60 - m }, { t: 'minutes to', span: 4 }, { ask: next }];
    return sentence('measures', year, 'Telling the time', 'TIME', 'What time does the clock show?', clockWhy(h, m), tokens,
      { picture: { kind: 'clock', h: h, m: m }, check: { kind: 'clock' } });
  };

  // Years 3 and 4: analogue to digital, Roman numerals on some clocks.
  MEASURES.clock12 = function (year) {
    const h = randInt(1, 12);
    const m = year === 3 ? 5 * randInt(0, 11) : randInt(0, 59);
    const mm = String(m).padStart(2, '0');
    return sentence('measures', year, 'Telling the time', 'TIME', 'What time does the clock show? Write it as hours and minutes.',
      'The hour hand is ' + (m < 30 ? 'just past ' + h : 'between ' + h + ' and ' + (h % 12 + 1)) + '. The minute hand shows ' + m +
        ' minutes. So it is ' + h + ':' + mm + '.',
      [{ ask: h + ':' + mm }], { picture: { kind: 'clock', h: h, m: m, roman: randInt(0, 2) === 0 }, check: { kind: 'clock', digital: true } });
  };

  // Year 4: 12-hour and 24-hour clocks.
  MEASURES.clock24 = function (year) {
    const h = randInt(1, 12);
    const m = randInt(0, 59);
    const pm = randInt(0, 1) === 1;
    const h24 = pm ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
    const mm = String(m).padStart(2, '0');
    const out = String(h24).padStart(2, '0') + ':' + mm;
    return sentence('measures', year, '24-hour clock', 'TIME', 'Write ' + h + ':' + mm + ' ' + (pm ? 'pm' : 'am') + ' in the 24-hour clock.',
      pm ? (h === 12 ? '12 pm is midday, which stays 12 in the 24-hour clock.' : 'For pm times add 12 to the hours: ' + h + ' + 12 = ' + h24 + '.')
        : (h === 12 ? '12 am is midnight, which is 00 in the 24-hour clock.' : 'Morning times keep their hours, written with 2 digits.'),
      [{ n: h + ':' + mm }, { t: pm ? 'pm' : 'am' }, { s: '=' }, { ask: out }], { check: { kind: 'time24', h: h, m: m, pm: pm } });
  };

  // Year 1: days, weeks and months.
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  MEASURES.calendar = function (year) {
    if (randInt(0, 1)) {
      const fact = pick([['days are in a week', 7], ['months are in a year', 12], ['days are in a weekend', 2], ['days are in a fortnight', 14]]);
      return sentence('measures', year, 'Calendar', 'TIME', 'How many ' + fact[0] + '?', 'There are ' + fact[1] + ' ' + fact[0] + '.',
        [{ ask: fact[1] }], { check: { kind: 'calendar', fact: fact[0] } });
    }
    const i = randInt(0, 6);
    const after = randInt(0, 1) === 1;
    const answer = DAYS[(i + (after ? 1 : 6)) % 7];
    const options = shuffle([answer, DAYS[(i + (after ? 6 : 1)) % 7], DAYS[(i + 3) % 7]]).map(function (day, k) { return [k + 1, day]; });
    const key = options.find(function (o) { return o[1] === answer; })[0];
    return sentence('measures', year, 'Calendar', 'TIME', 'What day comes ' + (after ? 'after ' : 'before ') + DAYS[i] + '?',
      'The days go ' + DAYS.join(', ') + '. The day ' + (after ? 'after ' : 'before ') + DAYS[i] + ' is ' + answer + '.',
      [{ pick: key, options: options }], { check: { kind: 'day', day: DAYS[i], after: after } });
  };

  // Years 1 and 2: measuring with a ruler.
  MEASURES.ruler = function (year) {
    const length = randInt(2, year === 1 ? 10 : 14);
    return sentence('measures', year, 'Measuring', 'MEASURE', 'How long is the pencil? It starts at 0.',
      'The pencil ends at the ' + length + ' mark, so it is ' + length + ' cm long.',
      [{ ask: length }, { t: 'cm' }], { picture: { kind: 'ruler', length: length, max: 15 }, check: { kind: 'ruler' } });
  };

  // Years 2 and 3: reading scales.
  MEASURES.scale = function (year) {
    const style = pick(['thermometer', 'jug']);
    let min;
    let max;
    let step;
    let value;
    let unit;
    if (style === 'thermometer') {
      min = 0;
      max = 40;
      step = year === 2 ? 5 : 2;
      value = step * randInt(1, max / step - 1);
      unit = '°C';
    } else {
      min = 0;
      max = 1000;
      step = year === 2 ? 100 : 50;
      value = step * randInt(1, max / step - 1);
      unit = 'ml';
    }
    return sentence('measures', year, 'Reading scales', 'MEASURE', 'What does the scale show?',
      'Each mark on the scale is ' + step + ' ' + unit + '. Count up from ' + min + ': the level is at ' + value + ' ' + unit + '.',
      [{ ask: value }, { t: unit }],
      { picture: { kind: 'scale', min: min, max: max, step: step, value: value, unit: unit, style: style }, check: { kind: 'scale' } });
  };

  // Year 2: hours, minutes and days.
  MEASURES.timeFacts = function (year) {
    const facts = year === 2
      ? [['1 hour', 'minutes', 60], ['1 day', 'hours', 24], ['half an hour', 'minutes', 30], ['2 hours', 'minutes', 120]]
      : [['1 minute', 'seconds', 60], ['1 year', 'days', 365], ['a leap year', 'days', 366], ['April', 'days', 30],
        ['June', 'days', 30], ['January', 'days', 31], ['February in a leap year', 'days', 29], ['September', 'days', 30]];
    const fact = pick(facts);
    return sentence('measures', year, 'Time facts', 'TIME', 'How many ' + fact[1] + ' are in ' + fact[0] + '?',
      fact[0].charAt(0).toUpperCase() + fact[0].slice(1) + ' has ' + fact[2] + ' ' + fact[1] + '.',
      [{ ask: fact[2] }, { t: fact[1], span: 3 }], { check: { kind: 'calendar', fact: fact[0] + ' ' + fact[1] } });
  };

  // Year 2: adding coins and giving change; Year 3 in pence and pounds.
  MEASURES.money = function (year) {
    if (randInt(0, 1)) return MEASURES.coins(year);
    const pay = pick([20, 50, 100]);
    const cost = randInt(1, pay / 5 - 1) * 5 - randInt(0, 1) * randInt(1, 4);
    if (cost <= 0) return MEASURES.money(year);
    return sentence('measures', year, 'Change', 'MONEY',
      'A pencil costs ' + cost + 'p. You pay with a ' + coinName(pay) + ' coin. How much change do you get?',
      'Count on from ' + cost + 'p to ' + pay + 'p: ' + (pay - cost) + 'p.',
      [{ ask: pay - cost }, { t: 'p' }], { check: { kind: 'value', expr: pay + '-' + cost } });
  };

  // Year 3: pounds and pence.
  MEASURES.moneyPence = function (year) {
    const pounds = randInt(1, 9);
    const pence = randInt(1, 99);
    const total = pounds * 100 + pence;
    if (randInt(0, 1)) {
      return sentence('measures', year, 'Pounds and pence', 'MONEY', 'How many pence is £' + pounds + ' and ' + pence + 'p?',
        '£1 is 100p, so £' + pounds + ' is ' + (pounds * 100) + 'p. ' + (pounds * 100) + 'p + ' + pence + 'p = ' + total + 'p.',
        [{ t: '£' }, { n: pounds }, { t: 'and', span: 2 }, { n: pence }, { t: 'p' }, { s: '=' }, { ask: total }, { t: 'p' }],
        { check: { kind: 'value', expr: pounds + '*100+' + pence } });
    }
    return sentence('measures', year, 'Pounds and pence', 'MONEY', 'Write ' + total + 'p in pounds and pence.',
      '100p make £1, so ' + total + 'p is £' + pounds + ' and ' + pence + 'p.',
      [{ n: total }, { t: 'p' }, { s: '=' }, { t: '£' }, { ask: pounds, sub: 'Type the pounds.' }, { t: 'and', span: 2 }, { ask: pence, sub: 'Now the pence.' }, { t: 'p' }],
      { check: { kind: 'poundsPence', total: total } });
  };

  // Year 2: compare measures with <, > and =.
  MEASURES.compareMeasure = function (year) {
    const unit = pick(['cm', 'kg', 'ml', 'm', 'g']);
    const a = randInt(5, 95);
    const b = randInt(0, 3) === 0 ? a : randInt(5, 95);
    const sym = a < b ? '<' : (a > b ? '>' : '=');
    return sentence('measures', year, 'Compare measures', 'COMPARE', 'Which sign goes between ' + a + ' ' + unit + ' and ' + b + ' ' + unit + '?',
      'Both are in ' + unit + ', so compare the numbers: ' + a + ' ' + sym + ' ' + b + '.',
      [{ n: a }, { t: unit }, { cmp: sym }, { n: b }, { t: unit }]);
  };

  // Year 3: add and subtract measures in the same unit.
  MEASURES.addMeasures = function (year) {
    const unit = pick(['ml', 'g', 'cm', 'mm']);
    const add = randInt(0, 1) === 1;
    const a = randInt(12, 99) * (unit === 'mm' || unit === 'cm' ? 1 : 10);
    const b = randInt(11, 89) * (unit === 'mm' || unit === 'cm' ? 1 : 10);
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    const value = add ? a + b : big - small;
    const x = add ? a : big;
    const y = add ? b : small;
    return sentence('measures', year, 'Adding measures', add ? 'ADD' : 'SUBTRACT', 'Work it out. The answer is in ' + unit + '.',
      'Both are in ' + unit + ': ' + x + (add ? ' + ' : ' ' + MINUS + ' ') + y + ' = ' + value + ' ' + unit + '.',
      [{ n: x }, { s: add ? '+' : MINUS }, { n: y }, { s: '=' }, { ask: value }, { t: unit }]);
  };

  // Years 3 to 5: perimeter of rectangles, triangles and L-shapes.
  function rectangle(w, h) {
    return [[0, 0], [w, 0], [w, h], [0, h]];
  }

  MEASURES.perimeter = function (year) {
    const unit = year >= 4 && randInt(0, 2) === 0 ? 'm' : 'cm';
    let points;
    let labels;
    if (year === 5 || (year === 4 && randInt(0, 1))) {
      // An L-shape: a rectangle with a corner cut away. Two sides are not
      // labelled; they come from the others.
      const W = randInt(6, 14);
      const H = randInt(6, 12);
      const w = randInt(2, W - 2);
      const h = randInt(2, H - 2);
      points = [[0, 0], [W, 0], [W, H - h], [W - w, H - h], [W - w, H], [0, H]];
      const sides = [W, H - h, w, h, W - w, H];
      const hidden = year === 5 ? [1, 2] : [];
      labels = sides.map(function (len, i) { return hidden.indexOf(i) === -1 ? len + ' ' + unit : ''; });
      const total = sides.reduce(function (s, v) { return s + v; }, 0);
      return sentence('measures', year, 'Perimeter', 'PERIMETER', 'What is the perimeter of the shape? All corners are right angles.',
        (hidden.length ? 'Find the missing sides first: ' + H + ' ' + MINUS + ' ' + h + ' = ' + (H - h) + ' and ' + W + ' ' + MINUS + ' ' +
          (W - w) + ' = ' + w + '. ' : '') + 'Add all six sides: ' + sides.join(' + ') + ' = ' + total + ' ' + unit + '.',
        [{ ask: total }, { t: unit }],
        { picture: { kind: 'shape', points: points, sideLabels: labels, rightAngles: true }, check: { kind: 'perimeter', sides: sides } });
    }
    if (year === 3 && randInt(0, 1)) {
      const a = randInt(3, 12);
      const b = randInt(3, 12);
      const c = randInt(Math.abs(a - b) + 1, a + b - 1);
      points = [[0, 0], [a, 0], null];
      // Place the third corner from the side lengths (c from the first corner).
      const x = (a * a + c * c - b * b) / (2 * a);
      const y = Math.sqrt(Math.max(0, c * c - x * x));
      points[2] = [x, y];
      const sides = [a, b, c];
      return sentence('measures', year, 'Perimeter', 'PERIMETER', 'What is the perimeter of the triangle?',
        'Add the three sides: ' + sides.join(' + ') + ' = ' + (a + b + c) + ' ' + unit + '.',
        [{ ask: a + b + c }, { t: unit }],
        { picture: { kind: 'shape', points: points, sideLabels: [a + ' ' + unit, b + ' ' + unit, c + ' ' + unit] }, check: { kind: 'perimeter', sides: sides } });
    }
    const w = randInt(3, 15);
    const h = randInt(2, 10);
    const square = randInt(0, 4) === 0;
    const hh = square ? w : h;
    const sides = [w, hh, w, hh];
    return sentence('measures', year, 'Perimeter', 'PERIMETER', 'What is the perimeter of the ' + (square ? 'square' : 'rectangle') + '?',
      'Opposite sides are equal: ' + sides.join(' + ') + ' = ' + (2 * (w + hh)) + ' ' + unit + '.',
      [{ ask: 2 * (w + hh) }, { t: unit }],
      { picture: { kind: 'shape', points: rectangle(w, hh), sideLabels: [w + ' ' + unit, square ? '' : hh + ' ' + unit, '', ''], rightAngles: true, ticks: square },
        check: { kind: 'perimeter', sides: sides } });
  };

  // Year 4: area by counting squares.
  MEASURES.areaCount = function (year) {
    const rows = randInt(3, 5);
    const cols = randInt(4, 7);
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) cells.push([r, c]);
    }
    // Cut a block from one corner to make a rectilinear shape.
    const cutR = randInt(1, rows - 1);
    const cutC = randInt(1, cols - 2);
    const kept = cells.filter(function (cell) { return !(cell[0] < cutR && cell[1] < cutC); });
    return sentence('measures', year, 'Area', 'AREA', 'Each square is 1 square centimetre. What is the area of the shape?',
      'Count the squares row by row: ' + kept.length + ' squares, so ' + kept.length + ' cm².',
      [{ ask: kept.length }, { t: 'cm²' }],
      { picture: { kind: 'areaGrid', rows: rows, cols: cols, cells: kept }, check: { kind: 'areaCount' } });
  };

  // Years 4 to 7: converting units, with decimals from Year 5.
  MEASURES.convert = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const family = pick(year === 4 ? ['length', 'mass', 'capacity', 'time', 'time'] : ['length', 'length', 'mass', 'capacity', 'time']);
      const pair = pick(UNIT_PAIRS[family]);
      const big = pair[0];
      const small = pair[1];
      const factor = pair[2];
      const down = randInt(0, 1) === 1;
      const places = year === 4 || family === 'time' ? 0 : randInt(0, year === 5 ? 2 : 3);
      let fromText;
      let toText;
      if (down) {
        const value = places ? K.randomDecimal(1, Math.min(places, 2)) : String(randInt(2, 12));
        const d = K.parseDecimal(value);
        const scaled = d.scaled * factor;
        toText = decimalText(scaled, d.places, true);
        fromText = value;
      } else {
        const value = places ? randInt(1, factor * 20) : randInt(2, 12) * factor;
        const d = String(value);
        const exact = value % factor === 0;
        if (!places && !exact) continue;
        // Powers of ten move the point; 60, 24, 7 and 12 divide exactly.
        const powerOfTen = /^10*$/.test(String(factor));
        if (!powerOfTen && !exact) continue;
        toText = powerOfTen ? decimalText(value, String(factor).length - 1, true) : String(value / factor);
        if (K.parseDecimal(toText).places > Engine.MAX_DECIMAL_PLACES[year]) continue;
        fromText = d;
      }
      const from = down ? big : small;
      const to = down ? small : big;
      const problem = sentence('measures', year, 'Converting units', 'CONVERT',
        'Change ' + grouped(fromText) + ' ' + from + ' into ' + to + '.',
        '1 ' + big.replace(/s$/, '') + ' = ' + grouped(factor) + ' ' + small + ', so ' + (down ? 'multiply' : 'divide') + ' by ' + grouped(factor) + ': ' +
          grouped(fromText) + ' ' + from + ' = ' + grouped(toText) + ' ' + to + '.',
        [{ n: fromText }, { t: from, span: from.length > 3 ? 2 : 1 }, { s: '=' }, { ask: toText }, { t: to, span: to.length > 3 ? 2 : 1 }],
        { check: { kind: 'convert', value: fromText, from: from, to: to } });
      if (problem.width > 15) continue;
      return problem;
    }
    return null;
  };

  // Year 5: approximate imperial equivalents; Year 6: miles and km.
  MEASURES.imperial = function (year) {
    if (year >= 6) {
      const k = randInt(2, 12);
      return sentence('measures', year, 'Miles and kilometres', 'CONVERT',
        '5 miles is about 8 km. About how many km is ' + (5 * k) + ' miles?',
        (5 * k) + ' miles is ' + k + ' lots of 5 miles, so about ' + k + ' × 8 = ' + (8 * k) + ' km.',
        [{ n: 5 * k }, { t: 'miles', span: 2 }, { s: '≈' }, { ask: 8 * k }, { t: 'km' }], { check: { kind: 'value', expr: (5 * k) + '/5*8' } });
    }
    const inches = randInt(2, 12) * 2;
    return sentence('measures', year, 'Inches and centimetres', 'CONVERT',
      '1 inch is about 2.5 cm. About how many cm is ' + inches + ' inches?',
      inches + ' × 2.5 = ' + (inches * 5 / 2) + ', so about ' + (inches * 5 / 2) + ' cm.',
      [{ n: inches }, { t: 'inches', span: 2 }, { s: '≈' }, { ask: inches * 5 / 2 }, { t: 'cm' }], { check: { kind: 'value', expr: inches + '*2.5' } });
  };

  // Year 3: durations; Year 5: units of time.
  MEASURES.duration = function (year) {
    const h = randInt(1, 11);
    const m1 = 5 * randInt(0, 10);
    const gap = 5 * randInt(2, year === 3 ? 9 : 14);
    const total = h * 60 + m1 + gap;
    const h2 = Math.floor(total / 60);
    const m2 = total % 60;
    const from = h + ':' + String(m1).padStart(2, '0');
    const to = h2 + ':' + String(m2).padStart(2, '0');
    return sentence('measures', year, 'How long', 'TIME', 'How many minutes is it from ' + from + ' to ' + to + '?',
      h2 > h ? 'From ' + from + ' to ' + h2 + ':00 is ' + (60 - m1) + ' minutes, then ' + m2 + ' more: ' + (60 - m1) + ' + ' + m2 + ' = ' + gap + ' minutes.'
        : 'Count on from ' + m1 + ' to ' + m2 + ' minutes: ' + gap + ' minutes.',
      [{ n: from }, { t: 'to' }, { n: to }, { s: '=' }, { ask: gap }, { t: 'min' }], { check: { kind: 'duration', from: from, to: to } });
  };

  MEASURES.timeConvert = function (year) {
    if (randInt(0, 1)) {
      const hours = randInt(1, 5);
      const minutes = 5 * randInt(1, 11);
      return sentence('measures', year, 'Units of time', 'CONVERT', 'How many minutes is ' + hours + ' hours ' + minutes + ' minutes?',
        hours + ' hours is ' + hours + ' × 60 = ' + (hours * 60) + ' minutes. Add ' + minutes + ': ' + (hours * 60 + minutes) + ' minutes.',
        [{ n: hours }, { t: 'h' }, { n: minutes }, { t: 'min' }, { s: '=' }, { ask: hours * 60 + minutes }, { t: 'min' }],
        { check: { kind: 'value', expr: hours + '*60+' + minutes } });
    }
    const days = randInt(2, 7);
    return sentence('measures', year, 'Units of time', 'CONVERT', 'How many hours are in ' + days + ' days?',
      'A day has 24 hours: ' + days + ' × 24 = ' + (days * 24) + '.',
      [{ n: days }, { t: 'days', span: 2 }, { s: '=' }, { ask: days * 24 }, { t: 'hours', span: 2 }], { check: { kind: 'convert', value: String(days), from: 'days', to: 'hours' } });
  };

  // Year 4: money with decimals.
  MEASURES.moneyDecimal = function (year) {
    const add = randInt(0, 1) === 1;
    // Sums stay under £10, so the sentence fits a phone.
    const a = randInt(105, add ? 489 : 899);
    const b = randInt(105, add ? 489 : 899);
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    if (!add && big - small < 100) return MEASURES.moneyDecimal(year);
    const value = add ? a + b : big - small;
    const x = add ? a : big;
    const y = add ? b : small;
    return sentence('measures', year, 'Money', 'MONEY', (add ? 'Add ' : 'Take ') + money(add ? x : y) + (add ? ' and ' : ' from ') + money(add ? y : x) + '.',
      'Line up the points: ' + money(x) + (add ? ' + ' : ' ' + MINUS + ' ') + money(y) + ' = ' + money(value) + '.',
      [{ n: decimalText(x, 2) }, { s: add ? '+' : MINUS }, { n: decimalText(y, 2) }, { s: '=' }, { t: '£' }, { ask: decimalText(value, 2) }]);
  };

  // Years 5 and 6: measures with decimals.
  MEASURES.measureDecimal = function (year) {
    const unit = pick(['m', 'kg', 'l']);
    const a = K.randomDecimal(1, randInt(1, 2));
    const b = K.randomDecimal(1, randInt(1, 2));
    const add = randInt(0, 1) === 1;
    const order = K.compareDecimals(a, b);
    const x = add || order >= 0 ? a : b;
    const y = x === a ? b : a;
    const places = Math.max(K.parseDecimal(x).places, K.parseDecimal(y).places);
    const value = add ? K.scaleTo(x, places) + K.scaleTo(y, places) : K.scaleTo(x, places) - K.scaleTo(y, places);
    if (value <= 0) return MEASURES.measureDecimal(year);
    const answer = decimalText(value, places, true);
    return sentence('measures', year, 'Measures with decimals', add ? 'ADD' : 'SUBTRACT', 'Work it out in ' + unit + '.',
      'Line up the points: ' + x + (add ? ' + ' : ' ' + MINUS + ' ') + y + ' = ' + answer + ' ' + unit + '.',
      [{ n: x }, { s: add ? '+' : MINUS }, { n: y }, { s: '=' }, { ask: answer }, { t: unit }]);
  };

  // Years 5 and 6: area of rectangles, triangles and parallelograms.
  MEASURES.areaRect = function (year) {
    const w = randInt(3, 15);
    const h = randInt(2, 12);
    const unit = randInt(0, 3) === 0 ? 'm' : 'cm';
    return sentence('measures', year, 'Area', 'AREA', 'What is the area of the rectangle?',
      'Area of a rectangle = length × width: ' + w + ' × ' + h + ' = ' + (w * h) + ' ' + unit + '².',
      [{ ask: w * h }, { t: unit + '²' }],
      { picture: { kind: 'shape', points: rectangle(w, h), sideLabels: [w + ' ' + unit, h + ' ' + unit, '', ''], rightAngles: true },
        check: { kind: 'value', expr: w + '*' + h } });
  };

  MEASURES.areaTriangle = function (year) {
    const b = randInt(3, 16);
    const h = randInt(2, 12);
    if (randInt(0, 1)) {
      if ((b * h) % 2) return MEASURES.areaTriangle(year);
      const apex = randInt(1, b - 1);
      return sentence('measures', year, 'Area of a triangle', 'AREA', 'What is the area of the triangle?',
        'Area of a triangle = base × height ÷ 2: ' + b + ' × ' + h + ' ÷ 2 = ' + (b * h / 2) + ' cm².',
        [{ ask: b * h / 2 }, { t: 'cm²' }],
        { picture: { kind: 'shape', points: [[0, 0], [b, 0], [apex, h]], sideLabels: [b + ' cm', '', ''], height: { from: [apex, h], to: [apex, 0], text: h + ' cm' } },
          check: { kind: 'value', expr: b + '*' + h + '/2' } });
    }
    const slant = randInt(1, 4);
    return sentence('measures', year, 'Area of a parallelogram', 'AREA', 'What is the area of the parallelogram?',
      'Area of a parallelogram = base × height: ' + b + ' × ' + h + ' = ' + (b * h) + ' cm².',
      [{ ask: b * h }, { t: 'cm²' }],
      { picture: { kind: 'shape', points: [[0, 0], [b, 0], [b + slant, h], [slant, h]], sideLabels: [b + ' cm', '', '', ''], height: { from: [slant, h], to: [slant, 0], text: h + ' cm' } },
        check: { kind: 'value', expr: b + '*' + h } });
  };

  // Years 5 and 6: volume, by counting cubes and then by multiplying.
  MEASURES.volumeCubes = function (year) {
    const l = randInt(2, 5);
    const w = randInt(2, 3);
    const h = randInt(2, 4);
    return sentence('measures', year, 'Volume', 'VOLUME', 'Each cube is 1 cm³. What is the volume of the cuboid?',
      'There are ' + l + ' × ' + w + ' = ' + (l * w) + ' cubes in each layer and ' + h + ' layers: ' + (l * w) + ' × ' + h + ' = ' + (l * w * h) + ' cm³.',
      [{ ask: l * w * h }, { t: 'cm³' }], { picture: { kind: 'cubes', l: l, w: w, h: h }, check: { kind: 'cubes' } });
  };

  MEASURES.volumeCuboid = function (year) {
    const l = randInt(2, 12);
    const w = randInt(2, 8);
    const h = randInt(2, 10);
    return sentence('measures', year, 'Volume', 'VOLUME', 'What is the volume of the cuboid?',
      'Volume = length × width × height: ' + l + ' × ' + w + ' × ' + h + ' = ' + (l * w * h) + ' cm³.',
      [{ ask: l * w * h }, { t: 'cm³' }], { picture: { kind: 'cuboid', l: l, w: w, h: h, unit: 'cm' }, check: { kind: 'cuboid' } });
  };

  // Year 7: trapezia, circles in terms of pi, prisms, area units, speed and
  // unit prices.
  MEASURES.trapezium = function (year) {
    const a = randInt(2, 10);
    const b = a + 2 * randInt(1, 4);
    const h = randInt(2, 10);
    if (((a + b) * h) % 2) return MEASURES.trapezium(year);
    const off = (b - a) / 2;
    return sentence('measures', year, 'Area of a trapezium', 'AREA', 'What is the area of the trapezium?',
      'Area = (a + b) ÷ 2 × height: (' + a + ' + ' + b + ') ÷ 2 × ' + h + ' = ' + ((a + b) / 2) + ' × ' + h + ' = ' + ((a + b) * h / 2) + ' cm².',
      [{ ask: (a + b) * h / 2 }, { t: 'cm²' }],
      { picture: { kind: 'shape', points: [[0, 0], [b, 0], [b - off, h], [off, h]], sideLabels: [b + ' cm', '', a + ' cm', ''], height: { from: [off, h], to: [off, 0], text: h + ' cm' } },
        check: { kind: 'value', expr: '(' + a + '+' + b + ')/2*' + h } });
  };

  MEASURES.circle = function (year) {
    const r = randInt(2, 12);
    const area = randInt(0, 1) === 1;
    const byDiameter = !area && randInt(0, 1) === 1;
    const label = byDiameter ? 'diameter ' + (2 * r) + ' cm' : 'radius ' + r + ' cm';
    return sentence('measures', year, 'Circles', 'CIRCLES',
      'A circle has ' + label + '. What is its ' + (area ? 'area' : 'circumference') + '? Leave π in the answer.',
      area ? 'Area = π × radius²: π × ' + r + '² = ' + (r * r) + 'π cm².' : 'Circumference = π × diameter: π × ' + (2 * r) + ' = ' + (2 * r) + 'π cm.',
      [{ ask: area ? r * r : 2 * r }, { t: area ? 'π cm²' : 'π cm', span: 2 }],
      { picture: { kind: 'circle', label: label, diameter: byDiameter }, check: { kind: 'circle', r: r, area: area } });
  };

  MEASURES.prism = function (year) {
    const cross = randInt(4, 30);
    const length = randInt(2, 12);
    return sentence('measures', year, 'Volume of a prism', 'VOLUME',
      'A prism has a cross-section of ' + cross + ' cm² and is ' + length + ' cm long. What is its volume?',
      'Volume of a prism = area of the cross-section × length: ' + cross + ' × ' + length + ' = ' + (cross * length) + ' cm³.',
      [{ ask: cross * length }, { t: 'cm³' }], { check: { kind: 'value', expr: cross + '*' + length } });
  };

  MEASURES.areaUnits = function (year) {
    const pair = pick([['m²', 'cm²', 10000], ['cm²', 'mm²', 100], ['km²', 'm²', 1000000]]);
    const n = randInt(2, pair[2] >= 1000000 ? 4 : 9);
    const root = Math.round(Math.sqrt(pair[2]));
    return sentence('measures', year, 'Area units', 'CONVERT', 'Change ' + n + ' ' + pair[0] + ' into ' + pair[1] + '.',
      '1 ' + pair[0].replace('²', '') + ' = ' + grouped(root) + ' ' + pair[1].replace('²', '') + ', so 1 ' + pair[0] + ' = ' + grouped(root) + ' × ' +
        grouped(root) + ' = ' + grouped(pair[2]) + ' ' + pair[1] + '. ' + n + ' × ' + grouped(pair[2]) + ' = ' + grouped(n * pair[2]) + '.',
      [{ n: n }, { t: pair[0] }, { s: '=' }, { ask: n * pair[2] }, { t: pair[1] }], { check: { kind: 'convert', value: String(n), from: pair[0], to: pair[1] } });
  };

  MEASURES.speed = function (year) {
    const hours = randInt(2, 5);
    const speed = randInt(4, 18) * 5;
    return sentence('measures', year, 'Speed', 'SPEED', 'A car goes ' + (speed * hours) + ' km in ' + hours + ' hours at a steady speed. How fast is it going?',
      'Speed = distance ÷ time: ' + (speed * hours) + ' ÷ ' + hours + ' = ' + speed + ' km per hour.',
      [{ ask: speed }, { t: 'km/h', span: 2 }], { check: { kind: 'value', expr: (speed * hours) + '/' + hours } });
  };

  MEASURES.unitPrice = function (year) {
    const count = randInt(3, 9);
    const each = randInt(12, 95);
    return sentence('measures', year, 'Unit price', 'MONEY', count + ' apples cost ' + money(count * each) + '. How much does 1 apple cost?',
      money(count * each) + ' is ' + (count * each) + 'p. ' + (count * each) + ' ÷ ' + count + ' = ' + each + 'p.',
      [{ ask: each }, { t: 'p' }], { check: { kind: 'value', expr: (count * each) + '/' + count } });
  };

  const MEASURE_KINDS = {
    1: [[3, 'coins'], [3, 'clockHour'], [2, 'calendar'], [2, 'ruler']],
    2: [[3, 'clock5'], [2, 'timeFacts'], [2, 'money'], [2, 'scale'], [1, 'compareMeasure'], [1, 'ruler']],
    3: [[2, 'addMeasures'], [2, 'perimeter'], [2, 'clock12'], [1, 'timeFacts'], [2, 'duration'], [1, 'scale'], [2, 'moneyPence']],
    4: [[3, 'convert'], [2, 'perimeter'], [2, 'areaCount'], [2, 'moneyDecimal'], [2, 'clock24'], [1, 'clock12'], [1, 'duration']],
    5: [[3, 'convert'], [1, 'imperial'], [2, 'perimeter'], [2, 'areaRect'], [2, 'volumeCubes'], [1, 'timeConvert'], [2, 'measureDecimal']],
    6: [[3, 'convert'], [1, 'imperial'], [3, 'areaTriangle'], [2, 'volumeCuboid'], [1, 'measureDecimal'], [1, 'areaRect']],
    7: [[2, 'trapezium'], [3, 'circle'], [1, 'prism'], [2, 'areaUnits'], [2, 'speed'], [1, 'unitPrice'], [1, 'convert']]
  };

  MEASURES.drawClock = DRAW.clock;
  MEASURES.drawRuler = DRAW.ruler;
  [1, 2, 3].forEach(function (year) { MEASURE_KINDS[year].push([3, 'drawClock']); });
  [2, 3, 4, 5].forEach(function (year) { MEASURE_KINDS[year].push([2, 'drawRuler']); });

  Engine.addArea('measures', chooser(MEASURES, MEASURE_KINDS, 'measures'));

  /* Shape: 2-D and 3-D shapes, turns, angles, lines, symmetry, coordinates
     and transformations. Shapes are drawn from their corner points (x to
     the right, y up). */

  function regularPolygon(n) {
    const points = [];
    for (let k = 0; k < n; k++) {
      const a = Math.PI / 2 + 2 * Math.PI * k / n + (n % 2 === 0 ? Math.PI / n : 0);
      points.push([Math.round(Math.cos(a) * 1000) / 1000, Math.round(Math.sin(a) * 1000) / 1000]);
    }
    return points;
  }

  const SHAPE_NAMES = { 3: 'triangle', 4: 'quadrilateral', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon' };

  // Corner points for each kind of triangle and quadrilateral, with tick
  // marks on equal sides and right-angle marks, as schools draw them.
  function triangleOf(kind) {
    if (kind === 'equilateral') return { points: [[0, 0], [4, 0], [2, 3.464]], ticks: [[0, 1], [1, 1], [2, 1]] };
    if (kind === 'isosceles') {
      const b = randInt(3, 5);
      const h = pick([4.5, 5, 5.5, 6]);
      return { points: [[0, 0], [b, 0], [b / 2, h]], ticks: [[1, 1], [2, 1]] };
    }
    if (kind === 'right') return { points: [[0, 0], [randInt(4, 6), 0], [0, randInt(2, 4)]], rightAngles: [0] };
    // Scalene: retry until no two sides are within 0.6 of each other.
    for (;;) {
      const points = [[0, 0], [6, 0], [randInt(5, 55) / 10, randInt(20, 40) / 10]];
      const sides = points.map(function (p, k) {
        const q = points[(k + 1) % 3];
        return Math.hypot(p[0] - q[0], p[1] - q[1]);
      });
      if (Math.abs(sides[0] - sides[1]) > 0.6 && Math.abs(sides[1] - sides[2]) > 0.6 && Math.abs(sides[0] - sides[2]) > 0.6) return { points: points };
    }
  }

  function quadrilateralOf(kind) {
    if (kind === 'square') return { points: [[0, 0], [4, 0], [4, 4], [0, 4]], ticks: [[0, 1], [1, 1], [2, 1], [3, 1]], rightAngles: [0, 1, 2, 3] };
    if (kind === 'rectangle') return { points: [[0, 0], [6, 0], [6, 3], [0, 3]], ticks: [[0, 1], [1, 2], [2, 1], [3, 2]], rightAngles: [0, 1, 2, 3] };
    if (kind === 'rhombus') return { points: [[0, 0], [5, 0], [8, 4], [3, 4]], ticks: [[0, 1], [1, 1], [2, 1], [3, 1]] };
    if (kind === 'parallelogram') return { points: [[0, 0], [6, 0], [8, 3], [2, 3]], ticks: [[0, 1], [1, 2], [2, 1], [3, 2]] };
    if (kind === 'trapezium') return { points: [[0, 0], [7, 0], [5, 3], [1.5, 3]] };
    return { points: [[0, 0], [2.5, 2], [0, 6], [-2.5, 2]], ticks: [[0, 1], [3, 1], [1, 2], [2, 2]] };
  }

  const SHAPE = {};

  // Year 1: naming common 2-D and 3-D shapes.
  SHAPE.name2d = function (year) {
    const options = [[1, 'circle'], [2, 'triangle'], [3, 'square'], [4, 'rectangle']];
    const name = pick(['circle', 'triangle', 'square', 'rectangle']);
    let picture;
    if (name === 'circle') picture = { kind: 'shape', circle: true };
    else if (name === 'triangle') picture = { kind: 'shape', points: triangleOf(pick(['equilateral', 'isosceles', 'right', 'scalene'])).points };
    else if (name === 'square') picture = { kind: 'shape', points: [[0, 0], [4, 0], [4, 4], [0, 4]] };
    else picture = { kind: 'shape', points: rectangle(randInt(5, 8), randInt(2, 3)) };
    picture.fill = true;
    const facts = { circle: 'It is round with no corners: a circle.', triangle: 'It has 3 straight sides: a triangle.',
      square: 'It has 4 equal sides and 4 square corners: a square.', rectangle: 'It has 4 square corners and two longer sides: a rectangle.' };
    return sentence('shape', year, '2-D shapes', 'SHAPES', 'What is this shape called?', facts[name],
      [{ pick: options.find(function (o) { return o[1] === name; })[0], options: options }],
      { picture: picture, check: { kind: 'shapeName', name: name } });
  };

  const SOLIDS = {
    cube: { faces: 6, edges: 12, vertices: 8, bottom: 'square' },
    cuboid: { faces: 6, edges: 12, vertices: 8, bottom: 'rectangle' },
    pyramid: { faces: 5, edges: 8, vertices: 5, bottom: 'square' },
    prism: { faces: 5, edges: 9, vertices: 6, bottom: 'rectangle' },
    tetrahedron: { faces: 4, edges: 6, vertices: 4, bottom: 'triangle' },
    sphere: { bottom: null },
    cylinder: { bottom: 'circle' },
    cone: { bottom: 'circle' }
  };
  const SOLID_LABELS = { pyramid: 'square-based pyramid', prism: 'triangular prism', tetrahedron: 'triangular pyramid' };

  SHAPE.name3d = function (year) {
    const options = [[1, 'cube'], [2, 'cuboid'], [3, 'pyramid'], [4, 'sphere']];
    const choice = pick(options);
    const facts = { cube: 'Every face is a square: a cube.', cuboid: 'Its faces are rectangles: a cuboid.',
      pyramid: 'Its sides are triangles that meet at a point: a pyramid.', sphere: 'It is round like a ball: a sphere.' };
    return sentence('shape', year, '3-D shapes', 'SHAPES', 'What is this shape called?', facts[choice[1]],
      [{ pick: choice[0], options: options }], { picture: { kind: 'solid', name: choice[1] }, check: { kind: 'shapeName', name: choice[1] } });
  };

  // Year 1: whole, half, quarter and three-quarter turns.
  const DIRECTIONS = ['up', 'right', 'down', 'left'];

  SHAPE.turn = function (year) {
    const quarters = randInt(1, 4);
    const clockwise = randInt(0, 1) === 1;
    const end = DIRECTIONS[((clockwise ? quarters : -quarters) % 4 + 4) % 4];
    const turnName = { 1: 'a quarter turn', 2: 'a half turn', 3: 'a three-quarter turn', 4: 'a whole turn' }[quarters];
    const options = DIRECTIONS.map(function (d, k) { return [k + 1, d]; });
    return sentence('shape', year, 'Turns', 'TURNS',
      'The arrow points up. It makes ' + turnName + ' ' + (clockwise ? 'clockwise' : 'anticlockwise') + '. Which way does it point now?',
      'Each quarter turn ' + (clockwise ? 'clockwise' : 'anticlockwise') + ' moves it one step: up, ' +
        (clockwise ? 'right, down, left' : 'left, down, right') + '. After ' + turnName + ' it points ' + end + '.',
      [{ t: 'points', span: 2 }, { pick: DIRECTIONS.indexOf(end) + 1, options: options }],
      { picture: { kind: 'arrow', clockwise: clockwise }, check: { kind: 'turn', quarters: quarters, clockwise: clockwise } });
  };

  // Year 2: sides and vertices of 2-D shapes; faces, edges and vertices of
  // 3-D shapes.
  SHAPE.sides = function (year) {
    const n = randInt(3, 8);
    const regular = randInt(0, 1) === 1;
    let points = regularPolygon(n);
    if (!regular) {
      points = points.map(function (p, k) {
        const s = 0.75 + 0.5 * ((k * 7) % 5) / 4;
        return [Math.round(p[0] * s * 1000) / 1000, Math.round(p[1] * s * 1000) / 1000];
      });
    }
    const vertices = randInt(0, 1) === 1;
    return sentence('shape', year, 'Sides and corners', 'SHAPES', 'How many ' + (vertices ? 'vertices (corners)' : 'sides') + ' does this shape have?',
      'Count them one at a time: ' + n + ' ' + (vertices ? 'vertices' : 'sides') + '. A shape with ' + n + ' sides is a ' + SHAPE_NAMES[n] + '.',
      [{ ask: n }, { t: vertices ? 'vertices' : 'sides', span: vertices ? 3 : 2 }],
      { picture: { kind: 'shape', points: points, fill: true }, check: { kind: 'polygonCount' } });
  };

  SHAPE.faces = function (year) {
    const name = pick(['cube', 'cuboid', 'pyramid', 'prism', 'tetrahedron']);
    const part = pick(['faces', 'edges', 'vertices']);
    const count = SOLIDS[name][part];
    return sentence('shape', year, 'Faces, edges and vertices', 'SHAPES',
      'How many ' + part + ' does a ' + (SOLID_LABELS[name] || name) + ' have?',
      'A ' + (SOLID_LABELS[name] || name) + ' has ' + SOLIDS[name].faces + ' faces, ' + SOLIDS[name].edges + ' edges and ' +
        SOLIDS[name].vertices + ' vertices.',
      [{ ask: count }, { t: part, span: part === 'vertices' ? 3 : 2 }],
      { picture: { kind: 'solid', name: name }, check: { kind: 'solidCount', name: name, part: part } });
  };

  // Year 2: a vertical line of symmetry, yes or no.
  SHAPE.symmetry = function (year) {
    const kind = pick(['isosceles', 'rectangle', 'kite', 'hexagon', 'scalene', 'parallelogram']);
    let points;
    if (kind === 'isosceles') points = [[0, 0], [4, 0], [2, 5]];
    else if (kind === 'rectangle') points = rectangle(6, 3);
    else if (kind === 'kite') points = quadrilateralOf('kite').points;
    else if (kind === 'hexagon') points = regularPolygon(6);
    else if (kind === 'scalene') points = triangleOf('scalene').points;
    else points = quadrilateralOf('parallelogram').points;
    const xs = points.map(function (p) { return p[0]; });
    const middle = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
    const symmetric = kind !== 'scalene' && kind !== 'parallelogram';
    return sentence('shape', year, 'Symmetry', 'SYMMETRY', 'Is the dashed line a line of symmetry? Type 1 for yes or 0 for no.',
      symmetric ? 'Fold the shape on the dashed line: both halves match exactly, so yes.'
        : 'Fold the shape on the dashed line: the two halves do not match, so no.',
      [{ t: 'symmetry?', span: 3 }, { pick: symmetric ? 1 : 0, options: YES_NO }],
      { picture: { kind: 'shape', points: points, fill: true, mirror: { x: middle } }, check: { kind: 'symmetryLine' } });
  };

  // Years 2 and 3: turns as right angles.
  SHAPE.rightAngles = function (year) {
    const pair = pick([['a quarter turn', 1], ['a half turn', 2], ['a three-quarter turn', 3], ['a complete turn', 4]]);
    return sentence('shape', year, 'Right angles', 'TURNS', 'How many right angles make ' + pair[0] + '?',
      'A right angle is a quarter turn, so ' + pair[0] + ' is ' + plural(pair[1], 'right angle', 'right angles') + '.',
      [{ ask: pair[1] }, { t: 'right angles', span: 4 }], { check: { kind: 'calendar', fact: pair[0] } });
  };

  function angleClassWhy(degrees, options) {
    if (degrees === 90) return 'The arms make a square corner: a right angle.';
    if (degrees < 90) return 'It is smaller than a square corner, less than a right angle' + (options.length === 3 && options[0][1] === 'acute' ? ': acute.' : '.');
    if (degrees < 180) return 'It is bigger than a square corner but less than a straight line' + (options[0][1] === 'acute' ? ': obtuse.' : '.');
    return 'It is more than a straight line (180°): reflex.';
  }

  // Year 3: less than, equal to or more than a right angle. Year 4: acute,
  // right or obtuse. Year 5: acute, obtuse or reflex.
  SHAPE.angleType = function (year) {
    let options;
    let degrees;
    let key;
    if (year === 3) {
      options = [[1, 'less'], [2, 'right angle'], [3, 'more']];
      degrees = pick([randInt(2, 8) * 10, 90, randInt(10, 17) * 10]);
      key = degrees < 90 ? 1 : (degrees === 90 ? 2 : 3);
    } else if (year === 4) {
      options = [[1, 'acute'], [2, 'right'], [3, 'obtuse']];
      degrees = pick([randInt(2, 8) * 10, 90, randInt(10, 17) * 10]);
      key = degrees < 90 ? 1 : (degrees === 90 ? 2 : 3);
    } else {
      options = [[1, 'acute'], [2, 'obtuse'], [3, 'reflex']];
      degrees = pick([randInt(2, 8) * 10, randInt(10, 17) * 10, randInt(19, 34) * 10]);
      key = degrees < 90 ? 1 : (degrees < 180 ? 2 : 3);
    }
    return sentence('shape', year, 'Angles', 'ANGLES',
      year === 3 ? 'Is this angle less than a right angle, a right angle, or more than a right angle?' : 'What kind of angle is this?',
      angleClassWhy(degrees, options),
      [{ pick: key, options: options }], { picture: { kind: 'angle', degrees: degrees, rotate: randInt(0, 3) * 15 }, check: { kind: 'angleClass' } });
  };

  // Year 3: parallel and perpendicular lines.
  SHAPE.lines = function (year) {
    const kind = pick(['parallel', 'perpendicular', 'neither']);
    const options = [[1, 'parallel'], [2, 'perpendicular'], [3, 'neither']];
    return sentence('shape', year, 'Lines', 'LINES', 'Are these lines parallel, perpendicular, or neither?',
      kind === 'parallel' ? 'They stay the same distance apart and never meet: parallel.'
        : (kind === 'perpendicular' ? 'They meet at a right angle: perpendicular.' : 'They are not the same distance apart and do not meet at a right angle: neither.'),
      [{ pick: options.find(function (o) { return o[1] === kind; })[0], options: options }],
      { picture: { kind: 'lines', relation: kind, rotate: randInt(0, 5) * 15 }, check: { kind: 'linesKind' } });
  };

  // Year 4: classifying triangles and quadrilaterals, and lines of symmetry.
  SHAPE.triangleType = function (year) {
    const options = [[1, 'equilateral'], [2, 'isosceles'], [3, 'scalene']];
    const kind = pick(['equilateral', 'isosceles', 'scalene']);
    const t = triangleOf(kind);
    return sentence('shape', year, 'Triangles', 'SHAPES', 'What kind of triangle is this? The marks show equal sides.',
      { equilateral: 'All 3 sides are equal: equilateral.', isosceles: 'Exactly 2 sides are equal: isosceles.', scalene: 'No sides are equal: scalene.' }[kind],
      [{ pick: options.find(function (o) { return o[1] === kind; })[0], options: options }],
      { picture: { kind: 'shape', points: t.points, ticks: t.ticks || [], fill: true }, check: { kind: 'triangleKind', name: kind } });
  };

  SHAPE.quadType = function (year) {
    const names = ['square', 'rectangle', 'rhombus', 'parallelogram', 'trapezium', 'kite'];
    const options = names.map(function (n, k) { return [k + 1, n]; });
    const kind = pick(names);
    const q = quadrilateralOf(kind);
    return sentence('shape', year, 'Quadrilaterals', 'SHAPES', 'What kind of quadrilateral is this? Marks show equal sides and right angles.',
      { square: '4 equal sides and 4 right angles: a square.', rectangle: '4 right angles, opposite sides equal: a rectangle.',
        rhombus: '4 equal sides but no right angles: a rhombus.', parallelogram: 'Opposite sides equal and parallel, no right angles: a parallelogram.',
        trapezium: 'Just one pair of parallel sides: a trapezium.', kite: 'Two pairs of equal sides next to each other: a kite.' }[kind],
      [{ pick: names.indexOf(kind) + 1, options: options }],
      { picture: { kind: 'shape', points: q.points, ticks: q.ticks || [], rightAngles: q.rightAngles || [], fill: true }, check: { kind: 'quadKind', name: kind } });
  };

  SHAPE.symmetryCount = function (year) {
    const kind = pick(['square', 'rectangle', 'equilateral', 'isosceles', 'regular5', 'regular6', 'regular8', 'parallelogram', 'kite', 'rhombus']);
    let points;
    if (kind === 'equilateral' || kind === 'isosceles') points = triangleOf(kind).points;
    else if (/^regular/.test(kind)) points = regularPolygon(Number(kind.slice(7)));
    else points = quadrilateralOf(kind).points;
    const counts = { square: 4, rectangle: 2, equilateral: 3, isosceles: 1, regular5: 5, regular6: 6, regular8: 8, parallelogram: 0, kite: 1, rhombus: 2 };
    const n = counts[kind];
    return sentence('shape', year, 'Lines of symmetry', 'SYMMETRY', 'How many lines of symmetry does this shape have?',
      n ? 'There are ' + plural(n, 'way', 'ways') + ' to fold it so both halves match exactly: ' + plural(n, 'line', 'lines') + ' of symmetry.'
        : 'No fold makes the two halves match, so it has 0 lines of symmetry.',
      [{ ask: n }, { t: n === 1 ? 'line' : 'lines', span: 2 }], { picture: { kind: 'shape', points: points, fill: true }, check: { kind: 'symmetryCount' } });
  };

  // Years 4 and 6: coordinates, first quadrant then all four.
  function coordinateTokens(x, y, signs, label) {
    return [{ t: label }, { s: '=' }, { s: '(' }, { ask: int(x), sign: signs, sub: 'Type the x-coordinate: across first.' }, { s: ',' },
      { ask: int(y), sign: signs, sub: 'Now the y-coordinate: up or down.' }, { s: ')' }];
  }

  SHAPE.coordinates = function (year) {
    const four = year >= 6;
    const x = four ? randInt(-5, 5) : randInt(1, 7);
    const y = four ? randInt(-5, 5) : randInt(1, 7);
    if (four && (x === 0 || y === 0 || (x > 0 && y > 0))) return null;
    return sentence('shape', year, 'Coordinates', 'COORDINATES', 'What are the coordinates of point A? Go across, then up or down.',
      'From (0, 0) go ' + (x < 0 ? 'left ' + Math.abs(x) : 'right ' + x) + ', then ' + (y < 0 ? 'down ' + Math.abs(y) : 'up ' + y) + ': A is (' +
        int(x) + ', ' + int(y) + ').',
      coordinateTokens(x, y, four, 'A'),
      { picture: { kind: 'grid', min: four ? -6 : 0, max: four ? 6 : 8, points: [{ x: x, y: y, label: 'A' }] }, check: { kind: 'gridPoint' } });
  };

  SHAPE.translate = function (year) {
    const x = randInt(1, 6);
    const y = randInt(2, 6);
    const dx = randInt(-x + 1, 7 - x);
    const dy = randInt(-y + 1, 7 - y);
    if (dx === 0 || dy === 0) return null;
    return sentence('shape', year, 'Translation', 'MOVES',
      'Point A is at (' + x + ', ' + y + '). It moves ' + Math.abs(dx) + (dx > 0 ? ' right' : ' left') + ' and ' + Math.abs(dy) + (dy > 0 ? ' up' : ' down') +
        '. Where is it now?',
      'Across: ' + x + (dx > 0 ? ' + ' : ' ' + MINUS + ' ') + Math.abs(dx) + ' = ' + (x + dx) + '. Up or down: ' + y + (dy > 0 ? ' + ' : ' ' + MINUS + ' ') + Math.abs(dy) +
        ' = ' + (y + dy) + '. So (' + (x + dx) + ', ' + (y + dy) + ').',
      coordinateTokens(x + dx, y + dy, false, 'A'),
      { picture: { kind: 'grid', min: 0, max: 8, points: [{ x: x, y: y, label: 'A' }] }, check: { kind: 'translate', x: x, y: y, dx: dx, dy: dy } });
  };

  // Year 5: reflection in a mirror line; Year 6: in the axes.
  SHAPE.reflect = function (year) {
    if (year >= 6) {
      const x = randInt(-5, 5);
      const y = randInt(-5, 5);
      if (!x || !y) return null;
      const axis = pick(['x', 'y']);
      const rx = axis === 'y' ? -x : x;
      const ry = axis === 'x' ? -y : y;
      return sentence('shape', year, 'Reflection', 'MOVES', 'Reflect point A in the ' + axis + '-axis. Where does it land?',
        'Reflecting in the ' + axis + '-axis changes the sign of the ' + (axis === 'y' ? 'x' : 'y') + '-coordinate: (' + int(x) + ', ' + int(y) +
          ') goes to (' + int(rx) + ', ' + int(ry) + ').',
        coordinateTokens(rx, ry, true, 'A′'),
        { picture: { kind: 'grid', min: -6, max: 6, points: [{ x: x, y: y, label: 'A' }], axisLine: axis }, check: { kind: 'reflect', x: x, y: y, axis: axis } });
    }
    const mirror = randInt(3, 5);
    const x = randInt(1, 7);
    const y = randInt(1, 7);
    if (x === mirror || 2 * mirror - x < 0 || 2 * mirror - x > 8) return null;
    return sentence('shape', year, 'Reflection', 'MOVES', 'Reflect point A in the mirror line. Where does it land?',
      'A is ' + Math.abs(x - mirror) + ' squares ' + (x < mirror ? 'left of' : 'right of') + ' the mirror, so its image is ' + Math.abs(x - mirror) +
        ' squares on the other side: (' + (2 * mirror - x) + ', ' + y + ').',
      coordinateTokens(2 * mirror - x, y, false, 'A′'),
      { picture: { kind: 'grid', min: 0, max: 8, points: [{ x: x, y: y, label: 'A' }], mirror: mirror }, check: { kind: 'reflect', x: x, y: y, mirror: mirror } });
  };

  // Year 5: measuring with a protractor, angles on a line and at a point.
  SHAPE.measureAngle = function (year) {
    const degrees = randInt(2, 34) * 5;
    return sentence('shape', year, 'Measuring angles', 'ANGLES', 'Read the angle on the protractor. Use the scale that starts at 0 on the arm along the base.',
      'Start at 0 on the arm along the base and count round to the other arm: ' + degrees + '°.',
      [{ ask: degrees }, { t: '°' }], { picture: { kind: 'angle', degrees: degrees, protractor: true }, check: { kind: 'angle' } });
  };

  SHAPE.anglesLine = function (year) {
    const a = randInt(3, 33) * 5;
    return sentence('shape', year, 'Angles on a line', 'ANGLES', 'Find the angle marked ?. The bottom is a straight line.',
      'Angles on a straight line add up to 180°: 180 ' + MINUS + ' ' + a + ' = ' + (180 - a) + '°.',
      [{ ask: 180 - a }, { t: '°' }], { picture: { kind: 'anglesLine', angles: [a, 180 - a], labels: [a + '°', '?'] }, check: { kind: 'anglesSum', total: 180 } });
  };

  SHAPE.anglesPoint = function (year) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const count = randInt(3, 4);
      const angles = [];
      let left = 360;
      for (let k = 0; k < count - 1; k++) {
        const a = randInt(6, 14) * 10 - (year === 6 ? randInt(0, 1) * 5 : 0);
        angles.push(a);
        left -= a;
      }
      if (left < 30 || left > 200) continue;
      angles.push(left);
      const labels = angles.map(function (a, k) { return k === count - 1 ? '?' : a + '°'; });
      return sentence('shape', year, 'Angles at a point', 'ANGLES', 'Find the angle marked ?.',
        'Angles around a point add up to 360°: 360 ' + MINUS + ' ' + angles.slice(0, -1).join(' ' + MINUS + ' ') + ' = ' + left + '°.',
        [{ ask: left }, { t: '°' }], { picture: { kind: 'anglesPoint', angles: angles, labels: labels }, check: { kind: 'anglesSum', total: 360 } });
    }
    return null;
  };

  SHAPE.regular = function (year) {
    const n = randInt(3, 8);
    const regular = randInt(0, 1) === 1;
    let points = regularPolygon(n);
    if (!regular) points = points.map(function (p, k) { return k === 0 ? [p[0] * 1.35, p[1] * 1.35] : p; });
    return sentence('shape', year, 'Regular polygons', 'SHAPES', 'Is this polygon regular? Type 1 for yes or 0 for no.',
      regular ? 'All its sides and all its angles are equal, so it is regular.' : 'Its sides are not all equal, so it is not regular.',
      [{ t: 'regular?', span: 3 }, { pick: regular ? 1 : 0, options: YES_NO }],
      { picture: { kind: 'shape', points: points, fill: true }, check: { kind: 'regular' } });
  };

  // Year 6: missing angles in triangles and quadrilaterals, regular
  // polygons, vertically opposite angles and parts of circles.
  SHAPE.triangleAngles = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const quad = year >= 6 && randInt(0, 2) === 0;
      if (quad) {
        const a = randInt(6, 15) * 10 - randInt(0, 1) * 5;
        const b = randInt(6, 13) * 10;
        const c = randInt(5, 12) * 10;
        const d = 360 - a - b - c;
        if (d < 40 || d > 170) continue;
        const points = [[0, 0], [8, 0], [7, 4], [1.5, 5]];
        return sentence('shape', year, 'Angles in shapes', 'ANGLES', 'Find the angle marked ? in the quadrilateral.',
          'The angles of a quadrilateral add up to 360°: 360 ' + MINUS + ' ' + a + ' ' + MINUS + ' ' + b + ' ' + MINUS + ' ' + c + ' = ' + d + '°.',
          [{ ask: d }, { t: '°' }],
          { picture: { kind: 'shape', points: points, angleLabels: [a + '°', b + '°', c + '°', '?'], fill: true, notToScale: true },
            check: { kind: 'anglesSum', total: 360 } });
      }
      const a = randInt(3, 13) * 5;
      const b = randInt(4, 14) * 5;
      const c = 180 - a - b;
      if (c < 20) continue;
      const points = [[0, 0], [8, 0], [3, 4]];
      return sentence('shape', year, 'Angles in shapes', 'ANGLES', 'Find the angle marked ? in the triangle.',
        'The angles of a triangle add up to 180°: 180 ' + MINUS + ' ' + a + ' ' + MINUS + ' ' + b + ' = ' + c + '°.',
        [{ ask: c }, { t: '°' }],
        { picture: { kind: 'shape', points: points, angleLabels: [a + '°', b + '°', '?'], fill: true, notToScale: true }, check: { kind: 'anglesSum', total: 180 } });
    }
    return null;
  };

  SHAPE.polygonAngle = function (year) {
    const n = pick([3, 4, 5, 6, 8, 9, 10, 12]);
    const names = { 3: 'equilateral triangle', 4: 'square', 5: 'regular pentagon', 6: 'regular hexagon', 8: 'regular octagon', 9: 'regular nonagon',
      10: 'regular decagon', 12: 'regular 12-sided polygon' };
    if (year >= 7 && randInt(0, 1)) {
      const sumOnly = randInt(0, 1) === 1;
      if (sumOnly) {
        return sentence('shape', year, 'Angles in polygons', 'ANGLES', 'What do the interior angles of a ' + n + '-sided polygon add up to?',
          'A ' + n + '-sided polygon splits into ' + (n - 2) + ' triangles from one corner: ' + (n - 2) + ' × 180 = ' + ((n - 2) * 180) + '°.',
          [{ ask: (n - 2) * 180 }, { t: '°' }], { check: { kind: 'polygonAngle', n: n, what: 'sum' } });
      }
      return sentence('shape', year, 'Angles in polygons', 'ANGLES', 'What is each exterior angle of a ' + names[n] + '?',
        'The exterior angles of any polygon add up to 360°: 360 ÷ ' + n + ' = ' + (360 / n) + '°.',
        [{ ask: 360 / n }, { t: '°' }], { check: { kind: 'polygonAngle', n: n, what: 'exterior' } });
    }
    const each = 180 * (n - 2) / n;
    return sentence('shape', year, 'Angles in polygons', 'ANGLES', 'What is each angle inside a ' + names[n] + '?',
      'It splits into ' + (n - 2) + ' triangles, so the angles add up to ' + (n - 2) + ' × 180 = ' + ((n - 2) * 180) + '°. Shared by ' + n + ' equal angles: ' +
        ((n - 2) * 180) + ' ÷ ' + n + ' = ' + each + '°.',
      [{ ask: each }, { t: '°' }], { picture: { kind: 'shape', points: regularPolygon(n), fill: true }, check: { kind: 'polygonAngle', n: n, what: 'interior' } });
  };

  SHAPE.vertOpposite = function (year) {
    const a = randInt(4, 16) * 5 + 20;
    const opposite = randInt(0, 1) === 1;
    return sentence('shape', year, 'Vertically opposite angles', 'ANGLES', 'Two straight lines cross. Find the angle marked ?.',
      opposite ? 'Vertically opposite angles are equal: ? = ' + a + '°.' : 'Angles on a straight line add up to 180°: 180 ' + MINUS + ' ' + a + ' = ' + (180 - a) + '°.',
      [{ ask: opposite ? a : 180 - a }, { t: '°' }],
      { picture: { kind: 'crossing', angle: a, given: 0, asked: opposite ? 2 : 1 }, check: { kind: 'crossing', angle: a, given: 0, asked: opposite ? 2 : 1 } });
  };

  SHAPE.circleParts = function (year) {
    const r = randInt(2, 25);
    const findDiameter = randInt(0, 1) === 1;
    return sentence('shape', year, 'Parts of a circle', 'CIRCLES',
      findDiameter ? 'The radius of a circle is ' + r + ' cm. What is its diameter?' : 'The diameter of a circle is ' + (2 * r) + ' cm. What is its radius?',
      'The diameter is twice the radius: ' + (findDiameter ? r + ' × 2 = ' + (2 * r) : (2 * r) + ' ÷ 2 = ' + r) + ' cm.',
      [{ ask: findDiameter ? 2 * r : r }, { t: 'cm' }],
      { picture: { kind: 'circle', label: findDiameter ? 'radius ' + r + ' cm' : 'diameter ' + (2 * r) + ' cm', diameter: !findDiameter },
        check: { kind: 'value', expr: findDiameter ? r + '*2' : (2 * r) + '/2' } });
  };

  SHAPE.nets = function (year) {
    const names = ['cube', 'pyramid', 'prism'];
    const options = [[1, 'cube'], [2, 'square-based pyramid'], [3, 'triangular prism']];
    const name = pick(names);
    return sentence('shape', year, 'Nets', 'SHAPES', 'Which 3-D shape does this net fold up to make?',
      { cube: '6 squares fold into a cube.', pyramid: 'A square with 4 triangles folds into a square-based pyramid.',
        prism: '2 triangles and 3 rectangles fold into a triangular prism.' }[name],
      [{ pick: names.indexOf(name) + 1, options: options, span: 7 }], { picture: { kind: 'net', name: name }, check: { kind: 'netName', name: name } });
  };

  // Year 7: angles with parallel lines, Pythagoras, trigonometry, rotation
  // and enlargement.
  SHAPE.parallel = function (year) {
    const a = randInt(5, 16) * 5 + 10;
    const given = randInt(0, 3);
    const asked = randInt(4, 7);
    const value = (asked % 2) === (given % 2) ? a : 180 - a;
    const relation = asked - 4 === given ? 'corresponding' : ((asked - 4 + 2) % 4 === given ? 'alternate' : 'co-interior');
    const sameKind = (asked % 2) === (given % 2);
    return sentence('shape', year, 'Parallel lines', 'ANGLES', 'The two arrowed lines are parallel. Find the angle marked ?.',
      sameKind ? 'The angles are ' + (relation === 'corresponding' ? 'corresponding' : 'alternate') + ', and with parallel lines those are equal: ? = ' + a + '°.'
        : 'The marked angles make a straight line or a co-interior pair, so they add up to 180°: 180 ' + MINUS + ' ' + a + ' = ' + (180 - a) + '°.',
      [{ ask: value }, { t: '°' }],
      { picture: { kind: 'parallel', angle: a, given: given, asked: asked }, check: { kind: 'parallel', angle: a, given: given, asked: asked } });
  };

  const TRIPLES = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [7, 24, 25], [9, 12, 15], [12, 16, 20], [9, 40, 41], [20, 21, 29]];

  SHAPE.pythagoras = function (year) {
    const t = pick(TRIPLES);
    const missing = pick(['c', 'c', 'a']);
    const labels = missing === 'c' ? [t[0] + ' cm', '?', t[1] + ' cm'] : ['?', t[2] + ' cm', t[1] + ' cm'];
    const points = [[0, 0], [t[0], 0], [0, t[1]]];
    return sentence('shape', year, "Pythagoras' theorem", 'PYTHAGORAS', 'Find the side marked ? in the right-angled triangle.',
      missing === 'c'
        ? 'a² + b² = c²: ' + t[0] + '² + ' + t[1] + '² = ' + (t[0] * t[0]) + ' + ' + (t[1] * t[1]) + ' = ' + (t[2] * t[2]) + ', and √' + (t[2] * t[2]) + ' = ' + t[2] + '.'
        : 'a² = c² ' + MINUS + ' b²: ' + t[2] + '² ' + MINUS + ' ' + t[1] + '² = ' + (t[2] * t[2]) + ' ' + MINUS + ' ' + (t[1] * t[1]) + ' = ' + (t[0] * t[0]) +
          ', and √' + (t[0] * t[0]) + ' = ' + t[0] + '.',
      [{ ask: missing === 'c' ? t[2] : t[0] }, { t: 'cm' }],
      { picture: { kind: 'shape', points: points, sideLabels: labels, rightAngles: [0], notToScale: true },
        check: { kind: 'pythagoras', a: t[0], b: t[1], c: t[2], missing: missing } });
  };

  SHAPE.trig = function (year) {
    const t = pick(TRIPLES.slice(0, 6));
    const fn = pick(['sin', 'cos', 'tan']);
    const opp = t[1];
    const adj = t[0];
    const hyp = t[2];
    const ratio = { sin: [opp, hyp], cos: [adj, hyp], tan: [opp, adj] }[fn];
    const s = simplest(ratio[0], ratio[1]);
    return sentence('shape', year, 'Trigonometry', 'TRIGONOMETRY', 'In the right-angled triangle, find ' + fn + ' A as a fraction in its simplest form.',
      fn + ' = ' + { sin: 'opposite ÷ hypotenuse', cos: 'adjacent ÷ hypotenuse', tan: 'opposite ÷ adjacent' }[fn] + ' = ' + ratio[0] + '/' + ratio[1] +
        (s[0] !== ratio[0] ? ' = ' + s[0] + '/' + s[1] : '') + '.',
      [{ t: fn + ' A', span: 2 }, { s: '=' }, { frac: [{ ask: s[0] }, { ask: s[1] }] }],
      { picture: { kind: 'shape', points: [[0, 0], [adj, 0], [adj, opp]], sideLabels: [adj + '', opp + '', hyp + ''], rightAngles: [1], angleLabels: ['A', '', ''], notToScale: true },
        check: { kind: 'trig', opp: opp, adj: adj, hyp: hyp, fn: fn } });
  };

  SHAPE.rotate = function (year) {
    const x = randInt(-5, 5);
    const y = randInt(-5, 5);
    if (!x || !y) return null;
    const turn = pick(['90c', '90a', '180']);
    const r = turn === '180' ? [-x, -y] : (turn === '90c' ? [y, -x] : [-y, x]);
    const name = turn === '180' ? '180°' : '90° ' + (turn === '90c' ? 'clockwise' : 'anticlockwise');
    return sentence('shape', year, 'Rotation', 'MOVES', 'Rotate point A ' + name + ' about (0, 0). Where does it land?',
      turn === '180' ? 'A half turn about (0, 0) changes both signs: (' + int(x) + ', ' + int(y) + ') goes to (' + int(r[0]) + ', ' + int(r[1]) + ').'
        : 'A quarter turn ' + (turn === '90c' ? 'clockwise' : 'anticlockwise') + ' about (0, 0) takes (x, y) to ' + (turn === '90c' ? '(y, ' + MINUS + 'x)' : '(' + MINUS + 'y, x)') +
          ': (' + int(x) + ', ' + int(y) + ') goes to (' + int(r[0]) + ', ' + int(r[1]) + ').',
      coordinateTokens(r[0], r[1], true, 'A′'),
      { picture: { kind: 'grid', min: -6, max: 6, points: [{ x: x, y: y, label: 'A' }] }, check: { kind: 'rotate', x: x, y: y, turn: turn } });
  };

  SHAPE.enlarge = function (year) {
    const t = pick(TRIPLES.slice(0, 5));
    const f = randInt(2, 5);
    return sentence('shape', year, 'Enlargement', 'MOVES',
      'A triangle with sides ' + t.join(' cm, ') + ' cm is enlarged to sides ' + t.map(function (v) { return v * f; }).join(' cm, ') + ' cm. What is the scale factor?',
      'Each side is ' + f + ' times as long: ' + (t[0] * f) + ' ÷ ' + t[0] + ' = ' + f + '.',
      [{ t: 'scale factor', span: 4 }, { ask: f }], { check: { kind: 'value', expr: (t[0] * f) + '/' + t[0] } });
  };

  const SHAPE_KINDS = {
    1: [[3, 'name2d'], [3, 'name3d'], [3, 'turn']],
    2: [[3, 'sides'], [3, 'faces'], [2, 'symmetry'], [2, 'rightAngles']],
    3: [[3, 'angleType'], [3, 'lines'], [2, 'rightAngles'], [1, 'sides'], [1, 'symmetry']],
    4: [[2, 'angleType'], [2, 'triangleType'], [2, 'quadType'], [2, 'symmetryCount'], [2, 'coordinates'], [2, 'translate']],
    5: [[3, 'measureAngle'], [2, 'anglesLine'], [2, 'anglesPoint'], [1, 'angleType'], [1, 'regular'], [2, 'reflect']],
    6: [[3, 'triangleAngles'], [2, 'polygonAngle'], [2, 'vertOpposite'], [1, 'circleParts'], [2, 'coordinates'], [1, 'reflect'], [1, 'nets']],
    7: [[3, 'parallel'], [2, 'polygonAngle'], [3, 'pythagoras'], [2, 'trig'], [2, 'rotate'], [1, 'enlarge']]
  };

  SHAPE.drawRectangle = DRAW.drawRectangle;
  SHAPE.drawSymmetry = DRAW.symmetry;
  SHAPE.drawVertex = DRAW.missingVertex;
  SHAPE.drawTranslate = DRAW.translate;
  SHAPE.drawReflect = DRAW.reflect;
  SHAPE.drawRotate = DRAW.rotate;
  SHAPE.drawAngle = DRAW.angle;
  SHAPE.drawTriangle = DRAW.triangle;
  SHAPE.drawNet = DRAW.net;
  SHAPE_KINDS[3].push([3, 'drawRectangle']);
  SHAPE_KINDS[4].push([2, 'drawSymmetry'], [1, 'drawVertex'], [2, 'drawTranslate']);
  SHAPE_KINDS[5].push([2, 'drawAngle'], [2, 'drawReflect'], [1, 'drawTranslate']);
  SHAPE_KINDS[6].push([2, 'drawTriangle'], [1, 'drawAngle'], [1, 'drawReflect'], [1, 'drawTranslate'], [2, 'drawNet']);
  SHAPE_KINDS[7].push([2, 'drawRotate'], [1, 'drawAngle']);

  Engine.addArea('shape', chooser(SHAPE, SHAPE_KINDS, 'shape'));

  /* Data: tally charts, pictograms, block diagrams, bar charts, tables, time
     and line graphs, pie charts, averages and probability. */

  const CATEGORY_SETS = [
    { things: 'fruit', labels: ['apples', 'pears', 'bananas', 'grapes'], who: 'children chose' },
    { things: 'pets', labels: ['cats', 'dogs', 'fish', 'rabbits'], who: 'children have' },
    { things: 'colours', labels: ['red', 'blue', 'green', 'yellow'], who: 'children like' },
    { things: 'sports', labels: ['football', 'netball', 'tennis', 'swimming'], who: 'children play' }
  ];

  // One question about a chart: how many in one group, how many more or
  // fewer, two groups together, or everyone.
  function chartQuestion(year, set, values) {
    const n = values.length;
    const ops = year === 1 ? ['read', 'read', 'more'] : (year === 2 ? ['read', 'more', 'fewer', 'sum'] : ['more', 'fewer', 'sum', 'total']);
    const op = pick(ops);
    const i = randInt(0, n - 1);
    let j = randInt(0, n - 1);
    if (j === i) j = (i + 1) % n;
    const big = values[i] >= values[j] ? i : j;
    const small = big === i ? j : i;
    if (op === 'read') {
      return { prompt: 'How many ' + set.who + ' ' + set.labels[i] + '?', answer: values[i], why: 'Read the ' + set.labels[i] + ' row: ' + values[i] + '.', check: { op: 'read', a: i } };
    }
    if (op === 'more' || op === 'fewer') {
      if (values[big] === values[small]) return null;
      const more = op === 'more';
      const a = more ? big : small;
      const b = more ? small : big;
      return {
        prompt: 'How many ' + (more ? 'more' : 'fewer') + ' ' + set.labels[a] + ' than ' + set.labels[b] + ' are there?',
        answer: values[big] - values[small],
        why: set.labels[a] + ': ' + values[a] + ', ' + set.labels[b] + ': ' + values[b] + '. The difference is ' + values[big] + ' ' + MINUS + ' ' + values[small] + ' = ' +
          (values[big] - values[small]) + '.',
        check: { op: 'difference', a: big, b: small }
      };
    }
    if (op === 'sum') {
      return {
        prompt: 'How many ' + set.labels[i] + ' and ' + set.labels[j] + ' are there altogether?',
        answer: values[i] + values[j],
        why: values[i] + ' + ' + values[j] + ' = ' + (values[i] + values[j]) + '.',
        check: { op: 'sum', a: i, b: j }
      };
    }
    const total = values.reduce(function (s, v) { return s + v; }, 0);
    return { prompt: 'How many are there altogether?', answer: total, why: 'Add them all: ' + values.join(' + ') + ' = ' + total + '.', check: { op: 'total' } };
  }

  const DATA = {};

  // Years 1 and 2: tally charts and pictograms where each picture is 1 or 2.
  DATA.tally = function (year) {
    const set = pick(CATEGORY_SETS);
    const n = year === 1 ? 3 : 4;
    const values = [];
    for (let k = 0; k < n; k++) values.push(randInt(1, year === 1 ? 9 : 14));
    const q = chartQuestion(year, set, values);
    if (!q) return null;
    return sentence('data', year, 'Tally charts', 'DATA', q.prompt + ' Each line is 1; a gate of 5 is four lines and one across.', q.why,
      [{ ask: q.answer }], { picture: { kind: 'tally', title: 'What ' + set.who.replace(/ \w+$/, '') + ' chose', labels: set.labels.slice(0, n), counts: values },
        check: Object.assign({ kind: 'chart' }, q.check) });
  };

  DATA.pictogram = function (year) {
    const set = pick(CATEGORY_SETS);
    const n = 4;
    const key = year === 1 ? 1 : (year === 2 ? pick([1, 2]) : pick([2, 4, 5, 10]));
    const half = key % 2 === 0 && year >= 3;
    const values = [];
    for (let k = 0; k < n; k++) {
      const symbols = randInt(1, 6) + (half && randInt(0, 2) === 0 ? 0.5 : 0);
      values.push(symbols * key);
    }
    const q = chartQuestion(year, set, values);
    if (!q) return null;
    return sentence('data', year, 'Pictograms', 'DATA', q.prompt + (key > 1 ? ' Each circle stands for ' + key + '.' : ' Each circle stands for 1.'),
      (key > 1 ? 'Count the circles and multiply by ' + key + (half ? '; half a circle is ' + (key / 2) : '') + '. ' : '') + q.why,
      [{ ask: q.answer }], { picture: { kind: 'pictogram', labels: set.labels, values: values, key: key }, check: Object.assign({ kind: 'chart' }, q.check) });
  };

  // Years 2 to 4: block diagrams and bar charts with a scale.
  DATA.bars = function (year) {
    const set = pick(CATEGORY_SETS);
    const step = year === 2 ? 1 : pick([2, 5, 10]);
    const values = [];
    for (let k = 0; k < 4; k++) values.push(step * randInt(1, year === 2 ? 10 : 9) + (year >= 4 && step > 2 && randInt(0, 2) === 0 ? step / 2 : 0));
    if (values.some(function (v) { return v !== Math.floor(v); })) return null;
    const q = chartQuestion(year, set, values);
    if (!q) return null;
    return sentence('data', year, year === 2 ? 'Block diagrams' : 'Bar charts', 'DATA', q.prompt,
      (step > 1 ? 'Each line on the scale is ' + step + '. ' : '') + q.why,
      [{ ask: q.answer }], { picture: { kind: 'bars', labels: set.labels, values: values, step: step, blocks: year === 2 }, check: Object.assign({ kind: 'chart' }, q.check) });
  };

  // Years 2 and 3: tables.
  DATA.table = function (year) {
    const set = pick(CATEGORY_SETS);
    const values = set.labels.map(function () { return randInt(2, year === 2 ? 15 : 40); });
    const q = chartQuestion(year, set, values);
    if (!q) return null;
    return sentence('data', year, 'Tables', 'DATA', q.prompt, q.why, [{ ask: q.answer }],
      { picture: { kind: 'table', head: [set.things, 'number'], rows: set.labels.map(function (l, k) { return [l, String(values[k])]; }) },
        check: Object.assign({ kind: 'chart' }, q.check) });
  };

  // Years 4 and 5: time graphs and line graphs.
  DATA.lineGraph = function (year) {
    const hours = ['9 am', '10 am', '11 am', '12 pm', '1 pm', '2 pm', '3 pm'];
    const values = [];
    let v = randInt(4, 12);
    hours.forEach(function () {
      values.push(v);
      v = Math.max(0, Math.min(30, v + randInt(-3, 5)));
    });
    const i = randInt(0, hours.length - 2);
    const j = randInt(i + 1, hours.length - 1);
    if (randInt(0, 1) && values[j] !== values[i]) {
      const rise = values[j] > values[i];
      return sentence('data', year, 'Line graphs', 'DATA',
        'The graph shows the temperature in a playground. By how many degrees did it ' + (rise ? 'rise' : 'fall') + ' from ' + hours[i] + ' to ' + hours[j] + '?',
        'At ' + hours[i] + ' it was ' + values[i] + ' °C and at ' + hours[j] + ' it was ' + values[j] + ' °C. The difference is ' + Math.abs(values[j] - values[i]) + ' degrees.',
        [{ ask: Math.abs(values[j] - values[i]) }, { t: 'degrees', span: 3 }],
        { picture: { kind: 'line', labels: hours, values: values, step: 5, unit: '°C' }, check: { kind: 'line', op: 'difference', a: i, b: j } });
    }
    return sentence('data', year, 'Line graphs', 'DATA', 'The graph shows the temperature in a playground. What was it at ' + hours[j] + '?',
      'Go up from ' + hours[j] + ' to the line, then across to the scale: ' + values[j] + ' °C.',
      [{ ask: values[j] }, { t: '°C' }], { picture: { kind: 'line', labels: hours, values: values, step: 5, unit: '°C' }, check: { kind: 'line', op: 'read', a: j } });
  };

  // Year 5: timetables.
  DATA.timetable = function (year) {
    const stops = ['Station', 'Market', 'School', 'Park'];
    const buses = 3;
    const rows = [];
    const times = [];
    for (let b = 0; b < buses; b++) {
      let t = 7 * 60 + 30 + b * randInt(25, 50) + randInt(0, 5);
      const row = [];
      stops.forEach(function () {
        row.push(t);
        t += randInt(6, 19);
      });
      times.push(row);
    }
    const text = function (m) { return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };
    stops.forEach(function (stop, s) { rows.push([stop].concat(times.map(function (row) { return text(row[s]); }))); });
    const b = randInt(0, buses - 1);
    const from = randInt(0, stops.length - 2);
    const to = randInt(from + 1, stops.length - 1);
    const minutes = times[b][to] - times[b][from];
    return sentence('data', year, 'Timetables', 'DATA',
      'How many minutes does bus ' + (b + 1) + ' take from ' + stops[from] + ' to ' + stops[to] + '?',
      'Bus ' + (b + 1) + ' leaves ' + stops[from] + ' at ' + text(times[b][from]) + ' and reaches ' + stops[to] + ' at ' + text(times[b][to]) + ': ' + minutes + ' minutes.',
      [{ ask: minutes }, { t: 'min' }],
      { picture: { kind: 'table', head: ['stop', 'bus 1', 'bus 2', 'bus 3'], rows: rows }, check: { kind: 'timetable', bus: b, from: from, to: to } });
  };

  // Year 6: pie charts and the mean.
  DATA.pie = function (year) {
    const total = pick([24, 36, 40, 60, 72, 120]);
    const sets = [[[1, 2], [1, 4], [1, 8], [1, 8]], [[1, 3], [1, 3], [1, 6], [1, 6]], [[1, 4], [1, 4], [1, 4], [1, 4]], [[1, 2], [1, 3], [1, 6]],
      [[1, 3], [1, 4], [1, 4], [1, 6]]];
    const parts = pick(sets.filter(function (s) { return s.every(function (f) { return total % f[1] === 0; }); }));
    const set = pick(CATEGORY_SETS);
    const values = parts.map(function (f) { return total * f[0] / f[1]; });
    const degrees = parts.map(function (f) { return 360 * f[0] / f[1]; });
    const i = randInt(0, parts.length - 1);
    return sentence('data', year, 'Pie charts', 'DATA',
      total + ' children were asked about ' + set.things + '. The pie chart shows their answers. How many chose ' + set.labels[i] + '?',
      'The ' + set.labels[i] + ' slice is ' + degrees[i] + '°, which is ' + parts[i][0] + '/' + parts[i][1] + ' of the circle. ' + parts[i][0] + '/' + parts[i][1] + ' of ' + total +
        ' = ' + values[i] + '.',
      [{ ask: values[i] }],
      { picture: { kind: 'pie', labels: set.labels.slice(0, parts.length), degrees: degrees }, check: { kind: 'pie', total: total, index: i } });
  };

  DATA.mean = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const n = randInt(3, 6);
      const data = [];
      for (let k = 0; k < n; k++) data.push(randInt(1, year === 6 ? 20 : 40));
      const sum = data.reduce(function (s, v) { return s + v; }, 0);
      if (sum % n) continue;
      return sentence('data', year, 'Mean', 'AVERAGES', 'Find the mean of ' + data.join(', ') + '.',
        'Add them: ' + data.join(' + ') + ' = ' + sum + '. Share by how many there are: ' + sum + ' ÷ ' + n + ' = ' + (sum / n) + '.',
        [{ t: 'mean', span: 2 }, { s: '=' }, { ask: sum / n }], { check: { kind: 'stats', measure: 'mean', data: data } });
    }
    return null;
  };

  // Year 7: median, mode and range; probability; scatter graphs.
  DATA.averages = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const measure = pick(['median', 'mode', 'range', 'mean']);
      const n = measure === 'median' ? pick([5, 7]) : randInt(5, 7);
      const data = [];
      for (let k = 0; k < n; k++) data.push(randInt(1, 30));
      if (measure === 'mode') {
        data[1] = data[0];
        data[3] = data[0];
      }
      const sorted = data.slice().sort(function (a, b) { return a - b; });
      let value;
      let why;
      if (measure === 'median') {
        value = sorted[(n - 1) / 2];
        why = 'Put them in order: ' + sorted.join(', ') + '. The middle one is ' + value + '.';
      } else if (measure === 'mode') {
        const counts = {};
        data.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
        const most = Math.max.apply(null, Object.keys(counts).map(function (k) { return counts[k]; }));
        const modes = Object.keys(counts).filter(function (k) { return counts[k] === most; });
        if (modes.length !== 1) continue;
        value = Number(modes[0]);
        why = value + ' comes up most often (' + most + ' times), so it is the mode.';
      } else if (measure === 'range') {
        value = sorted[n - 1] - sorted[0];
        why = 'Largest ' + MINUS + ' smallest: ' + sorted[n - 1] + ' ' + MINUS + ' ' + sorted[0] + ' = ' + value + '.';
      } else {
        const sum = data.reduce(function (s, v) { return s + v; }, 0);
        if (sum % n) continue;
        value = sum / n;
        why = 'Add them: ' + sum + '. Divide by ' + n + ': ' + value + '.';
      }
      return sentence('data', year, 'Averages and range', 'AVERAGES', 'Find the ' + measure + ' of ' + data.join(', ') + '.', why,
        [{ t: measure, span: 2 }, { s: '=' }, { ask: value }], { check: { kind: 'stats', measure: measure, data: data } });
    }
    return null;
  };

  DATA.probability = function (year) {
    const roll = randInt(1, 3);
    if (roll === 1) {
      const colours = ['red', 'blue', 'green', 'yellow'];
      const counts = colours.map(function () { return randInt(1, 6); });
      const total = counts.reduce(function (s, v) { return s + v; }, 0);
      const i = randInt(0, 3);
      const not = randInt(0, 2) === 0;
      const top = not ? total - counts[i] : counts[i];
      const s = simplest(top, total);
      return sentence('data', year, 'Probability', 'PROBABILITY',
        'A bag has ' + counts.map(function (c, k) { return c + ' ' + colours[k]; }).join(', ') + ' counters. One is taken without looking. What is the probability it is ' +
          (not ? 'not ' : '') + colours[i] + '? Give a fraction in its simplest form.',
        (not ? total + ' ' + MINUS + ' ' + counts[i] + ' = ' + top + ' counters are not ' + colours[i] : counts[i] + ' of the ' + total + ' counters are ' + colours[i]) +
          ', so the probability is ' + top + '/' + total + (s[0] !== top ? ' = ' + s[0] + '/' + s[1] : '') + '.',
        [{ t: 'P', span: 1 }, { s: '=' }].concat(fractionTokens(s[0], s[1], true, false)),
        { check: { kind: 'probability', favourable: top, total: total } });
    }
    if (roll === 2) {
      const target = randInt(2, 12);
      let ways = 0;
      for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === target) ways += 1;
      const s = simplest(ways, 36);
      return sentence('data', year, 'Probability', 'PROBABILITY',
        'Two dice are rolled and the scores added. What is the probability of a total of ' + target + '? Give a fraction in its simplest form.',
        'There are 6 × 6 = 36 equally likely outcomes, and ' + ways + ' of them make ' + target + ': ' + ways + '/36' + (s[0] !== ways ? ' = ' + s[0] + '/' + s[1] : '') + '.',
        [{ t: 'P', span: 1 }, { s: '=' }].concat(fractionTokens(s[0], s[1], true, false)),
        { check: { kind: 'dice', target: target } });
    }
    const p = pick([[1, 4], [2, 5], [3, 10], [1, 3], [5, 8], [7, 12]]);
    return sentence('data', year, 'Probability', 'PROBABILITY',
      'The probability that it rains tomorrow is ' + p[0] + '/' + p[1] + '. What is the probability that it does not rain?',
      'The probabilities of all the outcomes add up to 1: 1 ' + MINUS + ' ' + p[0] + '/' + p[1] + ' = ' + (p[1] - p[0]) + '/' + p[1] + '.',
      [{ t: 'P', span: 1 }, { s: '=' }, { frac: [{ ask: p[1] - p[0] }, { ask: p[1] }] }], { check: { kind: 'probability', favourable: p[1] - p[0], total: p[1] } });
  };

  // Pearson's r, so a drawn graph is clearly one kind or the other.
  function correlation(points) {
    const n = points.length;
    const mx = points.reduce(function (t, p) { return t + p[0]; }, 0) / n;
    const my = points.reduce(function (t, p) { return t + p[1]; }, 0) / n;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    points.forEach(function (p) {
      sxy += (p[0] - mx) * (p[1] - my);
      sxx += (p[0] - mx) * (p[0] - mx);
      syy += (p[1] - my) * (p[1] - my);
    });
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
  }

  DATA.scatter = function (year) {
    const trend = pick(['positive', 'negative', 'none']);
    let points;
    let r;
    do {
      points = [];
      for (let k = 0; k < 12; k++) {
        const x = randInt(1, 20);
        const noise = randInt(-3, 3);
        const y = trend === 'positive' ? x + noise + 2 : (trend === 'negative' ? 22 - x + noise : randInt(1, 21));
        points.push([x, Math.max(0, y)]);
      }
      r = correlation(points);
    } while (trend === 'none' ? Math.abs(r) > 0.25 : (trend === 'positive' ? r < 0.8 : r > -0.8));
    const options = [[1, 'positive'], [2, 'negative'], [3, 'no correlation']];
    return sentence('data', year, 'Scatter graphs', 'DATA', 'What kind of correlation does the scatter graph show?',
      trend === 'positive' ? 'As one value goes up, so does the other: positive correlation.'
        : (trend === 'negative' ? 'As one value goes up, the other goes down: negative correlation.' : 'The points show no clear pattern: no correlation.'),
      [{ pick: { positive: 1, negative: 2, none: 3 }[trend], options: options }], { picture: { kind: 'scatter', points: points }, check: { kind: 'scatter', trend: trend } });
  };

  const DATA_KINDS = {
    1: [[3, 'tally'], [3, 'pictogram']],
    2: [[2, 'tally'], [2, 'pictogram'], [2, 'bars'], [2, 'table']],
    3: [[3, 'bars'], [3, 'pictogram'], [2, 'table']],
    4: [[3, 'bars'], [3, 'lineGraph'], [1, 'pictogram'], [1, 'table']],
    5: [[3, 'lineGraph'], [3, 'timetable'], [2, 'bars']],
    6: [[3, 'pie'], [3, 'mean'], [2, 'lineGraph']],
    7: [[3, 'averages'], [3, 'probability'], [2, 'scatter'], [1, 'pie']]
  };

  DATA.drawChart = DRAW.chart;
  DATA.drawPie = DRAW.pie;
  [1, 2, 3, 4, 5, 6, 7].forEach(function (year) { DATA_KINDS[year].push([3, 'drawChart']); });
  DATA_KINDS[6].push([2, 'drawPie']);
  DATA_KINDS[7].push([1, 'drawPie']);

  Engine.addArea('data', chooser(DATA, DATA_KINDS, 'data'));

  /* Algebra: the equals sign, function machines and sequences first, then
     letters, formulae and equations (Year 6), then manipulating expressions
     and straight-line graphs (Year 7). */

  function term(coefficient, letter, first) {
    if (coefficient === 0) return '';
    const size = Math.abs(coefficient);
    const body = (size === 1 && letter ? '' : String(size)) + (letter || '');
    if (first) return (coefficient < 0 ? MINUS : '') + body;
    return (coefficient < 0 ? ' ' + MINUS + ' ' : ' + ') + body;
  }

  // An expression such as 3a + 2b - 5 as text, from [coefficient, letter]
  // pairs (letter '' for a number on its own).
  function expression(terms) {
    let text = '';
    terms.forEach(function (t) {
      const part = term(t[0], t[1], text === '');
      text += part;
    });
    return text || '0';
  }

  const ALGEBRA = {};

  // Years 1 to 5: both sides of = balance.
  ALGEBRA.balance = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const top = { 1: 20, 2: 100, 3: 100, 4: 200, 5: 1000 }[year];
      const multiply = year >= 3 && randInt(0, 1) === 1;
      if (multiply) {
        const a = randInt(2, 12);
        const b = randInt(2, 12);
        const product = a * b;
        const c = pick([2, 3, 4, 6].filter(function (x) { return product % x === 0 && x !== a && x !== b; }).concat([0]));
        if (!c) continue;
        return sentence('algebra', year, 'Balancing', 'EQUALS', 'Both sides are equal. What number goes in the box?',
          a + ' × ' + b + ' = ' + product + ', so ' + c + ' × ? must be ' + product + ' too: ' + product + ' ÷ ' + c + ' = ' + (product / c) + '.',
          [{ n: a }, { s: '×' }, { n: b }, { s: '=' }, { n: c }, { s: '×' }, { ask: product / c }]);
      }
      const a = randInt(1, top / 2);
      const b = randInt(1, top / 2);
      const c = randInt(1, a + b - 1);
      const d = a + b - c;
      if (d <= 0 || c === a || c === b) continue;
      return sentence('algebra', year, 'Balancing', 'EQUALS', 'Both sides are equal. What number goes in the box?',
        a + ' + ' + b + ' = ' + (a + b) + ', so ' + c + ' + ? must be ' + (a + b) + ' too: ' + (a + b) + ' ' + MINUS + ' ' + c + ' = ' + d + '.',
        [{ n: a }, { s: '+' }, { n: b }, { s: '=' }, { n: c }, { s: '+' }, { ask: d }]);
    }
    return null;
  };

  // Years 1 to 4: function machines, one or two steps, forwards or back.
  function applyOp(value, op) {
    if (op[0] === '+') return value + op[1];
    if (op[0] === MINUS) return value - op[1];
    if (op[0] === '×') return value * op[1];
    return value / op[1];
  }

  // Years 3 to 5: the rule is not given. Two numbers have been through the
  // machine; work out what it does and what comes out for a third. Only one
  // rule of the kind + n, − n or × n fits both pairs.
  function machineFromPairs(year) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const sym = pick(['+', MINUS, '×']);
      const n = sym === '×' ? randInt(2, year === 3 ? 5 : 10) : randInt(2, year === 3 ? 20 : 50);
      const ins = [];
      while (ins.length < 3) {
        const x = randInt(sym === MINUS ? n + 1 : 1, sym === '×' ? 12 : n + 40);
        if (ins.indexOf(x) === -1) ins.push(x);
      }
      const outs = ins.map(function (x) { return applyOp(x, [sym, n]); });
      if (outs.some(function (y) { return y <= 0 || y > 200; })) continue;
      const rule = { '+': 'adds ' + n, '×': 'multiplies by ' + n }[sym] || 'takes away ' + n;
      const pair = function (k, asked) { return [{ n: ins[k] }, { s: '→' }, asked ? { ask: outs[k] } : { n: outs[k] }]; };
      return K.buildSentenceLines({
        area: 'algebra', year: year, title: 'Function machines', stage: 'MACHINE',
        prompt: 'The machine does the same thing to every number. Two numbers have been through it. What comes out when ' + ins[2] + ' goes in?',
        why: ins[0] + ' becomes ' + outs[0] + ' and ' + ins[1] + ' becomes ' + outs[1] + ', so the machine ' + rule + '. ' + ins[2] + ' ' + sym + ' ' + n + ' = ' + outs[2] + '.',
        lines: [pair(0, false), pair(1, false), pair(2, true)],
        check: { kind: 'machinePairs' },
        examples: 2
      });
    }
    return null;
  }

  ALGEBRA.machine = function (year) {
    if (year >= 3 && randInt(0, 2) === 0) return machineFromPairs(year);
    for (let attempt = 0; attempt < 500; attempt++) {
      const steps = year >= 3 ? 2 : 1;
      const choices = year === 1 ? ['+', MINUS] : ['+', MINUS, '×', '÷'];
      const ops = [];
      for (let k = 0; k < steps; k++) {
        const sym = pick(choices);
        ops.push([sym, sym === '×' || sym === '÷' ? pick(year === 2 ? [2, 5, 10] : [2, 3, 4, 5, 10]) : randInt(1, year === 1 ? 9 : 20)]);
      }
      const input = randInt(1, year === 1 ? 10 : 20) * (ops[0][0] === '÷' ? ops[0][1] : 1);
      let value = input;
      let ok = true;
      ops.forEach(function (op) {
        value = applyOp(value, op);
        if (value !== Math.floor(value) || value < 0) ok = false;
      });
      if (!ok || value > 200) continue;
      const backwards = year >= 2 && randInt(0, 2) === 0;
      const opText = ops.map(function (op) { return op[0] + ' ' + op[1]; }).join(', then ');
      return sentence('algebra', year, 'Function machines', 'MACHINE',
        backwards ? 'The machine does ' + opText + '. ' + value + ' came out. What went in?' : 'The machine does ' + opText + '. ' + input + ' goes in. What comes out?',
        backwards ? 'Work backwards with the inverse: ' + ops.slice().reverse().map(function (op) {
          return { '+': MINUS, '×': '÷', '÷': '×' }[op[0]] ? ({ '+': MINUS, '×': '÷', '÷': '×' }[op[0]] + ' ' + op[1]) : ('+ ' + op[1]);
        }).join(', then ') + ' takes ' + value + ' back to ' + input + '.'
          : input + ' ' + opText + ' gives ' + value + '.',
        backwards ? [{ ask: input }, { s: '→' }, { t: opText.replace(', then ', ' '), span: steps === 2 ? 3 : 2 }, { s: '→' }, { n: value }]
          : [{ n: input }, { s: '→' }, { t: opText.replace(', then ', ' '), span: steps === 2 ? 3 : 2 }, { s: '→' }, { ask: value }],
        { check: { kind: 'machine', input: input, ops: ops, find: backwards ? 'in' : 'out' } });
    }
    return null;
  };

  // Years 1 and 2: repeating patterns of shapes.
  ALGEBRA.pattern = function (year) {
    const shapes = ['circle', 'square', 'triangle'];
    const unit = year === 1 ? shuffle(shapes).slice(0, 2) : shuffle(shapes.concat(['circle'])).slice(0, 3);
    const shown = [];
    const length = unit.length * 2 + randInt(0, unit.length - 1);
    for (let k = 0; k < length; k++) shown.push(unit[k % unit.length]);
    const next = unit[length % unit.length];
    const options = shapes.map(function (s, k) { return [k + 1, s]; });
    return sentence('algebra', year, 'Patterns', 'PATTERNS', 'The pattern repeats. Which shape comes next?',
      'The pattern repeats ' + unit.join(', ') + '. After ' + shown[shown.length - 1] + ' comes ' + next + '.',
      [{ t: 'next:', span: 2 }, { pick: shapes.indexOf(next) + 1, options: options }],
      { picture: { kind: 'pattern', shapes: shown }, check: { kind: 'pattern', shapes: shown, unit: unit.length } });
  };

  // Years 3 to 6: sequences: the rule, then a later term.
  ALGEBRA.sequence = function (year) {
    const first = randInt(1, 20);
    const diff = randInt(year >= 5 ? -9 : 2, 12);
    if (diff === 0 || (diff < 0 && first + 10 * diff < 0 && year < 6)) return null;
    const terms = [first, first + diff, first + 2 * diff, first + 3 * diff];
    if (year <= 3 || randInt(0, 1)) {
      if (diff < 0) return null;
      return sentence('algebra', year, 'Sequences', 'SEQUENCES', terms.join(', ') + ', ... What is added each time?',
        terms[1] + ' ' + MINUS + ' ' + terms[0] + ' = ' + diff + ', and every step is the same: add ' + diff + '.',
        [{ n: terms[0] }, { s: ',' }, { n: terms[1] }, { s: ',' }, { n: terms[2] }, { s: ':' }, { t: 'add', span: 1 }, { ask: diff }],
        { check: { kind: 'sequenceRule', terms: terms } });
    }
    const n = pick([10, 12, 15, 20]);
    const value = first + (n - 1) * diff;
    return sentence('algebra', year, 'Sequences', 'SEQUENCES',
      terms.map(int).join(', ') + ', ... What is the ' + n + 'th term?',
      'The terms go up by ' + diff + ' each time. The ' + n + 'th term is the first term plus ' + (n - 1) + ' steps: ' + first + ' + ' + (n - 1) + ' × ' + int(diff) + ' = ' + int(value) + '.',
      [{ t: n + 'th', span: 2 }, { s: '=' }, { ask: int(value), sign: value < 0 || diff < 0 }],
      { check: { kind: 'sequenceTerm', terms: terms, n: n } });
  };

  /* Symbols and letters. A symbol stands in for a number: each question
     says which number, or asks for it, and the symbol changes from question
     to question, so no symbol seems to have a value of its own. Within one
     question the same symbol is always the same number. */

  const STAND_INS = ['★', '▲', '●', '■', '♦'];

  function standIn(year) {
    return year <= 4 ? pick(STAND_INS) : pick(['a', 'b', 'n', 'x', 'y']);
  }

  const SYMBOL_IDEA = ' A symbol stands for a number. Each question says which number, or asks you to find it, so it can be a different number every time.';
  const LETTER_IDEA = ' A letter stands for a number, the same way a symbol does. Each question says which number, or asks you to find it.';

  function ideaFor(letter) {
    return STAND_INS.indexOf(letter) !== -1 ? SYMBOL_IDEA : LETTER_IDEA;
  }

  // "★ + ★ + 4" or "3n + 4": `times` lots of the symbol, then + c.
  function lotsText(letter, times, c) {
    const symbol = STAND_INS.indexOf(letter) !== -1;
    return (symbol ? new Array(times).fill(letter).join(' + ') : times + letter) + (c ? ' + ' + c : '');
  }

  // The same as sentence tokens: each symbol in a cell of its own, or a term
  // such as 3n in one cell.
  function lotsTokens(letter, times, c) {
    const symbol = STAND_INS.indexOf(letter) !== -1;
    const tokens = [];
    if (symbol) {
      for (let k = 0; k < times; k++) {
        if (k) tokens.push({ s: '+' });
        tokens.push({ v: letter });
      }
    } else {
      tokens.push({ v: times + letter, span: times >= 10 ? 2 : 1 });
    }
    return c ? tokens.concat([{ s: '+' }, { n: c }]) : tokens;
  }

  // The working for one value: "8 + 8 + 4 = 20", or "3 × 8 + 4 = 28".
  function putIn(letter, times, c, value) {
    const symbol = STAND_INS.indexOf(letter) !== -1;
    const product = times * value;
    const body = symbol ? new Array(times).fill(value).join(' + ') : times + ' × ' + value;
    return body + (c ? ' + ' + c : '') + ' = ' + (c ? product + ' + ' + c + ' = ' : '') + (product + c);
  }

  // Years 4 and 5: the question says what the symbol stands for, written on
  // the page as its first line; put that number in and work it out.
  ALGEBRA.symbols = function (year) {
    const value = randInt(2, 12);
    const letter = standIn(year);
    const times = year === 4 ? randInt(2, 3) : randInt(2, 5);
    const c = randInt(1, 15);
    const symbol = STAND_INS.indexOf(letter) !== -1;
    return K.buildSentenceLines({
      area: 'algebra', year: year, title: year === 4 ? 'Symbols' : 'Letters', stage: 'ALGEBRA',
      prompt: 'In this question ' + letter + ' stands for ' + value + '. Work out ' + lotsText(letter, times, c) + '.',
      why: (symbol ? '' : times + letter + ' means ' + times + ' × ' + letter + '. ') + 'Put ' + value + ' in place of ' +
        (symbol ? 'each ' : '') + letter + ': ' + putIn(letter, times, c, value) + '.' + ideaFor(letter),
      lines: [[{ v: letter }, { s: '=' }, { n: value }], lotsTokens(letter, times, c).concat([{ s: '=' }, { ask: times * value + c }])],
      check: { kind: 'symbolValue', letter: letter },
      examples: 2
    });
  };

  // Years 2 to 5: find the number a symbol stands for. Two of the same
  // symbol in one question are the same number.
  ALGEBRA.unknown = function (year) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const letter = standIn(year);
      const symbol = STAND_INS.indexOf(letter) !== -1;
      const roll = year === 2 ? randInt(1, 2) : randInt(1, year === 3 ? 3 : 4);
      let lhs;
      let right;
      let value;
      let why;
      if (roll === 1) {
        value = randInt(2, year === 2 ? 15 : 40);
        const c = randInt(2, year === 2 ? 9 : 30);
        lhs = [{ v: letter }, { s: '+' }, { n: c }];
        right = value + c;
        why = letter + ' + ' + c + ' = ' + right + ', so ' + letter + ' is ' + c + ' less than ' + right + ': ' + right + ' ' + MINUS + ' ' + c + ' = ' + value + '.';
      } else if (roll === 2) {
        const c = randInt(2, year === 2 ? 9 : 30);
        value = c + randInt(2, year === 2 ? 10 : 40);
        lhs = [{ v: letter }, { s: MINUS }, { n: c }];
        right = value - c;
        why = letter + ' ' + MINUS + ' ' + c + ' = ' + right + ', so ' + letter + ' is ' + c + ' more than ' + right + ': ' + right + ' + ' + c + ' = ' + value + '.';
      } else if (roll === 3) {
        const k = randInt(2, year === 3 ? 10 : 12);
        value = randInt(2, 12);
        lhs = symbol ? [{ n: k }, { s: '×' }, { v: letter }] : [{ v: k + letter, span: k >= 10 ? 2 : 1 }];
        right = k * value;
        why = (symbol ? k + ' × ' + letter : k + letter + ' means ' + k + ' × ' + letter + ', and ' + k + letter) + ' = ' + right +
          ', so ' + letter + ' = ' + right + ' ÷ ' + k + ' = ' + value + '.';
      } else {
        const times = symbol ? 2 : randInt(2, 6);
        const c = randInt(1, 20);
        value = randInt(2, 15);
        lhs = lotsTokens(letter, times, c);
        right = times * value + c;
        why = 'Take ' + c + ' away first: ' + lotsText(letter, times, 0) + ' = ' + right + ' ' + MINUS + ' ' + c + ' = ' + (right - c) +
          '. ' + (symbol ? 'Two ' + letter + ' are the same number, so ' : 'Then ') + letter + ' = ' + (right - c) + ' ÷ ' + times + ' = ' + value + '.';
      }
      const left = lhs.map(function (token) {
        return token.v !== undefined ? token.v : (token.s !== undefined ? token.s : String(token.n));
      }).join(' ');
      return K.buildSentenceLines({
        area: 'algebra', year: year, title: symbol ? 'Find the symbol' : 'Find the letter', stage: 'ALGEBRA',
        prompt: left + ' = ' + right + '. What number does ' + letter + ' stand for in this question?',
        why: why + ideaFor(letter),
        lines: [lhs.concat([{ s: '=' }, { n: right }]), [{ v: letter }, { s: '=' }, { ask: value }]],
        check: { kind: 'findSymbol' },
        examples: 2
      });
    }
    return null;
  };

  // Years 4 to 6: two worked lines with different numbers for the same
  // symbol, then a third to work out.
  ALGEBRA.symbolLines = function (year) {
    const letter = standIn(year);
    const symbol = STAND_INS.indexOf(letter) !== -1;
    // Three symbols, two-digit numbers and + c fill more than a phone's 15
    // cells, so a line of symbols has two of them.
    const times = symbol ? 2 : randInt(2, year === 6 ? 9 : 5);
    const c = randInt(0, 12);
    const values = shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).slice(0, 3);
    const line = function (value, asked) {
      return [{ v: letter }, { s: '=' }, { n: value }, { s: ',' }].concat(lotsTokens(letter, times, c), [{ s: '=' },
        asked ? { ask: times * value + c } : { n: times * value + c }]);
    };
    return K.buildSentenceLines({
      area: 'algebra', year: year, title: symbol ? 'Symbols' : 'Letters', stage: 'ALGEBRA',
      prompt: 'The same ' + (symbol ? 'symbol' : 'letter') + ' stands for a different number on each line. The first two lines are worked out. Work out the third.',
      why: 'On this line ' + letter + ' = ' + values[2] + '. Put ' + values[2] + ' in place of ' + (symbol ? 'each ' : '') + letter + ': ' +
        putIn(letter, times, c, values[2]) + '.' + ideaFor(letter),
      lines: [line(values[0], false), line(values[1], false), line(values[2], true)],
      check: { kind: 'symbolLines', letter: letter },
      examples: 2
    });
  };

  // Year 6: simple formulae, one- and two-step equations, two unknowns and
  // counting combinations.
  ALGEBRA.formula = function (year) {
    if (randInt(0, 1)) {
      const l = randInt(2, 15);
      const w = randInt(2, 12);
      return sentence('algebra', year, 'Formulae', 'FORMULAE', 'P = 2l + 2w gives the perimeter of a rectangle. Find P when l = ' + l + ' and w = ' + w + '.',
        'P = 2 × ' + l + ' + 2 × ' + w + ' = ' + (2 * l) + ' + ' + (2 * w) + ' = ' + (2 * l + 2 * w) + '.',
        [{ t: 'P', span: 1 }, { s: '=' }, { ask: 2 * l + 2 * w }], { check: { kind: 'value', expr: '2*' + l + '+2*' + w } });
    }
    const rate = randInt(2, 9);
    const fixed = randInt(3, 20);
    const hours = randInt(2, 8);
    return sentence('algebra', year, 'Formulae', 'FORMULAE',
      'Bike hire costs £' + fixed + ' plus £' + rate + ' per hour: C = ' + rate + 'h + ' + fixed + '. Find C for ' + hours + ' hours.',
      'C = ' + rate + ' × ' + hours + ' + ' + fixed + ' = ' + (rate * hours) + ' + ' + fixed + ' = ' + (rate * hours + fixed) + '.',
      [{ t: 'C = £', span: 2 }, { ask: rate * hours + fixed }], { check: { kind: 'value', expr: rate + '*' + hours + '+' + fixed } });
  };

  ALGEBRA.solve = function (year) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const letter = pick(['n', 'x', 'a', 'y']);
      const value = year >= 7 ? randInt(-9, 12) : randInt(2, 15);
      if (value === 0) continue;
      const roll = randInt(1, year >= 7 ? 4 : 3);
      let left;
      let right;
      let why;
      if (roll === 1) {
        const c = randInt(2, 20);
        left = letter + ' + ' + c;
        right = value + c;
        why = 'Take ' + c + ' from both sides: ' + letter + ' = ' + right + ' ' + MINUS + ' ' + c + ' = ' + int(value) + '.';
      } else if (roll === 2) {
        const k = randInt(2, 9);
        left = k + letter;
        right = k * value;
        why = 'Divide both sides by ' + k + ': ' + letter + ' = ' + int(right) + ' ÷ ' + k + ' = ' + int(value) + '.';
      } else if (roll === 3) {
        const k = randInt(2, 9);
        const c = randInt(1, 20);
        const sub = randInt(0, 1) === 1;
        left = expression([[k, letter], [sub ? -c : c, '']]);
        right = k * value + (sub ? -c : c);
        why = (sub ? 'Add ' + c + ' to' : 'Take ' + c + ' from') + ' both sides: ' + k + letter + ' = ' + int(k * value) + '. Divide by ' + k + ': ' + letter + ' = ' + int(value) + '.';
      } else {
        const k = randInt(3, 9);
        const m = randInt(1, k - 1);
        const c = randInt(1, 20);
        const d = (k - m) * value + c;
        left = expression([[k, letter], [c, '']]);
        right = expression([[m, letter], [d, '']]);
        why = 'Take ' + expression([[m, letter]]) + ' from both sides: ' + expression([[k - m, letter], [c, '']]) + ' = ' + int(d) + '. Take ' + c + ': ' +
          expression([[k - m, letter]]) + ' = ' + int(d - c) + '. Divide by ' + (k - m) + ': ' + letter + ' = ' + int(value) + '.';
      }
      const rightText = typeof right === 'number' ? int(right) : right;
      return sentence('algebra', year, 'Equations', 'EQUATIONS', 'Solve ' + left + ' = ' + rightText + '.', why,
        [{ t: letter }, { s: '=' }, { ask: int(value), sign: year >= 7 }],
        { picture: { kind: 'words', text: left + ' = ' + rightText }, check: { kind: 'solve', left: left, right: String(rightText), letter: letter } });
    }
    return null;
  };

  ALGEBRA.twoUnknowns = function (year) {
    const a = randInt(3, 15);
    const b = randInt(1, a - 1);
    return sentence('algebra', year, 'Two unknowns', 'EQUATIONS',
      'a + b = ' + (a + b) + ' and a ' + MINUS + ' b = ' + (a - b) + '. Find a and b.',
      'Add the two equations: 2a = ' + (a + b) + ' + ' + (a - b) + ' = ' + (2 * a) + ', so a = ' + a + '. Then b = ' + (a + b) + ' ' + MINUS + ' ' + a + ' = ' + b + '.',
      [{ t: 'a', span: 1 }, { s: '=' }, { ask: a, sub: 'Type a.' }, { s: ',' }, { t: 'b', span: 1 }, { s: '=' }, { ask: b, sub: 'Now b.' }],
      { check: { kind: 'system', sum: a + b, diff: a - b } });
  };

  ALGEBRA.combinations = function (year) {
    const sum = randInt(5, 15);
    const least = randInt(0, 1);
    const count = sum - 2 * least + 1;
    return sentence('algebra', year, 'Combinations', 'ALGEBRA',
      'a and b are whole numbers' + (least ? ' of at least 1' : ', 0 or more') + ', and a + b = ' + sum + '. How many different pairs (a, b) are there?',
      'a can be any number from ' + least + ' to ' + (sum - least) + ', and then b is fixed: that is ' + count + ' pairs.',
      [{ ask: count }, { t: 'pairs', span: 2 }], { check: { kind: 'pairs', sum: sum, least: least } });
  };

  // Year 7: substitution with negatives, collecting like terms, expanding
  // and factorising, the nth term, and straight-line graphs.
  ALGEBRA.substitute = function (year) {
    const a = randInt(-6, 6);
    const b = randInt(-5, 8);
    if (!a || !b) return null;
    const p = randInt(2, 5);
    const q = randInt(1, 9);
    const value = p * a * a - q * b;
    return sentence('algebra', year, 'Substitution', 'ALGEBRA',
      'Find ' + p + 'a² ' + MINUS + ' ' + q + 'b when a = ' + int(a) + ' and b = ' + int(b) + '.',
      'a² = ' + int(a) + ' × ' + int(a) + ' = ' + (a * a) + ', so ' + p + 'a² = ' + (p * a * a) + '. ' + q + 'b = ' + int(q * b) + '. ' + (p * a * a) + ' ' + MINUS + ' ' +
        (q * b < 0 ? '(' + int(q * b) + ')' : q * b) + ' = ' + int(value) + '.',
      [{ ask: int(value), sign: true }], { picture: { kind: 'words', text: p + 'a² ' + MINUS + ' ' + q + 'b' }, check: { kind: 'value', expr: p + '*(' + a + ')^2-' + q + '*(' + b + ')' } });
  };

  ALGEBRA.collect = function (year) {
    const a1 = randInt(1, 9);
    const a2 = randInt(-6, 9);
    const b1 = randInt(1, 9);
    const b2 = randInt(-8, 9);
    if (!a2 || !b2 || a1 + a2 <= 0 || b1 + b2 <= 0) return null;
    const left = expression([[a1, 'a'], [b1, 'b'], [a2, 'a'], [b2, 'b']]);
    const tokens = [{ ask: a1 + a2, sub: 'Type how many a.' }, { t: 'a', span: 1 }, { s: '+' }, { ask: b1 + b2, sub: 'Now how many b.' }, { t: 'b', span: 1 }];
    return sentence('algebra', year, 'Collecting like terms', 'ALGEBRA', 'Simplify ' + left + '.',
      'Collect the a terms: ' + a1 + ' ' + (a2 < 0 ? MINUS + ' ' + Math.abs(a2) : '+ ' + a2) + ' = ' + (a1 + a2) + '. Collect the b terms: ' + b1 + ' ' +
        (b2 < 0 ? MINUS + ' ' + Math.abs(b2) : '+ ' + b2) + ' = ' + (b1 + b2) + '. So ' + expression([[a1 + a2, 'a'], [b1 + b2, 'b']]) + '.',
      tokens, { picture: { kind: 'words', text: left }, check: { kind: 'collect', left: left } });
  };

  ALGEBRA.brackets = function (year) {
    const k = randInt(2, 9);
    const p = randInt(1, 5);
    const c = randInt(1, 9);
    if (randInt(0, 1)) {
      return sentence('algebra', year, 'Expanding brackets', 'ALGEBRA', 'Expand ' + k + '(' + (p === 1 ? '' : p) + 'x + ' + c + ').',
        'Multiply each term inside by ' + k + ': ' + k + ' × ' + (p === 1 ? '' : p) + 'x = ' + (k * p) + 'x and ' + k + ' × ' + c + ' = ' + (k * c) + '.',
        [{ ask: k * p, sub: 'Type the number of x.' }, { t: 'x', span: 1 }, { s: '+' }, { ask: k * c, sub: 'Now the number on its own.' }],
        { picture: { kind: 'words', text: k + '(' + (p === 1 ? '' : p) + 'x + ' + c + ')' }, check: { kind: 'expand', left: k + '(' + p + 'x + ' + c + ')' } });
    }
    if (gcd(p, c) !== 1) return null;
    return sentence('algebra', year, 'Factorising', 'ALGEBRA', 'Factorise ' + (k * p) + 'x + ' + (k * c) + ' fully.',
      'The highest common factor of ' + (k * p) + ' and ' + (k * c) + ' is ' + k + ': ' + (k * p) + 'x + ' + (k * c) + ' = ' + k + '(' + (p === 1 ? '' : p) + 'x + ' + c + ').',
      [{ ask: k, sub: 'Type the factor outside the bracket.' }, { s: '(' }, { ask: p, sub: 'Now the number of x.' }, { t: 'x', span: 1 }, { s: '+' }, { ask: c, sub: 'Now the number on its own.' }, { s: ')' }],
      { picture: { kind: 'words', text: (k * p) + 'x + ' + (k * c) }, check: { kind: 'factorise', left: (k * p) + 'x+' + (k * c) } });
  };

  ALGEBRA.nthTerm = function (year) {
    const a = randInt(2, 9);
    const b = randInt(-5, 9);
    const terms = [1, 2, 3, 4].map(function (n) { return a * n + b; });
    if (terms[0] <= 0) return null;
    return sentence('algebra', year, 'nth term', 'SEQUENCES', 'Find the nth term of ' + terms.join(', ') + ', ...',
      'The terms go up by ' + a + ', so it starts ' + a + 'n. ' + a + ' × 1 = ' + a + ', and the first term is ' + terms[0] + ', so add ' + int(b) + ': ' + a + 'n' +
        (b < 0 ? ' ' + MINUS + ' ' + Math.abs(b) : ' + ' + b) + '.',
      [{ ask: a, sub: 'Type the number in front of n.' }, { t: 'n', span: 1 }, { signBox: b < 0 ? MINUS : '+' }, { ask: Math.abs(b), sub: 'Now the number added or taken away.' }],
      { check: { kind: 'nthTerm', terms: terms } });
  };

  ALGEBRA.graph = function (year) {
    const m = randInt(-5, 6);
    const c = randInt(-9, 9);
    if (!m) return null;
    const equation = 'y = ' + expression([[m, 'x'], [c, '']]);
    if (randInt(0, 1)) {
      const x = randInt(-4, 6);
      const y = m * x + c;
      return sentence('algebra', year, 'Straight-line graphs', 'GRAPHS', 'On the line ' + equation + ', what is y when x = ' + int(x) + '?',
        'Put x = ' + int(x) + ' into ' + equation + ': y = ' + m + ' × ' + (x < 0 ? '(' + int(x) + ')' : x) + (c < 0 ? ' ' + MINUS + ' ' + Math.abs(c) : ' + ' + c) + ' = ' + int(y) + '.',
        [{ t: 'y', span: 1 }, { s: '=' }, { ask: int(y), sign: true }], { picture: { kind: 'words', text: equation }, check: { kind: 'value', expr: m + '*(' + x + ')+(' + c + ')' } });
    }
    return sentence('algebra', year, 'Straight-line graphs', 'GRAPHS', 'For the line ' + equation + ', what are the gradient and the y-intercept?',
      'In y = mx + c, m is the gradient and c is where the line crosses the y-axis: gradient ' + int(m) + ', y-intercept ' + int(c) + '.',
      [{ t: 'm', span: 1 }, { s: '=' }, { ask: int(m), sign: true, sub: 'Type the gradient.' }, { s: ',' }, { t: 'c', span: 1 }, { s: '=' }, { ask: int(c), sign: true, sub: 'Now the y-intercept.' }],
      { picture: { kind: 'words', text: equation }, check: { kind: 'gradient', m: m, c: c, equation: equation } });
  };

  const ALGEBRA_KINDS = {
    1: [[3, 'balance'], [3, 'machine'], [2, 'pattern']],
    2: [[3, 'balance'], [3, 'machine'], [2, 'pattern'], [2, 'unknown']],
    3: [[2, 'balance'], [3, 'machine'], [3, 'sequence'], [2, 'unknown']],
    4: [[1, 'balance'], [2, 'machine'], [2, 'sequence'], [2, 'unknown'], [2, 'symbols'], [2, 'symbolLines']],
    5: [[1, 'balance'], [2, 'sequence'], [2, 'unknown'], [2, 'symbols'], [2, 'symbolLines'], [2, 'formula']],
    6: [[2, 'formula'], [2, 'sequence'], [3, 'solve'], [2, 'twoUnknowns'], [1, 'combinations'], [1, 'symbolLines']],
    7: [[2, 'substitute'], [2, 'collect'], [2, 'brackets'], [2, 'solve'], [2, 'nthTerm'], [2, 'graph']]
  };

  ALGEBRA.plotLine = DRAW.plotLine;
  ALGEBRA_KINDS[7].push([2, 'plotLine']);

  Engine.addArea('algebra', chooser(ALGEBRA, ALGEBRA_KINDS, 'algebra'));
});
