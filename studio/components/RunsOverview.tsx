import { galleryCards } from "@/lib/cards";
import type { Run } from "@/lib/hub";
import { RunsGallery } from "./RunsGallery";

/** Page body shared by "All runs", "Video" and "Images": heading, KPI tiles, filterable gallery. */
export function RunsOverview({ title, lead, kpis, runs }: { title: string; lead: React.ReactNode; kpis: { label: string; value: React.ReactNode }[]; runs: Run[] }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="lead">{lead}</p>
        </div>
      </div>
      <div className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <div className="kpi-val">{k.value}</div>
            <div className="kpi-lbl">{k.label}</div>
          </div>
        ))}
      </div>
      <RunsGallery runs={galleryCards(runs)} />
    </>
  );
}
