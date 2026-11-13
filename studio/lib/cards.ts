import type { RunCard } from "@/components/RunsGallery";
import { qaIssues } from "@/core/qa";
import { aspectOf, mediaUrl, type Run } from "./hub";

export function toCard(run: Run): RunCard {
  const reg = run.registry;
  const m = reg?.metrics;
  const spec =
    run.kind === "image"
      ? `${run.images.length} image${run.images.length === 1 ? "" : "s"}${reg?.params.aspect ? ` · ${reg.params.aspect}` : ""}`
      : m?.width ? `${m.width}×${m.height} · ${m.fps}fps · ${m.duration_s}s` : aspectOf(run);
  return {
    key: run.dir,
    href: `/r/${run.brand}/${run.campaign}/${run.version}`,
    project: `${run.brand}/${run.campaign}`,
    version: run.version,
    title: reg?.title ?? run.version,
    stage: reg?.stage ?? null,
    kind: run.kind,
    engine: reg?.params.skill_engine ?? (run.hyperframes ? `hyperframes ${run.hyperframes}` : null),
    mp4Url: run.mp4 ? mediaUrl(run.mp4) : null,
    imageUrl: run.images[0] ? mediaUrl(run.images[0]) : run.sheet ? mediaUrl(run.sheet) : null,
    aspect: aspectOf(run),
    spec,
    lufs: m?.integrated_lufs ?? null,
    qaIssues: m && run.mp4 ? qaIssues(m) : [],
    review: { status: run.review.verdict?.status ?? null, open: run.review.comments.filter((c) => !c.resolved_at).length },
  };
}

const STAGE_ORDER = { production: 0, staging: 1, archived: 2 } as const;

/** Runs with output ordered production → staging → unlogged → archived, newest first within each. */
export const galleryCards = (runs: Run[]): RunCard[] =>
  runs
    .filter((r) => r.kind !== "empty")
    .sort(
      (a, b) =>
        (a.registry ? STAGE_ORDER[a.registry.stage] : 1.5) - (b.registry ? STAGE_ORDER[b.registry.stage] : 1.5) ||
        b.modified.localeCompare(a.modified),
    )
    .map(toCard);
