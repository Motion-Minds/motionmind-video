// Compare page logic (no node imports: shared by the server page, the client view and unit tests).

export interface CompareRun {
  dir: string;
  /** "<brand>/<campaign>" */
  project: string;
  version: string;
  /** Leading number of the version (v12-x → 12); breaks ties between runs logged in the same minute. */
  versionNumber: number;
  aspect: string | null;
  /** When the run was logged (registry created_at), else when its folder last changed; ms since epoch. */
  registeredAt: number;
  /** "YYYY-MM-DD HH:mm" shown next to the run. */
  registeredLabel: string;
  stage: string;
  mp4Url: string;
  fields: Record<string, string>;
}

/** Registry stamps are local "YYYY-MM-DD HH:mm"; folder times are ISO. Both become ms since epoch (0 if unreadable). */
export function parseRegistered(value: string): number {
  const ms = Date.parse(/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(value) ? value.replace(" ", "T") : value);
  return Number.isNaN(ms) ? 0 : ms;
}

const newestFirst = (a: CompareRun, b: CompareRun) => b.registeredAt - a.registeredAt || b.versionNumber - a.versionNumber;

/** Campaigns ordered by their latest registered run, runs newest first within each: what the pickers list. */
export function groupByCampaign(runs: readonly CompareRun[]): { project: string; runs: CompareRun[] }[] {
  const groups = new Map<string, CompareRun[]>();
  for (const run of [...runs].sort(newestFirst)) groups.set(run.project, [...(groups.get(run.project) ?? []), run]);
  return [...groups].map(([project, list]) => ({ project, runs: list }));
}

/**
 * Candidates for B once A is chosen, best first. Only A's campaign; the same aspect ratio before other ratios. Within
 * those, the versions registered before A come first, newest first (so the top pick is A's previous version: what A
 * changed), then the later ones, oldest first.
 */
export function suggestionsFor(a: CompareRun, runs: readonly CompareRun[]): CompareRun[] {
  const earlier = (r: CompareRun) => r.registeredAt < a.registeredAt || (r.registeredAt === a.registeredAt && r.versionNumber < a.versionNumber);
  return runs
    .filter((r) => r.project === a.project && r.dir !== a.dir)
    .sort((x, y) => {
      const rank = Number(x.aspect !== a.aspect) - Number(y.aspect !== a.aspect) || Number(!earlier(x)) - Number(!earlier(y));
      if (rank) return rank;
      return earlier(x) ? newestFirst(x, y) : newestFirst(y, x);
    });
}
