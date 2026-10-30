import { RunsOverview } from "@/components/RunsOverview";
import { listRuns } from "@/lib/hub";

export const dynamic = "force-dynamic";

export default function GambarPage() {
  const runs = listRuns().filter((r) => r.kind === "gambar");
  return (
    <RunsOverview
      title="Gambar"
      lead={
        <>
          Deliverable statis (carousel, cover, thumbnail): run tanpa <code>.mp4</code> yang berisi <code>.png</code>/<code>.jpg</code>/
          <code>.webp</code>. Catatan serah-terima ada di <code>DELIVERY.md</code>; tidak di-log ke registry.
        </>
      }
      kpis={[
        { label: "Deliverable", value: runs.length },
        { label: "Campaign", value: new Set(runs.map((r) => `${r.brand}/${r.campaign}`)).size },
        { label: "File gambar", value: runs.reduce((n, r) => n + r.images.length, 0) },
        { label: "Paket .zip", value: runs.reduce((n, r) => n + r.files.filter((f) => f.endsWith(".zip")).length, 0) },
      ]}
      runs={runs}
    />
  );
}
