import assert from "node:assert/strict";
import { test } from "node:test";
import { qaIssues } from "../core/qa.ts";

test("silent videos pass", () => {
  assert.deepEqual(qaIssues({ has_audio: false }), []);
  assert.deepEqual(qaIssues({ has_audio: false, integrated_lufs: -30, true_peak_dbfs: 3 }), []);
  assert.deepEqual(qaIssues({}), []);
});

test("on-target loudness and peak pass", () => {
  assert.deepEqual(qaIssues({ has_audio: true, integrated_lufs: -14, true_peak_dbfs: -1 }), []);
});

test("loudness tolerance is +-0.5 LUFS, inclusive", () => {
  assert.deepEqual(qaIssues({ has_audio: true, integrated_lufs: -14.5, true_peak_dbfs: -2 }), []);
  assert.deepEqual(qaIssues({ has_audio: true, integrated_lufs: -13.5, true_peak_dbfs: -2 }), []);
  assert.deepEqual(qaIssues({ has_audio: true, integrated_lufs: -14.51, true_peak_dbfs: -2 }), ["-14.51 LUFS (target -14 ±0.5)"]);
  assert.deepEqual(qaIssues({ has_audio: true, integrated_lufs: -13.51, true_peak_dbfs: -2 }), []);
  assert.deepEqual(qaIssues({ has_audio: true, integrated_lufs: -13.49, true_peak_dbfs: -2 }), ["-13.49 LUFS (target -14 ±0.5)"]);
});

test("true peak above -1 dBFS fails", () => {
  assert.deepEqual(qaIssues({ has_audio: true, integrated_lufs: -14, true_peak_dbfs: -1 }), []);
  assert.deepEqual(qaIssues({ has_audio: true, integrated_lufs: -14, true_peak_dbfs: -0.99 }), ["true peak -0.99 dBFS (max -1)"]);
});

test("missing measurements are reported when the video has audio", () => {
  assert.deepEqual(qaIssues({ has_audio: true, integrated_lufs: null, true_peak_dbfs: -2 }), ["loudness not measured"]);
  assert.deepEqual(qaIssues({ has_audio: true, integrated_lufs: -14, true_peak_dbfs: null }), ["true peak not measured"]);
  assert.deepEqual(qaIssues({ has_audio: true }), ["loudness not measured", "true peak not measured"]);
});

test("both rules can fail at once", () => {
  assert.equal(qaIssues({ has_audio: true, integrated_lufs: -20, true_peak_dbfs: 0 }).length, 2);
});
