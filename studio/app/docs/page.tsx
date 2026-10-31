import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { Markdown } from "@/components/Markdown";
import { packageDir } from "@/core/store";
import { STORE_ROOT } from "@/lib/hub";

export const dynamic = "force-dynamic";

type Doc = { label: string; group: string; files: string[] };

/** Skill docs ship with the package; hub docs exist only when the store is a hub checkout. Read at request time. */
function docs(): Record<string, Doc> {
  const skill = path.join(packageDir(), "skills", "motionmind");
  const list: Record<string, Doc> = {
    skill: { label: "SKILL.md", group: "motionmind skill", files: [path.join(skill, "SKILL.md")] },
  };
  for (const [id, label] of [["workflow", "Workflow & gate"], ["hyperframes", "HyperFrames"], ["motion", "Motion"], ["sound", "Sound"], ["qa", "QA"], ["screen-demo", "Screen demo"]]) {
    list[id] = { label, group: "motionmind skill", files: [path.join(skill, "references", `${id}.md`)] };
  }
  for (const [id, file] of [["rules", "RULES.md"], ["skills", "MOTION-SKILLS.md"], ["agents", "AGENTS.md"]]) {
    list[id] = { label: file, group: "Hub", files: [path.join(/*turbopackIgnore: true*/ STORE_ROOT, file), path.join(/*turbopackIgnore: true*/ path.dirname(packageDir()), file)] };
  }
  return Object.fromEntries(Object.entries(list).filter(([, d]) => d.files.some((f) => fs.existsSync(f))));
}

export default async function DocsPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const { doc = "skill" } = await searchParams;
  const all = docs();
  const current = Object.hasOwn(all, doc) ? doc : "skill";
  const file = all[current]?.files.find((f) => fs.existsSync(f));
  const source = file ? fs.readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "") : "_Document not found._";
  const groups = [...new Set(Object.values(all).map((d) => d.group))];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Docs</h1>
          <p className="lead">
            AI agents (Claude Code, Codex, …) use the <code>motionmind</code> skill to make videos from the terminal. Install it in a workspace with{" "}
            <code>motionmind setup</code> or <code>motionmind skill install</code>.
          </p>
          <p className="lead">
            <code>motionmind log</code> without <code>--stage</code> records the version as <code>staging</code>. Promoting to <code>production</code>{" "}
            requires passing QA (−14 ±0.5 LUFS integrated, true peak ≤ −1 dBFS) unless forced with <code>--force</code>.
          </p>
        </div>
      </div>
      {groups.map((g) => (
        <div key={g} className="tabs" style={{ alignItems: "center" }}>
          <span className="muted small" style={{ width: 130 }}>{g}</span>
          {Object.entries(all)
            .filter(([, d]) => d.group === g)
            .map(([id, d]) => (
              <Link key={id} href={`/docs?doc=${id}`} className={`chip ${id === current ? "on" : ""}`}>
                {d.label}
              </Link>
            ))}
        </div>
      ))}
      <section className="panel">
        <Markdown source={source} />
      </section>
    </>
  );
}
