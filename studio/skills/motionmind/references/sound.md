# Sound: music, SFX, voice-over, loudness

## Music bed (no samples, deterministic)
```bash
motionmind music --out src/assets/audio/music.wav --duration 15 --bpm 120 \
  --sections "0:tense,2:groove,5:outro" --bells "6.5,10" --duck 9.5:0.2
```
- `--sections bar:kind,…` — bar index where each section starts (one bar = 4 beats; 120 BPM → 2 s per bar).
  Kinds: `tense` (minor pad, ticking hats — problem), `calm` (pad + soft keys — explanation, VO beds), `groove`
  (major, kick/clap/hats — product), `lift` (busier groove — climax), `outro` (open chord, no drums — CTA).
- `--bells s,…` — a rising four-note motif at those seconds (reveals, logo, CTA).
- `--duck s:depth,…` — dip the bed around hero SFX or VO lines (depth 0.2–0.5).
- Output is peak-normalised; final loudness comes from the master bus (`hyperframes.md`).
- Plan cuts on bar lines: at 120 BPM scene changes on multiples of 2 s (or beats of 0.5 s) feel intentional.
- The user's own track: copy it into `src/assets/audio/` and note its licence in `manifest.json`.

## Sound effects
```bash
motionmind sfx list --query whoosh        # id · duration · licence · file
motionmind sfx list --unlicensed           # what must not ship in commercial work
```
The catalogue is the user's library (`MOTIONMIND_SFX`, `sfx_library` in `motionmind.config.json`, or `~/.motionmind/sfx`, one folder per
category); without one, MotionMind's bundled CC0 starter pack is used (clicks, ticks, pops, chimes, whooshes, risers,
impacts — licence recorded per file). New sounds: drop them in a category folder of the user's library,
`motionmind sfx scan`, fill `source` and `license`. Copy every sound you use into `src/assets/sfx/` so later library
changes never alter a rendered version. Never download sounds without a licence you can record.

Cue map (one sound per meaningful event; silence is a choice too):
| Event | Sound | Level (`data-volume`) |
|---|---|---|
| Scene change | soft whoosh, start 0.1 s before the cut | 0.18–0.25 |
| Word/line reveal | tiny tick or pop, not on every word | 0.06–0.1 |
| Tap / click | click | 0.25–0.35 |
| Result / success | bright pop or chime | 0.2–0.3 |
| Logo / CTA | the music bell, or one pop | — |

Trim each clip with `data-duration` and a short `data-fade-out`; never let SFX tails overlap the next cue.

## Voice-over
- Final VO from the user: `src/assets/audio/vo/`, time scenes to its phrases (measure with
  `npx hyperframes audio` or ffmpeg `silencedetect`).
- No VO yet: build to the storyboard timing and leave 10 % slack; a temporary TTS guide only with the user's consent
  (`npx hyperframes tts`), and label it temporary.
- Duck music 6–10 dB under VO (`--duck` per line, or lower the music clip's volume).

## Targets (measured on the rendered file)
- Integrated −14 LUFS (±0.5), true peak ≤ −1.0 dBFS — `motionmind render` / `log` print both.
- Too quiet → raise root `gain` by the difference; peaks over → keep `truepeak` ceiling at −2.5 and lower SFX volumes.
- Silent videos are fine when intended; say so in `breakdown.md`.
