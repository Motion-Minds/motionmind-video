# Third-party notice

This repository contains only original MotionMind code, docs, templates and the `demo` brand (MIT, see `LICENSE`).
The MotionMind name and logo (`studio/public/brand/`, `shared/brands/motionmind/`) identify the project and are not
licensed under MIT; use them to refer to MotionMind, not to brand a fork.
The tools below are used at runtime and are **not** redistributed here; each keeps its own licence.

| Component | How it is used | Licence |
|---|---|---|
| [HyperFrames](https://github.com/heygen-com/hyperframes) | `npx hyperframes@<pinned>` per run | Apache-2.0 |
| [GSAP](https://gsap.com) | loaded from a CDN inside HyperFrames compositions | GSAP standard licence |
| [Next.js](https://nextjs.org), React, marked | `studio/` dependencies via npm | MIT |
| FFmpeg | system binary for loudness and contact sheets | LGPL/GPL |
| Satoshi (Fontshare), Geist (Vercel) | optional UI fonts, user-supplied in `shared/ui-fonts/` | Fontshare licence, SIL OFL 1.1 |
| `remotion-*` skills / Remotion | optional, installed by the user | Remotion licence |

The starter SFX pack in `studio/sfx/` is CC0: interface sounds from Kenney's *Interface Sounds 1.0* (kenney.nl) plus
whooshes, risers and impacts synthesised by MotionMind (`studio/sfx/LICENSE.md`, sources per file in `catalog.json`).

Sound effects, brand assets and fonts you add to your own hub stay yours or their owners'; check their licences before
commercial use (`motionmind sfx list --unlicensed`).
