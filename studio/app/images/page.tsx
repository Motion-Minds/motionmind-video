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
          <code>.webp</code> files. Handoff notes live in <code>DELIVERY.md</code>; they are not logged to the registry.
        </>
      }
      kpis={[
        { label: "Deliverables", value: runs.length },
        { label: "Campaigns", value: new Set(runs.map((r) => `${r.brand}/${r.campaign}`)).size },
        { label: "Image files", value: runs.reduce((n, r) => n + r.images.length, 0) },
        { label: ".zip bundles", value: runs.reduce((n, r) => n + r.files.filter((f) => f.endsWith(".zip")).length, 0) },
      ]}
      runs={runs}
    />
  );
}
