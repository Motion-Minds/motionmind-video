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
}

const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: "production", label: "Production" },
  { id: "staging", label: "Staging" },
  { id: "archived", label: "Archived" },
  { id: "unlogged", label: "Belum di-log" },
  { id: "gambar", label: "Gambar" },
];

/** Image deliverables are never logged to the registry, so they form their own status bucket. */
const bucket = (r: RunCard) => (r.kind === "gambar" ? "gambar" : (r.stage ?? "unlogged"));

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
              Semua campaign
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
              Semua
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
        <div className="empty">Tidak ada run untuk filter ini.</div>
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
                  <span className="muted small">belum ada output</span>
                )}
                <div className="thumb-top">
                  {r.kind === "gambar" ? <span className="pill">gambar</span> : <StagePill stage={r.stage} />}
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
