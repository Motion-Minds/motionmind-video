// Shared test helpers: a throwaway store per test, registry fixtures, and the CLI run from source.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { Store, type RegistryRun } from "../core/store.ts";

export const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function tempDir(t: TestContext): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "motionmind-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

export function tempStore(t: TestContext): Store {
  const store = new Store(tempDir(t));
  store.ensure();
  return store;
}

export function makeRun(over: Partial<RegistryRun> & Pick<RegistryRun, "run_id" | "project" | "version">): RegistryRun {
  return { run_dir: null, stage: "staging", created_at: "2026-01-01 00:00", title: over.run_id, params: { aspect: "9:16" }, artifacts: {}, metrics: {}, ...over };
}

export function seedRegistry(store: Store, runs: RegistryRun[]) {
  store.updateRegistry((reg) => {
    reg.runs = runs;
  });
}

export function runCli(args: string[], env: Record<string, string> = {}) {
  const res = spawnSync(process.execPath, [path.join(STUDIO, "cli", "main.ts"), ...args], {
    cwd: STUDIO,
    encoding: "utf8",
    env: { ...process.env, MOTIONMIND_PACKAGE_DIR: STUDIO, ...env },
  });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}
