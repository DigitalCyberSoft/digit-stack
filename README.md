# Digit Stack

A keyboard-first browser game for practising long multiplication and long division on a worksheet that fills in one digit at a time.

## Run it

Open `index.html` directly in a modern browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## How to play

- Press `1` for divide or `2` for multiply.
- Every row of the worksheet is shown before play starts. The glowing box with the `TYPE` flag is the active box.
- Type the digit for that box. A wrong digit ends the round immediately.
- In multiplication, the `CARRY` button lights when a carry is due. Press `Space` or `Enter` to lift it into the small box above the next column.
- The clean streak must reach 10 in a row to add a digit. The digit level goes 1, 2, 3, 4. The count starts again for each new digit. A miss resets the clean streak but leaves the digit level alone.
- Only the first number grows. The second number stays a single digit, so the progression ends up at problems such as `204 / 2` and `2040 / 2`.
- Division stays in whole numbers. A remainder is written as `R`, for example `7 R 2`. No decimal answers are shown.
- Keyboard: `0-9` type, `Space` or `Enter` carry, `Esc` pause, `H` help, `S` sound. The on-screen keypad is optional.

## Files

- `index.html`: page structure.
- `styles.css`: visual design.
- `engine.js`: pure arithmetic, worksheet layout, and action-sequence engine.
- `game.js`: game state, keyboard controls, rendering, and sound.
- `assets/`: locally hosted fonts and their OFL license files.

No build step or third-party runtime dependencies.
