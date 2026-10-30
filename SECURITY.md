# Security policy

## Supported versions

Security fixes go into the latest release on npm (`motionmind`) and the `main` branch.

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately through GitHub:
**Security → Report a vulnerability** on https://github.com/Motion-Minds/motionmind-video, with the version, steps to
reproduce, and the impact you see. You will get a reply within 7 days.

## Scope notes

- MotionMind Studio (`motionmind ui`) is a local tool: it binds to `127.0.0.1` and serves files from the workspace's
  `projects/` and `shared/` folders only. Exposing it on a network interface (`--host 0.0.0.0`) is not supported.
- The CLI runs `npx hyperframes`, `ffmpeg` and `ffprobe` on files in your workspace. Treat HyperFrames projects from
  others like any code you run.
