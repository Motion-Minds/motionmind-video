// Markdown for the Studio. Workspace files are written by agents that also read untrusted pages, so raw HTML is shown
// as text and only http(s)/mailto/relative links survive: nothing in a .md file can run script in the Studio.
import { Marked } from "marked";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Browsers ignore control characters and whitespace inside a URL scheme ("java\tscript:"), so drop them first. */
export function isSafeUrl(href: string): boolean {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href.replace(/[\u0000-\u0020\u007f]/g, ""))?.[1]?.toLowerCase();
  return !scheme || scheme === "http" || scheme === "https" || scheme === "mailto";
}

const md = new Marked({
  gfm: true,
  renderer: { html: ({ text }) => text.replace(/[&<>"']/g, (c) => ESC[c]) },
  walkTokens(token) {
    if ((token.type === "link" || token.type === "image") && !isSafeUrl(token.href)) token.href = "#";
  },
});

export const renderMarkdown = (source: string) => md.parse(source, { async: false }) as string;
