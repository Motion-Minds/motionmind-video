import assert from "node:assert/strict";
import { test } from "node:test";
import { makeRun, runCli, seedRegistry, tempDir, tempStore } from "./helpers.ts";

test("help exits 0 and lists promote", (t) => {
  const home = tempDir(t);
  const res = runCli(["help"], { MOTIONMIND_STORE: tempDir(t), HOME: home });
  assert.equal(res.code, 0);
  assert.match(res.stdout, /motionmind promote/);
});

test("promote of an unknown run exits 1 with a one-line error", (t) => {
  const res = runCli(["promote", "nope", "--stage", "staging"], { MOTIONMIND_STORE: tempDir(t), HOME: tempDir(t) });
  assert.equal(res.code, 1);
  assert.match(res.stderr, /Run 'nope' not found\./);
  assert.doesNotMatch(res.stderr, /\n\s+at /);
});

test("list prints the run_ids of the registry", (t) => {
  const store = tempStore(t);
  seedRegistry(store, [
    makeRun({ run_id: "a-b-v1", project: "a/b", version: "v1" }),
    makeRun({ run_id: "c-d-v2", project: "c/d", version: "v2", stage: "production" }),
  ]);
  const res = runCli(["list"], { MOTIONMIND_STORE: store.root, HOME: tempDir(t) });
  assert.equal(res.code, 0);
  assert.match(res.stdout, /RUN_ID/);
  assert.match(res.stdout, /a-b-v1/);
  assert.match(res.stdout, /c-d-v2\s+v2\s+production/);
  const filtered = runCli(["list", "--campaign", "a/b"], { MOTIONMIND_STORE: store.root, HOME: tempDir(t) });
  assert.match(filtered.stdout, /a-b-v1/);
  assert.doesNotMatch(filtered.stdout, /c-d-v2/);
});
