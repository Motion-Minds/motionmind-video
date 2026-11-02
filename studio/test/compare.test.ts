import assert from "node:assert/strict";
import { test } from "node:test";
import { groupByCampaign, parseRegistered, suggestionsFor, type CompareRun } from "../lib/compare.ts";

const run = (project: string, version: string, registered: string, aspect = "9:16"): CompareRun => ({
  dir: `projects/${project}/runs/${version}`,
  project,
  version,
  versionNumber: Number(/^v(\d+)/.exec(version)![1]),
  aspect,
  registeredAt: parseRegistered(registered),
  registeredLabel: registered,
  stage: "staging",
  mp4Url: "",
  fields: {},
});

const v1 = run("acme/launch", "v1-a", "2026-10-01 09:00");
const v2 = run("acme/launch", "v2-b", "2026-10-02 09:00");
const v3 = run("acme/launch", "v3-c", "2026-10-03 09:00");
const v4 = run("acme/launch", "v4-d", "2026-10-04 09:00");
const wide = run("acme/launch", "v5-wide", "2026-10-02 12:00", "16:9");
const other = run("demo/coffee", "v9-x", "2026-10-05 09:00");
const all = [v1, v2, v3, v4, wide, other];
const dirs = (runs: CompareRun[]) => runs.map((r) => r.version);

test("registry stamps are local time and folder times are ISO; both order correctly", () => {
  assert.equal(parseRegistered("2026-10-02 09:00"), new Date(2026, 9, 2, 9, 0).getTime());
  assert.equal(parseRegistered("2026-10-02T02:00:00.000Z"), Date.UTC(2026, 9, 2, 2));
  assert.equal(parseRegistered("garbage"), 0);
});

test("B suggestions: A's previous versions newest first, then later ones, then other aspect ratios; never another campaign", () => {
  assert.deepEqual(dirs(suggestionsFor(v3, all)), ["v2-b", "v1-a", "v4-d", "v5-wide"]);
  // The oldest version has nothing before it, so its next version comes first.
  assert.deepEqual(dirs(suggestionsFor(v1, all)), ["v2-b", "v3-c", "v4-d", "v5-wide"]);
  assert.deepEqual(suggestionsFor(other, all), []);
});

test("runs logged in the same minute fall back to the version number", () => {
  const a = run("x/y", "v1-a", "2026-10-01 09:00");
  const b = run("x/y", "v2-b", "2026-10-01 09:00");
  const c = run("x/y", "v3-c", "2026-10-01 09:00");
  assert.deepEqual(dirs(suggestionsFor(c, [a, b, c])), ["v2-b", "v1-a"]);
  assert.deepEqual(dirs(suggestionsFor(a, [a, b, c])), ["v2-b", "v3-c"]);
});

test("pickers list campaigns by their latest run and runs newest first", () => {
  const groups = groupByCampaign(all);
  assert.deepEqual(groups.map((g) => g.project), ["demo/coffee", "acme/launch"]);
  assert.deepEqual(dirs(groups[1].runs), ["v4-d", "v3-c", "v5-wide", "v2-b", "v1-a"]);
});
