import Link from "next/link";
import { StagePill } from "@/components/StagePill";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { campaignCategories, listCampaigns, mediaUrl, progressSummary } from "@/lib/hub";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const active = CATEGORIES.find((c) => c.id === category) ?? null;
  const campaigns = listCampaigns().map((c) => ({ ...c, categories: campaignCategories(c) }));
  const shown = active ? campaigns.filter((c) => c.categories.includes(active.id)) : campaigns;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Campaigns</h1>
          <p className="lead">
            One campaign = one memory (<code>TASTE.md</code>, <code>PROGRESS.md</code>, <code>LOG.md</code>, <code>plan/</code>) with
            many versions in <code>runs/</code>. Categories follow run output; campaigns without output only appear under &ldquo;All&rdquo;.
          </p>
        </div>
      </div>
      <div className="toolbar">
        <div className="chips">
          <Link href="/campaigns" className={`chip ${active ? "" : "on"}`}>
            All · {campaigns.length}
          </Link>
          {CATEGORIES.map((cat) => (
            <Link key={cat.id} href={`/campaigns?category=${cat.id}`} className={`chip ${active?.id === cat.id ? "on" : ""}`}>
              {cat.label} · {campaigns.filter((c) => c.categories.includes(cat.id)).length}
            </Link>
          ))}
        </div>
      </div>
      <div className="grid cards">
        {shown.map((c) => {
          const { phase, next } = progressSummary(c.progress);
          const latest = c.runs[0];
          const thumbs = c.runs.flatMap((r) => (r.sheet ? [r.sheet] : r.images.slice(0, 1))).slice(0, 3);
          return (
            <Link key={c.dir} href={`/c/${c.brand}/${c.campaign}`} className="panel camp-card">
              <div className="camp-head">
                <div>
                  <span className="muted small mono">{c.brand}</span>
                  <h3>{c.campaign}</h3>
                </div>
                {latest && <StagePill stage={latest.registry?.stage ?? null} />}
              </div>
              {thumbs.length > 0 && (
                <div className="strip">
                  {thumbs.map((t) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={t} src={mediaUrl(t)} alt="" loading="lazy" />
                  ))}
                </div>
              )}
              <div className="small muted">
                {c.runs.length} version{c.runs.length === 1 ? "" : "s"} · latest <span className="mono">{latest?.version ?? "—"}</span>
              </div>
              {phase && (
                <div className="small">
                  <b>Status:</b> <span className="muted">{phase}</span>
                </div>
              )}
              {next && (
                <div className="small">
                  <b>Next:</b> <span className="muted">{next}</span>
                </div>
              )}
              <div className="chips">
                {c.categories.map((id) => (
                  <span key={id} className="pill">
                    {categoryLabel(id)}
                  </span>
                ))}
                {!c.categories.length && <span className="pill stage-unlogged">no output yet</span>}
                {!c.taste && <span className="pill stage-staging">no TASTE.md</span>}
                {!c.progress && <span className="pill stage-staging">no PROGRESS.md</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
