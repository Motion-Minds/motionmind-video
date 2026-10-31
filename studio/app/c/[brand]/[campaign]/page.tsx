import Link from "next/link";
import { notFound } from "next/navigation";
import { EditForm, RenderForm, TrackForm, UntrackForm } from "@/components/ActionForms";
import { Markdown } from "@/components/Markdown";
import { RunsGallery } from "@/components/RunsGallery";
import { toCard } from "@/lib/cards";
import { categoryLabel } from "@/lib/categories";
import { stamp } from "@/core/store";
import { campaignCategories, getCampaign, listBrands, mediaUrl } from "@/lib/hub";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ brand: string; campaign: string }> }) {
  const { brand, campaign } = await params;
  const c = getCampaign(brand, campaign);
  if (!c) notFound();

  return (
    <>
      <div className="crumbs">
        <Link href="/campaigns">Campaigns</Link> / {brand}
      </div>
      <div className="page-head">
        <div>
          <h1>{campaign}</h1>
          <p className="lead mono small">{c.dir}/</p>
        </div>
        <div className="inline-form">
          {campaignCategories(c).map((id) => (
            <span key={id} className="pill">
              {categoryLabel(id)}
            </span>
          ))}
          {c.planDesign && (
            <a className="btn" href={mediaUrl(c.planDesign)} target="_blank" rel="noreferrer">
              plan/design.html ↗
            </a>
          )}
          <Link className="btn primary" href={`/new?brand=${brand}&campaign=${campaign}&version=v${c.nextVersion}-`}>
            + v{c.nextVersion}
          </Link>
        </div>
      </div>

      <div className="grid two">
        <section className="panel">
          <h2>PROGRESS.md</h2>
          {c.progress ? <Markdown source={c.progress} /> : <p className="muted">No PROGRESS.md yet (created by <code>motionmind init</code> or the agent).</p>}
        </section>
        <section className="panel">
          <h2>LOG.md (latest)</h2>
          {c.logTail.length ? <div className="log">{c.logTail.join("\n")}</div> : <p className="muted">No LOG.md yet.</p>}
        </section>
      </div>

      <section className="panel section">
        {c.tracked ? (
          <>
            <h2>Tracked project</h2>
            <p className="muted small" style={{ marginBottom: 14 }}>
              <code>{c.tracked.dir}</code> · {c.tracked.engine} · {Date.parse(c.tracked.since) === 0 ? "including existing renders" : `since ${stamp(new Date(c.tracked.since))}`}. Every new render{" "}
              {c.tracked.engine === "hyperframes" ? <>in <code>renders/</code></> : <>(.mp4)</>} is logged as a new <code>staging</code> version while <code>motionmind ui</code> /{" "}
              <code>motionmind watch</code> is running.
            </p>
            <div className="inline-form" style={{ alignItems: "flex-start" }}>
              {c.tracked.engine === "hyperframes" && <EditForm brand={brand} campaign={campaign} version="" editing={c.editing} />}
              {c.tracked.engine === "hyperframes" && <RenderForm brand={brand} campaign={campaign} version="" />}
              <UntrackForm brand={brand} campaign={campaign} />
            </div>
          </>
        ) : (
          <details>
            <summary>Track an external project (autolog)</summary>
            <p className="muted small" style={{ margin: "12px 0 14px" }}>
              Track a HyperFrames project folder or an export folder so every render lands in this campaign automatically.
            </p>
            <TrackForm brands={listBrands()} campaigns={[campaign]} brand={brand} campaign={campaign} />
          </details>
        )}
      </section>

      <section className="panel section">
        <details>
          <summary>TASTE.md — campaign style memory</summary>
          {c.taste ? <Markdown source={c.taste} /> : <p className="muted">No TASTE.md yet.</p>}
        </details>
      </section>

      <section className="section">
        <h2>Versions</h2>
        {c.runs.length ? <RunsGallery runs={c.runs.map(toCard)} /> : <div className="empty">No runs yet.</div>}
      </section>
    </>
  );
}
