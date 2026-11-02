import { CompareView } from "@/components/CompareView";
import { parseRegistered, suggestionsFor, type CompareRun } from "@/lib/compare";
import { aspectOf, listRuns, mediaUrl } from "@/lib/hub";
import { stamp, versionNumber } from "@/core/store";

export const dynamic = "force-dynamic";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams;
  const runs: CompareRun[] = listRuns()
    .filter((r) => r.mp4)
    .map((r) => {
      const reg = r.registry;
      const m = reg?.metrics;
      const registeredLabel = reg ? reg.created_at : stamp(new Date(r.modified));
      const registeredAt = parseRegistered(reg ? reg.created_at : r.modified);
      const fields: Record<string, string> = {
        Stage: reg?.stage ?? "not logged",
        Logged: reg ? reg.created_at : "—",
        Engine: reg?.params.skill_engine ?? "—",
        Resolution: m?.width ? `${m.width}×${m.height} (${aspectOf(r)})` : "—",
        FPS: m?.fps != null ? String(m.fps) : "—",
        Duration: m?.duration_s != null ? `${m.duration_s} s` : "—",
        LUFS: m?.integrated_lufs != null ? String(m.integrated_lufs) : "—",
        "True peak": m?.true_peak_dbfs != null ? `${m.true_peak_dbfs} dBFS` : "—",
        "Size (MB)": m?.size_mb != null ? String(m.size_mb) : "—",
        Concept: reg?.params.concept_name ?? "—",
        Hook: reg?.params.hook_copy ?? "—",
        CTA: reg?.params.cta_copy ?? "—",
        Palette: Array.isArray(reg?.params.palette) ? reg.params.palette.join(", ") || "—" : String(reg?.params.palette ?? "—"),
        Variables: reg?.params.variables ? JSON.stringify(reg.params.variables) : "—",
        Source: reg?.source && reg.source.kind !== "hub" ? `${reg.source.kind} · ${reg.source.file ?? reg.source.dir}` : "store",
      };
      return {
        dir: r.dir,
        project: `${r.brand}/${r.campaign}`,
        version: r.version,
        versionNumber: versionNumber(r.version),
        aspect: aspectOf(r) ?? null,
        registeredAt,
        registeredLabel,
        stage: reg?.stage ?? "not logged",
        mp4Url: mediaUrl(r.mp4!),
        fields,
      };
    });
  // Opened with only A (the run page's Compare button): start with A's suggested partner.
  const left = runs.find((r) => r.dir === a);
  const right = b ?? (left ? suggestionsFor(left, runs)[0]?.dir : undefined);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Compare</h1>
          <p className="lead">
            Play two versions side by side with synced play/seek; rows that differ are highlighted amber. Runs are listed by campaign,
            newest logged first; picking A suggests B from the same campaign.
          </p>
        </div>
      </div>
      <CompareView runs={runs} a={a ?? null} b={right ?? null} />
    </>
  );
}
