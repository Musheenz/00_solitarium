# John's Solitaire — Build Brief (for Claude Code)

A one-of-a-kind Klondike solitaire made as a gift for **John**, a 70-year-old who has played 4,000+ games of classic MS Solitaire. He is retired military (Berlin, '80s), ex-trucker, ex-county-jail officer. The deck's court cards are pixel-art caricatures of him. He must be able to click one icon and play. Nothing else.

**Prime directive:** the rules and controls must feel exactly like MS Solitaire (Klondike, Draw One, Standard scoring). All personality lives in the art, the juice, the jokes, and the stats. No twists to how the game plays.

---

## 1. Platform and delivery

- Target: **Samsung Chromebook 4, 11.6", 1366×768**, Celeron N4000, 4 GB RAM, ChromeOS, **touchpad only (no touchscreen)**. No developer mode, no Linux container.
- Deliver as an **installable PWA** that works **fully offline** after first load. He launches it from a shelf icon; it opens in its own window.
- Dev/test machine: Windows desktop, Chrome, `python -m http.server` from `docs/`, DevTools device mode at 1366×768. Chrome on Windows can install the PWA too.
- Hosting: the deployable root is `docs/` so GitHub Pages can serve it (Settings → Pages → main branch, `/docs`). Free Pages needs a public repo. If the repo must stay private, deploy `docs/` to Netlify or Cloudflare Pages instead. HTTPS is required for PWA install.

## 2. Stack

- **Vanilla JavaScript (ES modules) + one `<canvas>` with 2D context. No framework, no build step, no dependencies.** It has to boot instantly on a Celeron and keep working offline for years with zero maintenance.
- `imageSmoothingEnabled = false` everywhere. Pixel art only ever renders at an **integer scale**.

```
docs/
  index.html  style.css  manifest.webmanifest  sw.js
  js/  main.js  game.js  render.js  input.js  anim.js  ui.js  save.js  audio.js  lines.js  config.js
  assets/cards/  assets/ui/  assets/font/
  icons/  audio/
tests/  rules.test.mjs     (node, no deps; game.js must be pure and importable)
art_src/                   (Python/PIL generators; regenerates all PNGs; not deployed)
```

## 3. Assets provided (all native resolution, no scaling baked in)

| Path | Size | Notes |
|---|---|---|
| `assets/cards/{R}{S}.png` | 46×64 | R = A 2 3 4 5 6 7 8 9 10 J Q K, S = S H D C. 52 files |
| `assets/cards/back.png` | 46×64 | Olive drab with Army star |
| `assets/ui/slot_empty.png` | 46×64 | Dashed outline for an empty tableau column |
| `assets/ui/foundation_{S,H,D,C}.png` | 46×64 | Empty foundation with ghost suit |
| `assets/ui/stock_recycle.png` | 46×64 | Empty stock (click to recycle waste) |
| `assets/ui/card_select.png` | 50×68 | Gold ring. Draw at card pos −2,−2 for the valid drop target / hover |
| `assets/ui/logo.png` | 94×39 | "JOHN'S SOLITAIRE" title |
| `assets/ui/loss_card.png` | 46×64 | "OOPS!" card, John in fedora with tongue out. Shown on loss |
| `assets/font/font.png` + `font.json` | 10px tall | White glyphs. json: `{height, spacing, glyphs:{char:{x,w}}}`. Uppercase A–Z, 0–9, `' ! . , : - % / ?` and space. Tint by drawing to an offscreen canvas with `source-in`. Use letter spacing 1 for headers, 2 for body |
| `icons/icon-192.png`, `icons/icon-512.png` | | PWA icons (King of Spades portrait) |
| `audio/` | empty | See §9 |

Card anatomy: rank + suit index in the top-left occupies native rows 3–12. **A tableau overlap of ≥13 native px shows the full index.** The bottom-right index is rotated 180°.

## 4. Scale and layout

All layout in **native pixels** (1 native px = 1 card pixel). Compute in **device pixels** (window size × `devicePixelRatio`, so Windows 125%/150% scaling stays crisp):

- `scale` = largest integer where `floor(devW/scale) ≥ 452` and `floor(devH/scale) ≥ 240`, minimum 1. Expect **3 on the Chromebook**, 4 on a 1920×1080 desktop.
- Size the canvas backing store to device pixels. Set CSS size to the window size. Center the 452-wide layout horizontally.

**Layout (native px), left sidebar + table:**
- **Sidebar**, x 0–76: "JOHN'S" at the top in gold text (font at 1×). The full `logo.png` is 94 wide, too wide for the sidebar, so it appears on the splash and win screens only. Below that, **WINS** in large text (font at 2×). This number is the most important thing on screen for John. Then SCORE, TIME, and GAMES/WIN %. Then big stacked buttons: **NEW GAME**, **UNDO**, **STATS**, **SOUND ON/OFF**. Buttons have hover and press states and are at least 16 native px tall.
- **Table**, x 82–452: 7 columns of width 46 with gaps of 6. Top row y = 4: stock (col 1), waste (col 2), gap (col 3), foundations (cols 4–7). Tableau starts at y = 74.
- **Tableau fan offsets:** face-down 4, face-up 14. If a column would overflow the window bottom, compress face-down to 2 first, then face-up down to a floor of 12 (the index stays readable). Only below that, compress further evenly. Recompute live as columns grow.
- **Waste (Draw One):** show the top card only, with up to 2 cards peeking behind it offset 2 px, as MS does.

## 5. Rules — Klondike, Draw One, Standard scoring (must match MS exactly)

- Deal: 7 columns, column *n* has *n* cards, top card face-up. The remaining 24 go to the stock.
- Click stock: move 1 card to the waste. Click the empty stock (recycle marker): waste returns to the stock in original order. **Unlimited recycles.**
- Tableau: build down in alternating colors. Move any face-up run whose top card is legal on the target. **Only a King (or a run starting with a King) goes into an empty column.**
- Foundations: Ace up, same suit. **Foundation → tableau moves are allowed.**
- A face-down card at the end of a column flips when clicked (and auto-flip after a move, like modern MS. Pick auto-flip and note it in code).
- **Double-click** a card (waste or end of a column) sends it to a legal foundation if one exists.
- **Standard scoring** (Windows classic values):
  - waste → tableau **+5**; waste → foundation **+10**; tableau → foundation **+10**; turn over tableau card **+5**; foundation → tableau **−15**; recycle waste in Draw One **−100** (score floor 0)
  - time: **−2 every 10 seconds** of play
  - win bonus if time ≥ 30 s: **700000 / seconds**
  - The timer starts on the first move and pauses when the page is hidden (`visibilitychange`).
- **Undo:** unlimited, full-state snapshots (including score). Ctrl+Z also works.
- **Auto-finish:** when the stock and waste are empty and every tableau card is face-up, automatically fly the remaining cards to the foundations (fast, ~70 ms apart), then play the win sequence.
- **Stuck detection:** after each move, check whether any productive move exists, counting every card reachable by cycling the stock/waste. Skip pointless moves such as a King from the bottom of a column into another empty column, or shuffling an identical run back and forth. If none exists, show the **loss dialog** (§8). John can still Undo from there.

## 6. Game feel (Balatro-style juice, restrained)

Snappy and fun, never slow. Nothing may delay input: any animation is interruptible by the next click.

- Hover over a draggable card: lift −2 px and brighten a hair, eased 80 ms.
- Pick up: the card or stack scales 1.04 and gets a soft drop shadow. It follows the pointer with a quick spring (critically damped, ~60 ms). Tilt is proportional to horizontal velocity, clamped ±5°, returning to 0 when still. Card positions are *not* snapped to the native grid; smooth sub-native motion is fine.
- While dragging, draw `card_select.png` around the best valid target: the valid target with the **largest overlap** with the dragged card's rect.
- Drop valid: ease-out-back snap into place (~120 ms) plus a tiny squash. Foundation drops also get a quick pop and a few 1-native-px dust particles in the suit color.
- Drop invalid: fly back (~150 ms) with a small horizontal shake at the end.
- Flip: scaleX 1 → 0 → 1, swapping the face at the midpoint (~120 ms total).
- Deal: cards fly from the stock to the columns in deal order, ~25 ms apart, with a flip on the top cards.
- **Idle cost must be zero:** only run `requestAnimationFrame` while something is animating or being dragged; otherwise redraw on events only.
- Pointer Events for input. A touchpad tap counts as a click. Double-click threshold is 400 ms.

## 7. The John layer (personality)

- **Launch splash (~2 s, click skips):** logo at a large integer scale on the felt, "WINS: 4,127" beneath it, and a small random line (e.g. "THE COLONEL IS IN."). Then resume the saved game in progress, or deal a new one.
- **Win sequence:**
  1. **Classic MS bouncing cascade.** Cards launch one at a time from the foundations (top cards first). Gravity plus a floor bounce with 0.7 damping. Draw **without clearing** so they leave trails. Click skips.
  2. Then the banner: **"JOHN WINS AGAIN!"** in big gold text (font at 3×–4×, same gold/outline style as the logo) drops in with a bounce.
  3. **The WINS number ticks up** from old to new with a pop and a sparkle. Every 100th win gets a special line.
  4. A random sub-line from `lines.js`. Show score, time, and a **NEW GAME** button.
- **Loss dialog** (stuck, or clicking NEW GAME mid-game after at least one move, which asks "GIVE UP THIS ONE?" first): the `loss_card.png` drops in at 3×, tilted and wobbling, with a random jab and buttons **DEAL AGAIN** and **UNDO** (UNDO is only shown when stuck).
- **Blunder quips:** on invalid drops, show a small text pop near the card that fades in ~1.2 s. Rate-limited to at most once every 45 s and only ~1 in 3 invalid drops, so it never nags. Pick contextually: color clash → color lines, wrong rank → rank lines, non-King into an empty column → King lines. Three undos in a row → an undo line (once per game).
- All text lives in `lines.js` so it's easy to add more. Starting set below. Tone: gruff affectionate ribbing, never mean.

```js
export const LOSS = [
  "SON, I'VE SEEN BETTER CARD WORK IN A MOTOR POOL.",
  "THAT DECK JUST JACKKNIFED ON YOU.",
  "NEGATIVE, COLONEL. REGROUP AND REDEPLOY.",
  "EVEN THE INMATES ARE LAUGHING AT THAT ONE.",
  "BREAKER BREAKER, WE GOT A PILEUP ON COLUMN 3.",
  "THE WALL CAME DOWN FASTER THAN THAT GAME.",
  "PERMISSION TO BE EMBARRASSED: GRANTED.",
  "TEN-FOUR, THAT'S A WRECK.",
  "LOCKDOWN. NOBODY MOVES. INCLUDING YOUR CARDS.",
  "DROP AND GIVE ME TWENTY. THEN DEAL.",
  "THAT HAND IS GOING STRAIGHT TO SOLITARY.",
  "OUT OF MOVES. NOT OUT OF COFFEE.",
  "RETREAT IS JUST ADVANCING IN ANOTHER DIRECTION.",
  "YOUR RIG'S OUT OF DIESEL, DRIVER.",
  "EVEN ACTION HEROES LOSE ONE NOW AND THEN.",
  "THAT ONE'S CLASSIFIED. WE NEVER SPEAK OF IT.",
];
export const BLUNDER = {
  color: ["RED ON RED? COME ON, JOHN.", "WRONG UNIFORM, SOLDIER.", "COLORS DON'T MATCH, DEPUTY."],
  rank:  ["NICE TRY, ROOKIE.", "THAT'S NOT REGULATION.", "WRONG LANE, DRIVER.", "CHECK YOUR MIRRORS."],
  king:  ["KINGS ONLY, SIR.", "THAT SPOT'S RESERVED FOR BRASS."],
  undo:  ["REWINDING THE TAPE, HUH?", "THE COLONEL SAW THAT."],
};
export const WIN_SUB = [
  "MISSION ACCOMPLISHED, COLONEL.", "ANOTHER ONE FOR THE LOGBOOK.", "CONVOY MADE IT HOME SAFE.",
  "CASE CLOSED, SHERIFF.", "ROLL CREDITS.", "MEDAL OF HONOR, CARD DIVISION.", "UNDEFEATED AT THIS TRUCK STOP.",
];
export const MILESTONE = ["SOMEBODY CALL THE PENTAGON.", "THAT'S A NEW RECORD FOR THE SQUAD."];
export const SPLASH = ["THE COLONEL IS IN.", "CONVOY'S ROLLING.", "SHERIFF'S ON DUTY.", "LOCKED AND LOADED."];
```

The font is uppercase only and each line must fit the text box. Wrap by words and measure with `font.json`.

## 8. Stats and saving (single user, forever)

- Stats: played, won, lost, win %, current streak, best streak, best time, best score, total play time. The STATS panel shows them big.
- A game counts as **played** on the first move. It counts as **lost** when abandoned via NEW GAME/DEAL AGAIN after that. It counts as **won** on the win.
- `config.js`: `SEED_WINS` / `SEED_PLAYED` (default 0), applied **once** if no save exists, so his real MS win count carries over.
- **Save the game in progress after every move** (Chromebook lids get closed mid-game). Reopening resumes exactly.
- Storage: `localStorage` key `johns-solitaire-v1`, JSON with a `version` field. Call `navigator.storage.persist()` on first launch.
- **Backup code:** the STATS panel shows a short code (base36 of won/played/bestStreak plus a checksum), like "BACKUP: 3F2-1K7-X9". **Hidden admin: Ctrl+Shift+J** opens a small prompt to set wins/played manually or paste a backup code. That's for Billy only, so show no hint in the UI.
- **Debug mode** via `?debug=1` only: `W` plays the win sequence, `L` shows the loss dialog, `T` deals a worst-case tall-column layout, `B` fires a blunder quip. Debug must be impossible to trigger in normal play.

## 9. Audio (Billy composes it; build hooks only)

`audio.js` loads these if present in `audio/` (`.ogg`, falling back to `.mp3`). Missing files are silent, never an error:
`flip, pick, place, invalid, foundation, deal, shuffle, recycle, win_fanfare, loss_sting, quip_blip, ui_click`, plus optional `music_loop`. Keep separate SFX/music volume in the save. Start audio on the first user gesture (the splash click). Web Audio with preloaded buffers, low latency.

## 10. PWA

- `manifest.webmanifest`: name "John's Solitaire", short_name "Solitaire", `display: "standalone"`, background/theme color = felt `#2F4234`, both icons, `start_url: "./"`, `scope: "./"`.
- `sw.js`: precache every file (list them explicitly), cache-first, `CACHE_VERSION` constant. Old caches are deleted on activate. **Bump the version on every deploy.** After an update, the new version applies on the next launch; never interrupt a game.
- All paths relative, so it works under a GitHub Pages subpath.

## 11. Palette

Felt `#2F4234`, felt line `#4E6854`, card stock `#EEE4CE`, ink `#2B2420`, brick red `#9E2B26`, gold `#ECC668` / shine `#FAE8AA`, UI text on felt `#EEE4CE`. Earthy and calm. No neon, no saturated rainbow.

## 12. Acceptance checklist

- [ ] Rules unit tests (node): legal/illegal tableau moves by color and rank, King-only empty column, Ace-first foundations, foundation→tableau, recycle order, scoring for every move type, undo restores score, stuck detection on known stuck and not-stuck positions, auto-finish trigger.
- [ ] 1366×768 renders at scale 3 with no blur; at a 1920×1080 window, scale 4; resizing re-lays out cleanly.
- [ ] Debug `T` worst-case column stays on screen, and every face-up rank remains readable.
- [ ] Drag/drop, double-click to foundation, and click stock/recycle all work with a **touchpad** (tap-to-click and physical click).
- [ ] Reload mid-game resumes the same state, score, and timer.
- [ ] Install as a PWA, go offline, relaunch: fully works.
- [ ] Idle CPU ≈ 0 (no rAF loop when nothing moves).
- [ ] Every line in `lines.js` fits its box at runtime.
- [ ] Win: cascade → banner → WINS ticks up and persists. Loss: OOPS card, jab, counts once.
- [ ] Ctrl+Shift+J admin sets wins; backup code round-trips.
- [ ] Nothing in normal play can open debug, admin, or any error screen.

## 13. Order of work

1. `game.js` pure rules + scoring + undo + stuck detection, with tests passing.
2. Static render at integer scale, with the layout and sidebar.
3. Input: click, drag, double-click, stock.
4. Save/resume + stats.
5. Juice pass.
6. Win cascade + banner, loss dialog, quips.
7. PWA + offline test.
8. Audio hooks.
9. Performance pass on a throttled CPU (DevTools 4× slowdown) to approximate the Celeron.
