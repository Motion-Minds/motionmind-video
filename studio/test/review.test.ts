import assert from "node:assert/strict";
import fs from "node:fs";
import { test, type TestContext } from "node:test";
import { addComment, readReview, readReviewAt, resolveComment, setVerdict, timecode } from "../core/review.ts";
import { UserError } from "../core/store.ts";
import { runCli, tempStore } from "./helpers.ts";

const T = { campaign: "demo/promo", version: "v1-first" };

function withRun(t: TestContext) {
  const store = tempStore(t);
  fs.mkdirSync(store.runDir(T.campaign, T.version), { recursive: true });
  return store;
}

test("comments get increasing ids, keep their video time and are logged", (t) => {
  const store = withRun(t);
  addComment(store, { ...T, text: "Logo too small", atS: 12.34, by: "Kevin" });
  addComment(store, { ...T, text: "Overall: calmer pace" });
  const r = readReview(store, T);
  assert.deepEqual(r.comments.map((c) => [c.id, c.at_s, c.by, c.resolved_at]), [[1, 12.3, "Kevin", null], [2, null, "reviewer", null]]);
  assert.match(fs.readFileSync(store.path("projects", "demo", "promo", "LOG.md"), "utf8"), /review v1-first · comment #1 @0:12\.3 \(Kevin\): "Logo too small"/);
});

test("resolving and reopening a comment; unknown ids are refused", (t) => {
  const store = withRun(t);
  addComment(store, { ...T, text: "x" });
  assert.ok(resolveComment(store, { ...T, id: 1 }).resolved_at);
  assert.equal(resolveComment(store, { ...T, id: 1, reopen: true }).resolved_at, null);
  assert.throws(() => resolveComment(store, { ...T, id: 9 }), (e) => e instanceof UserError && /#9 not found/.test(e.message));
});

test("request changes needs a note or an open comment; approve does not", (t) => {
  const store = withRun(t);
  assert.throws(() => setVerdict(store, { ...T, status: "changes_requested" }), UserError);
  assert.equal(fs.existsSync(store.runDir(T.campaign, T.version) + "/review.json"), false);
  setVerdict(store, { ...T, status: "changes_requested", note: "Hook is too slow" });
  setVerdict(store, { ...T, status: "approved", by: "Client" });
  assert.deepEqual([readReview(store, T).verdict?.status, readReview(store, T).verdict?.by], ["approved", "Client"]);
});

test("bad input never writes: empty text, negative time, missing run", (t) => {
  const store = withRun(t);
  assert.throws(() => addComment(store, { ...T, text: "   " }), UserError);
  assert.throws(() => addComment(store, { ...T, text: "x", atS: -1 }), UserError);
  assert.throws(() => addComment(store, { ...T, text: "x", atS: Number.NaN }), UserError);
  assert.throws(() => addComment(store, { campaign: "demo/promo", version: "v2-none", text: "x" }), (e) => e instanceof UserError && /Run not found/.test(e.message));
  assert.deepEqual(readReview(store, T).comments, []);
});

test("Studio read side survives a corrupt review.json", (t) => {
  const store = withRun(t);
  const dir = store.runDir(T.campaign, T.version);
  fs.writeFileSync(dir + "/review.json", "{ not json");
  assert.deepEqual(readReviewAt(dir), { verdict: null, comments: [] });
});

test("timecode rounds before carrying into minutes", () => {
  assert.equal(timecode(75.4), "1:15.4");
  assert.equal(timecode(59.96), "1:00.0");
  assert.equal(timecode(3), "0:03.0");
});

test("CLI review: add, resolve and print open comments first", (t) => {
  const store = withRun(t);
  const env = { MOTIONMIND_STORE: store.root };
  assert.equal(runCli(["review", T.campaign, T.version, "--comment", "Later fix", "--at", "20"], env).code, 0);
  assert.equal(runCli(["review", T.campaign, T.version, "--comment", "Earlier fix", "--at", "5"], env).code, 0);
  assert.equal(runCli(["review", T.campaign, T.version, "--resolve", "2"], env).code, 0);
  const out = runCli(["review", T.campaign, T.version], env);
  const lines = out.stdout.trim().split("\n");
  assert.equal(lines[0], "v1-first: no verdict yet");
  assert.match(lines[1], /^\[open\] +#1 +0:20\.0 +Later fix +\(agent, /);
  assert.match(lines[2], /^\[resolved\] #2 +0:05\.0 +Earlier fix/);
  const bad = runCli(["review", T.campaign, T.version, "--approve", "--request-changes"], env);
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /either --approve or --request-changes/);
});
