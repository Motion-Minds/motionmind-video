// Tracking store: the folder MotionMind writes runs into (like MLflow's mlruns/).
//
//   <store>/motionmind.store.json        marker + tracked projects
//   <store>/registry.json          logged runs (params, metrics, artifacts, stage)
//   <store>/projects/<brand>/<campaign>/{TASTE.md,PROGRESS.md,LOG.md,plan/,runs/<version>/}
//   <store>/shared/brands/<brand>/ optional brand kits
//
// Resolution: MOTIONMIND_STORE env → nearest ancestor of the working directory with motionmind.store.json → ~/.motionmind.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const STORE_MARKER = "motionmind.store.json";
export const STAGES = ["production", "staging", "archived"] as const;
export type Stage = (typeof STAGES)[number];
export const ENGINES = ["hyperframes", "mp4"] as const;
export type Engine = (typeof ENGINES)[number];

export class UserError extends Error {}

export interface RunSource {
  /** hub: authored inside the store · tracked: snapshot of an external project · file: a video logged on its own */
  kind: "hub" | "tracked" | "file";
  dir?: string | null;
  file?: string | null;
  file_mtime?: string | null;
}

export interface RegistryRun {
  run_id: string;
  project: string;
  version: string;
  run_dir: string | null;
  stage: Stage;
  created_at: string;
  title: string;
  params: Record<string, unknown> & {
    skill_engine?: string;
    engine?: string;
    aspect?: string;
    safe_area?: string;
    concept_name?: string;
    hook_copy?: string;
    cta_copy?: string;
    bpm?: number | null;
    palette?: string[];
    fonts?: string[];
    color_logic?: string;
  };
  artifacts: Partial<Record<"html" | "mp4" | "contact_sheet" | "design_board" | "breakdown" | "src", string | null>>;
  metrics: Record<string, unknown> & {
    width?: number;
    height?: number;
    fps?: number;
    duration_s?: number;
    size_mb?: number;
    has_audio?: boolean;
    integrated_lufs?: number | null;
    true_peak_dbfs?: number | null;
  };
  hashes?: { mp4_sha256?: string | null; html_sha256?: string | null };
  source?: RunSource;
  notes?: string;
}

export interface Registry {
  schema_version: string;
  updated_at: string;
  runs: RegistryRun[];
}

export interface TrackedProject {
  /** <brand>/<campaign> the project's renders are logged into */
  campaign: string;
  dir: string;
  engine: Engine;
  /** Only renders written after this moment are captured (ISO time). */
  since: string;
  added_at: string;
}

export interface StoreConfig {
  schema: number;
  tracked: TrackedProject[];
}

export const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const VERSION = /^v\d+(-[a-z0-9][a-z0-9-]{0,63})?$/;

export const isFile = (abs: string) => fs.statSync(abs, { throwIfNoEntry: false })?.isFile() ?? false;
export const isDir = (abs: string) => fs.statSync(abs, { throwIfNoEntry: false })?.isDirectory() ?? false;
export const visible = (name: string) => !name.startsWith(".");
export const listDirs = (abs: string) =>
  isDir(abs) ? fs.readdirSync(abs, { withFileTypes: true }).filter((d) => d.isDirectory() && visible(d.name)).map((d) => d.name).sort() : [];
export const expandHome = (p: string) => (p === "~" || p.startsWith("~/") ? path.join(os.homedir(), p.slice(1)) : p);

const pad = (n: number) => String(n).padStart(2, "0");
/** Local "YYYY-MM-DD HH:mm" — the timestamp format used in registry and LOG.md. */
export function stamp(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function resolveStore(cwd = process.cwd()): string {
  if (process.env.MOTIONMIND_STORE) return path.resolve(expandHome(process.env.MOTIONMIND_STORE));
  for (let dir = path.resolve(/*turbopackIgnore: true*/ cwd); ; dir = path.dirname(dir)) {
    if (isFile(path.join(/*turbopackIgnore: true*/ dir, STORE_MARKER))) return dir;
    if (path.dirname(dir) === dir) break;
  }
  return path.join(os.homedir(), ".motionmind");
}

/** Folder of the installed package (starter kits, templates). Set by the CLI; Studio runs with the package as cwd. */
export const packageDir = () => process.env.MOTIONMIND_PACKAGE_DIR ?? process.cwd();

export class Store {
  readonly root: string;

  constructor(root = resolveStore()) {
    this.root = root;
  }

  path(...parts: string[]) {
    return path.join(this.root, ...parts);
  }

  rel(abs: string) {
    return path.relative(this.root, abs).split(path.sep).join("/");
  }

  ensure() {
    fs.mkdirSync(this.path("projects"), { recursive: true });
    if (!isFile(this.path(STORE_MARKER))) this.writeConfig({ schema: 3, tracked: [] });
  }

  readConfig(): StoreConfig {
    const file = this.path(STORE_MARKER);
    return isFile(file) ? { schema: 3, tracked: [], ...JSON.parse(fs.readFileSync(file, "utf8")) } : { schema: 3, tracked: [] };
  }

  writeConfig(config: StoreConfig) {
    fs.mkdirSync(this.root, { recursive: true });
    writeAtomic(this.path(STORE_MARKER), JSON.stringify(config, null, 2) + "\n");
  }

  readRegistry(): Registry {
    const file = this.path("registry.json");
    return isFile(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { schema_version: "3.0", updated_at: "", runs: [] };
  }

  /** Read-modify-write under a lock file, so the watcher and Studio actions never drop each other's runs. */
  updateRegistry<T>(fn: (reg: Registry) => T): T {
    this.ensure();
    return withLock(this.path(".registry.lock"), () => {
      const reg = this.readRegistry();
      const out = fn(reg);
      reg.schema_version = "3.0";
      reg.updated_at = stamp();
      writeAtomic(this.path("registry.json"), JSON.stringify(reg, null, 2) + "\n");
      return out;
    });
  }

  campaignDir(campaign: string) {
    return this.path("projects", ...campaign.split("/"));
  }

  runDir(campaign: string, version: string) {
    return this.path("projects", ...campaign.split("/"), "runs", version);
  }

  appendLog(campaign: string, line: string) {
    const dir = this.campaignDir(campaign);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "LOG.md");
    if (!isFile(file)) fs.writeFileSync(file, `# LOG – ${campaign}\n\n`);
    fs.appendFileSync(file, `${stamp()} · ${line}\n`);
  }

  /** Machine-local settings (motionmind.config.json next to the marker): repos the store must never write into. */
  protectedRepos(): string[] {
    const file = this.path("motionmind.config.json");
    if (!isFile(file)) return [];
    return ((JSON.parse(fs.readFileSync(file, "utf8")).protected_repos ?? []) as string[]).map((p) => path.resolve(expandHome(p)));
  }

  assertWritable(abs: string) {
    const resolved = path.resolve(abs);
    for (const repo of this.protectedRepos()) {
      if (resolved === repo || resolved.startsWith(repo + path.sep)) {
        throw new UserError(`Rule #1: '${resolved}' is inside the read-only product repo '${repo}'. Save output under '${this.path("projects")}'.`);
      }
    }
  }
}

export function parseCampaign(value: string): { brand: string; name: string; campaign: string } {
  const [brand, name, ...rest] = value.split("/");
  if (!brand || !name || rest.length || !SLUG.test(brand) || !SLUG.test(name)) {
    throw new UserError(`Campaign must look like <brand>/<campaign> using lowercase letters, digits and dashes (e.g. demo/promo-15s): '${value}'`);
  }
  return { brand, name, campaign: `${brand}/${name}` };
}

export const versionNumber = (version: string) => Number(/^v(\d+)/.exec(version)?.[1] ?? 0);

export function nextVersionNumber(store: Store, campaign: string): number {
  return Math.max(0, ...listDirs(path.join(store.campaignDir(campaign), "runs")).map(versionNumber)) + 1;
}

export const defaultRunId = (campaign: string, version: string) => `${campaign.replace("/", "-")}-${version.split("-")[0]}`;

function writeAtomic(file: string, text: string) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function withLock<T>(lockFile: string, fn: () => T): T {
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      fs.writeFileSync(lockFile, String(process.pid), { flag: "wx" });
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const owner = Number(fs.readFileSync(lockFile, "utf8"));
      if (owner && !pidAlive(owner)) fs.rmSync(lockFile, { force: true });
      else if (Date.now() > deadline) throw new UserError(`Registry is locked by PID ${owner} (${lockFile}).`);
      else Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    return fn();
  } finally {
    fs.rmSync(lockFile, { force: true });
  }
}

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}
