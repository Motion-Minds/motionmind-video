"use client";
import { useMemo, useState } from "react";
import type { StarterKit } from "@/lib/hub";

export interface StarterCampaign {
  brand: string;
  campaign: string;
  nextVersion: number;
  runs: string[];
}

type FieldDef = { label: string; kind: "text" | "area" | "select" | "number"; placeholder?: string; options?: string[]; initial?: string };

const FIELDS: Record<string, FieldDef> = {
  goal: { label: "Goal / key message", kind: "area", placeholder: "Shop owners know stock is running low before it runs out" },
  audience: { label: "Audience", kind: "text", placeholder: "Owners of small shops & cafés" },
  cta: { label: "CTA", kind: "text", placeholder: "example.com" },
  format: { label: "Format", kind: "select", options: ["9:16 (1080×1920, Reels/TikTok)", "16:9 (1920×1080)", "1:1 (1080×1080)", "4:5 (1080×1350, feed)"] },
  duration: { label: "Duration (seconds)", kind: "number", initial: "30" },
  audio: { label: "Audio", kind: "select", options: ["music + SFX, no VO", "VO (MP3 to follow) + music + SFX", "temporary TTS guide VO + music + SFX", "no audio"] },
  content: { label: "Content / screens that must appear", kind: "area", placeholder: "Stock page, low-stock card, notification… (or: pick from captures)" },
  refs: { label: "References", kind: "text", placeholder: "~/Downloads/ref.mp4 seconds 0–3 (copy the technique, not the assets)" },
  style: { label: "Style", kind: "text", placeholder: "follow campaign <name> TASTE.md · or new" },
  change: { label: "What changes", kind: "area", placeholder: "New hook: open on a lost receipt; calmer music" },
  notes: { label: "Review notes", kind: "area", placeholder: "- 8 s: tap is too fast\n- end card: URL too small" },
  slides: { label: "Number of slides", kind: "number", initial: "4" },
  extra: { label: "Extra instructions", kind: "area", placeholder: "Anything specific to this task" },
};

/** Replace {{field}}; drop a line whose placeholders all came out empty, so unused fields leave no stub. */
function fill(template: string, values: Record<string, string>): string {
  return template
    .split("\n")
    .filter((line) => {
      const keys = [...line.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      return !keys.length || keys.some((k) => (values[k] ?? "").trim());
    })
    .map((line) => line.replace(/\{\{(\w+)\}\}/g, (_, k) => (values[k] ?? "").trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function StarterKitBuilder({ kits, brands, campaigns }: { kits: StarterKit[]; brands: string[]; campaigns: StarterCampaign[] }) {
  const [kitId, setKitId] = useState(kits[0]?.id ?? "");
  const kit = kits.find((k) => k.id === kitId) ?? kits[0];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.initial ?? f.options?.[0] ?? ""])),
  );
  const [copied, setCopied] = useState(false);
  const set = (k: string, v: string) => {
    setCopied(false);
    setValues((old) => ({ ...old, [k]: v }));
  };

  const brand = values.brand ?? "";
  const brandCampaigns = campaigns.filter((c) => c.brand === brand);
  const current = brandCampaigns.find((c) => c.campaign === values.campaign);
  const existingOnly = kit?.fields.includes("run") || kit?.fields.includes("version");
  const version = values.version || (current ? `v${current.nextVersion}-` : "");
  const prompt = useMemo(
    () => (kit ? fill(kit.template, { ...values, version, run: values.run || current?.runs[0] || "" }) : ""),
    [kit, values, version, current],
  );

  if (!kit) return <div className="empty">No starter kits in starter-kits/ yet.</div>;

  return (
    <div className="grid two">
      <section className="panel form">
        <div className="chips">
          {kits.map((k) => (
            <button key={k.id} type="button" className={`chip ${k.id === kit.id ? "on" : ""}`} onClick={() => setKitId(k.id)}>
              {k.title}
            </button>
          ))}
        </div>
        <p className="muted small">{kit.description}</p>

        <div className="form-row">
          <label className="field">
            Brand
            <select value={brand} onChange={(e) => (set("brand", e.target.value), set("campaign", ""), set("run", ""), set("version", ""))}>
              <option value="">— select —</option>
              {brands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Campaign {existingOnly ? "(existing)" : "(new: lowercase-with-hyphens)"}
            {existingOnly ? (
              <select value={values.campaign ?? ""} onChange={(e) => (set("campaign", e.target.value), set("run", ""), set("version", ""))}>
                <option value="">— select —</option>
                {brandCampaigns.map((c) => (
                  <option key={c.campaign}>{c.campaign}</option>
                ))}
              </select>
            ) : (
              <input value={values.campaign ?? ""} onChange={(e) => set("campaign", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="safe-stock-30s" />
            )}
          </label>
          {kit.fields.includes("version") && (
            <label className="field">
              New version
              <input value={version} onChange={(e) => set("version", e.target.value)} placeholder="v4-new-hook" />
            </label>
          )}
          {kit.fields.includes("run") && (
            <label className="field">
              Run
              <select value={values.run || current?.runs[0] || ""} onChange={(e) => set("run", e.target.value)}>
                {(current?.runs ?? []).map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {!existingOnly && brandCampaigns.some((c) => c.campaign === values.campaign) && (
          <p className="small" style={{ color: "var(--amber)" }}>
            This campaign already exists. For a new execution of the same message, use the &ldquo;New version&rdquo; kit.
          </p>
        )}

        {kit.fields
          .filter((k) => FIELDS[k])
          .map((k) => {
            const f = FIELDS[k];
            return (
              <label key={k} className="field">
                {f.label}
                {f.kind === "area" ? (
                  <textarea rows={k === "extra" || k === "notes" ? 4 : 2} value={values[k]} placeholder={f.placeholder} onChange={(e) => set(k, e.target.value)} />
                ) : f.kind === "select" ? (
                  <select value={values[k]} onChange={(e) => set(k, e.target.value)}>
                    {f.options!.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input type={f.kind === "number" ? "number" : "text"} value={values[k]} placeholder={f.placeholder} onChange={(e) => set(k, e.target.value)} />
                )}
              </label>
            );
          })}
      </section>

      <section className="panel">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Prompt</h2>
          <button
            type="button"
            className="btn primary"
            disabled={!brand || !values.campaign}
            onClick={() => navigator.clipboard.writeText(prompt).then(() => setCopied(true))}
          >
            {copied ? "Copied ✓" : "Copy prompt"}
          </button>
        </div>
        <pre className="log" style={{ minHeight: 360 }}>{prompt}</pre>
        <p className="muted small" style={{ marginTop: 10 }}>
          Paste into Claude Code / omp / Codex opened in the MotionMind folder. The template lives in <code>starter-kits/{kit.id}.md</code>; edit it or
          add .md files there for new kits.
        </p>
      </section>
    </div>
  );
}
