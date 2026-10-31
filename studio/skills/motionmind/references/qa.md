# QA before Gate 3 and before production

Walk this list on the rendered file, fix, re-render. Report the numbers, not "looks good".

## Picture
- [ ] Contact sheet (`runs/<v>/contact-sheet.png`, one frame per second) matches the storyboard beat by beat.
- [ ] Full-resolution frames at every scene change and at the CTA: no clipped or overlapping text, no empty frames,
      no element popping in before its entrance, no leftover debug outlines.
- [ ] Text readable on a phone: ≥ 28 px at 1080 wide, contrast holds on every background it crosses.
- [ ] 9:16: headline, UI and CTA within y 285–1635; nothing important under the bottom 20 % (captions/UI of the app).
- [ ] CTA (URL / action) still and readable ≥ 1.5 s at the end.
- [ ] Brand: logo files from `shared/brands/<brand>/logos` (not redrawn), colours from `brand.json`, roles respected.
- [ ] Product screens are real captures, current, and contain no private data.

## Sound
- [ ] −14 LUFS ±0.5 integrated, true peak ≤ −1 dBFS (numbers from `motionmind render`).
- [ ] Every cue lands on its event (scrub the key moments); no SFX tail into the next cue; music ends with the fade.
- [ ] Every sound and track has a licence recorded (catalogue or `manifest.json`).

## Determinism (before production)
Render twice and compare frame hashes:
```bash
cp runs/<v>/video.mp4 /tmp/a.mp4 && motionmind render <brand>/<campaign> <v>
ffmpeg -v error -i /tmp/a.mp4 -map 0:v -f framemd5 - > /tmp/a.md5
ffmpeg -v error -i runs/<v>/video.mp4 -map 0:v -f framemd5 - > /tmp/b.md5
diff /tmp/a.md5 /tmp/b.md5 && echo identical
```

## Record
- [ ] `breakdown.md` filled (format, audio numbers, per-scene table).
- [ ] `PROGRESS.md` updated; feedback rules added to `TASTE.md`.
- [ ] `motionmind log … --stage staging` done (or the run was already logged and `render` refreshed it).
- [ ] Promote only after the user says so: `motionmind promote <run_id> --stage production` (the CLI refuses it while
  the sound numbers above fail; `--force` only when the user explicitly accepts the miss).
