"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { groupByCampaign, suggestionsFor, type CompareRun } from "@/lib/compare";

const optionLabel = (r: CompareRun) => `${r.version} · ${r.registeredLabel} · ${r.stage}`;

export function CompareView({ runs, a, b }: { runs: CompareRun[]; a: string | null; b: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const left = runs.find((r) => r.dir === a) ?? null;
  const right = runs.find((r) => r.dir === b) ?? null;
  const groups = groupByCampaign(runs);
  const suggested = left ? suggestionsFor(left, runs) : [];
  const refs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const select = (side: "a" | "b", dir: string) => {
    let nextB = side === "b" ? dir : b;
    if (side === "a") {
      // A new A gets a B from its own campaign, unless B was already picked there.
      const newA = runs.find((r) => r.dir === dir);
      if (newA && (!right || right.dir === dir || right.project !== newA.project)) nextB = suggestionsFor(newA, runs)[0]?.dir ?? null;
    }
    const q = new URLSearchParams({ ...(side === "a" ? { a: dir } : a ? { a } : {}), ...(nextB ? { b: nextB } : {}) });
    router.replace(`${pathname}?${q}`);
  };
  const videos = () => refs.map((r) => r.current).filter((v): v is HTMLVideoElement => v !== null);
  const seek = (t: number) => {
    for (const v of videos()) v.currentTime = Math.min(t, v.duration || t);
    setTime(t);
  };
  const toggle = () => {
    const next = !playing;
    for (const v of videos()) void (next ? v.play() : v.pause());
    setPlaying(next);
  };

  // The left video is the clock; nudge the right one when it drifts more than one frame at 30 fps.
  useEffect(() => {
    const [master, slave] = refs.map((r) => r.current);
    if (!master) return;
    const onTime = () => {
      setTime(master.currentTime);
      if (slave && Math.abs(slave.currentTime - master.currentTime) > 1 / 30 && master.currentTime <= slave.duration) {
        slave.currentTime = master.currentTime;
      }
    };
    const onMeta = () => setDuration(Math.max(...videos().map((v) => v.duration || 0)));
    const onEnd = () => setPlaying(false);
    master.addEventListener("timeupdate", onTime);
    master.addEventListener("loadedmetadata", onMeta);
    slave?.addEventListener("loadedmetadata", onMeta);
    master.addEventListener("ended", onEnd);
    return () => {
      master.removeEventListener("timeupdate", onTime);
      master.removeEventListener("loadedmetadata", onMeta);
      slave?.removeEventListener("loadedmetadata", onMeta);
      master.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left?.dir, right?.dir]);

  const keys = [...new Set([...Object.keys(left?.fields ?? {}), ...Object.keys(right?.fields ?? {})])];
  return (
    <>
      <div className="compare-grid">
        {(["a", "b"] as const).map((side, i) => {
          const run = side === "a" ? left : right;
          return (
            <div key={side}>
              <select value={run?.dir ?? ""} onChange={(e) => select(side, e.target.value)} style={{ marginBottom: 6 }}>
                <option value="" disabled>
                  Select run {side.toUpperCase()}…
                </option>
                {side === "b" && suggested.length > 0 && (
                  <optgroup label={`Suggested for A · ${left!.project}`}>
                    {suggested.map((r) => (
                      <option key={`s-${r.dir}`} value={r.dir}>
                        {optionLabel(r)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {groups.map((g) => (
                  <optgroup key={g.project} label={g.project}>
                    {g.runs.map((r) => (
                      <option key={r.dir} value={r.dir}>
                        {optionLabel(r)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="muted small" style={{ marginBottom: 10, minHeight: "1.4em" }}>
                {run && `${run.project} · logged ${run.registeredLabel}`}
                {side === "b" && run && run.dir === suggested[0]?.dir &&
                  (run.registeredAt < left!.registeredAt || (run.registeredAt === left!.registeredAt && run.versionNumber < left!.versionNumber)
                    ? " · suggested: the version before A"
                    : " · suggested: the version after A")}
              </p>
              <div className="player">
                {run ? <video ref={refs[i]} src={run.mp4Url} playsInline preload="auto" muted={i === 1} /> : <div className="empty">Nothing selected</div>}
              </div>
            </div>
          );
        })}
      </div>
      {left && right && (
        <>
          <div className="transport">
            <button className="btn primary" onClick={toggle}>
              {playing ? "Pause" : "Play"}
            </button>
            <input type="range" min={0} max={duration || 1} step={0.01} value={time} onChange={(e) => seek(Number(e.target.value))} />
            <span className="mono small">
              {time.toFixed(2)} / {duration.toFixed(2)} s
            </span>
          </div>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Audio from run A; run B is muted. Video A is the reference clock.
          </p>
          <table className="diff-table panel">
            <tbody>
              {keys.map((k) => {
                const va = left.fields[k] ?? "—";
                const vb = right.fields[k] ?? "—";
                return (
                  <tr key={k} className={va !== vb ? "changed" : ""}>
                    <th>{k}</th>
                    <td>{va}</td>
                    <td>{vb}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
