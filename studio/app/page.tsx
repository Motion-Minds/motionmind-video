import { RunsOverview } from "@/components/RunsOverview";
import { listCampaigns } from "@/lib/hub";

export const dynamic = "force-dynamic";

export default function AllRunsPage() {
  const campaigns = listCampaigns();
  const runs = campaigns.flatMap((c) => c.runs);
  const videos = runs.filter((r) => r.kind === "video");
  return (
    <RunsOverview
      title="All runs"
      lead={
        <>
          Every version in this store&rsquo;s <code>projects/*/*/runs/</code>, video and images. Stages and video metrics come from <code>registry.json</code>{" "}
          (<code>motionmind log</code>, autolog of tracked projects, or the form on a run page).
        </>
      }
      kpis={[
        { label: "Video", value: videos.length },
        { label: "Images", value: runs.filter((r) => r.kind === "image").length },
        { label: "Production", value: videos.filter((r) => r.registry?.stage === "production").length },
        { label: "Unlogged videos", value: videos.filter((r) => !r.registry).length },
        { label: "No output yet", value: runs.filter((r) => r.kind === "empty").length },
        { label: "Campaigns", value: campaigns.length },
      ]}
      runs={runs}
    />
  );
}
