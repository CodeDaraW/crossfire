import { test } from "node:test";
import assert from "node:assert/strict";
import { arbitrate } from "../src/arbiter/deterministic.mjs";

function entry(name, verdict, findings) {
  return { name, status: "completed", result: { verdict, summary: "", findings, next_steps: [] } };
}

test("merges similar findings across reviewers and escalates severity", () => {
  const f = (sev) => ({ severity: sev, title: "Null deref in handler", body: "b", file: "h.js", line_start: 10 });
  const a = arbitrate([entry("claude", "needs-attention", [f("high")]), entry("codex", "needs-attention", [f("critical")])]);
  assert.equal(a.merged_findings.length, 1);
  assert.equal(a.merged_findings[0].severity, "critical");
  assert.equal(a.consensus_findings.length, 1);
  assert.equal(a.verdict, "needs-attention");
});

test("approve when all reviewers approve with no findings", () => {
  const a = arbitrate([entry("claude", "approve", []), entry("codex", "approve", [])]);
  assert.equal(a.verdict, "approve");
});

test("verdict conflict is surfaced", () => {
  const a = arbitrate([
    entry("claude", "approve", []),
    entry("codex", "needs-attention", [{ severity: "medium", title: "x", body: "y" }]),
  ]);
  assert.equal(a.conflicting_findings.length, 1);
  assert.equal(a.conflicting_findings[0].type, "verdict");
});

test("all reviewers failed -> blocked-by-review-failure", () => {
  const a = arbitrate([{ name: "claude", status: "failed", error: "boom" }]);
  assert.equal(a.verdict, "blocked-by-review-failure");
  assert.equal(a.reviewer_failures.length, 1);
});
