import { marked } from "marked";

/** Renders trusted hub markdown (RULES.md, TASTE.md, breakdown.md, …). */
export function Markdown({ source }: { source: string }) {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: marked.parse(source, { async: false, gfm: true }) }} />;
}
