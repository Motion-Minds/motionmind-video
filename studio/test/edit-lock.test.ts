import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { readLock } from "../core/hyperframes.ts";
import { tempDir } from "./helpers.ts";

for (const [name, text] of [["truncated JSON", "{"], ["empty file", ""], ["no pid", "{}"], ["null", "null"], ["pid 0", '{"pid":0}']] as const) {
  test(`readLock: ${name} counts as no lock and is left in place`, (t) => {
    const f = path.join(tempDir(t), ".editing.json");
    fs.writeFileSync(f, text);
    assert.equal(readLock(f), null);
    assert.equal(fs.existsSync(f), true);
  });
}

test("readLock: missing file", (t) => {
  assert.equal(readLock(path.join(tempDir(t), ".editing.json")), null);
});

test("readLock: dead PID removes the lock", (t) => {
  const f = path.join(tempDir(t), ".editing.json");
  fs.writeFileSync(f, JSON.stringify({ pid: spawnSync(process.execPath, ["-e", ""]).pid, port: 1, url: "u", started_at: "s" }));
  assert.equal(readLock(f), null);
  assert.equal(fs.existsSync(f), false);
});

test("readLock: live PID returns the lock", (t) => {
  const f = path.join(tempDir(t), ".editing.json");
  fs.writeFileSync(f, JSON.stringify({ pid: process.pid, port: 3200, url: "http://localhost:3200/", started_at: "s" }));
  assert.equal(readLock(f)?.port, 3200);
});
