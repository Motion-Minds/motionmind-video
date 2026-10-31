import { RunsOverview } from "@/components/RunsOverview";
import { listRuns } from "@/lib/hub";

export const dynamic = "force-dynamic";

export default function VideoPage() {
  const runs = listRuns().filter((r) => r.kind === "video");
  const logged = runs.flatMap((r) => (r.registry ? [r.registry] : []));
  const lufs = logged.map((r) => r.metrics.integrated_lufs).filter((v): v is number => typeof v === "number");
  return (
    <RunsOverview
      title="Video"
      lead={
        <>
          Runs with an <code>.mp4</code> file. Stage, resolution and LUFS come from <code>registry.json</code>; unlogged runs can be logged
          from their run page (as <code>staging</code> unless another stage is chosen). Production requires passing QA (−14 ±0.5 LUFS, true peak ≤
          −1 dBFS) unless forced.
        </>
      }
      kpis={[
        { label: "Video runs", value: runs.length },
        { label: "Production", value: logged.filter((r) => r.stage === "production").length },
        { label: "Staging", value: logged.filter((r) => r.stage === "staging").length },
        { label: "Archived", value: logged.filter((r) => r.stage === "archived").length },
        { label: "Not logged", value: runs.length - logged.length },
        { label: "Average LUFS", value: lufs.length ? (lufs.reduce((a, b) => a + b, 0) / lufs.length).toFixed(1) : "—" },
      ]}
      runs={runs}
    />
  );
}
