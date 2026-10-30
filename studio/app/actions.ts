"use server";
// Mutations call the same core functions as the `motionmind` CLI, so both always behave the same.
import path from "node:path";
import { revalidatePath } from "next/cache";
import * as runs from "@/core/runs";
import { SLUG, VERSION, UserError } from "@/core/store";
import { STAGES, getRun, readRegistry, store, type Stage } from "@/lib/hub";

export type ActionState = { ok: boolean; output: string; href?: string } | null;

const RESOLUTIONS = ["portrait", "landscape", "square"];

async function attempt(fn: () => Promise<runs.Result> | runs.Result, revalidate = true): Promise<ActionState> {
  try {
    const r = await fn();
    if (revalidate) revalidatePath("/", "layout");
    return { ok: true, output: r.lines.join("\n"), href: r.href };
  } catch (err) {
    return { ok: false, output: err instanceof UserError ? err.message : String((err as Error).stack ?? err) };
  }
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function campaignOf(form: FormData): string | UserError {
  const [brand, campaign] = ["brand", "campaign"].map((k) => text(form, k));
  return SLUG.test(brand) && SLUG.test(campaign) ? `${brand}/${campaign}` : new UserError("Brand dan campaign: huruf kecil, angka, tanda minus (mis. demo, promo-15s).");
}

function target(form: FormData): { campaign: string; version: string } | UserError {
  const campaign = campaignOf(form);
  if (campaign instanceof UserError) return campaign;
  const version = text(form, "version");
  return VERSION.test(version) ? { campaign, version } : new UserError("Versi harus berbentuk v<N>-<slug>, mis. v1-first-cut.");
}

const fail = (err: UserError): ActionState => ({ ok: false, output: err.message });

export async function initRun(_prev: ActionState, form: FormData): Promise<ActionState> {
  const t = target(form);
  if (t instanceof UserError) return fail(t);
  const resolution = text(form, "resolution");
  if (!RESOLUTIONS.includes(resolution)) return { ok: false, output: `Resolusi tidak dikenal: ${resolution}` };
  return attempt(() => runs.initRun(store, { ...t, resolution }));
}

export async function importRun(_prev: ActionState, form: FormData): Promise<ActionState> {
  const t = target(form);
  if (t instanceof UserError) return fail(t);
  const source = text(form, "source");
  if (!path.isAbsolute(source) && !source.startsWith("~/")) return { ok: false, output: "Isi path folder proyek HyperFrames (absolut atau ~/…, mis. ~/Movies/my-video)." };
  return attempt(() => runs.importRun(store, { source, ...t }));
}

export async function trackProject(_prev: ActionState, form: FormData): Promise<ActionState> {
  const campaign = campaignOf(form);
  if (campaign instanceof UserError) return fail(campaign);
  const dir = text(form, "dir");
  if (!path.isAbsolute(dir) && !dir.startsWith("~/")) return { ok: false, output: "Isi path folder proyek (absolut atau ~/…)." };
  return attempt(() => runs.track(store, { dir, campaign, backfill: form.get("backfill") === "on" }));
}

export async function untrackProject(_prev: ActionState, form: FormData): Promise<ActionState> {
  const campaign = campaignOf(form);
  if (campaign instanceof UserError) return fail(campaign);
  return attempt(() => runs.untrack(store, campaign));
}

/** Edit / render target: a HyperFrames run (version given) or the campaign's tracked project (no version). */
function editTarget(form: FormData): { campaign: string; version?: string } | UserError {
  if (!text(form, "version")) return ((c) => (c instanceof UserError ? c : { campaign: c }))(campaignOf(form));
  const t = target(form);
  if (t instanceof UserError) return t;
  const [brand, name] = t.campaign.split("/");
  return getRun(brand, name, t.version)?.hyperframes ? t : new UserError("Run ini bukan proyek HyperFrames.");
}

export async function editRun(_prev: ActionState, form: FormData): Promise<ActionState> {
  const t = editTarget(form);
  if (t instanceof UserError) return fail(t);
  const stop = text(form, "op") === "stop";
  const res = await attempt(() => runs.editRun(store, { ...t, stop }));
  return res && { ...res, href: stop ? undefined : res.href };
}

export async function renderRun(_prev: ActionState, form: FormData): Promise<ActionState> {
  const t = editTarget(form);
  if (t instanceof UserError) return fail(t);
  return attempt(() => runs.renderRun(store, t));
}

export async function promoteRun(_prev: ActionState, form: FormData): Promise<ActionState> {
  const runId = text(form, "run_id");
  const stage = text(form, "stage") as Stage;
  if (!STAGES.includes(stage)) return { ok: false, output: `Stage tidak dikenal: ${stage}` };
  if (!readRegistry().some((r) => r.run_id === runId)) return { ok: false, output: `Run '${runId}' tidak ada di registry.` };
  return attempt(() => runs.promote(store, runId, stage));
}

export async function logRun(_prev: ActionState, form: FormData): Promise<ActionState> {
  const t = target(form);
  if (t instanceof UserError) return { ok: false, output: "Run tidak valid." };
  const [brand, name] = t.campaign.split("/");
  const run = getRun(brand, name, t.version);
  if (!run?.mp4) return { ok: false, output: "Run ini belum punya file .mp4 untuk dicatat." };
  const title = text(form, "title");
  const stage = text(form, "stage") as Stage;
  if (!title) return { ok: false, output: "Judul wajib diisi." };
  if (!STAGES.includes(stage)) return { ok: false, output: `Stage tidak dikenal: ${stage}` };
  const params: Record<string, string> = {};
  for (const [key, field] of [["skill_engine", "skill"], ["concept_name", "concept"], ["hook_copy", "hook"], ["cta_copy", "cta"]] as const) {
    if (text(form, field)) params[key] = text(form, field);
  }
  return attempt(() => runs.logVideo(store, {
    campaign: t.campaign,
    version: t.version,
    video: run.mp4!,
    runId: run.registry?.run_id,
    title,
    stage,
    params,
    notes: text(form, "notes") || undefined,
    sheet: run.sheet ?? undefined,
    breakdown: run.breakdown ?? undefined,
    design: run.design ?? undefined,
  }));
}
