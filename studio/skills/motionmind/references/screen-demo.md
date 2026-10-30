# Product demos and tutorials from real screens

Use real screenshots of the product (or of the tool being explained) and move a camera over them. It is honest,
always on-brand, and survives UI changes by re-capturing.

## 1. Capture
- Capture each state you need as PNG at device pixel ratio 2 (e.g. 1600×900 CSS → 3200×1800 file), same window size
  for every shot so they crossfade cleanly. Name them in order: `s01-home.png`, `s02-form-filled.png`, …
- Write `assets/captures/index.json`: for every shot, the rectangles (CSS px) you will zoom to, click, or ring:
  `{"s02": {"submit": {"x": 305, "y": 474, "w": 183, "h": 41}}}`. Measure them once (overlay a grid on the PNG) —
  guessing coordinates is where demos go wrong.
- Websites: Playwright/Puppeteer screenshots of a running build; apps: emulator/simulator or the test harness.
  Never change the product's code to get a state; seed data in a local copy instead. Remove private data.
- Store reusable captures in `shared/brands/<brand>/captures/`; copy the ones a run uses into its `src/assets/captures/`.

## 2. Scene structure (16:9 tutorial example)
```html
<div class="win">                         <!-- browser/app frame: title bar + view -->
  <div class="tbar">…url…</div>
  <div class="view">                      <!-- clips the camera, e.g. 1520×855 -->
    <div class="cam" id="s1-cam">         <!-- 1600×900 page layer the camera moves -->
      <img class="shot" id="s1-a" src="assets/captures/s01-home.png">
      <img class="shot" id="s1-b" src="assets/captures/s02-form-filled.png" style="opacity:0">
      <div class="ring" id="s1-ring" style="left:299px;top:468px;width:195px;height:53px"></div>
      <div class="cursor" id="s1-cursor"><div class="cz"><div class="ripple"></div><svg>…</svg></div></div>
    </div>
  </div>
</div>
```
Load `assets/js/screen-kit.js` (copy from this skill's `assets/`), then in the scene timeline:
`MMK.camera`, `MMK.cursor`, `MMK.show`, `MMK.ring` with **absolute times** — see the header of `screen-kit.js`.

## 3. Choreography rules
- Each chapter: header/caption appears → camera eases to the area → cursor moves (0.5–0.7 s) → click → screen
  changes (crossfade 0.15–0.3 s) → ring on the result (≥ 1 s) → next.
- One action per 1.5–2.5 s at most; leave the result on screen long enough to read.
- Zoom 1.3–2.6×; zoom out before travelling to a far part of the page.
- Click SFX exactly on `click(t)`; a soft whoosh on chapter changes.
- Use a fake terminal/chat rendered in HTML only to show text that really exists (real prompt, real output); say so
  in `breakdown.md`.
- Phone demos: put the capture in a phone frame (rounded mask + bezel), animate the phone in, then zoom into a card.
