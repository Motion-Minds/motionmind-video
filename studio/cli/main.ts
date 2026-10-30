// `motionmind` — tracking + studio for code-made videos (HyperFrames and any .mp4), in the spirit of MLflow.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, type ParseArgsConfig } from "node:util";
import * as runs from "../core/runs.ts";
import { musicBed } from "../core/music.ts";
import * as sfx from "../core/sfx.ts";
import { doctor, installSkill, setupWorkspace } from "../core/setup.ts";
import { isDir, parseCampaign, STAGES, Store, UserError, type Stage } from "../core/store.ts";

const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
process.env.MOTIONMIND_PACKAGE_DIR ??= PACKAGE_DIR;

const HELP = `motionmind — tracking & studio untuk video dari kode (HyperFrames, .mp4 apa pun)

Store: ${"$"}MOTIONMIND_STORE, folder terdekat berisi motionmind.store.json, atau ~/.motionmind

Mulai:
  motionmind setup [folder] [--no-hyperframes-skill] [--force]           buat workspace + pasang skill agen motionmind
  motionmind doctor                                                       cek Node, ffmpeg, HyperFrames/Chrome, skill, agen AI
  motionmind skill install [--global] [--force]                          pasang/perbarui skill motionmind (workspace atau ~)

Lacak & lihat:
  motionmind ui [--port 4310] [--host 127.0.0.1] [--no-watch] [--dev]   Studio + autolog proyek yang dilacak
  motionmind track <folder> --campaign <brand>/<campaign> [--backfill]    lacak proyek HyperFrames / folder export
  motionmind untrack <brand>/<campaign>
  motionmind tracked                                                      daftar proyek yang dilacak
  motionmind watch [--once] [--interval 2]                                autolog tanpa Studio
  motionmind log <video> --campaign <brand>/<campaign> [--version v<N>-<slug>] [--src <folder>] [--title …]
           [--stage staging|production|archived] [--param k=v]… [--metric k=n]… [--notes …] [--run-id …]
           [--sheet …] [--breakdown …] [--design …]
  motionmind init <brand>/<campaign> <version> [--resolution portrait|landscape|square]   versi baru: proyek HyperFrames di store
  motionmind import <folder> <brand>/<campaign> <version>
  motionmind edit <brand>/<campaign> [version] [--stop]                  HyperFrames Studio; tanpa versi = proyek yang dilacak
  motionmind render <brand>/<campaign> [version] [--crf 18]               tanpa versi = render proyek yang dilacak lalu catat
  motionmind promote <run_id> --stage production|staging|archived
  motionmind list [--campaign <brand>/<campaign>]
  motionmind compare <run_a> <run_b>
  motionmind music --out <wav> --duration <s> [--bpm 120] [--seed 817]    musik latar orisinal (WAV 48 kHz stereo, tanpa sampel)
           [--sections 0:groove,…] [--bells 3.0,9.5] [--duck 9.5:0.2]     kind: tense|calm|groove|lift|outro
  motionmind sfx scan                                                     perbarui catalog.json library SFX (field manual tetap)
  motionmind sfx list [--category X] [--query Y] [--unlicensed]           library: ${"$"}MOTIONMIND_SFX, sfx_library, ~/.motionmind/sfx, paket bawaan
  motionmind migrate                                                      ubah hub lama (dashboard/registry.json) ke store 3.0
  motionmind store                                                        tampilkan lokasi store`;

type Options = NonNullable<ParseArgsConfig["options"]>;

function args<const T extends Options>(argv: string[], options: T) {
  return parseArgs({ args: argv, options, allowPositionals: true, strict: true } as const);
}

const print = (r: runs.Result) => console.log(r.lines.join("\n"));

function keyValues(list: string[] | undefined, numeric: boolean): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const item of list ?? []) {
    const i = item.indexOf("=");
    if (i < 1) throw new UserError(`Format harus key=value: '${item}'`);
    const value = item.slice(i + 1);
    if (numeric && !Number.isFinite(Number(value))) throw new UserError(`Metrik harus angka: '${item}'`);
    out[item.slice(0, i)] = numeric ? Number(value) : value;
  }
  return out;
}

function stageOf(value: string | undefined): Stage | undefined {
  if (value === undefined) return undefined;
  if (!(STAGES as readonly string[]).includes(value)) throw new UserError(`Stage tidak dikenal: ${value}`);
  return value as Stage;
}

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined || value === "") throw new UserError(`${what} wajib diisi.\n\n${HELP}`);
  return value;
}

async function watchLoop(store: Store, intervalS: number, once: boolean) {
  const skip = new Set<string>();
  for (;;) {
    for (const r of await runs.scanTracked(store, skip)) console.log(`[autolog] ${r.lines.join(" · ")}`);
    if (once) return;
    await sleep(intervalS * 1000);
  }
}

async function ui(store: Store, argv: string[]) {
  const { values } = args(argv, { port: { type: "string", default: "4310" }, host: { type: "string", default: "127.0.0.1" }, "no-watch": { type: "boolean" }, dev: { type: "boolean" } });
  store.ensure();
  const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const mode = values.dev ? "dev" : "start";
  if (!values.dev && !isDir(path.join(PACKAGE_DIR, ".next"))) throw new UserError(`Studio belum di-build. Jalankan \`npm run build\` di ${PACKAGE_DIR} atau pakai --dev.`);
  const child = spawn(process.execPath, [next, mode, "-H", String(values.host), "-p", String(values.port)], {
    cwd: PACKAGE_DIR,
    env: { ...process.env, MOTIONMIND_STORE: store.root, MOTIONMIND_PACKAGE_DIR: PACKAGE_DIR },
    stdio: ["ignore", "inherit", "inherit"],
  });
  const stop = () => child.kill("SIGTERM");
  process.on("SIGINT", stop).on("SIGTERM", stop);
  child.on("exit", (code) => process.exit(code ?? 0));
  console.log(`MotionMind Studio → http://${values.host}:${values.port} · store ${store.root}`);
  const tracked = store.readConfig().tracked;
  if (!values["no-watch"]) {
    console.log(`Autolog aktif untuk ${tracked.length} proyek yang dilacak.`);
    await watchLoop(store, 2, false);
  }
}

async function main(argv: string[]) {
  const [cmd, ...rest] = argv;
  const store = new Store();
  switch (cmd) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return;
    case "store":
      console.log(store.root);
      return;
    case "ui":
      return ui(store, rest);
    case "watch": {
      const { values } = args(rest, { once: { type: "boolean" }, interval: { type: "string", default: "2" } });
      if (!values.once) console.log(`Autolog ${store.readConfig().tracked.length} proyek · store ${store.root} · Ctrl+C untuk berhenti`);
      return watchLoop(store, Number(values.interval), Boolean(values.once));
    }
    case "track": {
      const { values, positionals } = args(rest, { campaign: { type: "string" }, backfill: { type: "boolean" } });
      return print(runs.track(store, { dir: need(positionals[0], "Folder proyek"), campaign: need(values.campaign, "--campaign"), backfill: values.backfill }));
    }
    case "untrack":
      return print(runs.untrack(store, parseCampaign(need(rest[0], "Campaign")).campaign));
    case "tracked": {
      const tracked = store.readConfig().tracked;
      if (!tracked.length) return console.log("Belum ada proyek yang dilacak. `motionmind track <folder> --campaign <brand>/<campaign>`");
      for (const t of tracked) console.log(`${t.campaign.padEnd(32)} ${t.engine.padEnd(12)} ${t.dir}`);
      return;
    }
    case "log": {
      const { values, positionals } = args(rest, {
        campaign: { type: "string" }, version: { type: "string" }, src: { type: "string" }, title: { type: "string" }, stage: { type: "string" },
        "run-id": { type: "string" }, param: { type: "string", multiple: true }, metric: { type: "string", multiple: true }, notes: { type: "string" },
        sheet: { type: "string" }, breakdown: { type: "string" }, design: { type: "string" },
      });
      return print(await runs.logVideo(store, {
        campaign: need(values.campaign, "--campaign"), video: need(positionals[0], "File video"), version: values.version, src: values.src,
        title: values.title, stage: stageOf(values.stage), runId: values["run-id"], params: keyValues(values.param, false),
        metrics: keyValues(values.metric, true) as Record<string, number>, notes: values.notes, sheet: values.sheet, breakdown: values.breakdown, design: values.design,
      }));
    }
    case "init": {
      const { values, positionals } = args(rest, { engine: { type: "string", default: "hyperframes" }, resolution: { type: "string" } });
      if (values.engine !== "hyperframes") throw new UserError(`Engine tidak dikenal: ${values.engine} (hyperframes)`);
      return print(await runs.initRun(store, { campaign: need(positionals[0], "Campaign"), version: need(positionals[1], "Versi"), resolution: values.resolution }));
    }
    case "import": {
      const { positionals } = args(rest, {});
      return print(await runs.importRun(store, { source: need(positionals[0], "Folder sumber"), campaign: need(positionals[1], "Campaign"), version: need(positionals[2], "Versi") }));
    }
    case "edit": {
      const { values, positionals } = args(rest, { stop: { type: "boolean" } });
      return print(await runs.editRun(store, { campaign: need(positionals[0], "Campaign"), version: positionals[1], stop: values.stop }));
    }
    case "render": {
      const { values, positionals } = args(rest, { crf: { type: "string", default: "18" } });
      return print(await runs.renderRun(store, { campaign: need(positionals[0], "Campaign"), version: positionals[1], crf: Number(values.crf) }));
    }
    case "promote": {
      const { values, positionals } = args(rest, { stage: { type: "string" } });
      return print(runs.promote(store, need(positionals[0], "run_id"), need(stageOf(values.stage), "--stage")));
    }
    case "list": {
      const { values } = args(rest, { campaign: { type: "string" } });
      const list = store.readRegistry().runs.filter((r) => !values.campaign || r.project === values.campaign);
      console.log(`${"RUN_ID".padEnd(34)} ${"VERSION".padEnd(26)} ${"STAGE".padEnd(11)} ${"RES".padEnd(10)} ${"LUFS".padEnd(7)} SOURCE`);
      for (const r of list) {
        const res = r.metrics.width ? `${r.metrics.width}x${r.metrics.height}` : "—";
        console.log(`${r.run_id.padEnd(34)} ${r.version.padEnd(26)} ${r.stage.padEnd(11)} ${res.padEnd(10)} ${String(r.metrics.integrated_lufs ?? "—").padEnd(7)} ${r.source?.kind ?? "hub"}`);
      }
      return;
    }
    case "compare": {
      const { positionals } = args(rest, {});
      const reg = store.readRegistry().runs;
      const find = (id: string) => reg.find((r) => r.run_id === id || r.version === id) ?? (() => { throw new UserError(`Run '${id}' tidak ditemukan.`); })();
      const [a, b] = [find(need(positionals[0], "run_a")), find(need(positionals[1], "run_b"))];
      const keys = [...new Set([...Object.keys(a.params), ...Object.keys(b.params)])].map((k) => [`params.${k}`, a.params[k], b.params[k]] as const);
      const metrics = ["width", "height", "fps", "duration_s", "size_mb", "integrated_lufs", "true_peak_dbfs"].map((k) => [`metrics.${k}`, a.metrics[k], b.metrics[k]] as const);
      const rows = [["run_id", a.run_id, b.run_id] as const, ["stage", a.stage, b.stage] as const, ...keys, ...metrics];
      const cell = (v: unknown) => (v === undefined || v === null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)).slice(0, 44).padEnd(44);
      for (const [k, va, vb] of rows) console.log(`${k.padEnd(28)} ${cell(va)} ${cell(vb)}${JSON.stringify(va) === JSON.stringify(vb) ? "" : "  ≠"}`);
      return;
    }
    case "music": {
      const { values } = args(rest, {
        out: { type: "string" }, duration: { type: "string" }, bpm: { type: "string", default: "120" }, sections: { type: "string", default: "0:groove" },
        bells: { type: "string", default: "" }, duck: { type: "string", default: "" }, seed: { type: "string", default: "817" },
      });
      return print(await musicBed({
        out: need(values.out, "--out"), duration: Number(need(values.duration, "--duration")), bpm: Number(values.bpm), sections: values.sections,
        bells: values.bells, duck: values.duck, seed: Number(values.seed),
      }));
    }
    case "sfx": {
      const [sub, ...more] = rest;
      if (sub === "scan") {
        args(more, {});
        const lib = sfx.sfxLibrary();
        if (lib === sfx.bundledSfx() && !process.env.MOTIONMIND_SFX) {
          throw new UserError(`Belum ada library SFX sendiri; paket bawaan (${lib}) tidak di-scan. Buat folder kategori (mis. ~/.motionmind/sfx/Pops/), atau set MOTIONMIND_SFX, lalu scan.`);
        }
        return print(await sfx.scan(lib));
      }
      if (sub === "list") {
        const { values } = args(more, { category: { type: "string" }, query: { type: "string" }, unlicensed: { type: "boolean" } });
        const lib = sfx.sfxLibrary();
        const res = sfx.list(lib, values);
        return print(lib === sfx.bundledSfx() ? { lines: [...res.lines, "(paket SFX bawaan MotionMind, CC0 — tambah library sendiri lewat MOTIONMIND_SFX)"] } : res);
      }
      throw new UserError(`Subperintah sfx tidak dikenal: ${sub ?? "(kosong)"} (scan | list)\n\n${HELP}`);
    }
    case "setup": {
      const { values, positionals } = args(rest, { "no-hyperframes-skill": { type: "boolean" }, force: { type: "boolean" } });
      console.log((await setupWorkspace({ dir: positionals[0] ?? ".", hyperframesSkills: !values["no-hyperframes-skill"], force: values.force })).join("\n"));
      return;
    }
    case "skill": {
      const { values, positionals } = args(rest, { global: { type: "boolean" }, force: { type: "boolean" } });
      if (positionals[0] !== "install") throw new UserError("Pakai: motionmind skill install [--global] [--force]");
      const root = values.global ? os.homedir() : store.root;
      if (!values.global && !isDir(store.root)) throw new UserError("Belum ada workspace di sini; jalankan `motionmind setup` atau pakai --global.");
      console.log(installSkill(root, values.force).join("\n"));
      return;
    }
    case "doctor": {
      const res = await doctor();
      console.log(res.lines.join("\n"));
      if (!res.ok) process.exitCode = 1;
      return;
    }
    case "migrate":
      return print(runs.migrate(store));
    default:
      throw new UserError(`Perintah tidak dikenal: ${cmd}\n\n${HELP}`);
  }
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof UserError ? err.message : (err as Error).stack ?? String(err));
  process.exit(1);
});
