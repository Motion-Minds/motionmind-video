/** Seconds as m:ss.t, e.g. 75.4 → "1:15.4". Pure, so the Studio's client components can use it too. */
export function timecode(seconds: number): string {
  const tenths = Math.round(seconds * 10);
  const m = Math.floor(tenths / 600);
  const rest = (tenths - m * 600) / 10;
  return `${m}:${rest < 10 ? "0" : ""}${rest.toFixed(1)}`;
}
