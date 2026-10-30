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
          Run yang punya file <code>.mp4</code>. Stage, resolusi, dan LUFS berasal dari <code>registry.json</code>; run yang belum
          tercatat bisa di-log dari halaman run-nya.
        </>
      }
      kpis={[
        { label: "Video runs", value: runs.length },
        { label: "Production", value: logged.filter((r) => r.stage === "production").length },
        { label: "Staging", value: logged.filter((r) => r.stage === "staging").length },
        { label: "Archived", value: logged.filter((r) => r.stage === "archived").length },
        { label: "Belum di-log", value: runs.length - logged.length },
        { label: "Rata-rata LUFS", value: lufs.length ? (lufs.reduce((a, b) => a + b, 0) / lufs.length).toFixed(1) : "—" },
      ]}
      runs={runs}
    />
  );
}
