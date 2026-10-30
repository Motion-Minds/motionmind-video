# Motion design choices

Decide these in the storyboard and write the numbers into `TASTE.md`, so every scene and every later version moves
the same way.

## Pacing by length
| Length | Beats | Hold on the key line | CTA |
|---|---|---|---|
| 6–10 s bumper | hook → payoff | 1.2–1.8 s | last 2 s, still |
| 15 s reel | hook (0–3 s) → proof → CTA | 1.5–2.5 s | last 3 s, still ≥ 1.5 s |
| 30 s promo | hook → problem → product (2–3 beats) → CTA | 2 s per beat | last 3–4 s |
| 45–90 s explainer / tutorial | intro → one chapter per step → recap | caption ≥ 2 s per chapter | last 4–6 s |

The first 1.5 s must already say what the video is about (most feeds decide there). One idea per beat.

## Hierarchy and type
- One focal point per moment; everything else dims, blurs, or waits.
- Sizes at 1080 px wide (9:16): hero 96–140 px, keyword 56–80, caption 36–48, minimum 28. 16:9 at 1920: hero
  80–120, caption 40–48.
- Max ~6 words on screen per beat for social; reveal word by word or line by line, not letter by letter for long text.
- Accent colour only on the 1–2 words that carry the message and on the CTA.

## Colour roles
Give every accent exactly one meaning and keep it for the whole campaign, e.g. warm = problem, brand colour = the
product doing its job, green/lime = result achieved. Write the roles in `TASTE.md` and `brand.json`.

## Easing and timing (GSAP)
| Use | Ease | Duration |
|---|---|---|
| Entrance of text/cards | `power3.out` or `back.out(1.6)` for playful | 0.35–0.6 s |
| Exit | `power2.in` | 0.2–0.35 s (faster than entrance) |
| Camera move / zoom | `power2.inOut` | 0.6–0.9 s |
| UI tap / press | scale 1 → 0.92 → 1, `sine.inOut` | 0.15–0.2 s |
| Word stagger | — | 0.04–0.08 s per word |
| Emphasis pulse | `sine.inOut`, 2 repeats | 0.4 s each |

Keep one easing family per campaign. Linear only for continuous drift (slow push 2–3 %/s, background parallax).

## Transitions
- Hard cut on a musical beat is the default; it is never wrong.
- Overlap scenes 0.3 s and move both (outgoing fades/scales down while incoming rises) for softness.
- Match cuts (same shape/position across scenes) for product continuity; wipes and zooms sparingly, once per video.

## Camera on product screens
- Start wide enough to orient, then zoom to the element that matters (1.3–2.5×). Never zoom past where UI text gets
  soft; capture at 2× device pixel ratio.
- Highlight with a ring/glow in the accent colour plus a dimmed surround; add a cursor or tap only when a real action
  happens. See `screen-demo.md`.

## Signature moves
Pick 1–2 devices that repeat (a ring pop, a specific word reveal, a sweep of light) and use them at every key moment.
Repetition reads as brand; variety reads as template.

## Layout safety
- 9:16: keep text, UI and CTA within y 285–1635 (4:5 centre crop); keep 60 px side margins.
- 16:9: 5 % action-safe margin; captions inside 10 %.
- Never put text over a busy capture without a backing (card, scrim, or blur).
