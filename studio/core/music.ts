// Original procedural music bed for MotionMind videos: no samples, seeded, reproducible (same args → same bytes).
//
// Voices (pad, keys, plucks, bells, kick/clap/hats) are plain additive/FM synthesis. The form is bar sections
// `bar:kind,…` with kinds: tense (Bm pad, ticking hats), calm (pad + soft keys, no drums), groove (D major,
// kick/clap/hats), lift (groove + busier plucks), outro (open chord, no drums). The last 1.5 s fade to silence.
// Output: 48 kHz stereo 16-bit WAV, peak normalised to 0.7 (final loudness is set by the video's master bus).
import fs from "node:fs";
import path from "node:path";
import { UserError } from "./store.ts";

const SR = 48000;
const KINDS: Record<string, true> = { tense: true, calm: true, groove: true, lift: true, outro: true };

export interface MusicOptions {
  out: string;
  duration: number;
  bpm?: number;
  sections?: string;
  bells?: string;
  duck?: string;
  seed?: number;
}

type Stereo = [Float64Array, Float64Array];
type ToneKind = "key" | "pluck" | "bass" | "bell";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal samples (Box–Muller over mulberry32). */
function gaussian(seed: number) {
  const uniform = mulberry32(seed);
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const z = spare;
      spare = null;
      return z;
    }
    const r = Math.sqrt(-2 * Math.log(1 - uniform()));
    const theta = 2 * Math.PI * uniform();
    spare = r * Math.sin(theta);
    return r * Math.cos(theta);
  };
}

const twiddles = new Map<number, [Float64Array, Float64Array]>();

/** In-place iterative radix-2 complex FFT (forward, e^{-iωt}); length must be a power of two. */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  let table = twiddles.get(n);
  if (!table) {
    const cos = new Float64Array(n / 2);
    const sin = new Float64Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      cos[k] = Math.cos((2 * Math.PI * k) / n);
      sin[k] = -Math.sin((2 * Math.PI * k) / n);
    }
    table = [cos, sin];
    twiddles.set(n, table);
  }
  const [cos, sin] = table;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step];
        const wi = sin[k * step];
        const a = start + k;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const samples = (d: number) => Math.trunc(SR * d);

/** Attack · exponential decay · release ramp before the last sample. */
function env(i: number, last: number, at: number, decay: number, release: number) {
  const t = i / SR;
  return Math.min(t / at, 1) * Math.exp(-t / decay) * Math.min(Math.max(last - t, 0) / release, 1);
}

function toneOf(m: number, d: number, kind: ToneKind): Float64Array {
  const len = samples(d);
  const last = (len - 1) / SR;
  const f = 2 * Math.PI * hz(m);
  const x = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const p = f * t;
    let v: number;
    if (kind === "key") {
      v = (Math.sin(p + 1.7 * Math.exp(-t * 5.3) * Math.sin(p * 2)) + 0.16 * Math.sin(p * 3) * Math.exp(-t * 8)) * env(i, last, 0.004, 0.58, 0.07);
    } else if (kind === "pluck") {
      v = (Math.sin(p + 0.65 * Math.exp(-t * 12) * Math.sin(2 * p)) + 0.22 * Math.sin(2 * p) * Math.exp(-t * 5)) * env(i, last, 0.002, 0.22, 0.05);
    } else if (kind === "bass") {
      v = (Math.sin(p) + 0.19 * Math.sin(2 * p) + 0.07 * Math.sin(3 * p)) * env(i, last, 0.012, 0.75, 0.08);
    } else {
      v = (Math.sin(p) * Math.exp(-t * 3) + 0.23 * Math.sin(p * 2.002) * Math.exp(-t * 5)) * Math.min(t / 0.003, 1) * Math.min(Math.max(last - t, 0) / 0.05, 1);
    }
    x[i] = Math.tanh(v * 0.8);
  }
  return x;
}

function kick(): Float64Array {
  const x = new Float64Array(samples(0.34));
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    x[i] = Math.sin(2 * Math.PI * (47 * t + 52 * 0.026 * (1 - Math.exp(-t / 0.026)))) * Math.exp(-t * 13) * Math.min(t / 0.0015, 1);
  }
  return x;
}

function parseList(spec: string, what: string, parts: number): number[][] {
  return spec
    .split(",")
    .filter((s) => s)
    .map((item) => {
      const values = item.split(":").map(Number);
      if (values.length !== parts || values.some((v) => !Number.isFinite(v))) throw new UserError(`Format ${what} tidak valid: '${item}'`);
      return values;
    });
}

function writeWav(file: string, music: Stereo, n: number) {
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVEfmt ", 8, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0, o = 44; i < n; i++, o += 4) {
    buf.writeInt16LE(Math.trunc(Math.min(1, Math.max(-1, music[0][i])) * 32767), o);
    buf.writeInt16LE(Math.trunc(Math.min(1, Math.max(-1, music[1][i])) * 32767), o + 2);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

export async function musicBed(opts: MusicOptions): Promise<{ lines: string[] }> {
  const { out, duration: dur, bpm = 120, sections: sectionSpec = "0:groove", bells = "", duck: duckSpec = "", seed = 817 } = opts;
  if (!(dur > 0)) throw new UserError("--duration harus angka detik > 0.");
  if (!(bpm > 0)) throw new UserError("--bpm harus angka > 0.");
  if (!Number.isInteger(seed)) throw new UserError("--seed harus bilangan bulat.");
  const sections = sectionSpec
    .split(",")
    .map((s) => {
      const [b, kind, ...extra] = s.split(":");
      if (extra.length || !/^\d+$/.test(b ?? "") || !KINDS[kind ?? ""]) throw new UserError(`Section tidak valid: '${s}' (format bar:kind, kind = tense|calm|groove|lift|outro)`);
      return [Number(b), kind] as const;
    })
    .sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const bellTimes = parseList(bells, "--bells", 1).map(([t]) => t);
  const ducks = parseList(duckSpec, "--duck", 2);

  const beat = 60 / bpm;
  const bar = 4 * beat;
  const n = samples(dur);
  const normal = gaussian(seed);
  const music: Stereo = [new Float64Array(n), new Float64Array(n)];

  function add(sig: Float64Array | Stereo, start: number, amp = 1, pan = 0) {
    let i = Math.round(start * SR);
    const len = Array.isArray(sig) ? sig[0].length : sig.length;
    const off = Math.max(-i, 0);
    i = Math.max(i, 0);
    const size = Math.min(len - off, n - i);
    if (size <= 0) return;
    if (Array.isArray(sig)) {
      for (let k = 0; k < size; k++) {
        music[0][i + k] += sig[0][off + k] * amp;
        music[1][i + k] += sig[1][off + k] * amp;
      }
      return;
    }
    const gl = amp * Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = amp * Math.sin(((pan + 1) * Math.PI) / 4);
    for (let k = 0; k < size; k++) {
      music[0][i + k] += sig[off + k] * gl;
      music[1][i + k] += sig[off + k] * gr;
    }
  }

  const tones = new Map<string, Float64Array>();
  function tone(m: number, d = 1.2, kind: ToneKind = "key") {
    const key = `${m}|${d}|${kind}`;
    let x = tones.get(key);
    if (!x) tones.set(key, (x = toneOf(m, d, kind)));
    return x;
  }

  /** White noise band-shaped in the frequency domain (smooth high-pass at lo, low-pass at hi), peak 1. */
  function noise(d: number, lo: number, hi: number) {
    const len = samples(d);
    let size = 1;
    while (size < len) size <<= 1;
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < len; i++) re[i] = normal();
    fft(re, im);
    const low = Math.max(lo, 1);
    for (let k = 0; k < size; k++) {
      const f = (Math.min(k, size - k) * SR) / size;
      const gain = (1 - Math.exp(-((f / low) ** 4))) * Math.exp(-((f / hi) ** 6));
      re[k] *= gain;
      im[k] = -im[k] * gain;
    }
    fft(re, im);
    const x = new Float64Array(len);
    let peak = 0;
    for (let i = 0; i < len; i++) {
      x[i] = re[i] / size;
      peak = Math.max(peak, Math.abs(x[i]));
    }
    for (let i = 0; i < len; i++) x[i] /= peak + 1e-9;
    return x;
  }

  function hat(d = 0.1) {
    const x = noise(d, 5500, 14000);
    const last = (x.length - 1) / SR;
    for (let i = 0; i < x.length; i++) x[i] *= env(i, last, 0.001, 0.022, 0.012);
    return x;
  }

  function clap() {
    const x = noise(0.22, 1100, 9000);
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      x[i] *= ((t >= 0.012 ? Math.exp(-Math.max(t - 0.012, 0) * 24) : 0) + 0.6 * Math.exp(-t * 100)) * 0.5;
    }
    return x;
  }

  function pad(notes: number[], start: number, d: number, amp: number) {
    const len = samples(d);
    const x: Stereo = [new Float64Array(len), new Float64Array(len)];
    notes.forEach((m, j) => {
      [-0.0009, 0.0009].forEach((det, ch) => {
        const f = 2 * Math.PI * hz(m) * (1 + det);
        for (let i = 0; i < len; i++) {
          const p = (f * i) / SR + j * 0.19;
          x[ch][i] += (Math.sin(p) + 0.12 * Math.sin(2 * p)) / notes.length;
        }
      });
    });
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const e = Math.min(t / 0.27, 1) * Math.min((d - t) / 0.62, 1);
      x[0][i] *= e;
      x[1][i] *= e;
    }
    add(x, start, amp);
  }

  const Bm = [59, 62, 66, 69, 73];
  const prog: [number[], number][] = [
    [[62, 66, 69, 73, 76], 38],
    [[61, 64, 69, 71, 76], 33],
    [[62, 66, 69, 71, 74], 35],
    [[62, 66, 67, 69, 74], 31],
  ];
  const bars = Math.ceil(dur / bar);
  for (let b = 0; b < bars; b++) {
    const kind = sections.filter(([sb]) => sb <= b).at(-1)?.[1] ?? sections[0][1];
    const s = b * bar;
    if (kind === "tense") {
      pad(Bm, s, bar + 0.7, 0.085);
      add(tone(35, 1.6, "bass"), s, 0.14);
      for (let e8 = 0; e8 < 8; e8++) add(hat(), s + (e8 * beat) / 2, 0.03 * (e8 % 2 ? 1 : 0.55), e8 % 2 ? 0.25 : -0.25);
      [71, 74, 78].forEach((m, k) => add(tone(m, 0.8, "pluck"), s + (1.5 + k) * beat, 0.05 + 0.01 * k, (k - 1) * 0.4));
      continue;
    }
    let [chord, root] = prog[b % 4];
    if (kind === "outro") {
      [chord, root] = prog[0];
      pad(chord, s, Math.min(bar * 2, dur - s), 0.09);
      chord.slice(1).forEach((m, j) => add(tone(m, 3.5, "key"), s + j * 0.008, 0.05, (j - 1.5) * 0.23));
      add(tone(root, 3, "bass"), s, 0.12);
      continue;
    }
    pad(chord, s, bar + 0.7, kind !== "calm" ? 0.1 : 0.08);
    for (const beatI of kind !== "calm" ? [0, 1.5, 3] : [0, 2]) {
      chord.slice(1).forEach((m, j) => add(tone(m, 1.6, "key"), s + beatI * beat + j * 0.008, 0.055, (j - 1.5) * 0.23));
    }
    if (kind === "calm") {
      add(tone(root, 1.6, "bass"), s, 0.1);
      continue;
    }
    const busy = [0, 0.75, 1.5, 2.5, 3.5, ...(kind === "lift" ? [1, 3] : [])];
    busy.forEach((bt, k) => add(tone(chord[[0, 2, 3, 1, 4][(k + b) % 5]] + 12, 0.9, "pluck"), s + bt * beat, 0.065, k % 2 ? -0.48 : 0.48));
    for (const bt of [0, 1.5, 2, 3.5]) add(tone(root, 1, "bass"), s + bt * beat, 0.15);
    for (const bt of [0, 1.5, 2, 3.25]) add(kick(), s + bt * beat, 0.26);
    for (const bt of [1, 3]) add(clap(), s + bt * beat, 0.1, 0.06);
    for (let e8 = 0; e8 < 8; e8++) add(hat(), s + (e8 * beat) / 2, 0.043 * (e8 % 2 ? 1 : 0.64), e8 % 2 ? -0.27 : 0.23);
  }

  for (const t0 of bellTimes) {
    [78, 81, 85, 90].forEach((m, j) => add(tone(m, 1.3, "bell"), t0 + (j * beat) / 2, 0.05, -0.3 + j * 0.2));
  }
  // Slap echo with channels swapped; walking backwards reads only samples not yet echoed into.
  for (const [d, g] of [[0.25, 0.15], [0.5, 0.07]]) {
    const sh = Math.trunc(d * SR);
    for (let i = n - 1 - sh; i >= 0; i--) {
      music[0][i + sh] += music[1][i] * g;
      music[1][i + sh] += music[0][i] * g;
    }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let gain = Math.min(1, (dur - t) / 1.5);
    for (const [at, depth] of ducks) gain *= 1 - depth * Math.exp(-(((t - at) / 0.45) ** 2));
    music[0][i] *= gain;
    music[1][i] *= gain;
    peak = Math.max(peak, Math.abs(music[0][i]), Math.abs(music[1][i]));
  }
  let energy = 0;
  for (let i = 0; i < n; i++) {
    music[0][i] /= peak / 0.7;
    music[1][i] /= peak / 0.7;
    energy += music[0][i] ** 2 + music[1][i] ** 2;
  }
  const file = path.resolve(out);
  writeWav(file, music, n);
  const rms = 20 * Math.log10(Math.sqrt(energy / (2 * n)));
  return { lines: [`${file} ${dur.toFixed(2)}s ${bars} bar rms ${rms.toFixed(1)} dBFS`] };
}
