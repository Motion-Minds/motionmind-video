import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { imageAspect, logImages, promote } from "../core/runs.ts";
import { Store, UserError } from "../core/store.ts";
import { makeRun, runCli, seedRegistry, tempDir, tempStore } from "./helpers.ts";

function makeImage(file: string, size: string) {
  const res = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=navy:s=${size}`, "-frames:v", "1", file]);
  assert.equal(res.status, 0, String(res.stderr));
}

const stages = (store: Store) => Object.fromEntries(store.readRegistry().runs.map((r) => [r.run_id, r.stage]));

test("an image run of the campaign is logged in place with count, aspect and hash; contact sheets are skipped", async (t) => {
  const store = tempStore(t);
  const dir = store.runDir("acme/carousel", "v1-hook");
  fs.mkdirSync(dir, { recursive: true });
  for (const n of ["01-hook.png", "02-points.png", "03-cta.png"]) makeImage(path.join(dir, n), "108x135");
  makeImage(path.join(dir, "00-carousel-preview.png"), "330x100");
  makeImage(path.join(dir, "contact-sheet.png"), "64x64");
  const res = await logImages(store, { campaign: "acme/carousel", source: dir, title: "Carousel" });
  const [run] = store.readRegistry().runs;
  assert.equal(res.runId, "acme-carousel-v1");
  // The wide preview strip sorts first but the slides' 4:5 is the deliverable's format.
  assert.deepEqual([run.version, run.stage, run.params.engine, run.params.aspect, run.params.mixed_sizes, run.metrics.images, run.metrics.width], ["v1-hook", "staging", "image", "4:5", true, 4, 108]);
  assert.deepEqual(run.artifacts.images, ["00-carousel-preview.png", "01-hook.png", "02-points.png", "03-cta.png"].map((n) => `projects/acme/carousel/runs/v1-hook/${n}`));
  assert.match(run.hashes?.images_sha256 ?? "", /^[0-9a-f]{64}$/);
  assert.match(fs.readFileSync(store.path("projects", "acme", "carousel", "LOG.md"), "utf8"), /log v1-hook · acme-carousel-v1 \(staging\) · 4 images · 108x135 \(4:5, mixed sizes\)/);
});

test("a folder outside the store is copied into the next version; the source is untouched", async (t) => {
  const store = tempStore(t);
  const out = tempDir(t);
  makeImage(path.join(out, "cover.jpg"), "160x90");
  fs.writeFileSync(path.join(out, "notes.txt"), "x");
  await logImages(store, { campaign: "acme/covers", source: out, version: "v1-figma" });
  assert.deepEqual(fs.readdirSync(store.runDir("acme/covers", "v1-figma")), ["cover.jpg"]);
  assert.deepEqual(fs.readdirSync(out).sort(), ["cover.jpg", "notes.txt"]);
  assert.equal(store.readRegistry().runs[0].params.aspect, "16:9");
});

test("promoting images archives the previous production images, never the campaign's production video", async (t) => {
  const store = tempStore(t);
  seedRegistry(store, [
    makeRun({ run_id: "a-b-video", project: "a/b", version: "v1-reel", stage: "production", params: { aspect: "9:16", engine: "hyperframes" } }),
    makeRun({ run_id: "a-b-img1", project: "a/b", version: "v2-old", stage: "production", params: { aspect: "9:16", engine: "image" } }),
  ]);
  const dir = store.runDir("a/b", "v3-new");
  fs.mkdirSync(dir, { recursive: true });
  makeImage(path.join(dir, "story.png"), "90x160");
  const { runId } = await logImages(store, { campaign: "a/b", source: dir });
  promote(store, runId!, "production");
  assert.deepEqual(stages(store), { "a-b-video": "production", "a-b-img1": "archived", [runId!]: "production" });
});

test("folders without images, or with a video, are refused and leave no run behind", async (t) => {
  const store = tempStore(t);
  const empty = tempDir(t);
  await assert.rejects(logImages(store, { campaign: "a/b", source: empty }), (e) => e instanceof UserError && /No \.png/.test(e.message));
  fs.writeFileSync(path.join(empty, "video.mp4"), "");
  makeImage(path.join(empty, "still.png"), "64x64");
  await assert.rejects(logImages(store, { campaign: "a/b", source: empty }), (e) => e instanceof UserError && /contains a video/.test(e.message));
  assert.equal(fs.existsSync(store.path("projects", "a", "b", "runs")), false);
  assert.deepEqual(store.readRegistry().runs, []);
});

test("imageAspect names common ratios, else gives the ratio to 1", () => {
  assert.deepEqual([imageAspect(1080, 1350), imageAspect(1080, 1920), imageAspect(1200, 630), imageAspect(1000, 700), imageAspect(600, 1000)], ["4:5", "9:16", "1.91:1", "1.43:1", "1:1.67"]);
});

test("CLI log routes a folder to image logging and rejects video-only flags", (t) => {
  const store = tempStore(t);
  const out = tempDir(t);
  makeImage(path.join(out, "a.png"), "64x64");
  const env = { MOTIONMIND_STORE: store.root };
  const bad = runCli(["log", out, "--campaign", "a/b", "--src", out], env);
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /--src only apply to videos/);
  const ok = runCli(["log", out, "--campaign", "a/b", "--stage", "production"], env);
  assert.equal(ok.code, 0, ok.stderr);
  assert.match(ok.stdout, /\(production\) · .* · 1 image · 64x64 \(1:1\)/);
});
