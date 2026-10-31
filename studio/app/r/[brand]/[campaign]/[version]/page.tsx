import Link from "next/link";
import { notFound } from "next/navigation";
import { EditForm, LogForm, PromoteForm, RenderForm } from "@/components/ActionForms";
import { Markdown } from "@/components/Markdown";
import { SafeZoneVideo } from "@/components/SafeZoneVideo";
import { StagePill } from "@/components/StagePill";
import { qaIssues } from "@/core/qa";
import { CATEGORIES } from "@/lib/categories";
import { aspectOf, getRun, mediaUrl, readText } from "@/lib/hub";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ brand: string; campaign: string; version: string }> }) {
  const { brand, campaign, version } = await params;
  const run = getRun(brand, campaign, version);
  if (!run) notFound();
  const reg = run.registry;
  const m = reg?.metrics;
  const aspect = aspectOf(run);
  const category = CATEGORIES.find((c) => c.id === run.kind) ?? null;
  const breakdown = readText(run.breakdown);
  const docs = run.docs.map((d) => ({ path: d, text: readText(d) ?? "" }));
  const facts: [string, React.ReactNode][] = reg
    ? [
        ["Run ID", <span className="mono">{reg.run_id}</span>],
        ["Engine", reg.params.skill_engine],
        ["Resolution", m?.width ? `${m.width}×${m.height} (${aspect}) · ${m.fps} fps · ${m.duration_s} s` : "—"],
        ["Size", m?.size_mb != null ? `${m.size_mb} MB` : "—"],
        ["Loudness", m?.has_audio ? `${m.integrated_lufs} LUFS · TP ${m.true_peak_dbfs} dBFS` : "no audio"],
        ["Concept", reg.params.concept_name],
        ["Hook", reg.params.hook_copy],
        ["CTA", reg.params.cta_copy],
        ["Safe area", reg.params.safe_area],
        ["Color logic", reg.params.color_logic],
        ["Font", Array.isArray(reg.params.fonts) ? reg.params.fonts.join(", ") : reg.params.fonts],
        ["Source", reg.source && reg.source.kind !== "hub" ? <span className="mono small">{reg.source.kind} · {reg.source.file ?? reg.source.dir}</span> : null],
        ["Composition", typeof reg.params.composition === "string" ? `${reg.params.composition}${reg.params.scenes ? ` · ${reg.params.scenes} scenes` : ""}` : null],
        ["Variables", reg.params.variables ? <span className="mono small">{JSON.stringify(reg.params.variables)}</span> : null],
        ["Logged", reg.created_at],
        ["SHA-256", <span className="mono small">{reg.hashes?.mp4_sha256?.slice(0, 16) ?? "—"}</span>],
        ["Notes", reg.notes],
      ]
    : [];
  const qa = reg && run.mp4 ? qaIssues(reg.metrics) : [];

  return (
    <>
      <div className="crumbs">
        {category ? <Link href={category.href}>{category.label}</Link> : <Link href="/">All runs</Link>} /{" "}
        <Link href={`/c/${brand}/${campaign}`}>{brand}/{campaign}</Link> / {version}
      </div>
      <div className="page-head">
        <div>
          <h1>{reg?.title ?? version}</h1>
          <p className="lead mono small">{run.dir}/</p>
        </div>
        <div className="inline-form">
          {run.kind === "image" ? <span className="pill">image</span> : <StagePill stage={reg?.stage ?? null} />}
          {reg && run.mp4 && (qa.length ? <span className="pill stage-staging">QA ✗</span> : <span className="pill stage-production">QA ✓</span>)}
          {run.design && (
            <a className="btn" href={mediaUrl(run.design)} target="_blank" rel="noreferrer">
              design.html ↗
            </a>
          )}
          {run.mp4 && reg && (
            <Link className="btn" href={`/compare?a=${encodeURIComponent(run.dir)}`}>
              Compare
            </Link>
          )}
        </div>
      </div>

      <div className={run.mp4 || run.hyperframes ? "grid two" : ""}>
        <div>
          {run.mp4 ? (
            <SafeZoneVideo src={mediaUrl(run.mp4)} portrait={aspect === "9:16"} />
          ) : run.images.length ? (
            <div className="slides">
              {run.images.map((img) => (
                <a key={img} href={mediaUrl(img)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(img)} alt={img.split("/").pop()} loading="lazy" />
                  <figcaption>{img.split("/").pop()}</figcaption>
                </a>
              ))}
            </div>
          ) : (
            <div className="empty">No output in this run yet.</div>
          )}
        </div>

        <div>
          {run.hyperframes && (
            <section className="panel">
              <h2>HyperFrames {run.hyperframes}</h2>
              <p className="muted small" style={{ marginBottom: 14 }}>
                Project in <code>src/</code>. Edit visually in HyperFrames Studio (timeline, audio, variables); while it is open, the run is locked for agents
                via <code>.editing.json</code>.
              </p>
              {run.editing && (
                <p className="small" style={{ marginBottom: 12 }}>
                  <span className="pill stage-staging">editing</span> <span className="muted">since {run.editing.started_at} · port {run.editing.port}</span>
                </p>
              )}
              <EditForm brand={brand} campaign={campaign} version={version} editing={run.editing} />
              <div style={{ marginTop: 12 }}>
                <RenderForm brand={brand} campaign={campaign} version={version} />
              </div>
            </section>
          )}
          {reg ? (
            <section className="panel">
              <h2>Registry</h2>
              <dl className="kv">
                {facts
                  .filter(([, v]) => v != null && v !== "" && v !== "—")
                  .map(([k, v]) => (
                    <div key={k} style={{ display: "contents" }}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                {Array.isArray(reg.params.palette) && reg.params.palette.length ? (
                  <>
                    <dt>Palette</dt>
                    <dd className="swatches">
                      {reg.params.palette.map((hex) => (
                        <span key={hex} className="swatch">
                          <i style={{ background: hex }} />
                          <span className="mono">{hex}</span>
                        </span>
                      ))}
                    </dd>
                  </>
                ) : null}
              </dl>
            </section>
          ) : null}
          {reg ? (
            <section className="panel">
              <h2>Stage</h2>
              {run.mp4 && (
                <p className="small" style={{ marginBottom: 12 }}>
                  {qa.length ? (
                    <>
                      <span className="pill stage-staging">QA ✗ {qa.length} issue{qa.length === 1 ? "" : "s"}</span>{" "}
                      <span className="muted">Promotion to production is blocked until fixed or forced.</span>
                    </>
                  ) : (
                    <>
                      <span className="pill stage-production">QA ✓ passed</span> <span className="muted">Loudness and true peak within target.</span>
                    </>
                  )}
                </p>
              )}
              <PromoteForm runId={reg.run_id} stage={reg.stage} qaIssues={qa} />
            </section>
          ) : run.mp4 ? (
            <section className="panel">
              <h2>Not logged to the registry yet</h2>
              <p className="muted small" style={{ marginBottom: 14 }}>
                Measures resolution, duration, LUFS/true peak and SHA-256, then adds the run to <code>registry.json</code> in the store. Logged runs
                start as staging; production requires passing QA (−14 ±0.5 LUFS, true peak ≤ −1 dBFS) unless forced.
              </p>
              <LogForm brand={brand} campaign={campaign} version={version} defaultTitle={`${campaign} — ${version}`} defaultSkill={run.hyperframes ? `hyperframes ${run.hyperframes}` : "mp4"} />
            </section>
          ) : null}
        </div>
      </div>

      {run.sheet && (
        <section className="panel section sheet">
          <h2>Contact sheet</h2>
          <a href={mediaUrl(run.sheet)} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(run.sheet)} alt="Contact sheet" loading="lazy" />
          </a>
        </section>
      )}

      {breakdown && (
        <section className="panel section">
          <details open>
            <summary>
              Breakdown <span className="muted small mono">{run.breakdown}</span>
            </summary>
            <Markdown source={breakdown} />
          </details>
        </section>
      )}

      {docs.map((d) => (
        <section key={d.path} className="panel section">
          <details open={run.kind === "image"}>
            <summary>{d.path.split("/").pop()}</summary>
            <Markdown source={d.text} />
          </details>
        </section>
      ))}

      {run.design && (
        <section className="panel section">
          <details>
            <summary>
              Design board <span className="muted small mono">{run.design}</span>
            </summary>
            <iframe className="design-frame" src={mediaUrl(run.design)} title="Design board" />
          </details>
        </section>
      )}

      <section className="panel section">
        <details>
          <summary>Files in this run ({run.files.length})</summary>
          <ul className="files mono">
            {run.files.map((f) => (
              <li key={f}>
                {f.endsWith("/") ? (
                  <span className="muted">{f}</span>
                ) : (
                  <a href={mediaUrl(`${run.dir}/${f}`)} target="_blank" rel="noreferrer">
                    {f}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      </section>
    </>
  );
}
