// Runs before every Studio request (pages, server actions, /media, /_next). See core/host.ts.
import { NextResponse, type NextRequest } from "next/server";
import { rejectReason } from "./core/host";

const extra = (process.env.MOTIONMIND_ALLOWED_HOSTS ?? "").split(",").filter(Boolean);

export function proxy(req: NextRequest) {
  const reason = rejectReason(
    { method: req.method, host: req.headers.get("host"), origin: req.headers.get("origin"), secFetchSite: req.headers.get("sec-fetch-site") },
    extra,
  );
  return reason ? new NextResponse(`Forbidden: ${reason}`, { status: 403 }) : NextResponse.next();
}

export const config = { matcher: "/:path*" };
