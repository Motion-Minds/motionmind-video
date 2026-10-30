import Link from "next/link";
import { StagePill } from "@/components/StagePill";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { campaignCategories, listCampaigns, mediaUrl, progressSummary } from "@/lib/hub";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ kategori?: string }> }) {
  const { kategori } = await searchParams;
  const active = CATEGORIES.find((c) => c.id === kategori) ?? null;
  const campaigns = listCampaigns().map((c) => ({ ...c, categories: campaignCategories(c) }));
  const shown = active ? campaigns.filter((c) => c.categories.includes(active.id)) : campaigns;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Campaigns</h1>
          <p className="lead">
            Satu campaign = satu memori (<code>TASTE.md</code>, <code>PROGRESS.md</code>, <code>LOG.md</code>, <code>plan/</code>) dengan
            banyak versi di <code>runs/</code>. Kategori mengikuti output run-nya; campaign tanpa output hanya muncul di &ldquo;Semua&rdquo;.
          </p>
        </div>
      </div>
      <div className="toolbar">
        <div className="chips">
          <Link href="/campaigns" className={`chip ${active ? "" : "on"}`}>
            Semua · {campaigns.length}
          </Link>
          {CATEGORIES.map((cat) => (
            <Link key={cat.id} href={`/campaigns?kategori=${cat.id}`} className={`chip ${active?.id === cat.id ? "on" : ""}`}>
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
                {c.runs.length} versi · terbaru <span className="mono">{latest?.version ?? "—"}</span>
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
                {!c.categories.length && <span className="pill stage-unlogged">belum ada output</span>}
                {!c.taste && <span className="pill stage-staging">TASTE.md belum ada</span>}
                {!c.progress && <span className="pill stage-staging">PROGRESS.md belum ada</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
