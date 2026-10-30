# AGENTS.md — MotionMind

Folder ini adalah **tracking store** MotionMind (`motionmind.store.json`) sekaligus repo kode MotionMind. Semua perintah
`motionmind …` dijalankan dari root folder ini. CLI berasal dari paket `studio/` (`npm link` di `studio/`, atau
`node studio/bin/motionmind.mjs …`). Bila `RULES.md` atau `LOCAL.md` ada (catatan hub pribadi, tidak ikut repo publik),
baca juga.

1. **Playbook = skill `motionmind`** (`.agents/skills/motionmind/SKILL.md`, sumbernya `studio/skills/motionmind/`; pasang/perbarui dengan `motionmind skill install`). Video baru = proyek HyperFrames: `motionmind init <brand>/<campaign> v<N>-<slug> --resolution portrait|landscape|square`.
2. **Repo produk = READ-ONLY:** dilarang mengubah/memindah/menulis file video ke repo yang terdaftar di `motionmind.config.json` → `protected_repos` (`motionmind` menolaknya). Pakai aset di `shared/brands/<brand>/`.
3. **Kontrak folder:** campaign `projects/<brand>/<campaign>/` menyimpan `TASTE.md`, `PROGRESS.md`, `LOG.md`, `plan/`; tiap versi di `runs/v<N>-<slug>/` dengan `video.mp4`, `contact-sheet.png`, `breakdown.md`, kode di `src/`. Jangan menimpa versi yang sudah selesai.
4. **Resume:** baca `TASTE.md` → `PROGRESS.md` → akhir `LOG.md` campaign sebelum menulis kode.
5. **Wajib tracking:** setelah render versi baru, jalankan `motionmind log <video> --campaign <brand>/<campaign> …` (atau `motionmind render`, yang memperbarui run yang sudah tercatat) agar tercatat di `registry.json` dan tampil di Studio.
6. **Proyek yang dilacak (`motionmind track`):** campaign yang punya panel "Proyek yang dilacak" mendapat run baru otomatis dari setiap render proyek aslinya. Ubah proyek aslinya (path ada di `motionmind tracked`), bukan snapshot di `runs/`.
7. **`studio/` (paket `motionmind`):** `core/` = logika bersama CLI dan UI, `cli/` = perintah `motionmind`, `app/` + `components/` = Studio, `skills/motionmind/` = skill agen. Ubah perilaku di `core/`, bukan di UI. Jangan menaruh output video di `studio/`. Cek dengan `npm run typecheck` dan `npm run build` di `studio/`.
8. **Kunci edit HyperFrames:** jika `.editing.json` ada (di folder run, atau di folder campaign untuk proyek yang dilacak), **jangan ubah file proyeknya**: user sedang mengedit di HyperFrames Studio dan Studio akan menimpa perubahanmu. Setelah lock dilepas, jalankan `npx hyperframes history` di folder proyek dulu.
