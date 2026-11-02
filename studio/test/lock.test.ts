import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { withLock, writeAtomic } from "../core/store.ts";
import { tempDir, tempStore } from "./helpers.ts";

const deadPid = () => spawnSync(process.execPath, ["-e", ""]).pid!;

test("withLock retries when the holder releases between EEXIST and the owner read", (t) => {
  const lock = path.join(tempDir(t), ".registry.lock");
  fs.writeFileSync(lock, String(process.ppid));
  const real = fs.readFileSync;
  let first = true;
  t.mock.method(fs, "readFileSync", function (this: unknown, ...args: Parameters<typeof fs.readFileSync>) {
    if (args[0] === lock && first) {
      first = false;
      fs.rmSync(lock);
    }
    return real.apply(fs, args);
  });
  assert.equal(withLock(lock, () => 42), 42);
  assert.equal(fs.existsSync(lock), false);
});

test("a dead holder's lock is removed", (t) => {
  const lock = path.join(tempDir(t), ".registry.lock");
  fs.writeFileSync(lock, String(deadPid()));
  assert.equal(withLock(lock, () => "ok"), "ok");
  assert.equal(fs.existsSync(lock), false);
});

test("a waiter that saw a dead PID does not remove the lock another waiter has just taken", (t) => {
  const lock = path.join(tempDir(t), ".registry.lock");
  const dead = deadPid();
  const other = String(process.ppid); // a live process standing in for the faster waiter
  fs.writeFileSync(lock, String(dead));
  const realRead = fs.readFileSync;
  const realRm = fs.rmSync;
  let reads = 0;
  const removedWhileOtherHeld: string[] = [];
  t.mock.method(fs, "readFileSync", function (this: unknown, ...args: Parameters<typeof fs.readFileSync>) {
    if (args[0] !== lock) return realRead.apply(fs, args);
    reads++;
    const out = realRead.apply(fs, args);
    // Right after this waiter reads the dead PID, the faster waiter steals the stale lock and takes it.
    if (reads === 1) fs.writeFileSync(lock, other);
    // A few polls later the faster waiter releases it.
    if (reads === 4) realRm(lock, { force: true });
    return out;
  });
  t.mock.method(fs, "rmSync", function (this: unknown, ...args: Parameters<typeof fs.rmSync>) {
    if (args[0] === lock && fs.existsSync(lock) && String(realRead(lock, "utf8")) === other) removedWhileOtherHeld.push("x");
    return realRm.apply(fs, args);
  });
  assert.equal(withLock(lock, () => "ok"), "ok");
  assert.deepEqual(removedWhileOtherHeld, []);
});

test("concurrent processes never lose a registry update", async (t) => {
  const store = tempStore(t);
  const dir = tempDir(t);
  const worker = path.join(dir, "worker.mjs");
  fs.writeFileSync(worker, `import { Store } from ${JSON.stringify(new URL("../core/store.ts", import.meta.url).href)};
const s = new Store(process.argv[2]);
for (let i = 0; i < 100; i++) s.updateRegistry((r) => { r.runs.push({ run_id: process.pid + "-" + i }); });`);
  const kids = Array.from({ length: 4 }, () => spawn(process.execPath, [worker, store.root], { stdio: ["ignore", "ignore", "pipe"] }));
  const codes = await Promise.all(kids.map((k) => new Promise<number | null>((resolve) => { k.stderr.resume(); k.on("exit", resolve); })));
  assert.deepEqual(codes, [0, 0, 0, 0]);
  assert.equal(store.readRegistry().runs.length, 400);
});

test("writeAtomic leaves no temp file", (t) => {
  const dir = tempDir(t);
  const f = path.join(dir, "x.json");
  writeAtomic(f, "{}\n");
  assert.equal(fs.readFileSync(f, "utf8"), "{}\n");
  assert.deepEqual(fs.readdirSync(dir), ["x.json"]);
});
