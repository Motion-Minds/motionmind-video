// HyperFrames engine adapter: detect a project, read its parameters, and drive the pinned CLI (init, preview, render).
import type { ExecFileOptions } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { run } from "./media.ts";
import { isFile, pidAlive, stamp, UserError } from "./store.ts";

export const HF_VERSION = "0.8.214";
export const HF_RESOLUTIONS = ["portrait", "landscape", "square"] as const;
/** Never copied into a run snapshot: dependencies, renders, editor caches. */
export const HF_SKIP: Record<string, true> = {
  node_modules: true, renders: true, ".hyperframes": true, ".git": true, ".DS_Store": true, ".thumbnails": true, ".waveform-cache": true,
};
export const EDIT_LOCK = ".editing.json";

export interface EditLock {
  pid: number;
  port: number;
  url: string;
  started_at: string;
  /** Project folder the preview serves (the run's src/ or a tracked project). */
  dir?: string;
}

export const env = () => ({ ...process.env, HYPERFRAMES_NO_TELEMETRY: "1", DO_NOT_TRACK: "1", HYPERFRAMES_SKIP_SKILLS: "1" });

/**
 * npm's own npx entry script, for Windows: there `npx` is `npx.cmd`, which execFile cannot start (Node refuses .cmd
 * without a shell, and a shell would split paths containing spaces). Lookup order follows npx.cmd: a globally
 * upgraded npm, the npm bundled next to this node, then the npm next to any npx.cmd on PATH.
 */
function npxCli(): string | null {
  const prefix = process.env.npm_config_prefix ?? (process.env.APPDATA ? path.join(process.env.APPDATA, "npm") : null);
  const onPath = (process.env.PATH ?? "").split(path.delimiter).filter((d) => d && isFile(path.join(d, "npx.cmd")));
  const dirs = [...(prefix ? [prefix] : []), path.dirname(process.execPath), ...onPath];
  return dirs.map((d) => path.join(d, "node_modules", "npm", "bin", "npx-cli.js")).find(isFile) ?? null;
}

/** Run `npx <args>` on every platform. */
export function runNpx(args: string[], opts: ExecFileOptions) {
  if (process.platform !== "win32") return run("npx", args, opts);
  const cli = npxCli();
  if (!cli) return Promise.reject(new UserError("npx not found: install Node.js with npm (https://nodejs.org)."));
  return run(process.execPath, [cli, ...args], opts);
}

export function isProject(dir: string): boolean {
  if (isFile(path.join(dir, "hyperframes.json"))) return true;
  const index = path.join(dir, "index.html");
  return isFile(index) && fs.readFileSync(index, "utf8").includes("data-composition-id");
}

/** CLI version pinned in package.json (`hyperframes@X.Y.Z`), else the version this package was tested with. */
export function versionOf(dir: string): string {
  const pkg = path.join(dir, "package.json");
  return (isFile(pkg) && /hyperframes@(\d+\.\d+\.\d+)/.exec(fs.readFileSync(pkg, "utf8"))?.[1]) || HF_VERSION;
}

export async function npx(dir: string, args: string[], timeout = 900_000) {
  try {
    const { stdout, stderr } = await runNpx(["-y", `hyperframes@${versionOf(dir)}`, ...args], { cwd: dir, env: env(), timeout, maxBuffer: 64 * 1024 * 1024 });
    return { ok: true, output: `${stdout}${stderr}` };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    return { ok: false, output: `${e.stdout ?? ""}${e.stderr ?? ""}` || e.message };
  }
}

/** Parameters worth comparing between runs, read from the root composition and its hosts. */
export function params(dir: string): Record<string, unknown> {
  const index = path.join(dir, "index.html");
  const html = isFile(index) ? fs.readFileSync(index, "utf8") : "";
  const root = /<[^>]*data-composition-id="([^"]+)"[^>]*>/.exec(html)?.[0] ?? "";
  const attr = (tag: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];
  const variables: Record<string, unknown> = {};
  for (const m of html.matchAll(/data-variable-values='([^']*)'|data-variable-values="([^"]*)"/g)) {
    try {
      Object.assign(variables, JSON.parse((m[1] ?? m[2]).replace(/&quot;/g, '"')));
    } catch {
      /* hand-written attribute that is not JSON; skip */
    }
  }
  const compositions = [...new Set([...html.matchAll(/data-composition-src="([^"]+)"/g)].map((m) => m[1]))];
  return {
    engine: "hyperframes",
    hyperframes_version: versionOf(dir),
    composition: attr(root, "data-composition-id") ?? null,
    width: Number(attr(root, "data-width")) || null,
    height: Number(attr(root, "data-height")) || null,
    duration: Number(attr(root, "data-duration")) || null,
    scenes: compositions.length,
    ...(Object.keys(variables).length ? { variables } : {}),
  };
}

export function copyProject(from: string, to: string) {
  fs.cpSync(from, to, { recursive: true, filter: (src) => src === from || !Object.hasOwn(HF_SKIP, path.basename(src)) });
}

export async function init(runDir: string, resolution: string) {
  const res = await runNpx(["-y", `hyperframes@${HF_VERSION}`, "init", "src", "--example", "blank", "--resolution", resolution, "--non-interactive", "--skip-skills"],
    { cwd: runDir, env: env() }).then((r) => ({ ok: true, out: `${r.stdout}${r.stderr}` }), (e) => ({ ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` || e.message }));
  if (!res.ok || !isFile(path.join(runDir, "src", "hyperframes.json"))) throw new UserError(`hyperframes init failed:\n${res.out}`);
}

/** Pin the CLI version in package.json so the snapshot re-renders with the same HyperFrames. */
export function pin(src: string) {
  if (!isFile(path.join(src, "hyperframes.json"))) {
    fs.writeFileSync(path.join(src, "hyperframes.json"), JSON.stringify({
      $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
      paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
    }, null, 2) + "\n");
  }
  const pkgFile = path.join(src, "package.json");
  const text = isFile(pkgFile) ? fs.readFileSync(pkgFile, "utf8") : "";
  if (text.includes("hyperframes@")) return;
  const version = versionOf(src);
  const pkg = text ? JSON.parse(text) : { name: path.basename(path.dirname(src)), private: true, type: "module" };
  pkg.scripts = { ...pkg.scripts, dev: `npx --yes hyperframes@${version} preview`, check: `npx --yes hyperframes@${version} check`, render: `npx --yes hyperframes@${version} render` };
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");
}

export function readLock(lockFile: string): EditLock | null {
  if (!isFile(lockFile)) return null;
  const lock = JSON.parse(fs.readFileSync(lockFile, "utf8")) as EditLock;
  if (pidAlive(lock.pid)) return lock;
  fs.rmSync(lockFile, { force: true });
  return null;
}

async function freePort(start = 3200): Promise<number> {
  for (let port = start; port < start + 200; port++) {
    const { promise, resolve } = Promise.withResolvers<boolean>();
    const s = net.createServer().once("error", () => resolve(false)).once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
    if (await promise) return port;
  }
  throw new UserError("No free port for the HyperFrames preview.");
}

/** Start HyperFrames Studio for `dir` in the background and write the edit lock. */
export async function openEditor(dir: string, lockFile: string): Promise<EditLock> {
  const open = readLock(lockFile);
  if (open) return open;
  const port = await freePort();
  const res = await npx(dir, ["preview", "--background", "--port", String(port)], 120_000);
  const url = /Studio\s+(http:\/\/localhost:\d+\/\S*)/.exec(res.output)?.[1];
  const status = await npx(dir, ["preview", "--status"], 60_000);
  const pid = Number(/PID (\d+)/.exec(status.output)?.[1]);
  if (!res.ok || !url || !pid) {
    await npx(dir, ["preview", "--stop"], 60_000);
    throw new UserError(`HyperFrames preview failed to start:\n${res.output}${status.output}`);
  }
  const lock: EditLock = { pid, port, url, started_at: stamp(), dir };
  fs.writeFileSync(lockFile, JSON.stringify(lock, null, 2) + "\n");
  return lock;
}

export async function closeEditor(dir: string, lockFile: string) {
  await npx(dir, ["preview", "--stop"], 60_000);
  fs.rmSync(lockFile, { force: true });
}

/** Render `dir` to `out` with the pinned CLI. */
export async function render(dir: string, out: string, crf = 18) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.rmSync(out, { force: true });
  const res = await npx(dir, ["render", "-o", out, "--crf", String(crf), "--quiet"]);
  if (!res.ok || !isFile(out)) throw new UserError(`Render failed:\n${res.output.slice(-6000)}`);
}
