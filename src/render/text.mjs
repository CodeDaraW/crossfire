function findingBlock(f) {
  const loc = f.file ? `\nfile: ${f.file}${f.line_start != null ? `:${f.line_start}` : ""}` : "";
  const conf = f.confidence != null ? `\nconfidence: ${f.confidence}` : "";
  const src = f.sources ? `\nReviewer: ${f.sources.join(", ")}` : "";
  const rec = f.recommendation ? `\nRecommendation: ${f.recommendation}` : "";
  return `[${f.severity}] ${f.title}${loc}${conf}\n\n${f.body}${rec}${src}`;
}

export function renderReviewText(result) {
  const lines = [];
  const a = result.arbitration || {};
  lines.push(`# Crossfire ${result.kind}`);
  lines.push(`Target: ${result.target.label} (${result.target.mode})`);
  lines.push(`Reviewers: ${result.reviewers.map((r) => r.name).join(", ") || "(none)"}`);
  lines.push(`Verdict: ${a.verdict || result.status}`);
  lines.push("");

  if (a.summary) {
    lines.push("## Arbitration");
    lines.push(a.summary);
    if (a.highest_risk_findings?.length) {
      lines.push("\nHighest risk:");
      for (const f of a.highest_risk_findings) lines.push(`  - ${f.severity}: ${f.title}${f.file ? ` (${f.file})` : ""}`);
    }
    if (a.conflicting_findings?.length) {
      lines.push("\nConflicts:");
      for (const c of a.conflicting_findings) lines.push(`  - ${c.type}: ${c.detail}`);
    }
    lines.push("");
  }

  for (const r of result.reviewers) {
    lines.push(`## Reviewer: ${r.name}${r.self_review ? " (self-review)" : ""}`);
    lines.push(`status: ${r.status}${r.duration_ms ? ` (${r.duration_ms}ms)` : ""}`);
    if (r.status !== "completed") {
      lines.push(`  ${r.error || r.status}`);
      lines.push("");
      continue;
    }
    lines.push(`verdict: ${r.result.verdict}`);
    if (r.result.summary) lines.push(r.result.summary);
    if (r.result.findings?.length) {
      lines.push("");
      for (const f of r.result.findings) {
        lines.push(findingBlock(f));
        lines.push("");
      }
    } else {
      lines.push("(no findings)");
    }
    if (!r.structured) lines.push("[note] reviewer output was not structured JSON; shown best-effort.");
    lines.push("");
  }

  if (result.safety?.repo_changed_during_review) {
    lines.push("## SAFETY WARNING");
    lines.push("Target repo changed during review (pre/post git status differ). Treat results with caution.");
    lines.push("");
  }
  if (a.reviewer_failures?.length) {
    lines.push("## Failures / timeouts");
    for (const f of a.reviewer_failures) lines.push(`  - ${f.name}: ${f.status}${f.error ? ` (${f.error})` : ""}`);
    lines.push("");
  }
  if (result.follow_up_commands?.length) {
    lines.push("## Follow-up");
    for (const c of result.follow_up_commands) lines.push(`  ${c}`);
  }
  return lines.join("\n");
}
