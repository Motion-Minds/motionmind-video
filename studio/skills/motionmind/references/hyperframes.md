# HyperFrames in a MotionMind run

The **official HyperFrames skill** is the authority on composition format, motion, captions and review — install it
once with `npx hyperframes skills` (`motionmind setup` does this) and read it when writing scenes. Offline docs:
`npx hyperframes@<pinned> docs <topic>`. This file adds only what MotionMind runs rely on.

## Where things go

```text
runs/v<N>-<slug>/src/
├── index.html              root: scene hosts + audio clips + master bus; declares video-level variables
├── compositions/<scene>.html
├── assets/{brand,captures,img,video,audio,sfx,fonts,js}/
└── package.json            pinned hyperframes@X.Y.Z — never change it in a rendered run
```
Run every `npx hyperframes` command inside `src/` with the pinned version and `HYPERFRAMES_NO_TELEMETRY=1`.

## Root `index.html` essentials

```html
<div id="root" data-composition-id="main" data-start="0" data-duration="15"
     data-width="1080" data-height="1920" data-motion-blur="on"
     data-fx-chain='{"version":1,"nodes":[{"type":"gain","id":"m1","params":{"gain":9}},
                    {"type":"truepeak","id":"m2","params":{"ceiling":-2.5,"lookahead":3,"release":80}}]}'>
  <div id="hook" data-composition-id="hook" data-composition-src="compositions/hook.html"
       data-start="0" data-duration="3.2" data-track-index="1" data-track-kind="graphics"
       data-width="1080" data-height="1920" data-variable-values='{"headline":"Stock running low?"}'></div>
  <audio id="music" class="clip" src="assets/audio/music.wav" data-start="0" data-duration="15"
         data-volume="0.5" data-track-index="10"></audio>
</div>
```

- **Loudness is not normalised by the render.** The root `gain` node sets level (start around 8–10 dB for a music bed at
  volume 0.4–0.5), `truepeak` holds the ceiling. Render, read the LUFS that `motionmind render` prints, change gain by
  the difference (−15.3 → −14.0 means +1.3 dB), render again.
- Overlap consecutive scene hosts by ~0.3 s for transitions; later scenes get higher track indexes.
- Shared CSS, `@font-face` and helper scripts (e.g. `assets/js/screen-kit.js`) go in the root `<head>` after GSAP.
  Brand fonts were copied to `assets/brand/fonts/` by `motionmind init`.

## Scenes and variables
- One paused GSAP timeline per composition, registered as `window.__timelines["<composition id>"]`, times local to the
  scene. Use `fromTo`; tweens that start later on an element already animated need `immediateRender: false`.
- Prefix ids with the scene id (`hook-title`) so scenes never collide.
- Copy the user may want to change without code becomes a variable: declare it on the scene's root element with
  `data-composition-variables='[{"id":"headline","type":"string","label":"Headline","default":"…"}]'`, bind it with
  `data-var-text="headline"` (or `data-var-src`, `var(--id)` in CSS), and set per-instance values on the **host** with
  `data-variable-values`. Root-level values do not reach a scene. Rendering one composition on its own ignores host
  values — always render the root.
- Timed media inside a scene: `class="clip"` + `data-start` (local to the scene) + `data-duration` +
  `data-track-index`; videos `muted playsinline`, `data-media-start` to begin mid-file.
- No randomness, clocks or timers. Grain/noise layers sit behind text and UI and stay small.
- Body text ≥ 28 px at 1080 wide (`check` warns below that); tiny UI inside product captures is fine.

## Edit lock (HyperFrames Studio)
HyperFrames Studio rewrites files when it opens a project (adds `data-hf-id`, saves timeline edits); two editors at once
lose work. The user opens it with `motionmind edit <brand>/<campaign> <version>`, which writes `runs/<v>/.editing.json`.
While that file exists you do not touch `src/`. Afterwards run `npx hyperframes history` and build on their changes.

## Check, look, render
```bash
cd projects/<brand>/<campaign>/runs/<v>/src
HYPERFRAMES_NO_TELEMETRY=1 npx -y hyperframes@<pinned> check
HYPERFRAMES_NO_TELEMETRY=1 npx -y hyperframes@<pinned> snapshot --at 0.5,2,4.5,8,12 --no-end
cd - && motionmind render <brand>/<campaign> <version>
```
Open the snapshot PNGs (tile them with ffmpeg if many) and compare with the storyboard before rendering.

| Symptom | Usual cause |
|---|---|
| Scene blank in render | timeline not registered under the composition id, or host id typo |
| Element visible before its entrance | later `fromTo` without `immediateRender: false`, or no initial CSS state |
| Variable shows the default | value set on the root instead of the scene host, or a single-composition render |
| Font falls back | missing `@font-face` in the root head or wrong `assets/…` path |
| Audio silent | `<audio>` without `class="clip"` / `data-track-index` |
