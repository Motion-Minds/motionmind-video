"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Category } from "@/lib/categories";
import type { Stage } from "@/lib/hub";
import { StagePill } from "./StagePill";

export interface RunCard {
  key: string;
  href: string;
  project: string;
  version: string;
  title: string;
  stage: Stage | null;
  kind: Category | "empty";
  engine: string | null;
  mp4Url: string | null;
  imageUrl: string | null;
  aspect: string | null;
  spec: string | null;
  lufs: number | null;
  /** Loudness QA violations of a logged video (`qaIssues`); empty when it passes or has no measurements. */
  qaIssues: string[];
  /** Review verdict (runs/<v>/review.json) and how many comments are still open. */
  review: { status: "approved" | "changes_requested" | null; open: number };
}

const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: "production", label: "Production" },
  { id: "staging", label: "Staging" },
  { id: "archived", label: "Archived" },
  { id: "unlogged", label: "Not logged" },
];

/** Videos and image deliverables share the stages; anything not in the registry yet is "not logged". */
const bucket = (r: RunCard) => r.stage ?? "unlogged";

export function RunsGallery({ runs }: { runs: RunCard[] }) {
  const [project, setProject] = useState("all");
  const [stage, setStage] = useState("all");
  const projects = useMemo(() => [...new Set(runs.map((r) => r.project))], [runs]);
  const statuses = useMemo(() => STATUS_FILTERS.filter((s) => runs.some((r) => bucket(r) === s.id)), [runs]);
  const shown = runs.filter(
    (r) => (project === "all" || r.project === project) && (stage === "all" || bucket(r) === stage),
  );

  return (
    <>
      <div className="toolbar">
        {projects.length > 1 && (
          <div className="chips">
            <button className={`chip ${project === "all" ? "on" : ""}`} onClick={() => setProject("all")}>
              All campaigns
            </button>
            {projects.map((p) => (
              <button key={p} className={`chip ${project === p ? "on" : ""}`} onClick={() => setProject(p)}>
                {p}
              </button>
            ))}
          </div>
        )}
        {statuses.length > 1 && (
          <div className="chips">
            <button className={`chip ${stage === "all" ? "on" : ""}`} onClick={() => setStage("all")}>
              All
            </button>
            {statuses.map((s) => (
              <button key={s.id} className={`chip ${stage === s.id ? "on" : ""}`} onClick={() => setStage(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {shown.length === 0 ? (
        <div className="empty">No runs match this filter.</div>
      ) : (
        <div className="grid cards">
          {shown.map((r) => (
            <Link key={r.key} href={r.href} className="run-card">
              <div className="thumb">
                {r.mp4Url ? (
                  <video
                    src={`${r.mp4Url}#t=1`}
                    muted
                    playsInline
                    preload="metadata"
                    onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                  />
                ) : r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span className="muted small">no output yet</span>
                )}
                <div className="thumb-top">
                  {r.kind === "image" && !r.stage ? <span className="pill">image</span> : <StagePill stage={r.stage} />}
                  <span className="thumb-flags">
                    {r.qaIssues.length > 0 && (
                      <span className="pill stage-staging" title={r.qaIssues.join("\n")}>
                        QA ✗
                      </span>
                    )}
                    {r.review.status === "approved" ? (
                      <span className="pill stage-production">✓ approved</span>
                    ) : r.review.status === "changes_requested" ? (
                      <span className="pill stage-staging">changes{r.review.open ? ` · ${r.review.open}` : ""}</span>
                    ) : r.review.open > 0 ? (
                      <span className="pill">{r.review.open} comment{r.review.open === 1 ? "" : "s"}</span>
                    ) : null}
                  </span>
                </div>
              </div>
              <div className="run-body">
                <span className="muted small mono">
                  {r.project} · {r.version}
                </span>
                <span className="run-title">{r.title}</span>
                <div className="run-meta">
                  {r.engine && <span className="pill wrap">{r.engine}</span>}
                  {r.spec && <span className="pill">{r.spec}</span>}
                  {r.lufs != null && <span className="pill">{r.lufs} LUFS</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
