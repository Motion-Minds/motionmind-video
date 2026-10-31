import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import type { Category } from "@/lib/categories";
import { listCampaigns } from "@/lib/hub";
import "./globals.css";

export const metadata: Metadata = {
  title: "MotionMind Studio",
  description: "Run registry, campaign memory and render review for the MotionMind hub.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const campaigns = listCampaigns();
  const runs = campaigns.flatMap((c) => c.runs).filter((r) => r.kind !== "empty");
  const runCategories: Record<string, Category> = {};
  for (const r of runs) runCategories[`/r/${r.brand}/${r.campaign}/${r.version}`] = r.kind as Category;
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidebar
            counts={{
              video: runs.filter((r) => r.kind === "video").length,
              image: runs.filter((r) => r.kind === "image").length,
              all: runs.length,
              campaigns: campaigns.length,
            }}
            runCategories={runCategories}
          />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
