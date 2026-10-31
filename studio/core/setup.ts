// Workspace bootstrap for CLI-first use: `motionmind setup`, `motionmind skill install`, `motionmind doctor`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as hf from "./hyperframes.ts";
import { onPath, run } from "./media.ts";
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
  if (!isFile(path.join(src, "SKILL.md"))) throw new UserError(`Bundled skill not found in ${src}.`);
  const dest = path.join(root, ".agents", "skills", SKILL);
  if (isDir(dest) && !isFile(path.join(dest, STAMP)) && !force) {
    throw new UserError(`${dest} already exists and was not installed by MotionMind; pass --force to replace it.`);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  fs.writeFileSync(path.join(dest, STAMP), JSON.stringify({ version: packageVersion(), installed_at: new Date().toISOString() }, null, 2) + "\n");

  const claude = path.join(root, ".claude", "skills", SKILL);
  fs.mkdirSync(path.dirname(claude), { recursive: true });
  const existing = fs.lstatSync(claude, { throwIfNoEntry: false });
  if (existing && !existing.isSymbolicLink() && !isFile(path.join(claude, STAMP)) && !force) {
    throw new UserError(`${claude} already exists and was not installed by MotionMind; pass --force to replace it.`);
  }
  if (existing) fs.rmSync(claude, { recursive: true, force: true });
  // Windows: directory symlinks need admin rights or Developer Mode; a junction (absolute target) needs neither.
  const target = process.platform === "win32" ? dest : path.relative(path.dirname(claude), dest);
  fs.symlinkSync(target, claude, process.platform === "win32" ? "junction" : "dir");
  return [`skill ${SKILL} ${packageVersion()} → ${dest}`, `${claude} → ${target}`];
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
  const lines = [`MotionMind workspace: ${root}`];
  const store = new Store(root);
  const fresh = !isFile(store.path(STORE_MARKER));
  store.ensure();
  fs.mkdirSync(store.path("shared", "brands"), { recursive: true });
  lines.push(fresh ? `  + ${STORE_MARKER}, projects/, shared/brands/` : `  = ${STORE_MARKER} already exists (store used as is)`);

  for (const [name, text] of [["AGENTS.md", AGENTS_MD], ["CLAUDE.md", AGENTS_MD], [".gitignore", GITIGNORE]] as const) {
    const file = path.join(root, name);
    if (isFile(file) && !opts.force) {
      lines.push(`  = ${name} already exists (unchanged; --force to overwrite)`);
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
    const res = await hf.runNpx(["-y", `hyperframes@${hf.HF_VERSION}`, "skills"], { cwd: root, env, timeout: 300_000 }).then(
      (r) => ({ ok: true, output: `${r.stdout}${r.stderr}` }),
      (e) => ({ ok: false, output: `${e.stdout ?? ""}${e.stderr ?? ""}` || String(e.message) }),
    );
    const tail = res.output.trim().split("\n").slice(-3).map((l) => `      ${l.trim()}`).join("\n");
    lines.push(res.ok ? `  + official HyperFrames skills (npx hyperframes skills):\n${tail}` : `  ! npx hyperframes skills failed:\n${res.output.slice(-1500)}`);
  }
  lines.push(
    "",
    "Next:",
    `  cd ${path.relative(process.cwd(), root) || "."}`,
    "  motionmind doctor            # check ffmpeg, Chrome, HyperFrames",
    "  motionmind ui                # Studio at http://127.0.0.1:4310 (keep it running)",
    "  claude   (or codex, etc.)    # then: \"Use the motionmind skill. I want a 15-second promo video for …\"",
  );
  return lines;
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  required: boolean;
}

/** First output line of a version command, or null when it cannot run. */
async function firstLine(res: Promise<{ stdout: string | Buffer; stderr: string | Buffer }>): Promise<string | null> {
  try {
    const { stdout, stderr } = await res;
    return `${stdout}${stderr}`.trim().split("\n")[0] ?? "";
  } catch {
    return null;
  }
}

const VERSION_CHECK = { timeout: 120_000, env: hf.env() };

export async function doctor(cwd = process.cwd()): Promise<{ lines: string[]; ok: boolean }> {
  const store = new Store();
  const checks: Check[] = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({ name: "Node.js ≥ 22", ok: nodeMajor >= 22, detail: process.version, required: true });
  for (const bin of ["ffmpeg", "ffprobe"]) {
    const v = await firstLine(run(bin, ["-version"], VERSION_CHECK));
    checks.push({ name: bin, ok: v !== null, detail: v ?? "not found on PATH (brew install ffmpeg / apt install ffmpeg / winget install ffmpeg)", required: true });
  }
  const hfVersion = await firstLine(hf.runNpx(["-y", `hyperframes@${hf.HF_VERSION}`, "--version"], VERSION_CHECK));
  checks.push({ name: `HyperFrames ${hf.HF_VERSION}`, ok: hfVersion !== null, detail: hfVersion ?? "npx could not fetch hyperframes (check network/npm)", required: true });
  if (hfVersion !== null) {
    // HyperFrames' own doctor also lists optional extras (local TTS/music models, Docker) and a newer-version notice
    // (the pin is deliberate); only the render path matters here.
    const res = await hf.npx(cwd, ["doctor"], 180_000);
    const failing = res.output.split("\n").filter((l) => /✗/.test(l) && !/optional|Docker|✗\s*Version\b.*available/i.test(l)).map((l) => l.replace(/\s+/g, " ").trim());
    const chrome = /✓ Chrome/.test(res.output);
    // Chrome Headless Shell has no Linux ARM64 build; HyperFrames then needs a system Chromium.
    const noChrome = process.platform === "linux" && process.arch === "arm64"
      ? "Chrome not found → Linux ARM64: install Chromium (apt install chromium) and export HYPERFRAMES_BROWSER_PATH=$(command -v chromium)"
      : "Chrome not installed → npx hyperframes browser";
    checks.push({ name: "Render (Chrome, ffmpeg via HyperFrames)", ok: chrome && !failing.length, detail: [...failing, ...(chrome ? [] : [noChrome])].join(" · ") || "ok", required: true });
  }
  checks.push({
    name: "Workspace",
    ok: isFile(store.path(STORE_MARKER)),
    detail: isFile(store.path(STORE_MARKER)) ? store.root : `no ${STORE_MARKER} here or above → motionmind setup <folder>`,
    required: false,
  });
  const skillHere = isFile(store.path(".agents", "skills", SKILL, "SKILL.md"));
  const skillHome = isFile(path.join(os.homedir(), ".agents", "skills", SKILL, "SKILL.md")) || isFile(path.join(os.homedir(), ".claude", "skills", SKILL, "SKILL.md"));
  checks.push({ name: "motionmind skill", ok: skillHere || skillHome, detail: skillHere ? "workspace" : skillHome ? "global (~)" : "not installed → motionmind skill install", required: false });
  const agents = ["claude", "codex", "gemini", "opencode"].filter(onPath);
  checks.push({ name: "AI agent CLI", ok: agents.length > 0, detail: agents.length ? agents.join(", ") : "no claude/codex/gemini/opencode on PATH", required: false });

  const lines = checks.map((c) => `${c.ok ? "✓" : c.required ? "✗" : "!"} ${c.name.padEnd(34)} ${c.detail}`);
  return { lines, ok: checks.every((c) => c.ok || !c.required) };
}
