// Serves hub files (projects/, shared/) to the UI. Supports HTTP Range so <video> can seek.
import fs from "node:fs";
import path from "node:path";
import { resolveServable } from "@/lib/hub";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".zip": "application/zip",
};

const CHUNK = 256 * 1024;

/**
 * Pull-based file body for bytes [start, end]. Browsers abort media requests constantly while seeking;
 * reading only on pull and closing on cancel avoids enqueueing into an already-closed stream.
 */
function fileBody(abs: string, start: number, end: number): ReadableStream<Uint8Array> {
  let handle: fs.promises.FileHandle | undefined;
  let pos = start;
  let done = false;
  const finish = async () => {
    done = true;
    await handle?.close().catch(() => {});
    handle = undefined;
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      handle ??= await fs.promises.open(abs, "r");
      const length = Math.min(CHUNK, end + 1 - pos);
      const buffer = Buffer.alloc(Math.max(length, 0));
      const { bytesRead } = length > 0 ? await handle.read(buffer, 0, length, pos) : { bytesRead: 0 };
      if (done) return;
      if (bytesRead === 0) {
        await finish();
        controller.close();
        return;
      }
      pos += bytesRead;
      controller.enqueue(buffer.subarray(0, bytesRead));
    },
    cancel: finish,
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path;
  const abs = resolveServable(segments.join("/"));
  const stat = abs ? fs.statSync(abs, { throwIfNoEntry: false }) : undefined;
  if (!abs || !stat?.isFile()) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    "Last-Modified": stat.mtime.toUTCString(),
  });
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    // "bytes=a-b", "bytes=a-" or suffix "bytes=-n"
    const start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    if (start > end || start >= stat.size) {
      headers.set("Content-Range", `bytes */${stat.size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(fileBody(abs, start, end), { status: 206, headers });
  }
  headers.set("Content-Length", String(stat.size));
  return new Response(fileBody(abs, 0, stat.size - 1), { status: 200, headers });
}
