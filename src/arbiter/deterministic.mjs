// Deterministic multi-reviewer arbitration. No LLM. Merges findings, surfaces
// highest-risk items and conflicts, and computes an aggregate verdict.

const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

function normTitle(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function similar(a, b) {
  const ta = normTitle(a.title);
  const tb = normTitle(b.title);
  if (!ta || !tb) return false;
  const sameFile = (a.file || "") === (b.file || "");
  const closeLines =
    a.line_start != null && b.line_start != null
      ? Math.abs(a.line_start - b.line_start) <= 5
      : false;
  const titleOverlap = ta === tb || ta.includes(tb) || tb.includes(ta);
  return (sameFile && (closeLines || titleOverlap)) || (titleOverlap && a.file == null && b.file == null);
}

export function arbitrate(reviewerEntries) {
  const completed = reviewerEntries.filter((r) => r.status === "completed" && r.result);
  const failures = reviewerEntries
    .filter((r) => r.status !== "completed")
    .map((r) => ({ name: r.name, status: r.status, error: r.error || null }));

  // Flatten findings with source attribution.
  const flat = [];
  for (const r of completed) {
    for (const f of r.result.findings || []) {
      flat.push({ ...f, sources: [r.name] });
    }
  }

  // Merge similar findings.
  const merged = [];
  for (const f of flat) {
    const hit = merged.find((m) => similar(m, f));
    if (hit) {
      if (!hit.sources.includes(f.sources[0])) hit.sources.push(f.sources[0]);
      if (SEV_RANK[f.severity] > SEV_RANK[hit.severity]) hit.severity = f.severity;
      if ((f.confidence ?? 0) > (hit.confidence ?? 0)) hit.confidence = f.confidence;
    } else {
      merged.push({ ...f });
    }
  }

  // Weak findings: no file/line and single source and not critical/high.
  for (const m of merged) {
    m.weak = !m.file && m.line_start == null && m.sources.length === 1 && SEV_RANK[m.severity] < 3;
  }

  const highest = merged
    .filter((m) => SEV_RANK[m.severity] >= 3)
    .sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || (b.confidence ?? 0) - (a.confidence ?? 0));

  const conflicts = [];
  // verdict conflict: some reviewer approve, another needs-attention.
  const verdicts = new Set(completed.map((r) => r.result.verdict));
  if (verdicts.has("approve") && verdicts.has("needs-attention")) {
    conflicts.push({
      type: "verdict",
      detail: "reviewers disagree on overall verdict",
      reviewers: completed.map((r) => ({ name: r.name, verdict: r.result.verdict })),
    });
  }

  let verdict;
  if (completed.length === 0) {
    verdict = "blocked-by-review-failure";
  } else if (merged.length > 0 || [...verdicts].includes("needs-attention")) {
    verdict = "needs-attention";
  } else {
    verdict = "approve";
  }

  const recommended_order = highest.map(
    (m) => `[${m.severity}] ${m.title}${m.file ? ` (${m.file}${m.line_start != null ? `:${m.line_start}` : ""})` : ""}`,
  );

  const coverageNote =
    failures.length && completed.length
      ? ` Review coverage incomplete: ${failures.map((f) => f.name).join(", ")} did not complete.`
      : "";

  const summary =
    verdict === "approve"
      ? `All ${completed.length} reviewer(s) approved; no material findings.${coverageNote}`
      : verdict === "blocked-by-review-failure"
        ? `All reviewers failed or were skipped; no usable review coverage.`
        : `${merged.length} merged finding(s) across ${completed.length} reviewer(s); ${highest.length} high/critical.${coverageNote}`;

  return {
    verdict,
    summary,
    consensus_findings: merged.filter((m) => m.sources.length > 1),
    conflicting_findings: conflicts,
    highest_risk_findings: highest,
    merged_findings: merged,
    recommended_order,
    reviewer_failures: failures,
    confidence: completed.length ? Math.min(1, 0.5 + 0.15 * completed.length) : 0,
  };
}
