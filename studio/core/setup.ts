// Workspace bootstrap for CLI-first use: `motionmind setup`, `motionmind skill install`, `motionmind doctor`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as hf from "./hyperframes.ts";
import { run } from "./media.ts";
import { isDir, isFile, packageDir, Store, UserError, STORE_MARKER } from "./store.ts";

const SKILL = "motionmind";
/** Written into an installed skill copy so later installs know they may replace it. */
const STAMP = ".motionmind-skill.json";

export const skillSource = () => path.join(packageDir(), "skills", SKILL);

function packageVersion(): string {
  const pkg = path.join(packageDir(), "package.json");
  return isFile(pkg) ? JSON.parse(fs.readFileSync(pkg, "utf8")).version : "dev";
}

/** Copy the bundled skill to `<root>/.agents/skills/motionmind` and link `<root>/.claude/skills/motionmind` to it. */
export function installSkill(root: string, force = false): string[] {
  const src = skillSource();
  if (!isFile(path.join(src, "SKILL.md"))) throw new UserError(`Skill bawaan tidak ditemukan di ${src}.`);
  const dest = path.join(root, ".agents", "skills", SKILL);
  if (isDir(dest) && !isFile(path.join(dest, STAMP)) && !force) {
    throw new UserError(`${dest} sudah ada dan bukan hasil pemasangan MotionMind; pakai --force untuk menimpanya.`);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  fs.writeFileSync(path.join(dest, STAMP), JSON.stringify({ version: packageVersion(), installed_at: new Date().toISOString() }, null, 2) + "\n");

  const claude = path.join(root, ".claude", "skills", SKILL);
  fs.mkdirSync(path.dirname(claude), { recursive: true });
  const existing = fs.lstatSync(claude, { throwIfNoEntry: false });
  if (existing && !existing.isSymbolicLink() && !isFile(path.join(claude, STAMP)) && !force) {
    throw new UserError(`${claude} sudah ada dan bukan hasil pemasangan MotionMind; pakai --force untuk menimpanya.`);
  }
  if (existing) fs.rmSync(claude, { recursive: true, force: true });
  fs.symlinkSync(path.relative(path.dirname(claude), dest), claude, "dir");
  return [`skill ${SKILL} ${packageVersion()} → ${dest}`, `${claude} → ${path.relative(path.dirname(claude), dest)}`];
}

const AGENTS_MD = `# MotionMind workspace

This folder is a MotionMind workspace (\`${STORE_MARKER}\`): video campaigns live in \`projects/\`, brand kits in
\`shared/brands/\`, and every rendered version is recorded in \`registry.json\`.

For any video task — new video, new version, revision, render, review — use the **motionmind** skill:
\`.agents/skills/motionmind/SKILL.md\` (also linked at \`.claude/skills/motionmind\`). Follow its four gates and run its
commands from this folder. The user watches results in MotionMind Studio: \`motionmind ui\` → http://127.0.0.1:4310.

Never write into the user's product repositories; copy brand material into \`shared/brands/<brand>/\` once.
`;

const GITIGNORE = `# Renders and caches are reproducible from the runs' src/
node_modules/
.hyperframes/
.thumbnails/
.waveform-cache/
.registry.lock
`;

export interface SetupOptions {
  dir: string;
  /** Also install the official HyperFrames skills for the user's AI tools (`npx hyperframes skills`). */
  hyperframesSkills: boolean;
  force?: boolean;
}

export async function setupWorkspace(opts: SetupOptions): Promise<string[]> {
  const root = path.resolve(opts.dir);
  const lines = [`Workspace MotionMind: ${root}`];
  const store = new Store(root);
  const fresh = !isFile(store.path(STORE_MARKER));
  store.ensure();
  fs.mkdirSync(store.path("shared", "brands"), { recursive: true });
  lines.push(fresh ? `  + ${STORE_MARKER}, projects/, shared/brands/` : `  = ${STORE_MARKER} sudah ada (store dipakai apa adanya)`);

  for (const [name, text] of [["AGENTS.md", AGENTS_MD], ["CLAUDE.md", AGENTS_MD], [".gitignore", GITIGNORE]] as const) {
    const file = path.join(root, name);
    if (isFile(file) && !opts.force) {
      lines.push(`  = ${name} sudah ada (tidak diubah; --force untuk menimpa)`);
      continue;
    }
    fs.writeFileSync(file, text);
    lines.push(`  + ${name}`);
  }
  lines.push(...installSkill(root, opts.force).map((l) => `  + ${l}`));

  if (opts.hyperframesSkills) {
    // hf.env() sets HYPERFRAMES_SKIP_SKILLS for every other command; this one exists to install them.
    const env: NodeJS.ProcessEnv = { ...hf.env() };
    delete env.HYPERFRAMES_SKIP_SKILLS;
    const res = await run("npx", ["-y", `hyperframes@${hf.HF_VERSION}`, "skills"], { cwd: root, env, timeout: 300_000 }).then(
      (r) => ({ ok: true, output: `${r.stdout}${r.stderr}` }),
      (e) => ({ ok: false, output: `${e.stdout ?? ""}${e.stderr ?? ""}` || String(e.message) }),
    );
    const tail = res.output.trim().split("\n").slice(-3).map((l) => `      ${l.trim()}`).join("\n");
    lines.push(res.ok ? `  + skill resmi HyperFrames (npx hyperframes skills):\n${tail}` : `  ! npx hyperframes skills gagal:\n${res.output.slice(-1500)}`);
  }
  lines.push(
    "",
    "Berikutnya:",
    `  cd ${path.relative(process.cwd(), root) || "."}`,
    "  motionmind doctor            # cek ffmpeg, Chrome, HyperFrames",
    "  motionmind ui                # Studio di http://127.0.0.1:4310 (biarkan berjalan)",
    "  claude   (atau codex, dll.)  # lalu: \"Pakai skill motionmind. Aku mau video promo 15 detik untuk …\"",
  );
  return lines;
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  required: boolean;
}

async function which(cmd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout, stderr } = await run(cmd, args, { timeout: 120_000, env: hf.env() });
    return `${stdout}${stderr}`.trim().split("\n")[0] ?? "";
  } catch {
    return null;
  }
}

export async function doctor(cwd = process.cwd()): Promise<{ lines: string[]; ok: boolean }> {
  const store = new Store();
  const checks: Check[] = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({ name: "Node.js ≥ 22", ok: nodeMajor >= 22, detail: process.version, required: true });
  for (const bin of ["ffmpeg", "ffprobe"]) {
    const v = await which(bin, ["-version"]);
    checks.push({ name: bin, ok: v !== null, detail: v ?? "tidak ditemukan di PATH (brew install ffmpeg / apt install ffmpeg)", required: true });
  }
  const hfVersion = await which("npx", ["-y", `hyperframes@${hf.HF_VERSION}`, "--version"]);
  checks.push({ name: `HyperFrames ${hf.HF_VERSION}`, ok: hfVersion !== null, detail: hfVersion ?? "npx gagal mengambil hyperframes (cek koneksi/npm)", required: true });
  if (hfVersion !== null) {
    // HyperFrames' own doctor also lists optional extras (local TTS/music models, Docker); only the render path matters here.
    const res = await hf.npx(cwd, ["doctor"], 180_000);
    const failing = res.output.split("\n").filter((l) => /✗/.test(l) && !/optional|Docker/i.test(l)).map((l) => l.replace(/\s+/g, " ").trim());
    const chrome = /✓ Chrome/.test(res.output);
    checks.push({ name: "Render (Chrome, ffmpeg via HyperFrames)", ok: chrome && !failing.length, detail: failing.join(" · ") || (chrome ? "ok" : "Chrome belum terpasang → npx hyperframes browser"), required: true });
  }
  checks.push({
    name: "Workspace",
    ok: isFile(store.path(STORE_MARKER)),
    detail: isFile(store.path(STORE_MARKER)) ? store.root : `belum ada ${STORE_MARKER} di sini atau di atasnya → motionmind setup <folder>`,
    required: false,
  });
  const skillHere = isFile(store.path(".agents", "skills", SKILL, "SKILL.md"));
  const skillHome = isFile(path.join(os.homedir(), ".agents", "skills", SKILL, "SKILL.md")) || isFile(path.join(os.homedir(), ".claude", "skills", SKILL, "SKILL.md"));
  checks.push({ name: "Skill motionmind", ok: skillHere || skillHome, detail: skillHere ? "workspace" : skillHome ? "global (~)" : "belum terpasang → motionmind skill install", required: false });
  const agents = (await Promise.all(["claude", "codex", "gemini", "opencode"].map(async (a) => ((await which(a, ["--version"])) !== null ? a : null)))).filter(Boolean);
  checks.push({ name: "Agen AI CLI", ok: agents.length > 0, detail: agents.length ? agents.join(", ") : "tidak ada claude/codex/gemini/opencode di PATH", required: false });

  const lines = checks.map((c) => `${c.ok ? "✓" : c.required ? "✗" : "!"} ${c.name.padEnd(34)} ${c.detail}`);
  return { lines, ok: checks.every((c) => c.ok || !c.required) };
}
