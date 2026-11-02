import { renderMarkdown } from "@/lib/markdown";

/** Workspace markdown (RULES.md, TASTE.md, breakdown.md, …), rendered without raw HTML or script URLs. */
export function Markdown({ source }: { source: string }) {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}
