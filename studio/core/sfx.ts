// SFX library catalog. The library lives outside the store (shared by every agent): one folder per category
// (Clicks/, Pop/, Whooshes/, …) and a catalog.json recording every sound with duration, checksum, and the manual
// fields agents must respect: source, license, tags, notes.
//
// Adding sounds: put the file in a category folder (new folder = new category), run `motionmind sfx scan`, then fill
// `source` and `license` in catalog.json. A run copies the sounds it uses into its own assets, so later library
// changes never alter rendered versions.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "./media.ts";
import { expandHome, isDir, isFile, packageDir, stamp, Store, UserError } from "./store.ts";

const AUDIO: Record<string, true> = { ".wav": true, ".mp3": true, ".aif": true, ".aiff": true, ".flac": true, ".ogg": true, ".m4a": true };
const CATALOG = "catalog.json";

export interface Sound {
  id: string;
  file: string;
  category: string;
  duration_s: number | null;
  sha1: string;
  added: string;
  source: string;
  license: string;
  tags: string[];
  notes: string;
}

export interface Catalog {
  version: number;
  updated_at: string;
  sounds: Sound[];
}

/** Starter pack shipped with the package (CC0, see sfx/LICENSE.md): used when the user has no library yet. */
export const bundledSfx = () => path.join(packageDir(), "sfx");

/**
 * MOTIONMIND_SFX → `sfx_library` in <store>/motionmind.config.json → ~/.motionmind/sfx → bundled pack.
 * An explicitly configured library must exist; only the default location falls back to the bundled pack.
 */
export function sfxLibrary(): string {
  let lib = process.env.MOTIONMIND_SFX;
  const config = path.join(new Store().root, "motionmind.config.json");
  if (!lib && isFile(config)) {
    const cfg: unknown = JSON.parse(fs.readFileSync(config, "utf8"));
    if (cfg && typeof cfg === "object" && "sfx_library" in cfg && typeof cfg.sfx_library === "string") lib = cfg.sfx_library;
  }
  if (lib) {
    const resolved = path.resolve(expandHome(lib));
    if (!isDir(resolved)) throw new UserError(`SFX library tidak ditemukan: ${resolved} (atur env MOTIONMIND_SFX atau sfx_library di ${config})`);
    return resolved;
  }
  const home = path.join(os.homedir(), ".motionmind", "sfx");
  return isDir(home) ? home : bundledSfx();
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function load(lib: string): Catalog {
  const file = path.join(lib, CATALOG);
  return isFile(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Catalog) : { version: 1, updated_at: "", sounds: [] };
}

async function duration(file: string): Promise<number | null> {
  try {
    const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
    const value = Number.parseFloat(stdout.trim());
    return Number.isFinite(value) ? Number(value.toFixed(3)) : null;
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") throw new UserError("ffprobe tidak ditemukan di PATH; pasang ffmpeg dulu.");
    return null;
  }
}

/** Every visible file under lib as path parts, in the same order as sorting pathlib paths. */
function walk(lib: string, parts: string[] = []): string[][] {
  const files: string[][] = [];
  for (const entry of fs.readdirSync(path.join(lib, ...parts), { withFileTypes: true })) {
    const rel = [...parts, entry.name];
    if (entry.isDirectory()) files.push(...walk(lib, rel));
    else if (!entry.name.startsWith(".") && entry.name !== CATALOG && isFile(path.join(lib, ...rel))) files.push(rel);
  }
  return files.sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    return a.length - b.length;
  });
}

/** Add new files, drop removed ones, keep the manual fields (source, license, tags, notes) of known ones. */
export async function scan(lib: string): Promise<{ lines: string[] }> {
  const catalog = load(lib);
  const known = new Map(catalog.sounds.map((s) => [s.file, s]));
  const now = stamp();
  const today = now.slice(0, 10);
  const sounds: Sound[] = [];
  const added: string[] = [];
  const skipped: string[] = [];
  for (const parts of walk(lib)) {
    const rel = parts.join("/");
    const name = parts.at(-1)!;
    if (!AUDIO[path.extname(name).toLowerCase()]) {
      skipped.push(rel);
      continue;
    }
    const category = parts.length > 1 ? parts[0] : "Uncategorized";
    const abs = path.join(lib, ...parts);
    const old = known.get(rel);
    const entry: Sound = {
      id: `${slug(category)}/${slug(path.parse(name).name)}`,
      file: rel,
      category,
      duration_s: await duration(abs),
      sha1: createHash("sha1").update(fs.readFileSync(abs)).digest("hex"),
      added: old?.added ?? today,
      source: old?.source ?? "",
      license: old?.license ?? "",
      tags: old?.tags ?? [],
      notes: old?.notes ?? "",
    };
    if (old && old.sha1 !== entry.sha1) entry.notes = `${entry.notes} · file berubah ${today}`.replace(/^[ ·]+|[ ·]+$/g, "");
    if (!old) added.push(rel);
    sounds.push(entry);
  }
  const files = new Set(sounds.map((s) => s.file));
  const removed = [...known.keys()].filter((f) => !files.has(f)).sort();
  Object.assign(catalog, { updated_at: now, sounds });
  fs.writeFileSync(path.join(lib, CATALOG), `${JSON.stringify(catalog, null, 2)}\n`);
  const unlicensed = sounds.filter((s) => !s.license).length;
  const lines = [`${path.join(lib, CATALOG)} · ${sounds.length} suara · ${added.length} baru · ${removed.length} hilang · ${unlicensed} tanpa lisensi`];
  lines.push(...added.map((f) => `  + ${f}`), ...removed.map((f) => `  - ${f}`), ...skipped.map((f) => `  ? ${f} (bukan file audio yang dikenal, dilewati)`));
  if (unlicensed) lines.push("Isi `source` dan `license` untuk file tanpa lisensi sebelum dipakai di video komersial.");
  return { lines };
}

export function list(lib: string, filter: { category?: string; query?: string; unlicensed?: boolean }): { lines: string[] } {
  const sounds = load(lib).sounds;
  if (!sounds.length) throw new UserError("catalog.json kosong; jalankan `motionmind sfx scan` dulu.");
  const category = filter.category?.toLowerCase();
  const query = filter.query?.toLowerCase();
  const rows = sounds.filter(
    (s) =>
      (!category || s.category.toLowerCase() === category) &&
      (!query || `${s.file} ${s.tags.join(" ")}`.toLowerCase().includes(query)) &&
      (!filter.unlicensed || !s.license),
  );
  const lines = rows.map((s) => `${s.id.padEnd(44)} ${(s.duration_s || 0).toFixed(2).padStart(6)}s  ${(s.license || "(lisensi?)").padEnd(14)} ${s.file}`);
  lines.push(`${rows.length} suara · library: ${lib}`);
  return { lines };
}
