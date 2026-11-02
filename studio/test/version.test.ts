import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { STUDIO, runCli, tempDir } from "./helpers.ts";

const { version } = JSON.parse(fs.readFileSync(path.join(STUDIO, "package.json"), "utf8"));

for (const flag of ["--version", "-v"]) {
  test(`${flag} prints the package version`, (t) => {
    const res = runCli([flag], { MOTIONMIND_STORE: tempDir(t), HOME: tempDir(t) });
    assert.equal(res.code, 0, res.stderr);
    assert.equal(res.stdout.trim(), version);
  });
}
