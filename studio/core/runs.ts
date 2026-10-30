// Run operations shared by the `motionmind` CLI and the Studio: create, snapshot, log, render, edit, promote, track.
import fs from "node:fs";
import path from "node:path";
import * as hf from "./hyperframes.ts";
import { aspectOf, contactSheet, probe, sha256 } from "./media.ts";
import {
  defaultRunId, expandHome, isDir, isFile, listDirs, nextVersionNumber, packageDir, parseCampaign, stamp, Store, VERSION, UserError,
  type Engine, type RegistryRun, type RunSource, type Stage, type TrackedProject,
} from "./store.ts";

export interface Result {
  lines: string[];
  href?: string;
  runId?: string;
}

/** Campaign memory template: the store's own templates/ first, else the package default. */
function campaignTemplate(store: Store, name: string, campaign: string): string {
  const file = [store.path("templates", name), path.join(packageDir(), "templates", name)].find(isFile);
  if (!file) throw new UserError(`Template ${name} tidak ditemukan.`);
  return fs.readFileSync(file, "utf8").replaceAll("{{project}}", campaign);
}

function ensureCampaignMemory(store: Store, campaign: string, version: string): string[] {
  const dir = store.campaignDir(campaign);
  const files: [string, () => string][] = [
    ["TASTE.md", () => campaignTemplate(store, "TASTE.md", campaign)],
    ["PROGRESS.md", () =>
      `# PROGRESS – ${campaign}   (updated ${stamp()})\nPhase: brief\nCurrent version: ${version} → runs/${version}/video.mp4\n` +
      "Done: -\nIn progress: -\nNext step: lengkapi brief di TASTE.md §1\nOpen issues / user feedback not yet fixed: -\nApprovals: -\n" +
      `Key files: TASTE.md, plan/design.html, runs/${version}/src/\n`],
    ["LOG.md", () => `# LOG – ${campaign}\n\n`],
    ["plan/design.html", () => campaignTemplate(store, "design.html", campaign)],
  ];
  const created: string[] = [];
  for (const [rel, content] of files) {
    const file = path.join(/*turbopackIgnore: true*/ dir, rel);
    if (isFile(file)) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content());
    created.push(store.rel(file));
  }
  return created;
}

function newRunDir(store: Store, campaign: string, version: string): string {
  if (!VERSION.test(version)) throw new UserError(`Versi harus berbentuk v<N>-<slug>, mis. v1-first-cut: '${version}'`);
  const dir = store.runDir(campaign, version);
  store.assertWritable(dir);
  if (fs.existsSync(dir)) throw new UserError(`Run '${store.rel(dir)}' sudah ada. Versi lama tidak boleh ditimpa; buat v<N+1> baru.`);
  return dir;
}

function breakdownStub(store: Store, runDir: string, campaign: string, version: string, engine: string): string {
  const file = path.join(runDir, "breakdown.md");
  fs.writeFileSync(file, `# Breakdown — ${campaign} (${version})\n\n- **Skill / Engine:** \`${engine}\`\n\n| Detik | Scene | Animasi & easing | SFX |\n|---|---|---|---|\n`);
  return store.rel(file);
}

/** Snapshot shared/brands/<brand>/{logos,fonts} into src/assets/brand/: a run never reads shared/ at render time. */
function seedBrandAssets(store: Store, brand: string, src: string): string[] {
  return (["logos", "fonts"] as const).flatMap((kind) => {
    const origin = store.path("shared", "brands", brand, kind);
    if (!isDir(origin) || !fs.readdirSync(origin).some((n) => !n.startsWith("."))) return [];
    const dst = path.join(src, "assets", "brand", kind);
    fs.cpSync(origin, dst, { recursive: true, filter: (p) => p === origin || !path.basename(p).startsWith(".") });
    return [`${store.rel(dst)}/ (salinan shared/brands/${brand}/${kind})`];
  });
}

export async function initRun(store: Store, opts: { campaign: string; version: string; resolution?: string }): Promise<Result> {
  const { brand, campaign } = parseCampaign(opts.campaign);
  const resolution = opts.resolution ?? "portrait";
  if (!(hf.HF_RESOLUTIONS as readonly string[]).includes(resolution)) throw new UserError(`Resolusi tidak dikenal: ${resolution}`);
  const runDir = newRunDir(store, campaign, opts.version);
  store.ensure();
  const created = ensureCampaignMemory(store, campaign, opts.version);
  const src = path.join(runDir, "src");
  fs.mkdirSync(runDir, { recursive: true });
  try {
    await hf.init(runDir, resolution);
  } catch (err) {
    fs.rmSync(runDir, { recursive: true, force: true });
    throw err;
  }
  created.push(`${store.rel(src)}/ (proyek HyperFrames ${hf.HF_VERSION}, ${resolution})`, ...seedBrandAssets(store, brand, src));
  created.push(breakdownStub(store, runDir, campaign, opts.version, `hyperframes ${hf.HF_VERSION}`));
  store.appendLog(campaign, `init ${opts.version} · engine: hyperframes ${hf.HF_VERSION} (${resolution}) · runs/${opts.version}/ · ok`);
  return {
    lines: [`Run baru: ${store.rel(runDir)}`, ...created.map((c) => `  + ${c}`)],
    href: `/r/${campaign}/${opts.version}`,
  };
}

/** Copy an existing HyperFrames project (e.g. from the desktop app) into a new run's src/. */
export async function importRun(store: Store, opts: { source: string; campaign: string; version: string }): Promise<Result> {
  const origin = path.resolve(expandHome(opts.source));
  if (!hf.isProject(origin)) throw new UserError(`'${origin}' bukan proyek HyperFrames (butuh index.html dengan data-composition-id).`);
  const { campaign } = parseCampaign(opts.campaign);
  const runDir = newRunDir(store, campaign, opts.version);
  if (origin === runDir || runDir.startsWith(origin + path.sep) || origin.startsWith(runDir + path.sep)) {
    throw new UserError("Sumber import tidak boleh berada di dalam atau di atas run tujuan.");
  }
  store.ensure();
  const created = ensureCampaignMemory(store, campaign, opts.version);
  const src = path.join(runDir, "src");
  hf.copyProject(origin, src);
  hf.pin(src);
  const files = fs.readdirSync(src, { recursive: true }).filter((f) => isFile(path.join(src, String(f)))).length;
  created.push(`${store.rel(src)}/ (${files} file dari ${origin}, hyperframes@${hf.versionOf(src)})`);
  created.push(breakdownStub(store, runDir, campaign, opts.version, `hyperframes ${hf.versionOf(src)} (import)`));
  store.appendLog(campaign, `import ${opts.version} · dari ${origin} · hyperframes ${hf.versionOf(src)} · runs/${opts.version}/src/ · ${files} file`);
  return { lines: [`Run hasil import: ${store.rel(runDir)}`, ...created.map((c) => `  + ${c}`)], href: `/r/${campaign}/${opts.version}` };
}

/** Target of edit/render: a run's src/ (version given) or the tracked project's own folder (no version). */
function editTarget(store: Store, campaign: string, version?: string): { dir: string; lock: string; label: string } {
  if (version) {
    const runDir = store.runDir(campaign, version);
    const src = path.join(runDir, "src");
    if (!hf.isProject(src)) throw new UserError(`'${store.rel(runDir)}' bukan run HyperFrames (src/ tidak berisi proyek HyperFrames).`);
    return { dir: src, lock: path.join(runDir, hf.EDIT_LOCK), label: version };
  }
  const tracked = findTracked(store, campaign);
  if (!tracked) throw new UserError(`Campaign '${campaign}' tidak melacak proyek; sebutkan versinya atau jalankan \`motionmind track\` dulu.`);
  if (tracked.engine !== "hyperframes") throw new UserError(`Proyek '${tracked.dir}' bukan proyek HyperFrames.`);
  return { dir: tracked.dir, lock: path.join(store.campaignDir(campaign), hf.EDIT_LOCK), label: tracked.dir };
}

export async function editRun(store: Store, opts: { campaign: string; version?: string; stop?: boolean }): Promise<Result> {
  const { campaign } = parseCampaign(opts.campaign);
  const t = editTarget(store, campaign, opts.version);
  if (opts.stop) {
    await hf.closeEditor(t.dir, t.lock);
    store.appendLog(campaign, `edit selesai ${t.label} · HyperFrames Studio ditutup · lock dilepas`);
    return { lines: [`Editor ditutup; ${t.label} bisa diubah agen lagi. Sebelum mengubah file, jalankan \`npx hyperframes history\` di ${t.dir}.`] };
  }
  const existing = hf.readLock(t.lock);
  if (existing) return { lines: [`Sudah terbuka: ${existing.url} (PID ${existing.pid}, sejak ${existing.started_at})`], href: existing.url };
  const lock = await hf.openEditor(t.dir, t.lock);
  store.appendLog(campaign, `edit mulai ${t.label} · HyperFrames Studio ${lock.url} · agen jangan ubah file sampai \`motionmind edit --stop\``);
  return { lines: [`HyperFrames Studio: ${lock.url}`], href: lock.url };
}

export async function renderRun(store: Store, opts: { campaign: string; version?: string; crf?: number }): Promise<Result> {
  const { campaign } = parseCampaign(opts.campaign);
  const t = editTarget(store, campaign, opts.version);
  const warn = hf.readLock(t.lock) ? ["Peringatan: proyek sedang terbuka di HyperFrames Studio; render memakai file yang sudah tersimpan."] : [];

  if (!opts.version) {
    // Tracked project: render into its own renders/ folder (as HyperFrames does), then log the file as a new run.
    const stampName = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
    const out = path.join(t.dir, "renders", `${path.basename(t.dir)}_${stampName}.mp4`);
    await hf.render(t.dir, out, opts.crf);
    const logged = await logVideo(store, { campaign, video: out, src: t.dir, slug: "render", source: { kind: "tracked", dir: t.dir, file: out, file_mtime: fs.statSync(out).mtime.toISOString() } });
    return { ...logged, lines: [...warn, ...logged.lines] };
  }

  const runDir = store.runDir(campaign, opts.version);
  const video = path.join(runDir, "video.mp4");
  const tmp = path.join(runDir, "cache", "render.mp4");
  await hf.render(t.dir, tmp, opts.crf);
  fs.renameSync(tmp, video);
  const m = await probe(video);
  await contactSheet(video, path.join(runDir, "contact-sheet.png"), m.duration_s);
  store.appendLog(campaign, `render ${opts.version} · hyperframes ${hf.versionOf(t.dir)} crf ${opts.crf ?? 18} · video.mp4 + contact-sheet.png · ${m.width}x${m.height} ${m.duration_s} s, ${m.integrated_lufs} LUFS / TP ${m.true_peak_dbfs}`);
  const lines = [...warn, `${store.rel(video)} · ${m.width}x${m.height} · ${m.duration_s} s · ${m.size_mb} MB · ${m.integrated_lufs ?? "—"} LUFS · TP ${m.true_peak_dbfs ?? "—"} dBFS`];
  // An already-logged run keeps its stage/title; only the measurements of the new file are refreshed.
  const hash = await sha256(video);
  const runRel = store.rel(runDir);
  const updated = store.updateRegistry((reg) => {
    const entry = reg.runs.find((r) => r.run_dir === runRel);
    if (!entry) return null;
    entry.metrics = { ...m };
    entry.hashes = { ...entry.hashes, mp4_sha256: hash };
    entry.artifacts = { ...entry.artifacts, mp4: store.rel(video), contact_sheet: store.rel(path.join(runDir, "contact-sheet.png")) };
    entry.params = { ...entry.params, ...hf.params(t.dir) };
    return entry;
  });
  lines.push(updated ? `Registry '${updated.run_id}' diperbarui (stage tetap ${updated.stage}).` : `${runRel}/contact-sheet.png · lalu \`motionmind log\`.`);
  return { lines, runId: updated?.run_id };
}

export interface LogOptions {
  campaign: string;
  video: string;
  version?: string;
  /** Suffix for an auto-numbered version, e.g. "render" → v4-render-1029-1430. */
  slug?: string;
  /** Project folder to snapshot into the run's src/ (HyperFrames parameters are read from it). */
  src?: string | null;
  title?: string;
  stage?: Stage;
  runId?: string;
  params?: Record<string, unknown>;
  metrics?: Record<string, number>;
  notes?: string;
  sheet?: string;
  breakdown?: string;
  design?: string;
  source?: RunSource;
}

const toRel = (store: Store, p: string | undefined | null) => {
  if (!p) return null;
  const abs = path.resolve(store.root, expandHome(p));
  return isFile(abs) ? store.rel(abs) : null;
};

function slugTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Log a rendered video as a run: snapshot it (and its project) into the store, measure it, write the registry. */
export async function logVideo(store: Store, opts: LogOptions): Promise<Result> {
  const { campaign } = parseCampaign(opts.campaign);
  const videoIn = path.resolve(store.root, expandHome(opts.video));
  if (!isFile(videoIn)) throw new UserError(`Video tidak ditemukan: ${videoIn}`);
  store.ensure();

  const campaignRuns = store.campaignDir(campaign) + path.sep + "runs" + path.sep;
  let runDir: string;
  let video: string;
  let version: string;
  if (videoIn.startsWith(campaignRuns)) {
    // Already inside one of this campaign's runs (authored in the store): log in place.
    version = videoIn.slice(campaignRuns.length).split(path.sep)[0];
    if (opts.version && opts.version !== version) throw new UserError(`Video berada di run ${version}, bukan ${opts.version}.`);
    runDir = store.runDir(campaign, version);
    video = videoIn;
  } else {
    const mtime = fs.statSync(videoIn).mtime;
    version = opts.version ?? `v${nextVersionNumber(store, campaign)}-${opts.slug ?? "log"}-${slugTime(mtime)}`;
    runDir = newRunDir(store, campaign, version);
    fs.mkdirSync(runDir, { recursive: true });
    video = path.join(runDir, "video.mp4");
    fs.copyFileSync(videoIn, video);
    if (opts.src) {
      const src = path.resolve(expandHome(opts.src));
      if (!isDir(src)) throw new UserError(`Folder proyek tidak ditemukan: ${src}`);
      hf.copyProject(src, path.join(runDir, "src"));
      if (hf.isProject(src)) hf.pin(path.join(runDir, "src"));
    }
  }

  const metrics = await probe(video);
  let sheet = toRel(store, opts.sheet) ?? toRel(store, path.join(runDir, "contact-sheet.png"));
  if (!sheet) {
    await contactSheet(video, path.join(runDir, "contact-sheet.png"), metrics.duration_s);
    sheet = store.rel(path.join(runDir, "contact-sheet.png"));
  }
  const srcDir = path.join(runDir, "src");
  const engineParams = hf.isProject(srcDir) ? hf.params(srcDir) : { engine: "mp4" };
  const aspect = aspectOf(metrics);
  const runId = opts.runId ?? defaultRunId(campaign, version);
  const runRel = store.rel(runDir);
  const stage = opts.stage ?? "staging";
  const hash = await sha256(video);

  const entry: RegistryRun = {
    run_id: runId,
    project: campaign,
    version,
    run_dir: runRel,
    stage,
    created_at: stamp(),
    title: opts.title || `${campaign} — ${version}`,
    params: {
      skill_engine: engineParams.engine === "hyperframes" ? `hyperframes ${engineParams.hyperframes_version}` : "mp4",
      aspect,
      ...(aspect === "9:16" ? { safe_area: "4:5 (1080×1350, y 285–1635)" } : {}),
      ...engineParams,
      ...opts.params,
    },
    artifacts: {
      mp4: store.rel(video),
      contact_sheet: sheet,
      breakdown: toRel(store, opts.breakdown) ?? toRel(store, path.join(runDir, "breakdown.md")),
      design_board: toRel(store, opts.design) ?? toRel(store, path.join(store.campaignDir(campaign), "plan", "design.html")),
      src: isDir(srcDir) ? store.rel(srcDir) : null,
    },
    metrics: { ...metrics, ...opts.metrics },
    hashes: { mp4_sha256: hash },
    source: opts.source ?? { kind: videoIn.startsWith(campaignRuns) ? "hub" : "file", file: videoIn.startsWith(campaignRuns) ? null : videoIn },
    notes: opts.notes ?? "",
  };

  store.updateRegistry((reg) => {
    const clash = reg.runs.find((r) => r.run_id === runId && r.run_dir !== runRel);
    if (clash) throw new UserError(`run_id '${runId}' sudah dipakai ${clash.project} ${clash.version}; pakai --run-id lain.`);
    if (stage === "production") demoteOthers(reg.runs, entry);
    reg.runs = [...reg.runs.filter((r) => r.run_id !== runId && r.run_dir !== runRel), entry];
  });
  store.appendLog(campaign, `log ${version} · ${runId} (${stage}) · ${metrics.width}x${metrics.height} ${metrics.duration_s} s · ${metrics.integrated_lufs ?? "tanpa audio"} LUFS`);
  return {
    lines: [`Run '${runId}' (${stage}) · ${runRel} · ${metrics.width}x${metrics.height} · ${metrics.duration_s} s · ${metrics.integrated_lufs ?? "—"} LUFS · TP ${metrics.true_peak_dbfs ?? "—"}`],
    href: `/r/${campaign}/${version}`,
    runId,
  };
}

/** One production version per aspect ratio per campaign: the previous one moves to archived. */
function demoteOthers(runs: RegistryRun[], target: RegistryRun) {
  for (const r of runs) {
    if (r.project === target.project && r.params.aspect === target.params.aspect && r.run_id !== target.run_id && r.stage === "production") r.stage = "archived";
  }
}

export function promote(store: Store, runId: string, stage: Stage): Result {
  const target = store.updateRegistry((reg) => {
    const t = reg.runs.find((r) => r.run_id === runId || r.version === runId);
    if (!t) throw new UserError(`Run '${runId}' tidak ditemukan.`);
    if (stage === "production") demoteOthers(reg.runs, t);
    t.stage = stage;
    return t;
  });
  store.appendLog(target.project, `promote ${target.version} · ${target.run_id} → ${stage}`);
  return { lines: [`'${target.run_id}' → ${stage}`], runId: target.run_id };
}

// ---------------------------------------------------------------------------------------------
// Tracking external projects (HyperFrames desktop/Studio projects, export folders of any editor)
// ---------------------------------------------------------------------------------------------

export const findTracked = (store: Store, campaign: string) => store.readConfig().tracked.find((t) => t.campaign === campaign) ?? null;

export function track(store: Store, opts: { dir: string; campaign: string; backfill?: boolean }): Result {
  const { campaign } = parseCampaign(opts.campaign);
  const dir = path.resolve(expandHome(opts.dir));
  if (!isDir(dir)) throw new UserError(`Folder tidak ditemukan: ${dir}`);
  if (dir === store.root || dir.startsWith(store.root + path.sep)) throw new UserError("Proyek yang dilacak harus berada di luar tracking store.");
  const engine: Engine = hf.isProject(dir) ? "hyperframes" : "mp4";
  store.ensure();
  const config = store.readConfig();
  const other = config.tracked.find((t) => t.dir === dir && t.campaign !== campaign);
  if (other) throw new UserError(`'${dir}' sudah dilacak oleh ${other.campaign}.`);
  const now = new Date().toISOString();
  const entry: TrackedProject = { campaign, dir, engine, since: opts.backfill ? new Date(0).toISOString() : now, added_at: now };
  config.tracked = [...config.tracked.filter((t) => t.campaign !== campaign), entry];
  store.writeConfig(config);
  store.appendLog(campaign, `track ${dir} · engine ${engine}${opts.backfill ? " · termasuk render lama" : ""}`);
  return {
    lines: [
      `Melacak ${dir} → ${campaign} (${engine}).`,
      engine === "hyperframes" ? `Setiap render di ${path.join(dir, "renders")} jadi run baru selama \`motionmind ui\` atau \`motionmind watch\` berjalan.` : `Setiap .mp4 baru di ${dir} jadi run baru selama \`motionmind ui\` atau \`motionmind watch\` berjalan.`,
    ],
    href: `/c/${campaign}`,
  };
}

export function untrack(store: Store, campaign: string): Result {
  const config = store.readConfig();
  if (!config.tracked.some((t) => t.campaign === campaign)) throw new UserError(`Campaign '${campaign}' tidak melacak proyek.`);
  config.tracked = config.tracked.filter((t) => t.campaign !== campaign);
  store.writeConfig(config);
  store.appendLog(campaign, "untrack · run yang sudah tercatat tetap ada");
  return { lines: [`Berhenti melacak ${campaign}; run yang sudah tercatat tetap ada.`] };
}

const VIDEO_EXT = /\.mp4$/i;
/** A file still being written is skipped until it has been quiet this long. */
const SETTLE_MS = 3000;

function renderFiles(t: TrackedProject): string[] {
  const dir = t.engine === "hyperframes" ? path.join(t.dir, "renders") : t.dir;
  return isDir(dir) ? fs.readdirSync(dir).filter((n) => VIDEO_EXT.test(n) && !n.startsWith(".")).map((n) => path.join(dir, n)) : [];
}

/** HyperFrames Studio writes <render>.meta.json ({"status":"complete","durationMs":…}) next to each render. */
function renderMeta(file: string): { status?: string; durationMs?: number } | null {
  const meta = file.replace(/\.mp4$/i, ".meta.json");
  if (!isFile(meta)) return null;
  try {
    return JSON.parse(fs.readFileSync(meta, "utf8"));
  } catch {
    return { status: "writing" };
  }
}

/**
 * Autolog: log every new render of every tracked project. A render with a meta file is taken once its status is
 * "complete"; one without (CLI, other editors) once it has been quiet for SETTLE_MS. `skip` remembers files already
 * judged in this process (path@mtime), so a long-running watcher does not hash the same duplicate twice.
 */
export async function scanTracked(store: Store, skip = new Set<string>()): Promise<Result[]> {
  const results: Result[] = [];
  for (const t of store.readConfig().tracked) {
    const since = Date.parse(t.since);
    for (const file of renderFiles(t)) {
      const st = fs.statSync(file, { throwIfNoEntry: false });
      if (!st || st.mtimeMs <= since) continue;
      const meta = renderMeta(file);
      if (meta ? meta.status !== "complete" : Date.now() - st.mtimeMs < SETTLE_MS) continue;
      const mtime = st.mtime.toISOString();
      const key = `${file}@${mtime}`;
      if (skip.has(key)) continue;
      const runs = store.readRegistry().runs;
      if (runs.some((r) => r.source?.file === file && r.source.file_mtime === mtime)) {
        skip.add(key);
        continue;
      }
      const hash = await sha256(file);
      if (runs.some((r) => r.project === t.campaign && r.hashes?.mp4_sha256 === hash)) {
        skip.add(key);
        continue;
      }
      skip.add(key);
      try {
        results.push(await logVideo(store, {
          campaign: t.campaign,
          video: file,
          src: t.engine === "hyperframes" ? t.dir : null,
          slug: t.engine === "hyperframes" ? "render" : "export",
          title: path.basename(file, path.extname(file)),
          metrics: typeof meta?.durationMs === "number" ? { render_ms: meta.durationMs } : undefined,
          source: { kind: "tracked", dir: t.dir, file, file_mtime: mtime },
        }));
      } catch (err) {
        results.push({ lines: [`Gagal mencatat ${file}: ${(err as Error).message}`] });
      }
    }
  }
  return results;
}

/** Move a pre-3.0 hub (dashboard/registry.json, no marker) to the store layout. */
export function migrate(store: Store): Result {
  const lines: string[] = [];
  const legacy = store.path("dashboard", "registry.json");
  if (isFile(legacy) && !isFile(store.path("registry.json"))) {
    fs.renameSync(legacy, store.path("registry.json"));
    lines.push("dashboard/registry.json → registry.json");
  }
  const staticUi = store.path("dashboard", "index.html");
  if (isFile(staticUi)) {
    fs.rmSync(staticUi);
    lines.push("dashboard/index.html dihapus (diganti Studio: `motionmind ui`)");
  }
  if (isDir(store.path("dashboard")) && !fs.readdirSync(store.path("dashboard")).length) fs.rmdirSync(store.path("dashboard"));
  const hadMarker = isFile(store.path("motionmind.store.json"));
  store.ensure();
  if (!hadMarker) lines.push("motionmind.store.json dibuat");
  let tagged = 0;
  store.updateRegistry((reg) => {
    for (const r of reg.runs) {
      if (!r.source) {
        r.source = { kind: "hub" };
        tagged++;
      }
    }
  });
  if (tagged) lines.push(`${tagged} run diberi source.kind = hub`);
  return { lines: lines.length ? [`Store ${store.root}:`, ...lines.map((l) => `  ${l}`)] : [`Store ${store.root} sudah berformat 3.0.`] };
}

export const campaignsOf = (store: Store) =>
  listDirs(store.path("projects")).flatMap((brand) => listDirs(store.path("projects", brand)).map((c) => `${brand}/${c}`));
