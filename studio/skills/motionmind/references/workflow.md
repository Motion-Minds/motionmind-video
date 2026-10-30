# Workflow: from brief to production

## Workspace layout

```text
<workspace>/                       motionmind.store.json marks it
├── shared/brands/<brand>/         brand.json · logos/ · fonts/ · captures/
├── projects/<brand>/<campaign>/   one campaign = one message for one audience
│   ├── TASTE.md                   style memory (palette, type, motion, sound, feedback rules)
│   ├── PROGRESS.md                where we are: phase, approvals, next step (overwrite each step)
│   ├── LOG.md                     append-only: time · action · result (the CLI also appends)
│   ├── manifest.json              source + licence of every downloaded/generated asset
│   ├── plan/concepts.md · plan/storyboard.md · plan/design.html
│   └── runs/v<N>-<slug>/          one rendered version, frozen once rendered
│       ├── src/                   the HyperFrames project (index.html, compositions/, assets/)
│       ├── video.mp4 · contact-sheet.png · breakdown.md
│       └── .editing.json          present while the user edits in HyperFrames Studio
└── registry.json                  every logged run (written by the CLI only)
```

New campaign vs new version:

| Situation | Where |
|---|---|
| Different message, feature, audience or goal | new campaign `<brand>/<topic>-<duration>` → `v1-<slug>` |
| Same message, different execution (hook, style, music, VO, ratio) | `v<N+1>-<slug>` in the same campaign |
| Technical fix before approval (typo, clipping, timing) | same run |

## Step by step

### 1. Brief
Restate in ≤6 lines: goal, audience, format + duration, audio (music only / VO coming / temporary TTS guide), CTA,
must-show content. List what is missing (logo, product screens, VO file) and ask once. Read `brand.json` for palette
and colour roles. Product screens: use `shared/brands/<brand>/captures/`; capture missing states from a running build
or public site, never by changing the product.

### 2. Concepts — Gate 1
Write `plan/concepts.md` with 2–3 concepts that differ in story, not just colour:

```markdown
# Concepts — <brand>/<campaign>
Brief: <one line> · Format: 9:16, 15 s · Audio: music + SFX

## 1. <Name> — <one-line hook>
- Story (0–3 s hook → middle → CTA): …
- What the viewer sees: …
- Why it works for <audience>: …
- Risk / needs: …

## 2. …
**Chosen:** _(filled after the user picks)_
```

Present them as a short numbered list in chat and wait.

### 3. Storyboard + style — Gate 2
`plan/storyboard.md`, one row per beat, times in seconds:

```markdown
| Time | Visual | On-screen text | Motion | Sound |
|---|---|---|---|---|
| 0.0–2.8 | Empty shelf illustration | "Stock running low?" | words rise, back.out 0.18 s stagger | low whoosh, pop |
```

Lock the style in `TASTE.md` (palette with roles, fonts and sizes, easing family, signature moves, music BPM and
sections, loudness). Keep `plan/design.html` in sync (swatches, type specimens) so the user can see it.
Show the table in chat and wait for approval.

### 4. Build
1. `motionmind init <brand>/<campaign> v<N>-<slug> --engine hyperframes --resolution <portrait|landscape|square>`
   — creates the campaign memory (first time), the run folder, a pinned HyperFrames project and copies brand logos/fonts
   into `src/assets/brand/`.
2. Write one composition per scene in `src/compositions/` and the hosts + audio in `src/index.html`
   (`references/hyperframes.md`).
3. Music: `motionmind music …` into `src/assets/audio/`; SFX: pick from `motionmind sfx list` and copy into
   `src/assets/sfx/` (`references/sound.md`).
4. After every change: `check`, then `snapshot` at the key beats and **look at the PNGs**. Fix overlaps, clipped text,
   empty frames, off-safe-area elements before moving on.

### 5. Review — Gate 3
Render a draft (`motionmind render …`), log it as `staging`, and tell the user where to watch it
(Studio → run page). Offer `motionmind edit …` so they can change text, timing or audio in HyperFrames Studio without
code. While `.editing.json` exists you do not touch `src/`. After they close it: `npx hyperframes history`, apply
their notes, add lasting preferences to `TASTE.md` → feedback rules.

### 6. Render + QA
`motionmind render` and walk `references/qa.md`. Adjust master gain until −14 LUFS ±0.5 with TP ≤ −1 dBFS.

### 7. Record — Gate 4
- `breakdown.md` in the run: format, audio numbers, then a table `Time | Scene | Motion & easing | SFX`.
- `PROGRESS.md`: phase, current version, approvals, next step.
- `motionmind log … --stage staging` (or `render` again if already logged).
- When the user approves: `motionmind promote <run_id> --stage production` (the previous production version of the
  same aspect ratio is archived automatically).

## Tracked projects
If the user prefers to work in their own HyperFrames folder, `motionmind track <folder> --campaign <brand>/<campaign>`
makes every render in that folder a new version while `motionmind ui` or `motionmind watch` runs. Then edit the user's
folder (path in `motionmind tracked`), never the snapshot in `runs/`.
