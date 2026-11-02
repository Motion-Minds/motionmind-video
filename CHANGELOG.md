# Changelog

## 0.3.1

- Compare: picking A fills B with A's previous version in the same campaign (same aspect ratio first; the next
  version when A is the oldest), also when opened from a run's Compare button. B's list starts with those
  suggestions. Both lists group runs by campaign, newest logged first, and show each run's logged date and stage.

## 0.3.0

Security fix for [GHSA-32j6-cgpv-2pj8](https://github.com/Motion-Minds/motionmind-video/security/advisories/GHSA-32j6-cgpv-2pj8)
(reported by @dhaniarfebrin). Everyone running `motionmind ui` should update.

- Studio refuses requests whose `Host` is not loopback (DNS rebinding); POSTs must also come from the Studio's own
  origin (`Origin`, `Sec-Fetch-Site`). `motionmind ui --host <name>` adds that name to the allowlist and warns that the
  Studio has no login.
- Workspace files are untrusted: `/media` serves every file with `Content-Security-Policy: sandbox allow-scripts` and
  `nosniff`, and the design board iframe is sandboxed, so HTML/SVG never run as the Studio. Design boards can no
  longer load fonts from `/media` (system fonts or embedded fonts still work).
- Markdown (breakdown, TASTE, PROGRESS, docs) shows raw HTML as text and drops `javascript:`/`data:` links.
- `promote`/`compare` resolve a run_id first, refuse an ambiguous bare version and accept `--campaign`;
  `motionmind --version` (#3).
- The registry lock survives concurrent writers and stale locks; a corrupt `.editing.json` no longer breaks the
  Studio (#4).
- Run creation is atomic: a failed `log`/`init`/`import` leaves no folder or stale `PROGRESS.md`, run_ids no longer
  collide, versions are claimed under the registry lock (#5).
- `render` refuses production/archived runs unless `--force` (logged to `LOG.md`); `edit`/`render` validate the
  version (#6).
- Tests: zero-dependency `node:test` suite (`npm test`), run in CI (#2). Thanks @dhaniarfebrin for #2–#6.

## 0.2.0

- Windows: HyperFrames commands (`init`, `render`, `edit`, `doctor`, `setup`) run npm's `npx-cli.js` with Node instead
  of `npx`, which `execFile` cannot start on Windows (`npx.cmd`). `doctor` finds agent CLIs installed as `.cmd`
  shims; `skill install` links `.claude/skills/motionmind` with a junction (no admin rights or Developer Mode needed).
- QA is enforced: production (`log --stage production`, `promote --stage production`, Studio) requires
  −14 ±0.5 LUFS and true peak ≤ −1 dBFS when the video has audio. `--force` (Studio: a checkbox) overrides and writes
  the override to `LOG.md`. `log` and `render` print a QA warning for staging versions; the Studio flags failing runs.
- CLI, Studio, LOG.md entries and starter kits are in English. Starter kits renamed: `video-baru` → `new-video`,
  `versi-baru` → `new-version`, `revisi` → `revision` (a store's own `starter-kits/` override by the new ids). The
  image category moved from `/gambar` to `/images`.
- `log` without `--stage` records `staging`; the help, README and Studio now say so.
- `log` copies the video with a copy-on-write clone where the filesystem supports it (APFS, btrfs, XFS), so the
  store copy takes no extra disk space there.
- `music` rejects stray arguments (PowerShell splits an unquoted `0:tense,2:groove`); docs quote `--sections` and state
  that section numbers are bars, not seconds.
- Re-rendering a production run whose new render fails QA moves it back to `staging` (logged in `LOG.md`);
  `log --metric` can no longer overwrite measured loudness.
- Linux: contact-sheet labels find DejaVu/Liberation fonts on Fedora, Arch, openSUSE and Alpine too; `doctor` tells
  Linux ARM64 users to point `HYPERFRAMES_BROWSER_PATH` at a system Chromium (no headless Chrome build exists there).
  Doctor no longer fails on HyperFrames' "newer version available" notice.
- README (GitHub and npm): platform notes (Windows, Linux x64/ARM64), enforced QA, default `staging`; Studio
  screenshots and the walkthrough re-captured with the English Studio.

## 0.1.1

- npm package page gets its own shorter README (`studio/README.npm.md`); the full README stays on GitHub.
- `setup` note: the official HyperFrames skills are installed into the agents' global skill folders; skip with
  `--no-hyperframes-skill`.

## 0.1.0

First public version.

- `motionmind` agent skill: four-gate workflow, HyperFrames rules, motion, sound, QA and screen-demo references,
  `screen-kit.js` camera/cursor/highlight helpers.
- CLI: `setup`, `doctor`, `skill install`, `init`, `import`, `edit`, `render`, `log`, `promote`, `list`, `compare`,
  `track`/`untrack`/`tracked`/`watch` (autolog of HyperFrames renders and export folders), `music`, `sfx`, `migrate`.
- Studio (`motionmind ui`): runs, campaigns, run page with 4:5 safe-area overlay, compare, starter kits, docs.
- Deterministic sample-free music bed; CC0 starter SFX pack (Kenney Interface Sounds + synthesised whooshes, risers,
  impacts).
