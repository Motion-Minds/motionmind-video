import type { Stage } from "@/lib/hub";

export function StagePill({ stage }: { stage: Stage | null }) {
  const label = stage === "production" ? "★ production" : (stage ?? "not logged");
  return <span className={`pill stage-${stage ?? "unlogged"}`}>{label}</span>;
}
