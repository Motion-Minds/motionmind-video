import assert from "node:assert/strict";
import { test } from "node:test";
import { findRun, promote } from "../core/runs.ts";
import { UserError } from "../core/store.ts";
import { makeRun, runCli, seedRegistry, tempDir, tempStore } from "./helpers.ts";

const runs = [
  makeRun({ run_id: "acme-launch-v1", project: "acme/launch", version: "v1-x", stage: "production" }),
  makeRun({ run_id: "demo-promo-v1", project: "demo/promo", version: "v1-x", stage: "production" }),
  makeRun({ run_id: "demo-promo-v2", project: "demo/promo", version: "v2-y" }),
  makeRun({ run_id: "v2-y", project: "acme/launch", version: "v9-z" }),
];

test("run_id wins over a version of the same name", () => assert.equal(findRun(runs, "v2-y").run_id, "v2-y"));

test("a unique version resolves", () => assert.equal(findRun(runs, "v9-z").run_id, "v2-y"));

test("an ambiguous version throws and lists every candidate", () => {
  assert.throws(
    () => findRun(runs, "v1-x"),
    (err) =>
      err instanceof UserError &&
      /'v1-x' matches 2 runs/.test(err.message) &&
      /acme-launch-v1\s+acme\/launch/.test(err.message) &&
      /demo-promo-v1\s+demo\/promo/.test(err.message) &&
      /--campaign/.test(err.message),
  );
});

test("campaign narrows an ambiguous version", () => assert.equal(findRun(runs, "v1-x", "demo/promo").run_id, "demo-promo-v1"));

test("campaign narrows a run_id too", () => {
  assert.throws(() => findRun(runs, "demo-promo-v1", "acme/launch"), (err) => err instanceof UserError && err.message === "Run 'demo-promo-v1' not found in acme/launch.");
});

test("an unknown reference is not found", () => {
  assert.throws(() => findRun(runs, "nope"), (err) => err instanceof UserError && err.message === "Run 'nope' not found.");
});

test("an ambiguous promote changes nothing, no demotion either", (t) => {
  const store = tempStore(t);
  seedRegistry(store, runs);
  const before = JSON.stringify(store.readRegistry());
  assert.throws(() => promote(store, "v1-x", "production", true), UserError);
  assert.equal(JSON.stringify(store.readRegistry()), before);
});

test("promote with a campaign picks that campaign's run and demotes only its own production run", (t) => {
  const store = tempStore(t);
  seedRegistry(store, [
    makeRun({ run_id: "acme-launch-v1", project: "acme/launch", version: "v1-x", stage: "production" }),
    makeRun({ run_id: "demo-promo-v1", project: "demo/promo", version: "v1-x" }),
    makeRun({ run_id: "demo-promo-v0", project: "demo/promo", version: "v0", stage: "production" }),
  ]);
  const res = promote(store, "v1-x", "production", true, "demo/promo");
  assert.equal(res.runId, "demo-promo-v1");
  const stages = Object.fromEntries(store.readRegistry().runs.map((r) => [r.run_id, r.stage]));
  assert.deepEqual(stages, { "acme-launch-v1": "production", "demo-promo-v1": "production", "demo-promo-v0": "archived" });
});

test("CLI promote: ambiguous version exits 1 with candidates, --campaign succeeds", (t) => {
  const store = tempStore(t);
  seedRegistry(store, runs);
  const env = { MOTIONMIND_STORE: store.root, HOME: tempDir(t) };
  const amb = runCli(["promote", "v1-x", "--stage", "archived"], env);
  assert.equal(amb.code, 1);
  assert.match(amb.stderr, /matches 2 runs/);
  assert.match(amb.stderr, /acme-launch-v1/);
  assert.match(amb.stderr, /demo-promo-v1/);
  assert.doesNotMatch(amb.stderr, /\n\s+at /);
  const ok = runCli(["promote", "v1-x", "--stage", "archived", "--campaign", "demo/promo"], env);
  assert.equal(ok.code, 0, ok.stderr);
  const stages = Object.fromEntries(store.readRegistry().runs.map((r) => [r.run_id, r.stage]));
  assert.equal(stages["demo-promo-v1"], "archived");
  assert.equal(stages["acme-launch-v1"], "production");
});

test("CLI promote: a malformed --campaign is a one-line error", (t) => {
  const store = tempStore(t);
  seedRegistry(store, runs);
  const res = runCli(["promote", "v1-x", "--stage", "archived", "--campaign", "Foo"], { MOTIONMIND_STORE: store.root, HOME: tempDir(t) });
  assert.equal(res.code, 1);
  assert.match(res.stderr, /Campaign must look like <brand>\/<campaign>/);
  assert.doesNotMatch(res.stderr, /\n\s+at /);
});

test("CLI compare: ambiguous version exits 1, --campaign resolves it", (t) => {
  const store = tempStore(t);
  seedRegistry(store, runs);
  const env = { MOTIONMIND_STORE: store.root, HOME: tempDir(t) };
  const amb = runCli(["compare", "v1-x", "v2-y"], env);
  assert.equal(amb.code, 1);
  assert.match(amb.stderr, /'v1-x' matches 2 runs/);
  const ok = runCli(["compare", "v1-x", "demo-promo-v2", "--campaign", "demo/promo"], env);
  assert.equal(ok.code, 0, ok.stderr);
  assert.match(ok.stdout, /demo-promo-v1/);
  assert.match(ok.stdout, /demo-promo-v2/);
});
