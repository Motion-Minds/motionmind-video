import { ImportForm, InitForm, TrackForm } from "@/components/ActionForms";
import { listBrands, listCampaigns } from "@/lib/hub";

export const dynamic = "force-dynamic";

export default async function NewRunPage({ searchParams }: { searchParams: Promise<{ brand?: string; campaign?: string; version?: string }> }) {
  const q = await searchParams;
  const campaigns = listCampaigns();
  const brands = listBrands();
  const names = [...new Set(campaigns.map((c) => c.campaign))];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Add to MotionMind</h1>
          <p className="lead">
            Track a project you work on in HyperFrames Studio (or another editor) so every render is logged automatically, or create a new version
            directly in the store.
          </p>
        </div>
      </div>
      <section className="panel">
        <h2>Track a project (autolog)</h2>
        <p className="muted small" style={{ marginBottom: 14 }}>
          <code>motionmind track</code>: while <code>motionmind ui</code> or <code>motionmind watch</code> is running, every new file in a HyperFrames
          project&rsquo;s <code>renders/</code> (or every new <code>.mp4</code> in an export folder) is copied along with a project snapshot, measured
          (resolution, duration, LUFS) and logged as a new version with stage <code>staging</code>. The project folder is left untouched.
        </p>
        <TrackForm brands={brands} campaigns={names} brand={q.brand} campaign={q.campaign} />
      </section>
      <section className="panel section">
        <h2>Create a new version in the store</h2>
        <p className="muted small" style={{ marginBottom: 14 }}>
          <code>motionmind init</code>: creates the campaign memory (TASTE/PROGRESS/LOG/plan/design.html) if missing, the{" "}
          <code>runs/v&lt;N&gt;-&lt;slug&gt;/</code> folder, and a HyperFrames project in <code>src/</code>. Existing runs are never overwritten.
        </p>
        <InitForm brands={brands} campaigns={names} brand={q.brand ?? ""} campaign={q.campaign ?? ""} version={q.version ?? "v1-"} />
      </section>
      <section className="panel section">
        <h2>Import a HyperFrames project</h2>
        <p className="muted small" style={{ marginBottom: 14 }}>
          <code>motionmind import</code> copies an existing project (e.g. from the HyperFrames desktop app or <code>npx hyperframes init</code>) into{" "}
          <code>runs/&lt;version&gt;/src/</code> once, to continue in the store. The source folder is left untouched; <code>node_modules/</code>,{" "}
          <code>renders/</code> and caches are skipped.
        </p>
        <ImportForm brands={brands} campaigns={names} />
      </section>
    </>
  );
}
