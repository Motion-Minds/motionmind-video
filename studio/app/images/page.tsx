import { RunsOverview } from "@/components/RunsOverview";
import { listRuns } from "@/lib/hub";

export const dynamic = "force-dynamic";

export default function ImagesPage() {
  const runs = listRuns().filter((r) => r.kind === "image");
  return (
    <RunsOverview
      title="Images"
      lead={
        <>
          Static deliverables (carousels, covers, thumbnails): runs without an <code>.mp4</code> that contain <code>.png</code>/<code>.jpg</code>/
          <code>.webp</code> files. Log them (<code>motionmind log &lt;folder&gt;</code> or the form on a run page) to give them a stage like a video;
          handoff notes live in <code>DELIVERY.md</code>.
        </>
      }
      kpis={[
        { label: "Deliverables", value: runs.length },
        { label: "Production", value: runs.filter((r) => r.registry?.stage === "production").length },
        { label: "Not logged", value: runs.filter((r) => !r.registry).length },
        { label: "Campaigns", value: new Set(runs.map((r) => `${r.brand}/${r.campaign}`)).size },
        { label: "Image files", value: runs.reduce((n, r) => n + r.images.length, 0) },
        { label: ".zip bundles", value: runs.reduce((n, r) => n + r.files.filter((f) => f.endsWith(".zip")).length, 0) },
      ]}
      runs={runs}
    />
  );
}
