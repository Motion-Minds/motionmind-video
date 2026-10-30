import { ImportForm, InitForm, TrackForm } from "@/components/ActionForms";
import { listBrands, listCampaigns } from "@/lib/hub";

export const dynamic = "force-dynamic";

export default async function NewRunPage({ searchParams }: { searchParams: Promise<{ brand?: string; campaign?: string; version?: string }> }) {
  const q = await searchParams;
  const campaigns = listCampaigns();
  const brands = listBrands();
  const names = [...new Set(campaigns.map((c) => c.campaign))];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tambah ke MotionMind</h1>
          <p className="lead">
            Lacak proyek yang kamu kerjakan di HyperFrames Studio (atau editor lain) supaya setiap render tercatat otomatis, atau buat versi baru
            langsung di store.
          </p>
        </div>
      </div>
      <section className="panel">
        <h2>Lacak proyek (autolog)</h2>
        <p className="muted small" style={{ marginBottom: 14 }}>
          <code>motionmind track</code>: selama <code>motionmind ui</code> atau <code>motionmind watch</code> berjalan, setiap file baru di <code>renders/</code> proyek
          HyperFrames (atau setiap <code>.mp4</code> baru di folder export) disalin bersama snapshot proyeknya, diukur (resolusi, durasi, LUFS), dan
          dicatat sebagai versi baru berstage <code>staging</code>. Folder proyek tidak diubah.
        </p>
        <TrackForm brands={brands} campaigns={names} brand={q.brand} campaign={q.campaign} />
      </section>
      <section className="panel section">
        <h2>Buat versi baru di store</h2>
        <p className="muted small" style={{ marginBottom: 14 }}>
          <code>motionmind init</code>: membuat memori campaign (TASTE/PROGRESS/LOG/plan/design.html) bila belum ada, folder{" "}
          <code>runs/v&lt;N&gt;-&lt;slug&gt;/</code>, dan proyek HyperFrames di <code>src/</code>. Run yang sudah ada tidak akan ditimpa.
        </p>
        <InitForm brands={brands} campaigns={names} brand={q.brand ?? ""} campaign={q.campaign ?? ""} version={q.version ?? "v1-"} />
      </section>
      <section className="panel section">
        <h2>Import proyek HyperFrames</h2>
        <p className="muted small" style={{ marginBottom: 14 }}>
          <code>motionmind import</code> menyalin proyek yang sudah ada (mis. dari aplikasi desktop HyperFrames atau <code>npx hyperframes init</code>) ke{" "}
          <code>runs/&lt;versi&gt;/src/</code> sekali, untuk dilanjutkan di store. Folder sumber tidak diubah; <code>node_modules/</code>,{" "}
          <code>renders/</code>, dan cache tidak ikut.
        </p>
        <ImportForm brands={brands} campaigns={names} />
      </section>
    </>
  );
}
