import { StarterKitBuilder } from "@/components/StarterKit";
import { listBrands, listCampaigns, listStarterKits } from "@/lib/hub";

export const dynamic = "force-dynamic";

export default function StarterPage() {
  const campaigns = listCampaigns().map((c) => ({ brand: c.brand, campaign: c.campaign, nextVersion: c.nextVersion, runs: c.runs.map((r) => r.version) }));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Starter kit</h1>
          <p className="lead">
            Pick a task type, fill in what it needs, add your own instructions, then copy the prompt to your agent. Studio rules (SOP Rule #4, brand
            assets, SFX, edit lock) are already built into each kit.
          </p>
        </div>
      </div>
      <StarterKitBuilder kits={listStarterKits()} brands={listBrands()} campaigns={campaigns} />
    </>
  );
}
