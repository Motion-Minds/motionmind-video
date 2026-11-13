"use client";
import { useActionState, useEffect, useState } from "react";
import { addReviewComment, resolveReviewComment, setReviewVerdict, type ActionState } from "@/app/actions";
import type { Review, ReviewComment } from "@/core/review";
import { timecode } from "@/core/timecode";

const NAME_KEY = "motionmind.reviewer";

function Target({ brand, campaign, version }: { brand: string; campaign: string; version: string }) {
  return (
    <>
      <input type="hidden" name="brand" value={brand} />
      <input type="hidden" name="campaign" value={campaign} />
      <input type="hidden" name="version" value={version} />
    </>
  );
}

const Note = ({ state }: { state: ActionState }) => (state && !state.ok ? <div className="result err">{state.output}</div> : null);

/** Comments with a video time and an approve / request-changes verdict, stored in runs/<v>/review.json. */
export function ReviewPanel(props: { brand: string; campaign: string; version: string; review: Review; videoId: string | null }) {
  const { review, videoId } = props;
  const target = { brand: props.brand, campaign: props.campaign, version: props.version };
  const [name, setName] = useState("");
  const [now, setNow] = useState(0);
  const [atNow, setAtNow] = useState(Boolean(videoId));
  const [text, setText] = useState("");
  const [commentState, commentAction, commenting] = useActionState(addReviewComment, null);
  const [verdictState, verdictAction, deciding] = useActionState(setReviewVerdict, null);

  useEffect(() => setName(localStorage.getItem(NAME_KEY) ?? ""), []);
  useEffect(() => {
    const video = videoId ? (document.getElementById(videoId) as HTMLVideoElement | null) : null;
    if (!video) return;
    const tick = () => setNow(video.currentTime);
    video.addEventListener("timeupdate", tick);
    video.addEventListener("seeked", tick);
    return () => {
      video.removeEventListener("timeupdate", tick);
      video.removeEventListener("seeked", tick);
    };
  }, [videoId]);
  useEffect(() => {
    if (commentState?.ok) setText("");
  }, [commentState]);

  const seek = (s: number) => {
    const video = videoId ? (document.getElementById(videoId) as HTMLVideoElement | null) : null;
    if (!video) return;
    video.pause();
    video.currentTime = s;
    video.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const rememberName = (v: string) => {
    setName(v);
    localStorage.setItem(NAME_KEY, v);
  };

  const order = (c: ReviewComment) => c.at_s ?? Number.POSITIVE_INFINITY;
  const comments = [...review.comments].sort((a, b) => Number(!!a.resolved_at) - Number(!!b.resolved_at) || order(a) - order(b) || a.id - b.id);
  const open = review.comments.filter((c) => !c.resolved_at).length;
  const v = review.verdict;

  return (
    <section className="panel review">
      <div className="review-head">
        <h2>Review</h2>
        {v ? (
          <span className={`pill ${v.status === "approved" ? "stage-production" : "stage-staging"}`} title={v.note ?? undefined}>
            {v.status === "approved" ? "✓ approved" : "changes requested"} · {v.by}
          </span>
        ) : (
          <span className="pill stage-unlogged">not reviewed</span>
        )}
        {open > 0 && <span className="pill">{open} open</span>}
      </div>
      {v?.note && (
        <p className="small review-verdict-note">
          <span className="muted">{v.at} · </span>
          {v.note}
        </p>
      )}

      {comments.length > 0 && (
        <ol className="review-list">
          {comments.map((c) => (
            <li key={c.id} className={c.resolved_at ? "resolved" : ""}>
              {c.at_s === null ? (
                <span className="review-time muted">—</span>
              ) : (
                <button type="button" className="review-time" onClick={() => seek(c.at_s!)} disabled={!videoId} title="Jump to this moment">
                  {timecode(c.at_s)}
                </button>
              )}
              <div className="review-body">
                <div className="review-text">{c.text}</div>
                <div className="muted small">
                  #{c.id} · {c.by} · {c.created_at}
                  {c.resolved_at && ` · resolved ${c.resolved_at}`}
                </div>
              </div>
              <ResolveButton {...target} comment={c} />
            </li>
          ))}
        </ol>
      )}

      <form
        className="form"
        action={(fd) => {
          if (atNow && videoId) fd.set("at", String(now));
          fd.set("by", name);
          commentAction(fd);
        }}
      >
        <Target {...target} />
        <textarea
          name="text"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={videoId ? "What should change at this moment? e.g. text appears too fast" : "What should change?"}
          required
          maxLength={2000}
        />
        <div className="inline-form review-actions">
          {videoId && (
            <label className="small review-at">
              <input type="checkbox" checked={atNow} onChange={(e) => setAtNow(e.target.checked)} /> at {timecode(now)}
            </label>
          )}
          <input className="review-name" value={name} onChange={(e) => rememberName(e.target.value)} placeholder="Your name" maxLength={60} aria-label="Your name" />
          <button className="btn" disabled={commenting || !text.trim()}>
            {commenting ? "Adding…" : "Add comment"}
          </button>
        </div>
        <Note state={commentState} />
      </form>

      <form
        className="form review-verdict"
        action={(fd) => {
          fd.set("by", name);
          verdictAction(fd);
        }}
      >
        <Target {...target} />
        <input name="note" placeholder="Note for the verdict (optional)" maxLength={2000} />
        <div className="inline-form">
          <button className="btn primary" name="status" value="approved" disabled={deciding}>
            ✓ Approve
          </button>
          <button className="btn" name="status" value="changes_requested" disabled={deciding}>
            Request changes
          </button>
        </div>
        {verdictState && <div className={`result ${verdictState.ok ? "ok" : "err"}`}>{verdictState.output}</div>}
      </form>
    </section>
  );
}

function ResolveButton(props: { brand: string; campaign: string; version: string; comment: ReviewComment }) {
  const [state, action, pending] = useActionState(resolveReviewComment, null);
  const { comment } = props;
  return (
    <form action={action} className="review-resolve">
      <Target {...props} />
      <input type="hidden" name="id" value={comment.id} />
      <button className="chip" name="op" value={comment.resolved_at ? "reopen" : "resolve"} disabled={pending} title={state && !state.ok ? state.output : undefined}>
        {comment.resolved_at ? "Reopen" : "Resolve"}
      </button>
    </form>
  );
}
