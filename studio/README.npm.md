<img src="https://raw.githubusercontent.com/Motion-Minds/motionmind-video/main/studio/public/brand/motionmind-symbol.svg" width="72" alt="MotionMind symbol">

# motionmind

Make videos with your AI coding agent and [HyperFrames](https://github.com/heygen-com/hyperframes), and keep every
render as a tracked, comparable version.

[![npm](https://img.shields.io/npm/v/motionmind?color=c9f24d&labelColor=0e0f11&style=flat-square)](https://www.npmjs.com/package/motionmind)
[![License: MIT](https://img.shields.io/badge/license-MIT-c9f24d?style=flat-square&labelColor=0e0f11)](https://github.com/Motion-Minds/motionmind-video/blob/main/LICENSE)

<img src="https://raw.githubusercontent.com/Motion-Minds/motionmind-video/main/docs/gallery/walkthrough.gif" alt="Install, brief the agent, approve the storyboard, render, then review and promote in MotionMind Studio" width="100%">

This package gives you three things:

- **`motionmind` skill** for Claude Code, Codex, Gemini CLI, OpenCode and other agents that read `SKILL.md`: a
  four-gate workflow (concepts → storyboard → review → production), HyperFrames rules, motion and sound guidance, QA.
- **`motionmind` CLI**: creates versions, renders them with a pinned HyperFrames, measures loudness, records everything.
- **MotionMind Studio** (`motionmind ui`): a local dashboard to watch, compare and promote versions.

## Install

```bash
npm i -g motionmind
```

Requires Node.js 22+ and `ffmpeg`/`ffprobe` on `PATH`. HyperFrames and its headless Chrome are fetched on first use.

## Quick start

```bash
motionmind setup my-studio     # workspace + motionmind skill (+ official HyperFrames skills)
cd my-studio
motionmind doctor              # checks Node, ffmpeg, Chrome, HyperFrames, skill, agent CLI
motionmind ui                  # Studio at http://127.0.0.1:4310
```

Then, in the same folder, ask your agent:

```text
Use the motionmind skill. A 15-second 9:16 promo for my coffee shop "Kopi Senja",
CTA kopisenja.id, music + SFX, no voice-over.
```

The agent stops at each gate for your decision; finished versions appear in the Studio.

`setup` also runs `npx hyperframes skills`, which installs the official HyperFrames skills into your agents' global
skill folders in your home directory. Skip it with `motionmind setup my-studio --no-hyperframes-skill`.

## Already have videos?

Any `.mp4` can be recorded, whatever made it:

```bash
motionmind track ~/Movies/HyperFrames/my-video --campaign acme/launch-15s   # every HyperFrames render becomes a version
motionmind track ~/Exports/premiere --campaign acme/launch-15s-cut          # every new .mp4 in an export folder
motionmind log ./final.mp4 --campaign acme/launch-15s --param skill_engine="my-skill"
```

## Commands

| Command | |
|---|---|
| `setup` · `doctor` · `skill install` | workspace, prerequisites, agent skill |
| `ui` · `watch` | Studio and autolog of tracked projects |
| `init` · `import` · `edit` · `render` | author, edit (HyperFrames Studio) and render versions |
| `log` · `track` · `promote` · `list` · `compare` | record, stage and compare versions |
| `music` · `sfx` | deterministic music bed, CC0 starter SFX pack |

`motionmind help` lists every option.

## Links

- Documentation, gallery and FAQ: https://github.com/Motion-Minds/motionmind-video
- Issues: https://github.com/Motion-Minds/motionmind-video/issues
- Changelog: https://github.com/Motion-Minds/motionmind-video/blob/main/CHANGELOG.md

MIT © 2026 Vinzzztty. The MotionMind name and logo are not covered by the MIT licence; third-party notices are in
`NOTICE.md`.
