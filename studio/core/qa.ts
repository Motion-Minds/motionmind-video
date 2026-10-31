// Measurable QA rules (references/qa.md): loudness and true peak of the rendered file.
// Pure module (no node imports): shared by the CLI, the Studio server and client components.

export const QA_LUFS = -14;
export const QA_LUFS_TOLERANCE = 0.5;
export const QA_TRUE_PEAK_MAX = -1;

export interface LoudnessMetrics {
  has_audio?: boolean;
  integrated_lufs?: number | null;
  true_peak_dbfs?: number | null;
}

/** Rule violations of a measured video; empty when it passes. Silent videos pass (silence is a deliberate choice). */
export function qaIssues(m: LoudnessMetrics): string[] {
  if (!m.has_audio) return [];
  const issues: string[] = [];
  const lufs = m.integrated_lufs;
  if (lufs == null) issues.push("loudness not measured");
  else if (Math.abs(lufs - QA_LUFS) > QA_LUFS_TOLERANCE) issues.push(`${lufs} LUFS (target ${QA_LUFS} ±${QA_LUFS_TOLERANCE})`);
  const tp = m.true_peak_dbfs;
  if (tp == null) issues.push("true peak not measured");
  else if (tp > QA_TRUE_PEAK_MAX) issues.push(`true peak ${tp} dBFS (max ${QA_TRUE_PEAK_MAX})`);
  return issues;
}
