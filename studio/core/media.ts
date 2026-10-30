// Measurements of a rendered video (ffprobe + EBU R128 loudness) and its contact sheet.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { promisify } from "node:util";
import { isFile, UserError } from "./store.ts";

export const run = promisify(execFile);
const BIG = { maxBuffer: 64 * 1024 * 1024 };

export interface MediaMetrics {
  width: number;
  height: number;
  fps: number;
  frames: number;
  duration_s: number;
  size_mb: number;
  bitrate_kbps: number;
  video_codec: string | null;
  audio_codec: string | null;
  has_audio: boolean;
  integrated_lufs: number | null;
  lra_lu: number | null;
  true_peak_dbfs: number | null;
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  nb_frames?: string;
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;
const last = (re: RegExp, text: string) => {
  const all = [...text.matchAll(re)];
  return all.length ? Number(all[all.length - 1][1]) : null;
};

export async function probe(video: string): Promise<MediaMetrics> {
  let json: { streams?: ProbeStream[]; format?: { duration?: string; size?: string; bit_rate?: string } };
  try {
    const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames",
      "-show_entries", "format=duration,size,bit_rate", "-of", "json", video], BIG);
    json = JSON.parse(stdout);
  } catch (err) {
    throw new UserError(`ffprobe gagal membaca '${video}': ${(err as Error).message}`);
  }
  const v = json.streams?.find((s) => s.codec_type === "video") ?? {};
  const a = json.streams?.find((s) => s.codec_type === "audio");
  const fmt = json.format ?? {};
  const [num, den] = (v.r_frame_rate ?? "0/1").split("/").map(Number);
  const fps = round(num / Math.max(1, den || 1), 2);
  const duration = Number(fmt.duration ?? 0);

  let lufs = null, lra = null, tp = null;
  if (a) {
    // ebur128 prints its summary on stderr; a failed measurement leaves the loudness fields null.
    const res = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", video, "-af", "ebur128=peak=true", "-f", "null", "-"], BIG).catch((e) => e);
    const log = String(res.stderr ?? "");
    lufs = last(/Integrated loudness:\s+I:\s*([-\d.]+)\s*LUFS/g, log);
    lra = last(/Loudness range:\s+LRA:\s*([-\d.]+)\s*LU/g, log);
    tp = last(/True peak:\s+Peak:\s*([-\d.]+)\s*dBFS/g, log);
  }
  return {
    width: Number(v.width ?? 0),
    height: Number(v.height ?? 0),
    fps,
    frames: Number(v.nb_frames) || Math.round(duration * fps),
    duration_s: round(duration, 2),
    size_mb: round(Number(fmt.size ?? 0) / (1024 * 1024), 2),
    bitrate_kbps: Math.round(Number(fmt.bit_rate ?? 0) / 1000),
    video_codec: v.codec_name ?? null,
    audio_codec: a?.codec_name ?? null,
    has_audio: Boolean(a),
    integrated_lufs: lufs,
    lra_lu: lra,
    true_peak_dbfs: tp,
  };
}

export async function sha256(file: string): Promise<string | null> {
  if (!isFile(file)) return null;
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

const LABEL_FONTS = ["/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"];

/** One frame per second, 10 per row, each stamped with its time. */
export async function contactSheet(video: string, out: string, durationS: number): Promise<void> {
  const rows = Math.max(1, Math.ceil((durationS || 1) / 10));
  const font = LABEL_FONTS.find(isFile);
  const label = font
    ? `,drawtext=fontfile='${font.replace(/:/g, "\\:")}':text='%{pts\\:hms}':x=8:y=h-34:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6`
    : "";
  await run("ffmpeg", ["-v", "error", "-y", "-i", video, "-vf", `fps=1,scale=270:-2${label},tile=10x${rows}:padding=6:color=white`, "-frames:v", "1", out], BIG);
}

export const aspectOf = (m: { width?: number; height?: number }) =>
  !m.width || !m.height ? undefined : m.height > m.width ? "9:16" : m.width > m.height ? "16:9" : "1:1";
