import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { defaultRunId, nextVersionNumber, parseCampaign, SLUG, STORE_MARKER, resolveStore, Store, UserError, VERSION, versionNumber } from "../core/store.ts";
import { tempDir, tempStore } from "./helpers.ts";

test("SLUG accepts lowercase slugs and rejects the rest", () => {
  for (const ok of ["a", "acme", "acme-launch-15s", "0day", "a".repeat(64)]) assert.ok(SLUG.test(ok), ok);
  for (const bad of ["", "-a", "A", "a_b", "a b", "a/b", ".a", "a".repeat(65)]) assert.ok(!SLUG.test(bad), bad);
});

test("VERSION accepts v<N> with an optional slug and rejects the rest", () => {
  for (const ok of ["v1", "v12", "v1-hook", "v3-fast-cut"]) assert.ok(VERSION.test(ok), ok);
  for (const bad of ["", "v", "1", "v1-", "V1", "v1_x", "v1/x", "../v1", "x1-a"]) assert.ok(!VERSION.test(bad), bad);
});

test("parseCampaign splits brand and name", () => {
  assert.deepEqual(parseCampaign("acme/launch-15s"), { brand: "acme", name: "launch-15s", campaign: "acme/launch-15s" });
});

test("parseCampaign rejects malformed campaigns with a UserError", () => {
  for (const bad of ["acme", "acme/", "/launch", "a/b/c", "Acme/launch", "acme/Launch", ""]) {
    assert.throws(() => parseCampaign(bad), (err) => err instanceof UserError && /Campaign must look like <brand>\/<campaign>/.test(err.message), bad);
  }
});

test("versionNumber reads the leading number", () => {
  assert.equal(versionNumber("v7"), 7);
  assert.equal(versionNumber("v12-hook"), 12);
  assert.equal(versionNumber("nope"), 0);
});

test("nextVersionNumber is highest + 1 and ignores hidden folders", (t) => {
  const store = tempStore(t);
  assert.equal(nextVersionNumber(store, "acme/launch"), 1);
  for (const d of ["v1-a", "v3-b", ".hidden"]) fs.mkdirSync(path.join(store.runDir("acme/launch", d)), { recursive: true });
  assert.equal(nextVersionNumber(store, "acme/launch"), 4);
  assert.equal(nextVersionNumber(store, "acme/other"), 1);
});

test("defaultRunId keeps the campaign and the version number only", () => {
  assert.equal(defaultRunId("acme/launch-15s", "v2-x"), "acme-launch-15s-v2");
  assert.equal(defaultRunId("acme/launch", "v10"), "acme-launch-v10");
});

test("resolveStore prefers MOTIONMIND_STORE", (t) => {
  const prev = process.env.MOTIONMIND_STORE;
  t.after(() => {
    if (prev === undefined) delete process.env.MOTIONMIND_STORE;
    else process.env.MOTIONMIND_STORE = prev;
  });
  const dir = tempDir(t);
  process.env.MOTIONMIND_STORE = dir;
  assert.equal(resolveStore("/"), path.resolve(dir));
});

test("resolveStore finds the nearest marker above the working directory", (t) => {
  const prev = process.env.MOTIONMIND_STORE;
  t.after(() => {
    if (prev === undefined) delete process.env.MOTIONMIND_STORE;
    else process.env.MOTIONMIND_STORE = prev;
  });
  delete process.env.MOTIONMIND_STORE;
  const root = fs.realpathSync(tempDir(t));
  fs.writeFileSync(path.join(root, STORE_MARKER), "{}");
  const nested = path.join(root, "a", "b");
  fs.mkdirSync(nested, { recursive: true });
  assert.equal(resolveStore(nested), root);
});

test("updateRegistry round-trips and leaves no temp or lock files", (t) => {
  const store = tempStore(t);
  assert.deepEqual(store.readRegistry().runs, []);
  const out = store.updateRegistry((reg) => {
    reg.runs.push({ run_id: "a-b-v1", project: "a/b", version: "v1", run_dir: null, stage: "staging", created_at: "x", title: "t", params: {}, artifacts: {}, metrics: {} });
    return 42;
  });
  assert.equal(out, 42);
  const reg = store.readRegistry();
  assert.equal(reg.schema_version, "3.0");
  assert.deepEqual(reg.runs.map((r) => r.run_id), ["a-b-v1"]);
  const leftovers = fs.readdirSync(store.root).filter((f) => f.endsWith(".tmp") || f === ".registry.lock");
  assert.deepEqual(leftovers, []);
});

test("updateRegistry releases the lock when the callback throws", (t) => {
  const store = tempStore(t);
  assert.throws(() => store.updateRegistry(() => { throw new Error("boom"); }), /boom/);
  assert.ok(!fs.existsSync(store.path(".registry.lock")));
  assert.deepEqual(store.readRegistry().runs, []);
});

test("readConfig defaults when the marker is missing", (t) => {
  const store = new Store(tempDir(t));
  assert.deepEqual(store.readConfig(), { schema: 3, tracked: [] });
});

test("assertWritable blocks protected repos only", (t) => {
  const store = tempStore(t);
  const repo = path.join(tempDir(t), "product");
  fs.writeFileSync(store.path("motionmind.config.json"), JSON.stringify({ protected_repos: [repo] }));
  assert.throws(() => store.assertWritable(repo), (err) => err instanceof UserError && /Rule #1/.test(err.message));
  assert.throws(() => store.assertWritable(path.join(repo, "src", "x.mp4")), UserError);
  assert.doesNotThrow(() => store.assertWritable(repo + "-other"));
  assert.doesNotThrow(() => store.assertWritable(store.path("projects", "a")));
});
