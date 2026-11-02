import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { claimNextRunDir, importRun, logVideo } from "../core/runs.ts";
import { UserError } from "../core/store.ts";
import { STUDIO, tempDir, tempStore } from "./helpers.ts";

const execFileAsync = promisify(execFile);
const hasFfmpeg = () => ["ffmpeg", "ffprobe"].every((bin) => spawnSync(bin, ["-version"]).status === 0);
const skip = !hasFfmpeg() && "ffmpeg not installed";

/** One second of silent test video. */
function makeClip(file: string) {
  const res = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=d=1:s=64x64:r=10", "-pix_fmt", "yuv420p", file]);
  assert.equal(res.status, 0, String(res.stderr));
}

const runFolders = (store: ReturnType<typeof tempStore>, campaign: string) => {
  const dir = path.join(store.campaignDir(campaign), "runs");
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
};
const ids = (store: ReturnType<typeof tempStore>) => store.readRegistry().runs.map((r) => r.run_id);

test("log with a missing --src fails before anything is created", async (t) => {
  const store = tempStore(t);
  const video = path.join(tempDir(t), "clip.mp4");
  fs.writeFileSync(video, "not a real video");
  await assert.rejects(
    logVideo(store, { campaign: "demo/x", video, src: "/nope/missing-project" }),
    (err) => err instanceof UserError && /Project folder not found/.test(err.message),
  );
  assert.deepEqual(runFolders(store, "demo/x"), []);
  assert.deepEqual(store.readRegistry().runs, []);
});

test("an invalid version is refused before any folder is created", (t) => {
  const store = tempStore(t);
  assert.throws(() => claimNextRunDir(store, "demo/x", "Bad Slug"), (err) => err instanceof UserError && /Version must look like/.test(err.message));
  assert.deepEqual(runFolders(store, "demo/x"), []);
});

test("claimNextRunDir numbers after the existing runs and never reuses a folder", (t) => {
  const store = tempStore(t);
  fs.mkdirSync(store.runDir("demo/x", "v3-old"), { recursive: true });
  const a = claimNextRunDir(store, "demo/x", "a");
  const b = claimNextRunDir(store, "demo/x", "a");
  assert.deepEqual([a.version, b.version], ["v4-a", "v5-a"]);
  assert.ok(fs.statSync(a.runDir).isDirectory() && fs.statSync(b.runDir).isDirectory());
  assert.ok(!fs.existsSync(store.path(".registry.lock")));
});

test("importRun on an existing run folder is refused and the folder is kept", async (t) => {
  const store = tempStore(t);
  const origin = tempDir(t);
  fs.writeFileSync(path.join(origin, "index.html"), '<div data-composition-id="main"></div>');
  const existing = store.runDir("demo/x", "v1-x");
  fs.mkdirSync(existing, { recursive: true });
  fs.writeFileSync(path.join(existing, "keep.txt"), "mine");
  await assert.rejects(importRun(store, { source: origin, campaign: "demo/x", version: "v1-x" }), (err) => err instanceof UserError && /already exists/.test(err.message));
  assert.equal(fs.readFileSync(path.join(existing, "keep.txt"), "utf8"), "mine");
});

test("a failed import removes the run folder it created", async (t) => {
  const store = tempStore(t);
  const origin = tempDir(t);
  fs.writeFileSync(path.join(origin, "index.html"), '<div data-composition-id="main"></div>');
  t.mock.method(fs, "cpSync", () => {
    throw new Error("disk full");
  });
  await assert.rejects(importRun(store, { source: origin, campaign: "demo/x", version: "v1-x" }), /disk full/);
  assert.deepEqual(runFolders(store, "demo/x"), []);
});

test("parallel processes claiming auto versions get distinct numbers", async (t) => {
  const store = tempStore(t);
  const runs = pathToFileURL(path.join(STUDIO, "core", "runs.ts")).href;
  const stores = pathToFileURL(path.join(STUDIO, "core", "store.ts")).href;
  const script = `
    import { claimNextRunDir } from ${JSON.stringify(runs)};
    import { Store } from ${JSON.stringify(stores)};
    const store = new Store(${JSON.stringify(store.root)});
    for (let i = 0; i < 10; i++) {
      // withLock can still throw ENOENT when the holder releases mid-check (fixed separately); that is not what is tested here.
      for (;;) {
        try {
          claimNextRunDir(store, "demo/x", "p" + process.pid + "-" + i);
          break;
        } catch (err) {
          if (err.code !== "ENOENT") throw err;
        }
      }
    }
  `;
  await Promise.all(Array.from({ length: 4 }, () => execFileAsync(process.execPath, ["--input-type=module", "-e", script])));
  const folders = runFolders(store, "demo/x");
  assert.equal(folders.length, 40);
  const numbers = folders.map((f) => Number(/^v(\d+)-/.exec(f)![1])).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: 40 }, (_, i) => i + 1));
});

test("explicit versions v4-a and v4-b get different run_ids", { skip }, async (t) => {
  const store = tempStore(t);
  const video = path.join(tempDir(t), "clip.mp4");
  makeClip(video);
  await logVideo(store, { campaign: "demo/x", video, version: "v4-a" });
  await logVideo(store, { campaign: "demo/x", video, version: "v4-b" });
  assert.deepEqual(ids(store), ["demo-x-v4", "demo-x-v4-b"]);
});

test("campaigns that flatten to the same id get different run_ids; the first keeps the short form", { skip }, async (t) => {
  const store = tempStore(t);
  const video = path.join(tempDir(t), "clip.mp4");
  makeClip(video);
  await logVideo(store, { campaign: "acme-launch/15s", video, version: "v1-x" });
  await logVideo(store, { campaign: "acme/launch-15s", video, version: "v1-x" });
  assert.deepEqual(ids(store), ["acme-launch-15s-v1", "acme-launch-15s-v1-x"]);
});

test("auto-numbered logs of the same clip each get their own run and id", { skip }, async (t) => {
  const store = tempStore(t);
  const video = path.join(tempDir(t), "clip.mp4");
  makeClip(video);
  await logVideo(store, { campaign: "demo/x", video });
  await logVideo(store, { campaign: "demo/x", video });
  assert.equal(runFolders(store, "demo/x").length, 2);
  assert.deepEqual(ids(store), ["demo-x-v1", "demo-x-v2"]);
});

test("re-logging an in-place video keeps its run_id and a single entry", { skip }, async (t) => {
  const store = tempStore(t);
  const video = path.join(tempDir(t), "clip.mp4");
  makeClip(video);
  await logVideo(store, { campaign: "demo/x", video, version: "v4-a" });
  await logVideo(store, { campaign: "demo/x", video, version: "v4-b" });
  const inPlace = store.path("projects", "demo", "x", "runs", "v4-b", "video.mp4");
  await logVideo(store, { campaign: "demo/x", video: inPlace });
  assert.deepEqual(ids(store), ["demo-x-v4", "demo-x-v4-b"]);
});

test("an explicit run_id used by another run is refused and the new folder is removed", { skip }, async (t) => {
  const store = tempStore(t);
  const video = path.join(tempDir(t), "clip.mp4");
  makeClip(video);
  await logVideo(store, { campaign: "demo/x", video, version: "v1-a", runId: "taken" });
  await assert.rejects(
    logVideo(store, { campaign: "demo/x", video, version: "v2-b", runId: "taken" }),
    (err) => err instanceof UserError && /already used/.test(err.message),
  );
  assert.deepEqual(runFolders(store, "demo/x"), ["v1-a"]);
  assert.deepEqual(ids(store), ["taken"]);
});

test("a failure after the copy leaves no run folder (project snapshot throws)", { skip }, async (t) => {
  const store = tempStore(t);
  const dir = tempDir(t);
  const video = path.join(dir, "clip.mp4");
  makeClip(video);
  t.mock.method(fs, "cpSync", () => {
    throw new Error("disk full");
  });
  await assert.rejects(logVideo(store, { campaign: "demo/x", video, src: dir }), /disk full/);
  assert.deepEqual(runFolders(store, "demo/x"), []);
  assert.deepEqual(store.readRegistry().runs, []);
});

test("a failed log never removes a run that already exists", { skip }, async (t) => {
  const store = tempStore(t);
  const video = path.join(tempDir(t), "clip.mp4");
  makeClip(video);
  await logVideo(store, { campaign: "demo/x", video, version: "v1-a" });
  await assert.rejects(logVideo(store, { campaign: "demo/x", video, version: "v1-a" }), /already exists/);
  assert.ok(fs.existsSync(store.path("projects", "demo", "x", "runs", "v1-a", "video.mp4")));
  assert.deepEqual(ids(store), ["demo-x-v1"]);
});
