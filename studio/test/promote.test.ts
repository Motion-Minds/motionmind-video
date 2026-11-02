import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { promote } from "../core/runs.ts";
import { UserError } from "../core/store.ts";
import { makeRun, seedRegistry, tempStore } from "./helpers.ts";

const GOOD = { has_audio: true, integrated_lufs: -14, true_peak_dbfs: -2 };
const BAD = { has_audio: true, integrated_lufs: -20, true_peak_dbfs: -2 };

const stages = (store: ReturnType<typeof tempStore>) => Object.fromEntries(store.readRegistry().runs.map((r) => [r.run_id, r.stage]));

test("promote resolves a run_id", (t) => {
  const store = tempStore(t);
  seedRegistry(store, [makeRun({ run_id: "a-b-v1", project: "a/b", version: "v1-x", metrics: GOOD })]);
  const res = promote(store, "a-b-v1", "production");
  assert.equal(res.runId, "a-b-v1");
  assert.equal(stages(store)["a-b-v1"], "production");
  assert.match(fs.readFileSync(store.path("projects", "a", "b", "LOG.md"), "utf8"), /promote v1-x · a-b-v1 → production/);
});

test("promote resolves a version that is unique", (t) => {
  const store = tempStore(t);
  seedRegistry(store, [makeRun({ run_id: "a-b-v1", project: "a/b", version: "v1-x", metrics: GOOD })]);
  promote(store, "v1-x", "production");
  assert.equal(stages(store)["a-b-v1"], "production");
});

test("promote of an unknown run fails with a UserError", (t) => {
  const store = tempStore(t);
  assert.throws(() => promote(store, "nope", "staging"), (err) => err instanceof UserError && err.message === "Run 'nope' not found.");
});

test("production with failing QA is refused and the registry is unchanged", (t) => {
  const store = tempStore(t);
  seedRegistry(store, [makeRun({ run_id: "a-b-v1", project: "a/b", version: "v1", metrics: BAD })]);
  const before = fs.readFileSync(store.path("registry.json"), "utf8");
  assert.throws(() => promote(store, "a-b-v1", "production"), (err) => err instanceof UserError && /QA failed for 'a-b-v1'/.test(err.message));
  assert.equal(fs.readFileSync(store.path("registry.json"), "utf8"), before);
});

test("force overrides QA and writes it to LOG.md", (t) => {
  const store = tempStore(t);
  seedRegistry(store, [makeRun({ run_id: "a-b-v1", project: "a/b", version: "v1", metrics: BAD })]);
  const res = promote(store, "a-b-v1", "production", true);
  assert.equal(stages(store)["a-b-v1"], "production");
  assert.ok(res.lines.some((l) => l.startsWith("QA overridden")));
  assert.match(fs.readFileSync(store.path("projects", "a", "b", "LOG.md"), "utf8"), /QA overridden: -20 LUFS/);
});

test("promoting to production archives the previous one of the same project and aspect only", (t) => {
  const store = tempStore(t);
  seedRegistry(store, [
    makeRun({ run_id: "a-b-v1", project: "a/b", version: "v1", stage: "production", params: { aspect: "9:16" } }),
    makeRun({ run_id: "a-b-v2", project: "a/b", version: "v2", stage: "production", params: { aspect: "16:9" } }),
    makeRun({ run_id: "a-c-v1", project: "a/c", version: "v1", stage: "production", params: { aspect: "9:16" } }),
    makeRun({ run_id: "a-b-v3", project: "a/b", version: "v3", stage: "staging", params: { aspect: "9:16" }, metrics: GOOD }),
  ]);
  promote(store, "a-b-v3", "production");
  assert.deepEqual(stages(store), { "a-b-v1": "archived", "a-b-v2": "production", "a-c-v1": "production", "a-b-v3": "production" });
});

test("promoting to staging demotes nobody", (t) => {
  const store = tempStore(t);
  seedRegistry(store, [
    makeRun({ run_id: "a-b-v1", project: "a/b", version: "v1", stage: "production" }),
    makeRun({ run_id: "a-b-v2", project: "a/b", version: "v2", stage: "archived" }),
  ]);
  promote(store, "a-b-v2", "staging");
  assert.deepEqual(stages(store), { "a-b-v1": "production", "a-b-v2": "staging" });
});
