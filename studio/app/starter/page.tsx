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
            Pilih jenis tugas, isi yang perlu, tambahkan perintahmu sendiri, lalu salin prompt-nya ke agen. Aturan studio (SOP Hukum #4, aset brand, SFX,
            kunci edit) sudah termasuk di dalam kit.
          </p>
        </div>
      </div>
      <StarterKitBuilder kits={listStarterKits()} brands={listBrands()} campaigns={campaigns} />
    </>
  );
}
