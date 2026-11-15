# Digit Stack

A keyboard-first browser maths game set by school year from Year 1 to Year 7: written methods for addition, subtraction, multiplication and division, then number, fractions, measures, shape, data and algebra, word problems, and a timed mixed test. Content and written layouts follow the national curriculum in England and its Mathematics Appendix 1.

Each year is pitched for a strong pupil in that year: its own content at the top of the range, plus some of the next year's, plus missing-number problems from Year 1. The programmes of study set one programme for the majority of pupils and say pupils who grasp concepts rapidly should get "rich and sophisticated problems before any acceleration through new content".

## Run it

Play it at https://digitalcybersoft.github.io/digit-stack/.

Guides with screenshots: [for students](https://digitalcybersoft.github.io/digit-stack/guide/students.html) and [for parents and teachers](https://digitalcybersoft.github.io/digit-stack/guide/parents-and-teachers.html). The parent and teacher guide has the full table of what each year covers.

To run it locally, open `index.html` directly in a modern browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Areas

Eleven areas, opened with `1` to `9`, `0` and `W` on the start screen. Each starts at the school year and moves up on its own.

| Key | Area | Covers |
| --- | --- | --- |
| `1` | Divide | Sharing, facts, short and long division, decimal answers and remainders as fractions (Year 6), negatives (Year 7) |
| `2` | Multiply | Groups and tables to 12 x 12, short and long multiplication, decimals, negatives (Year 7) |
| `3` | Add | Sentences and missing numbers, column addition, estimates, decimals, numbers below zero |
| `4` | Subtract | The same, with column subtraction by crossing out |
| `5` | Number | Place value, counting, comparing, rounding, Roman numerals, primes, powers, order of operations, standard form |
| `6` | Fractions | Fractions, decimals and percentages; ratio and proportion from Year 6 |
| `7` | Measures | Money, time, length, mass, capacity, perimeter, area, volume, speed |
| `8` | Shape | 2-D and 3-D shapes, turns, angles, symmetry, coordinates, transformations, Pythagoras, trigonometry |
| `9` | Data | Tally charts, pictograms, bar and line graphs, timetables, pie charts, averages, probability |
| `0` | Algebra | Balancing, machines, patterns, symbols and letters standing for numbers, sequences, formulae, equations, expressions, graphs |
| `W` | Word problems | Stories: one step in Year 1; money, change, scaling and combinations in Years 2 and 3; two steps in Year 4; remainders, rates and fractions of amounts in Year 5; percentages, ratio, proportion and missing numbers in Year 6; best buys, interest, percentage change and speed in Year 7. A working line for each step while learning; a test marks the answer line |

Decimals follow the curriculum: tenths as fractions in Year 3, decimal notation from Year 4, up to 3 places from Year 5.

## Watch, learn, then test

Every area and year has three stages, and the game moves between them by itself.

1. **Watch (worked example).** The first time a year is opened in an area, the game works one example for each kind of question that year uses (two with different numbers for an idea such as a symbol standing for a number), shortest first, filling in one box per step with the reason for it. `→` or `Enter` steps forward, `←` back, `N` skips. While learning, `W` replays it and returns to the same box. Tests have no examples.
2. **Learn (guided).** The game takes the child through each question one box at a time, with a prompt for each step.
3. **Test.** Once enough learning rounds in a row are clean, that year's test starts. Every box is open with no prompts. Arrow keys move between boxes and `Tab` follows the method's order. Typing fills a box and moves on in the direction that row is written; `Backspace` clears; `-` toggles the sign box of the number being typed; `Enter` hands in, asking once more if answer boxes are empty. Only the answer boxes are marked. A wrong answer marks each answer box, shows the proper answer and the full working, and sets the count back to 0. `Enter` then walks through the same problem one box at a time with the reason for each step, and goes on to the next problem; `N` skips the walkthrough.

Enough clean tests in a row pass the year, and the next year starts with learning. Learning and the test each need the same number of clean rounds in a row, set by how long that area's rounds are in that year: 10 when a round averages under 5 key presses, 5 for 5 to 15, 3 above 15.

Progress is saved in the browser, so the game can be closed at any point and opened again where it stopped. Each area keeps its own place: the years learned and passed, the clean count, and the round in progress with every box typed so far. A mistake made before closing still counts. If the browser blocks saving, the start screen says so.

## How to play

- Set the child's school year with the left and right arrow keys, then press an area's key.
- Every box is on the sheet before play starts. The highlighted box with the pencil is the active box. The child's own digits are blue; the question's are black.
- The cursor stops at every small box in a written method: type the carry, the amount left over in short division, or `1` to exchange a ten in subtraction. Type `0` when there is none; a 0 is not written on the sheet. The stop happens whether or not anything moves, so it gives nothing away.
- A question that is not a written sum is written on the page above its answer line. Every answer is typed. Fractions take the top number, then the bottom. Decimal points, units and the colon in a time are already written in the answer. `<`, `=` and `>` compare (`,` and `.` also work). A word answer, such as *acute* or *kite*, is chosen by its number, and yes or no is `1` or `0`. An answer that could be below zero has a sign box: press `-`, or type the first digit.
- Some questions are drawn on a board: clock hands, shading, a mark on a number line or a line on a ruler, corners on a grid (shapes, symmetric figures, translations, reflections, rotations, plotted points), bars, pictograms, tally charts and line graphs, protractor angles, triangles from two angles, nets of a cube, pie charts, and in Year 7 ruler and compass constructions (perpendicular bisector, angle bisector, perpendicular from or at a point). Arrows move or turn (`Shift` for a bigger step), `Space` shades or puts a corner down, `Backspace` takes the last corner away, `Enter` says it is done; with a compass, `+` and `-` open and close it, `Space` draws an arc and `L` at two points draws a ruler line. Learning checks each step (a grid corner as it is put down); a test marks the whole drawing and shows the proper one after a miss. Touch screens get the same keys as buttons.
- A wrong digit shows why and what the box needs. Fix it to finish the problem. A round with a fix does not count as clean, so the count goes back to 0. `Enter` then tries the same problem again and `N` starts a new one.
- Keyboard: arrows set the school year, `1`-`9`, `0` and `W` choose the area, `R` the mixed test (then `N`, `P` and `E` for next, back and hand in), `0-9` type, `-` minus, `<` `=` `>` compare, `W` watch the example, `Esc` pause, `H` help, `S` sound, `T` theme, `C` colour-blind friendly colours. The on-screen keypad is optional.

## The mixed test

`R` on the start screen opens a mixed test of questions from all eleven areas for the school year, each area coming up about equally often.

- **Questions:** 10, 20, 30, 40 or 50. **Time limit:** none, or 10 to 90 minutes. **How hard:** easy, medium or hard. Easy asks the easiest of three generated questions for each place, by key presses and decimal places; hard the hardest; medium the first.
- Each question works like a test, but nothing is marked until the test is handed in. Until then questions can be visited in any order and any answer changed: `N` or `Enter` next, `P` back, or click a number in the question strip, which fills in each answered question. `E` hands the test in after a check that lists the questions with no answer; pressing `E` or `Enter` again confirms.
- The time limit counts down to a fixed moment, so it keeps running while paused or closed. `Esc` pauses; `E` then hands in at once and `Q` leaves the test for later (`R` carries on).
- The results show the score, percentage, a grade, the time taken and a score per area, and the arrow keys step through every marked question. `Enter` goes over each question that was not right, step by step, then returns to the results; `F` finishes. Grades: A+ 95% or more, A 90, A− 85, B+ 80, B 75, B− 70, C+ 65, C 60, C− 55, D 50, and F under 50%, which is always a fail.
- Questions are made from a seed, so a test closed part way through is rebuilt exactly. The mixed test does not change any area's progress.

## Display settings

- **Theme:** `T` or the sun and moon button cycles automatic, light and dark. Automatic follows the device and changes with it.
- **Colour-blind friendly colours:** `C` or the eye button. Right answers turn blue with a tick, wrong ones orange, the proper working reddish purple with a dotted underline, and the eleven book covers use Okabe-Ito and Paul Tol colours (and a violet for word problems) chosen so every pair stays at least 17 apart (CIE76) under simulated protanopia, deuteranopia and tritanopia.
- Both are saved in the browser and applied by `theme.js` before the page draws, so it never flashes the wrong colours. Pictures are drawn in the same colours. The guides follow the same settings.

## Tests

The checks run in Node with Playwright:

```bash
npm install
npx playwright install chromium   # or set CHROME_PATH to an installed Chrome
npm test
```

- `tests/engine.check.js` makes 2,000 problems per area and year (154,000 in all) and checks the arithmetic, layouts, the order of steps, small-box decisions, wording, decimal places by year, the year-check table, and Appendix 1's examples. Every sentence's answer is also worked out a second way: finished sentences are evaluated with exact fractions, picture questions are worked out from the picture's own data (the clock's hands, the chart's bars, a shape's corners), word problems from a plain description of their sum, with every working line checked and every number the sum uses found in the story, and drawings from the question's own words, with each board then played by keyboard to the finished drawing.
- `tests/guided.check.js` plays learning in a browser by keyboard: small-box decisions, fixes, year checks, and the move from learning to test to the next year.
- `tests/test-stage.check.js` hands in right and wrong answers in the test stage.
- `tests/solve-all.check.js` plays full rounds by keyboard in all eleven areas, Year 1 to Year 7, including decimal division, comparisons, choices, sign boxes and every kind of drawing board.
- `tests/resume.check.js` closes and reopens the game mid-round, between rounds, at the learning gate and after a passed check, and checks bad saved data and blocked storage.
- `tests/tutorial.check.js` checks the worked examples: one per kind of question, a reason for every step, stepping forward and back, skipping, replaying, and moving up a year.
- `tests/mixed.check.js` plays the mixed test: settings, going back and forth and changing answers, the question strip, the hand-in check, no marking until the end, closing and reopening, quitting and carrying on, a time limit running out, handing in early, grades and the review.
- `tests/display.check.js` checks the theme and colour settings, WCAG contrast in all four combinations including all eleven covers, and colour differences under simulated colour vision deficiency (Machado, Oliveira and Fernandes, 2009).
- `tests/layout.check.js` checks the layout at 390, 860 and 1280 px wide.
- `tests/guide.check.js` checks the guide pages: images, links, phone width, and the game's links to them.

Each script exits non-zero when a check fails. Screenshots go to `tests/shots/`.

## Files

- `index.html`: page structure.
- `styles.css`: visual design, including the dark and colour-blind palettes.
- `theme.js`: applies the saved theme and colour settings before the page draws.
- `engine.js`: arithmetic, written-method layouts, decimals, the sentence builder, the four calculation areas, the year-check table, and the seeded random numbers.
- `topics.js`: the number, fractions, measures, shape, data and algebra areas.
- `words.js`: word problems.
- `drawing.js`: drawing questions: each board's state, what every key does to it, the checks and the questions themselves.
- `pictures.js`: draws each question's picture (clocks, coins, scales, shapes, angles, grids, charts) and each drawing board as SVG.
- `game.js`: learning and test play, the mixed test, year checks, keyboard controls, rendering, saving, and sound.
- `assets/`: locally hosted fonts and their OFL license files.
- `tests/`: engine and browser checks (see Tests).
- `guide/`: the student and parent/teacher pages, their stylesheet, and screenshots in `guide/img/`.
- `tools/screenshots.js`: remakes the guide screenshots from exact game states (`npm run screenshots`).
- `package.json`: the test and screenshot commands and the pinned Playwright version.

No build step or third-party runtime dependencies.
