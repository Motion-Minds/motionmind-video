import { RunsOverview } from "@/components/RunsOverview";
import { listCampaigns } from "@/lib/hub";

export const dynamic = "force-dynamic";

export default function AllRunsPage() {
  const campaigns = listCampaigns();
  const runs = campaigns.flatMap((c) => c.runs);
  const videos = runs.filter((r) => r.kind === "video");
  return (
    <RunsOverview
      title="Semua run"
      lead={
        <>
          Semua versi di <code>projects/*/*/runs/</code> store ini, video dan gambar. Stage dan metrik video berasal dari <code>registry.json</code>{" "}
          (<code>motionmind log</code>, autolog proyek yang dilacak, atau form di halaman run).
        </>
      }
      kpis={[
        { label: "Video", value: videos.length },
        { label: "Gambar", value: runs.filter((r) => r.kind === "gambar").length },
        { label: "Production", value: videos.filter((r) => r.registry?.stage === "production").length },
        { label: "Video belum di-log", value: videos.filter((r) => !r.registry).length },
        { label: "Belum ada output", value: runs.filter((r) => r.kind === "empty").length },
        { label: "Campaign", value: campaigns.length },
      ]}
      runs={runs}
    />
  );
}
