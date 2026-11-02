import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { onPath } from "../core/media.ts";
import { editRun, renderRun } from "../core/runs.ts";
import type { Stage } from "../core/store.ts";
import { makeRun, runCli, seedRegistry, tempDir, tempStore } from "./helpers.ts";

const RUN_DIR = "projects/demo/x/runs/v1-x";
const sha12 = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 12);
const canFake = process.platform !== "win32" && onPath("ffmpeg") && onPath("ffprobe");
const needsFfmpeg = canFake ? {} : { skip: "needs POSIX, ffmpeg and ffprobe" };

/** A store with one logged run at `stage` whose video.mp4 holds "old". */
function fixture(t: TestContext, stage?: Stage) {
  const store = tempStore(t);
  const runDir = store.path(RUN_DIR);
  fs.mkdirSync(path.join(runDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(runDir, "src", "index.html"), '<div data-composition-id="main" data-width="64" data-height="64"></div>\n');
  fs.writeFileSync(path.join(runDir, "video.mp4"), "old");
  if (stage) seedRegistry(store, [makeRun({ run_id: "demo-x-v1", project: "demo/x", version: "v1-x", run_dir: RUN_DIR, stage })]);
  return { store, runDir, video: path.join(runDir, "video.mp4"), log: store.path("projects", "demo", "x", "LOG.md") };
}

/** A fake `npx` that copies a 1 s silent clip to the path after `-o`, standing in for `hyperframes render`. */
function fakeNpx(t: TestContext): string {
  const bin = tempDir(t);
  const clip = path.join(bin, "clip.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=64x64:r=10:d=1", "-pix_fmt", "yuv420p", clip]);
  const script = path.join(bin, "npx");
  fs.writeFileSync(script, `#!/bin/sh\nwhile [ $# -gt 0 ]; do if [ "$1" = "-o" ]; then cp "${clip}" "$2"; exit 0; fi; shift; done\nexit 1\n`, { mode: 0o755 });
  return bin;
}

function withPath(t: TestContext, bin: string) {
  const before = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${before}`;
  t.after(() => {
    process.env.PATH = before;
  });
}

for (const stage of ["production", "archived"] as const) {
  test(`render of a ${stage} run is refused without --force and changes nothing`, async (t) => {
    const { store, video, log } = fixture(t, stage);
    const registry = fs.readFileSync(store.path("registry.json"), "utf8");
    await assert.rejects(renderRun(store, { campaign: "demo/x", version: "v1-x" }), (err: Error) => /frozen/.test(err.message) && /--force/.test(err.message) && err.message.includes(stage));
    assert.equal(fs.readFileSync(video, "utf8"), "old");
    assert.equal(fs.readFileSync(store.path("registry.json"), "utf8"), registry);
    assert.equal(fs.existsSync(log), false);
  });
}

test("render and edit reject a version that is not v<N>-<slug>", async (t) => {
  const { store } = fixture(t, "staging");
  for (const version of ["../x", "v1/../../y", "V1", "v1-X"]) {
    await assert.rejects(renderRun(store, { campaign: "demo/x", version }), /Version must look like/, `render ${version}`);
    await assert.rejects(editRun(store, { campaign: "demo/x", version }), /Version must look like/, `edit ${version}`);
  }
});

test("render of a staging run replaces the video and keeps the stage", needsFfmpeg, async (t) => {
  const { store, video, log } = fixture(t, "staging");
  withPath(t, fakeNpx(t));
  const res = await renderRun(store, { campaign: "demo/x", version: "v1-x" });
  assert.equal(res.runId, "demo-x-v1");
  assert.notEqual(fs.readFileSync(video, "utf8"), "old");
  assert.equal(store.readRegistry().runs[0].stage, "staging");
  assert.doesNotMatch(fs.readFileSync(log, "utf8"), /--force/);
});

test("render of an unlogged run is not frozen", needsFfmpeg, async (t) => {
  const { store, video } = fixture(t);
  withPath(t, fakeNpx(t));
  await renderRun(store, { campaign: "demo/x", version: "v1-x" });
  assert.notEqual(fs.readFileSync(video, "utf8"), "old");
});

test("render --force of a production run replaces the video, stays production and logs the override", needsFfmpeg, async (t) => {
  const { store, video, log } = fixture(t, "production");
  withPath(t, fakeNpx(t));
  const res = await renderRun(store, { campaign: "demo/x", version: "v1-x", force: true });
  assert.notEqual(fs.readFileSync(video, "utf8"), "old");
  assert.equal(store.readRegistry().runs[0].stage, "production");
  assert.match(fs.readFileSync(log, "utf8"), new RegExp(`render v1-x · --force on a production run · replaced video sha256 ${sha12("old")}`));
  assert.ok(res.lines.some((l) => l.startsWith("Forced:")));
});

test("CLI render of a production run exits 1 without --force and 0 with it", needsFfmpeg, (t) => {
  const { store, video } = fixture(t, "production");
  const env = { MOTIONMIND_STORE: store.root, HOME: tempDir(t), PATH: `${fakeNpx(t)}${path.delimiter}${process.env.PATH}` };
  const refused = runCli(["render", "demo/x", "v1-x"], env);
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /frozen/);
  assert.equal(fs.readFileSync(video, "utf8"), "old");
  const forced = runCli(["render", "demo/x", "v1-x", "--force"], env);
  assert.equal(forced.code, 0, forced.stderr);
  assert.notEqual(fs.readFileSync(video, "utf8"), "old");
});
