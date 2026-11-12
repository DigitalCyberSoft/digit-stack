# Digit Stack

A keyboard-first browser game for practising addition, subtraction, multiplication and division, set by school year from Year 1 to Year 7. Content and written layouts follow the national curriculum in England and its Mathematics Appendix 1.

Each year is pitched for a strong pupil in that year: its own content at the top of the range, plus the next year's methods, plus missing-number problems in Years 1 and 2. The programmes of study set one programme for the majority of pupils and say pupils who grasp concepts rapidly should get "rich and sophisticated problems before any acceleration through new content".

## Run it

Play it at https://digitalcybersoft.github.io/digit-stack/.

To run it locally, open `index.html` directly in a modern browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Learn, then test

Every area and year has two stages, and the game moves between them by itself.

1. **Learn (guided).** The game takes the child through the method one box at a time, with a prompt for each step.
2. **Test.** Once enough learning rounds in a row are clean, that year's test starts. Every box is open with no prompts. Arrow keys move between boxes and `Tab` follows the method's order. Typing fills a box and moves on in the direction that row is written; `Backspace` clears; `-` toggles the sign box; `Enter` hands in, asking once more if answer boxes are empty. Only the answer boxes are marked; carries, exchanges, left-overs, products and differences are working. A wrong answer marks each answer box, shows the proper answer and the full working, sets the count back to 0, and `Enter` goes to the next problem.

Enough clean tests in a row pass the year, and the next year starts with learning. Learning and the test each need the same number of clean rounds in a row, set by how long that area's rounds are in that year: 10 when a round averages under 5 key presses, 5 for 5 to 15, 3 above 15. Each area (divide, multiply, add, subtract) moves up on its own.

Progress is saved in the browser, so the game can be closed at any point and opened again where it stopped. Each area keeps its own place: the years learned and passed, the clean count, and the round in progress with every box typed so far. A mistake made before closing still counts, and a finished round is already counted, so reopening after one starts the next problem. If the browser blocks saving, the start screen says so.

Tests use the same problems as learning, so they include short and long multiplication and division.

## How to play (learning)

- Set the child's school year with the left and right arrow keys, then press `1` Divide, `2` Multiply, `3` Add or `4` Subtract. Every area starts at the school year.
- Every box is on the sheet before play starts. The glowing box with the `TYPE` flag is the active box.
- The cursor stops at every small box: type the carry, the amount left over in short division, or `1` to exchange a ten in subtraction. Type `0` when there is none; a 0 is not written on the sheet. The stop happens whether or not anything moves, so it gives nothing away.
- Subtraction is by crossing out (decomposition). After a `1`, the child types the new value of the column that gives the ten; across a zero they type each changed digit. Exchanged digits are crossed out.
- Long division types each difference straight in.
- From Year 5, some Add and Subtract answers are below zero. The answer starts with a sign box: press `-` for a negative answer, or type the first digit for a positive one.
- A wrong digit shows why and what the box needs. Fix it to finish the problem. A round with a fix does not count as clean, so the count goes back to 0. `Enter` then tries the same problem again and `N` starts a new one.
- In Years 1 and 2 the answer fills from the left, the way a number is written. Written methods fill from the right.
- Keyboard: arrows set the school year, `1`-`4` choose the area, `0-9` type, `-` minus, `Esc` pause, `H` help, `S` sound. The on-screen keypad is optional.

## What each year covers

| Year | Age | Multiply | Divide | Add and Subtract |
| --- | --- | --- | --- | --- |
| 1 | 5-6 | Rows of 2, 5 or 10 dots up to 100; 2, 5, 10 tables | Sharing and grouping; dividing by 2, 5, 10 | Facts to 20; 2-digit and 1s, 10s or 2-digit; three 1-digit numbers; missing numbers such as 7 = ? − 9 |
| 2 | 6-7 | 2, 3, 4, 5, 8, 10 tables; missing numbers | Same tables; missing numbers | 3-digit and 1s, 10s or 100s; missing numbers; 2- and 3-digit columns |
| 3 | 7-8 | 2- or 3-digit × 1-digit | 2- or 3-digit ÷ 1-digit, exact | 3- and 4-digit columns |
| 4 | 8-9 | 3- or 4-digit × 1-digit; 2-digit × 2-digit | 3- or 4-digit ÷ 1-digit with remainders | 4- and 5-digit columns |
| 5 | 9-10 | 3- or 4-digit × 2-digit | 4-digit ÷ 1-digit; 3- or 4-digit ÷ 2-digit | 5- and 6-digit columns; below zero with small numbers |
| 6 | 10-11 | 4-digit × 2-digit; 3- or 4-digit × 3-digit | 4- or 5-digit ÷ 2-digit | 6-digit columns; below zero up to 100 |
| 7 | 11-12 | 4- or 5-digit × 3-digit | 5-digit ÷ 2-digit; 4-digit ÷ 3-digit | 6- and 7-digit columns; adding and subtracting negatives |

About 1 in 4 column subtractions exchange across a zero, and from Year 5 about 1 in 3 Add and Subtract problems have answers below zero. Multiply and Divide stay with positive whole numbers. Decimals and fractions are not covered.

## Tests

The checks run in Node with Playwright:

```bash
npm install
npx playwright install chromium   # or set CHROME_PATH to an installed Chrome
npm test
```

- `tests/engine.check.js` replays 2,000 generated problems per area and year (56,000 in all): arithmetic, layouts, the order of steps, small-box decisions, wording, and the year-check table.
- `tests/guided.check.js` plays learning in a browser by keyboard: small-box decisions, fixes, year checks, and the move from learning to test to the next year.
- `tests/test-stage.check.js` hands in right and wrong answers in the test stage: short and long multiplication and division, column addition and subtraction, number sentences and facts.
- `tests/solve-all.check.js` plays full rounds in nine area and year cases, from Year 1 to Year 7 long multiplication and division.
- `tests/resume.check.js` closes and reopens the game mid-round, between rounds, at the learning gate and after a passed check, and checks bad saved data and blocked storage.
- `tests/layout.check.js` checks the layout at 390, 860 and 1280 px wide.

Each script exits non-zero when a check fails. Screenshots go to `tests/shots/`.

## Files

- `index.html`: page structure.
- `styles.css`: visual design.
- `engine.js`: pure arithmetic, worksheet layouts, year content, the action sequence and worked sheet for each problem, and the year-check table.
- `game.js`: learning and test play, year checks, keyboard controls, rendering, and sound.
- `assets/`: locally hosted fonts and their OFL license files.
- `tests/`: engine and browser checks (see Tests).
- `package.json`: the test command and the pinned Playwright version.

No build step or third-party runtime dependencies.
