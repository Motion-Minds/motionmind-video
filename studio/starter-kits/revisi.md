---
title: Revisi run
description: Catatan review untuk run yang belum disetujui. Perbaikan teknis di run yang sama; arah kreatif baru jadi versi baru.
category: video
order: 3
fields: brand, campaign, run, notes, extra
---
Pakai skill motionmind (revisi run yang sudah ada).

Revisi {{brand}}/{{campaign}} run {{run}}.
Cek dulu runs/{{run}}/.editing.json: kalau ada, minta aku menekan "Selesai edit". Lalu jalankan `npx hyperframes history` di src/ untuk melihat perubahanku di HyperFrames Studio.
Catatan: {{notes}}

Perbaikan teknis (typo, posisi, timing kecil) di run yang sama. Kalau catatannya mengubah arah kreatif, buat versi baru dan bilang dulu.
Setelah selesai: `motionmind render {{brand}}/{{campaign}} {{run}}`, jalankan checklist QA skill, tambahkan aturan dari catatanku ke feedback rules di TASTE.md.

Tambahan: {{extra}}
