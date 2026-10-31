// Server-side data layer: reads the MotionMind tracking store (registry + projects/ tree) on every request.
import fs from "node:fs";
import path from "node:path";
import { EDIT_LOCK, readLock, type EditLock } from "@/core/hyperframes";
import { findTracked } from "@/core/runs";
import { packageDir, Store, type RegistryRun, type Stage, type TrackedProject } from "@/core/store";
import { CATEGORIES, type Category } from "./categories";

export const store = new Store();
/** Store root: where projects/, shared/, registry.json and optional docs live. */
export const STORE_ROOT = store.root;
const SERVABLE_ROOTS: Record<string, true> = { projects: true, shared: true };

export { STAGES } from "@/core/store";
export type { EditLock, RegistryRun, Stage, TrackedProject };

export interface Run {
  brand: string;
  campaign: string;
  version: string;
  /** Store-relative run folder, e.g. projects/demo/promo-15s/runs/v1-x */
  dir: string;
  /** Output category; "empty" until the run has an .mp4 or an image deliverable. */
  kind: Category | "empty";
  mp4: string | null;
  sheet: string | null;
  breakdown: string | null;
  design: string | null;
  docs: string[];
  images: string[];
  files: string[];
  registry: RegistryRun | null;
  modified: string;
  /** HyperFrames CLI version pinned in src/package.json when src/ is a HyperFrames project; null for other runs. */
  hyperframes: string | null;
  /** Open HyperFrames Studio session (runs/<v>/.editing.json written by `motionmind edit`); null when closed or stale. */
  editing: EditLock | null;
}

export interface Campaign {
  brand: string;
  campaign: string;
  dir: string;
  progress: string | null;
  taste: string | null;
  logTail: string[];
  runs: Run[];
  nextVersion: number;
  planDesign: string | null;
  /** External project whose renders are logged into this campaign (`motionmind track`). */
  tracked: TrackedProject | null;
  /** HyperFrames Studio session on the tracked project (projects/<b>/<c>/.editing.json). */
  editing: EditLock | null;
}

const isFile = (abs: string) => fs.statSync(abs, { throwIfNoEntry: false })?.isFile() ?? false;
const isDir = (abs: string) => fs.statSync(abs, { throwIfNoEntry: false })?.isDirectory() ?? false;
const visible = (name: string) => !name.startsWith(".");
const listDirs = (abs: string) =>
  isDir(abs) ? fs.readdirSync(abs, { withFileTypes: true }).filter((d) => d.isDirectory() && visible(d.name)).map((d) => d.name).sort() : [];
const ROOT = STORE_ROOT;

/** Resolve a store-relative path that the UI may serve; null when it escapes projects/ or shared/. */
export function resolveServable(rel: string): string | null {
  const parts = rel.split("/").filter(Boolean);
  if (!parts.length || !Object.hasOwn(SERVABLE_ROOTS, parts[0]) || parts.some((p) => p.startsWith(".") || p === "..")) return null;
  const abs = path.resolve(ROOT, ...parts);
  return abs.startsWith(ROOT + path.sep) ? abs : null;
}

export const mediaUrl = (rel: string) => "/media/" + rel.split("/").map(encodeURIComponent).join("/");

export function readText(rel: string | null): string | null {
  const abs = rel ? resolveServable(rel) : null;
  return abs && isFile(abs) ? fs.readFileSync(abs, "utf8") : null;
}

export const readRegistry = (): RegistryRun[] => store.readRegistry().runs;

const existing = (rel: string | null | undefined) => (rel && resolveServable(rel) && isFile(resolveServable(rel)!) ? rel : null);

function buildRun(brand: string, campaign: string, version: string, registry: RegistryRun[]): Run {
  const dir = `projects/${brand}/${campaign}/runs/${version}`;
  const abs = path.join(ROOT, dir);
  const files = fs.readdirSync(abs).filter(visible).sort();
  const top = (name: string) => (files.includes(name) && isFile(path.join(abs, name)) ? `${dir}/${name}` : null);
  const firstMatching = (re: RegExp) => {
    const f = files.find((n) => re.test(n) && isFile(path.join(abs, n)));
    return f ? `${dir}/${f}` : null;
  };
  const reg = registry.find((r) => r.run_dir === dir) ?? null;
  const sheetRe = /contact[-_ ]?sheet/i;
  const mp4 = existing(reg?.artifacts.mp4) ?? top("video.mp4") ?? firstMatching(/\.mp4$/i);
  const images = files
    .filter((n) => /\.(png|jpe?g|webp)$/i.test(n) && !sheetRe.test(n) && isFile(path.join(abs, n)))
    .map((n) => `${dir}/${n}`);
  return {
    brand,
    campaign,
    version,
    dir,
    kind: mp4 ? "video" : images.length ? "image" : "empty",
    mp4,
    sheet: existing(reg?.artifacts.contact_sheet) ?? top("contact-sheet.png") ?? firstMatching(sheetRe),
    breakdown: top("breakdown.md") ?? existing(reg?.artifacts.breakdown),
    design: top("design.html") ?? existing(reg?.artifacts.design_board) ?? existing(`projects/${brand}/${campaign}/plan/design.html`),
    docs: files.filter((n) => n.endsWith(".md") && n !== "breakdown.md").map((n) => `${dir}/${n}`),
    images,
    files: files.map((n) => (isDir(path.join(abs, n)) ? `${n}/` : n)),
    registry: reg,
    modified: fs.statSync(abs).mtime.toISOString(),
    hyperframes: hyperframesVersion(abs),
    editing: readLock(path.join(abs, EDIT_LOCK)),
  };
}

function hyperframesVersion(runAbs: string): string | null {
  const src = path.join(runAbs, "src");
  if (!isFile(path.join(src, "hyperframes.json"))) return null;
  const pkg = path.join(src, "package.json");
  return (isFile(pkg) && /hyperframes@(\d+\.\d+\.\d+)/.exec(fs.readFileSync(pkg, "utf8"))?.[1]) || "?";
}

function versionNumber(version: string): number {
  const m = /^v(\d+)/.exec(version);
  return m ? Number(m[1]) : 0;
}

function buildCampaign(brand: string, campaign: string, registry: RegistryRun[]): Campaign {
  const dir = `projects/${brand}/${campaign}`;
  const versions = listDirs(path.join(ROOT, dir, "runs"));
  const runs = versions.map((v) => buildRun(brand, campaign, v, registry)).sort((a, b) => versionNumber(b.version) - versionNumber(a.version));
  const log = readText(`${dir}/LOG.md`);
  return {
    brand,
    campaign,
    dir,
    progress: readText(`${dir}/PROGRESS.md`),
    taste: readText(`${dir}/TASTE.md`),
    logTail: log ? log.trimEnd().split("\n").filter((l) => l.trim() && !l.startsWith("#")).slice(-12) : [],
    runs,
    nextVersion: Math.max(0, ...versions.map(versionNumber)) + 1,
    planDesign: existing(`${dir}/plan/design.html`),
    tracked: findTracked(store, `${brand}/${campaign}`),
    editing: readLock(path.join(ROOT, dir, EDIT_LOCK)),
  };
}

/** Campaign folders plus tracked campaigns that have not logged a render yet. */
export function listCampaigns(): Campaign[] {
  const registry = readRegistry();
  const names = new Set(listDirs(path.join(ROOT, "projects")).flatMap((brand) => listDirs(path.join(ROOT, "projects", brand)).map((c) => `${brand}/${c}`)));
  for (const t of store.readConfig().tracked) names.add(t.campaign);
  return [...names].sort().map((name) => {
    const [brand, campaign] = name.split("/");
    return buildCampaign(brand, campaign, registry);
  });
}

export function getCampaign(brand: string, campaign: string): Campaign | null {
  if (!resolveServable(`projects/${brand}/${campaign}`)) return null;
  if (!isDir(path.join(ROOT, "projects", brand, campaign)) && !findTracked(store, `${brand}/${campaign}`)) return null;
  return buildCampaign(brand, campaign, readRegistry());
}

export function getRun(brand: string, campaign: string, version: string): Run | null {
  const rel = `projects/${brand}/${campaign}/runs/${version}`;
  const abs = resolveServable(rel);
  return abs && isDir(abs) ? buildRun(brand, campaign, version, readRegistry()) : null;
}

export const listRuns = () => listCampaigns().flatMap((c) => c.runs);

/** Categories a campaign has produced output for, in sidebar order; empty while no run has output yet. */
export const campaignCategories = (c: Campaign): Category[] => CATEGORIES.map((x) => x.id).filter((id) => c.runs.some((r) => r.kind === id));

/** Phase / next step from a PROGRESS.md with `Phase:` / `Next step:` lines; falls back to the first heading for free-form files. */
export function progressSummary(text: string | null): { phase: string | null; next: string | null } {
  if (!text) return { phase: null, next: null };
  const phase = /^Phase:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? null;
  const next = /^Next step:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? null;
  if (phase || next) return { phase, next };
  const heading = text.split("\n").find((l) => /^##\s+/.test(l));
  return { phase: heading ? heading.replace(/^#+\s*/, "") : null, next: null };
}

export interface StarterKit {
  id: string;
  title: string;
  description: string;
  category: string;
  fields: string[];
  order: number;
  template: string;
}

/**
 * Prompt starter kits: <id>.md with a `key: value` front matter and a {{field}} template body.
 * The package ships defaults; a store's own starter-kits/ adds kits or overrides one by id.
 */
export function listStarterKits(): StarterKit[] {
  const byId: Record<string, string> = {};
  for (const dir of [path.join(packageDir(), "starter-kits"), path.join(ROOT, "starter-kits")]) {
    if (!isDir(dir)) continue;
    for (const f of fs.readdirSync(/*turbopackIgnore: true*/ dir)) if (f.endsWith(".md") && visible(f)) byId[f.replace(/\.md$/, "")] = path.join(/*turbopackIgnore: true*/ dir, f);
  }
  return Object.entries(byId)
    .flatMap(([id, file]) => {
      const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(fs.readFileSync(file, "utf8"));
      if (!m) return [];
      const meta = Object.fromEntries(m[1].split("\n").map((l) => l.split(/:\s*(.*)/s).slice(0, 2).map((s) => s.trim())));
      return [{
        id,
        title: meta.title ?? id,
        description: meta.description ?? "",
        category: meta.category ?? "video",
        fields: (meta.fields ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
        order: Number(meta.order) || 99,
        template: m[2].trim(),
      }];
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** Brands known to the store: brand asset folders plus brands that already have campaigns. */
export const listBrands = () =>
  [...new Set([...listDirs(path.join(ROOT, "shared", "brands")), ...listDirs(path.join(ROOT, "projects"))])].sort();

export function aspectOf(run: Run): string | null {
  const m = run.registry?.metrics;
  if (run.registry?.params.aspect) return run.registry.params.aspect;
  if (m?.width && m?.height) return m.height > m.width ? "9:16" : m.width > m.height ? "16:9" : "1:1";
  return null;
}
