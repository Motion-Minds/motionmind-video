"use client";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { editRun, importRun, initRun, logRun, promoteRun, renderRun, trackProject, untrackProject, type ActionState } from "@/app/actions";
import type { EditLock, Stage } from "@/lib/hub";

function Result({ state, linkLabel = "Buka run baru →" }: { state: ActionState; linkLabel?: string | null }) {
  if (!state) return null;
  return (
    <div className={`result ${state.ok ? "ok" : "err"}`}>
      {state.output}
      {state.ok && state.href && linkLabel && (
        <>
          {"\n\n"}
          <Link href={state.href} style={{ textDecoration: "underline" }} target={state.href.startsWith("http") ? "_blank" : undefined}>
            {linkLabel}
          </Link>
        </>
      )}
    </div>
  );
}

function RunFields(props: { brands: string[]; campaigns: string[]; brand: string; campaign: string; version: string; idSuffix: string }) {
  return (
    <>
      <div className="form-row">
        <label className="field">
          Brand
          <input name="brand" list={`brands-${props.idSuffix}`} defaultValue={props.brand} placeholder="demo" required />
        </label>
        <label className="field">
          Campaign
          <input name="campaign" list={`campaigns-${props.idSuffix}`} defaultValue={props.campaign} placeholder="ai-agent-reel-15s" required />
        </label>
        <label className="field">
          Versi
          <input name="version" defaultValue={props.version} placeholder="v1-first-cut" required pattern="v[0-9]+(-[a-z0-9][a-z0-9-]*)?" />
        </label>
      </div>
      <datalist id={`brands-${props.idSuffix}`}>{props.brands.map((b) => <option key={b} value={b} />)}</datalist>
      <datalist id={`campaigns-${props.idSuffix}`}>{props.campaigns.map((c) => <option key={c} value={c} />)}</datalist>
    </>
  );
}

function RunTarget({ brand, campaign, version }: { brand: string; campaign: string; version: string }) {
  return (
    <>
      <input type="hidden" name="brand" value={brand} />
      <input type="hidden" name="campaign" value={campaign} />
      <input type="hidden" name="version" value={version} />
    </>
  );
}

/** Open/close HyperFrames Studio for a run, or for the campaign's tracked project when `version` is empty. Locked for agents while open. */
export function EditForm(props: { brand: string; campaign: string; version: string; editing: EditLock | null }) {
  const [state, action, pending] = useActionState(editRun, null);
  useEffect(() => {
    if (state?.ok && state.href) window.open(state.href, "_blank", "noopener");
  }, [state]);
  return (
    <form action={action} className="form">
      <RunTarget {...props} />
      <div className="inline-form">
        {props.editing ? (
          <>
            <a className="btn primary" href={props.editing.url} target="_blank" rel="noreferrer">
              Buka HyperFrames Studio ↗
            </a>
            <button className="btn" name="op" value="stop" disabled={pending}>
              {pending ? "Menutup…" : "Selesai edit"}
            </button>
          </>
        ) : (
          <button className="btn primary" name="op" value="start" disabled={pending}>
            {pending ? "Membuka…" : "Edit di HyperFrames"}
          </button>
        )}
      </div>
      <Result state={state} linkLabel={null} />
    </form>
  );
}

/** Render a run's src/ (version given) or the tracked project (version empty; the render is logged as a new run). */
export function RenderForm(props: { brand: string; campaign: string; version: string }) {
  const [state, action, pending] = useActionState(renderRun, null);
  return (
    <form action={action} className="form">
      <RunTarget {...props} />
      <div>
        <button className="btn" disabled={pending}>
          {pending ? "Merender… (±30 s per 30 s video)" : props.version ? "Render video.mp4 + contact sheet" : "Render & catat sebagai run baru"}
        </button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function ImportForm(props: { brands: string[]; campaigns: string[] }) {
  const [state, action, pending] = useActionState(importRun, null);
  return (
    <form action={action} className="form">
      <label className="field">
        Folder proyek HyperFrames (berisi index.html)
        <input name="source" placeholder="~/Movies/HyperFrames/my-video" required />
      </label>
      <RunFields {...props} brand="" campaign="" version="v1-" idSuffix="import" />
      <div>
        <button className="btn primary" disabled={pending}>
          {pending ? "Mengimpor…" : "Import ke run baru (motionmind import)"}
        </button>
      </div>
      <Result state={state} />
    </form>
  );
}

/** Track an external project folder: every new render (HyperFrames renders/ or any .mp4 export) becomes a run. */
export function TrackForm(props: { brands: string[]; campaigns: string[]; brand?: string; campaign?: string }) {
  const [state, action, pending] = useActionState(trackProject, null);
  return (
    <form action={action} className="form">
      <label className="field">
        Folder proyek (proyek HyperFrames, atau folder export .mp4 dari editor lain)
        <input name="dir" placeholder="~/Movies/HyperFrames/my-video" required />
      </label>
      <div className="form-row">
        <label className="field">
          Brand
          <input name="brand" list="brands-track" defaultValue={props.brand} placeholder="demo" required />
        </label>
        <label className="field">
          Campaign
          <input name="campaign" list="campaigns-track" defaultValue={props.campaign} placeholder="promo-15s" required />
        </label>
      </div>
      <datalist id="brands-track">{props.brands.map((b) => <option key={b} value={b} />)}</datalist>
      <datalist id="campaigns-track">{props.campaigns.map((c) => <option key={c} value={c} />)}</datalist>
      <label className="skill-opt" style={{ maxWidth: 520 }}>
        <input type="checkbox" name="backfill" />
        <span>
          <b>Catat juga render lama</b>
          Tanpa ini, hanya render setelah sekarang yang masuk.
        </span>
      </label>
      <div>
        <button className="btn primary" disabled={pending}>
          {pending ? "Menyimpan…" : "Lacak proyek (motionmind track)"}
        </button>
      </div>
      <Result state={state} linkLabel="Buka campaign →" />
    </form>
  );
}

export function UntrackForm({ brand, campaign }: { brand: string; campaign: string }) {
  const [state, action, pending] = useActionState(untrackProject, null);
  return (
    <form action={action} className="form">
      <input type="hidden" name="brand" value={brand} />
      <input type="hidden" name="campaign" value={campaign} />
      <div>
        <button className="btn" disabled={pending}>
          {pending ? "Menyimpan…" : "Berhenti melacak"}
        </button>
      </div>
      <Result state={state} linkLabel={null} />
    </form>
  );
}

export function PromoteForm({ runId, stage }: { runId: string; stage: Stage }) {
  const [state, action, pending] = useActionState(promoteRun, null);
  return (
    <form action={action} className="form">
      <input type="hidden" name="run_id" value={runId} />
      <div className="inline-form">
        <select name="stage" defaultValue={stage}>
          <option value="production">production</option>
          <option value="staging">staging</option>
          <option value="archived">archived</option>
        </select>
        <button className="btn" disabled={pending}>
          {pending ? "Menyimpan…" : "Ubah stage"}
        </button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function LogForm(props: { brand: string; campaign: string; version: string; defaultTitle: string; defaultSkill: string }) {
  const [state, action, pending] = useActionState(logRun, null);
  return (
    <form action={action} className="form">
      {(["brand", "campaign", "version"] as const).map((k) => (
        <input key={k} type="hidden" name={k} value={props[k]} />
      ))}
      <div className="form-row">
        <label className="field">
          Judul
          <input name="title" defaultValue={props.defaultTitle} required />
        </label>
        <label className="field">
          Stage
          <select name="stage" defaultValue="staging">
            <option value="staging">staging</option>
            <option value="production">production</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label className="field">
          Skill / engine
          <input name="skill" defaultValue={props.defaultSkill} />
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          Konsep
          <input name="concept" />
        </label>
        <label className="field">
          Hook (0–3 dtk)
          <input name="hook" />
        </label>
        <label className="field">
          CTA
          <input name="cta" />
        </label>
      </div>
      <label className="field">
        Catatan
        <input name="notes" />
      </label>
      <div>
        <button className="btn primary" disabled={pending}>
          {pending ? "Mengukur & mencatat…" : "Catat ke registry (motionmind log)"}
        </button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function InitForm(props: { brands: string[]; campaigns: string[]; brand: string; campaign: string; version: string }) {
  const [state, action, pending] = useActionState(initRun, null);
  return (
    <form action={action} className="form">
      <RunFields {...props} idSuffix="init" />
      <label className="field" style={{ maxWidth: 320 }}>
        Format
        <select name="resolution" defaultValue="portrait">
          <option value="portrait">Portrait 9:16 (1080×1920)</option>
          <option value="landscape">Landscape 16:9 (1920×1080)</option>
          <option value="square">Square 1:1 (1080×1080)</option>
        </select>
      </label>
      <p className="muted small">Proyek HyperFrames (HTML + GSAP), bisa diedit visual di HyperFrames Studio. Logo &amp; font brand disalin ke src/assets/brand/.</p>
      <div>
        <button className="btn primary" disabled={pending}>
          {pending ? "Membuat…" : "Buat run (motionmind init)"}
        </button>
      </div>
      <Result state={state} />
    </form>
  );
}
