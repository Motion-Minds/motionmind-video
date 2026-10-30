"use client";
import { useState } from "react";

// 9:16 frames keep essentials inside the 4:5 centre crop: y = 285..1635 of 1920 (14.84% bands).
const BAND = `${(285 / 1920) * 100}%`;

export function SafeZoneVideo({ src, portrait }: { src: string; portrait: boolean }) {
  const [safe, setSafe] = useState(false);
  return (
    <div>
      <div className={`player ${portrait ? "portrait" : ""}`}>
        <video src={src} controls playsInline preload="metadata" />
        {portrait && safe && (
          <>
            <div className="safe-band top" style={{ height: BAND }} />
            <div className="safe-band bottom" style={{ height: BAND, bottom: 0 }} />
          </>
        )}
      </div>
      {portrait && (
        <div className="inline-form" style={{ justifyContent: "center", marginTop: 10 }}>
          <button className={`chip ${safe ? "on" : ""}`} onClick={() => setSafe(!safe)}>
            {safe ? "Sembunyikan" : "Tampilkan"} zona aman 4:5 (y 285–1635)
          </button>
        </div>
      )}
    </div>
  );
}
