// Review of one version: timestamped comments and a verdict, stored next to the output in runs/<version>/review.json.
// Studio (reviewers) and the CLI (agents) share these functions; every change is also a line in the campaign LOG.md.
import fs from "node:fs";
import path from "node:path";
import { isDir, isFile, parseCampaign, stamp, Store, UserError, VERSION, withLock, writeAtomic } from "./store.ts";
import { timecode } from "./timecode.ts";

export const REVIEW_FILE = "review.json";
export const VERDICTS = ["approved", "changes_requested"] as const;
export type Verdict = (typeof VERDICTS)[number];

export interface ReviewComment {
  id: number;
  /** Position in the video in seconds; null for a comment on the whole version (or an image run). */
  at_s: number | null;
  text: string;
  by: string;
  created_at: string;
  resolved_at: string | null;
}

export interface Review {
  verdict: { status: Verdict; note: string | null; by: string; at: string } | null;
  comments: ReviewComment[];
}

const MAX_TEXT = 2000;
const EMPTY: Review = { verdict: null, comments: [] };

export interface ReviewTarget {
  campaign: string;
  version: string;
}

function runDirOf(store: Store, t: ReviewTarget): string {
  const { campaign } = parseCampaign(t.campaign);
  if (!VERSION.test(t.version)) throw new UserError(`Version must look like v<N>-<slug>, got '${t.version}'.`);
  const dir = store.runDir(campaign, t.version);
  if (!isDir(dir)) throw new UserError(`Run not found: ${campaign} ${t.version}`);
  return dir;
}

function parse(file: string): Review {
  if (!isFile(file)) return { ...EMPTY, comments: [] };
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<Review>;
  return { verdict: raw.verdict ?? null, comments: Array.isArray(raw.comments) ? raw.comments : [] };
}

export function readReview(store: Store, t: ReviewTarget): Review {
  return parse(path.join(runDirOf(store, t), REVIEW_FILE));
}

/** Review of a run folder given as an absolute path; empty when there is none or it is unreadable (the Studio's read side never crashes on it). */
export function readReviewAt(runAbs: string): Review {
  try {
    return parse(path.join(runAbs, REVIEW_FILE));
  } catch {
    return { ...EMPTY, comments: [] };
  }
}

export const openComments = (r: Review) => r.comments.filter((c) => !c.resolved_at);

export { timecode };

function update(store: Store, t: ReviewTarget, fn: (r: Review) => string): string {
  const dir = runDirOf(store, t);
  const file = path.join(dir, REVIEW_FILE);
  const line = withLock(path.join(dir, ".review.lock"), () => {
    const review = parse(file);
    const out = fn(review);
    writeAtomic(file, JSON.stringify(review, null, 2) + "\n");
    return out;
  });
  store.appendLog(parseCampaign(t.campaign).campaign, `review ${t.version} · ${line}`);
  return line;
}

const cleanText = (text: string, what: string) => {
  const s = text.trim();
  if (!s) throw new UserError(`${what} is empty.`);
  if (s.length > MAX_TEXT) throw new UserError(`${what} is longer than ${MAX_TEXT} characters.`);
  return s;
};
const cleanBy = (by: string | undefined) => by?.trim().slice(0, 60) || "reviewer";
const quote = (s: string) => `"${s.length > 80 ? `${s.slice(0, 79)}…` : s}"`.replace(/\n/g, " ");

export function addComment(store: Store, t: ReviewTarget & { text: string; atS?: number | null; by?: string }): ReviewComment {
  const text = cleanText(t.text, "Comment");
  const atS = t.atS ?? null;
  if (atS !== null && !(Number.isFinite(atS) && atS >= 0)) throw new UserError(`Time must be a number of seconds ≥ 0, got '${t.atS}'.`);
  let comment!: ReviewComment;
  update(store, t, (r) => {
    comment = {
      id: Math.max(0, ...r.comments.map((c) => c.id)) + 1,
      at_s: atS === null ? null : Math.round(atS * 10) / 10,
      text,
      by: cleanBy(t.by),
      created_at: stamp(),
      resolved_at: null,
    };
    r.comments.push(comment);
    return `comment #${comment.id}${comment.at_s === null ? "" : ` @${timecode(comment.at_s)}`} (${comment.by}): ${quote(text)}`;
  });
  return comment;
}

export function resolveComment(store: Store, t: ReviewTarget & { id: number; reopen?: boolean }): ReviewComment {
  let comment!: ReviewComment;
  update(store, t, (r) => {
    const c = r.comments.find((x) => x.id === t.id);
    if (!c) throw new UserError(`Comment #${t.id} not found on ${t.version}.`);
    c.resolved_at = t.reopen ? null : stamp();
    comment = c;
    return `comment #${c.id} ${t.reopen ? "reopened" : "resolved"}`;
  });
  return comment;
}

export function setVerdict(store: Store, t: ReviewTarget & { status: Verdict; note?: string; by?: string }): Review["verdict"] {
  if (!VERDICTS.includes(t.status)) throw new UserError(`Unknown verdict: ${t.status} (approved | changes_requested)`);
  const note = t.note?.trim() ? cleanText(t.note, "Note") : null;
  if (t.status === "changes_requested" && !note && !readReview(store, t).comments.some((c) => !c.resolved_at)) {
    throw new UserError("Say what to change: add a note or an open comment first.");
  }
  let verdict!: Review["verdict"];
  update(store, t, (r) => {
    verdict = { status: t.status, note, by: cleanBy(t.by), at: stamp() };
    r.verdict = verdict;
    const open = openComments(r).length;
    return `${t.status === "approved" ? "approved" : "changes requested"} (${verdict.by})${note ? `: ${quote(note)}` : ""}${open ? ` · ${open} open comment${open === 1 ? "" : "s"}` : ""}`;
  });
  return verdict;
}

/** Plain-text summary for agents: verdict first, then open comments in time order, then resolved ones. */
export function formatReview(t: ReviewTarget, r: Review): string[] {
  const head = r.verdict
    ? `${t.version}: ${r.verdict.status === "approved" ? "APPROVED" : "CHANGES REQUESTED"} by ${r.verdict.by} (${r.verdict.at})${r.verdict.note ? ` — ${r.verdict.note}` : ""}`
    : `${t.version}: no verdict yet`;
  if (!r.comments.length) return [head, "No comments."];
  const order = (c: ReviewComment) => c.at_s ?? Number.POSITIVE_INFINITY;
  const sorted = [...r.comments].sort((a, b) => Number(!!a.resolved_at) - Number(!!b.resolved_at) || order(a) - order(b) || a.id - b.id);
  return [
    head,
    ...sorted.map((c) => `${c.resolved_at ? "[resolved]" : "[open]    "} #${c.id} ${c.at_s === null ? "  —   " : timecode(c.at_s).padStart(6)}  ${c.text.replace(/\n/g, " ")}  (${c.by}, ${c.created_at})`),
  ];
}
