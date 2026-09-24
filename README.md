# John's Solitaire

Klondike (Draw One, Standard scoring) built as a gift for John. It's an
installable offline web app written in plain JavaScript on one canvas, with no
build step and no dependencies. The full design is in [BRIEF.md](BRIEF.md).

## Run it locally

```
node tools/serve.mjs 8123
```

Open http://localhost:8123/ (or `?debug=1` for the debug keys). The service
worker stays off on localhost so edits show up immediately; add `?sw=1` to test
offline mode locally.

## Tests

```
node --test tests/rules.test.mjs tests/save.test.mjs
```

## Deploy

1. `node tools/release.mjs`. This rewrites the precache list in `docs/sw.js` and
   bumps `CACHE_VERSION`. Run it before every deploy.
2. Publish `docs/` over HTTPS (GitHub Pages from `/docs`, Netlify, or Cloudflare Pages).
3. On the Chromebook, open the URL in Chrome and choose Install. After that it
   runs offline from the shelf icon. Updates apply on the next launch.

## Knobs

- `docs/js/config.js`: palette, layout, timings, and how often quips fire.
  Every install starts at zero wins.
- `docs/js/lines.js`: every joke. Add lines freely; they wrap automatically.
- `docs/audio/`: sound files as `.ogg`, `.mp3` or `.wav`. Missing ones stay silent.
  - Basic kit: `main_theme` (loops), `card_slot` (card lands), `mistake` (bad drop).
  - Optional extras that override the basic kit: `place`, `foundation`, `invalid`,
    `flip`, `pick`, `deal`, `shuffle`, `recycle`, `win_fanfare`, `loss_sting`,
    `quip_blip`, `ui_click`.
  - The SOUND button cycles ALL (music and effects) → FX (effects only) → OFF.

## Hidden stuff (Billy only)

- **Ctrl+Shift+J** (or **Ctrl+Alt+J**): set WINS,PLAYED, paste a backup code
  from the STATS panel, or type `RESET` to wipe all stats.
- **`?debug=1`**: `W` win sequence, `L` loss dialog, `T` tallest possible column,
  `B` blunder quip, `F` a real game one double-click from winning
  (it counts in the stats; W does not). The console also checks that every line fits.

## Differences from the brief

- The minimum layout height is 216 native px instead of 240. An installed app
  window on the 1366×768 Chromebook is about 688 px tall once the shelf and
  title bar are gone, and 688/3 = 229. With 240 the game would drop to scale 2.
- The brief says `python -m http.server`; `tools/serve.mjs` does the same job with Node.
