import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson, normalizeReviewOutput, parseReviewerOutput } from "../src/schema/validate.mjs";

test("extracts JSON from fenced block with surrounding prose", () => {
  const raw = 'Here is my review:\n```json\n{"verdict":"approve","summary":"ok","findings":[]}\n```\nDone.';
  const obj = extractJson(raw);
  assert.equal(obj.verdict, "approve");
});

test("extracts balanced JSON without fences", () => {
  const raw = 'noise {"verdict":"needs-attention","summary":"x","findings":[{"severity":"high","title":"t","body":"b"}]} trailing';
  const obj = extractJson(raw);
  assert.equal(obj.findings.length, 1);
});

test("normalize coerces missing verdict from findings", () => {
  const { result, schema_valid } = normalizeReviewOutput({ summary: "s", findings: [{ severity: "high", title: "t", body: "b" }] });
  assert.equal(result.verdict, "needs-attention");
  assert.equal(schema_valid, false); // verdict was missing
});

test("normalize maps alternate field names", () => {
  const { result } = normalizeReviewOutput({
    verdict: "needs-attention",
    summary: "s",
    findings: [{ level: "critical", title: "t", description: "d", path: "a.js", line: 5, fix: "f" }],
  });
  assert.equal(result.findings[0].severity, "critical");
  assert.equal(result.findings[0].file, "a.js");
  assert.equal(result.findings[0].line_start, 5);
  assert.equal(result.findings[0].recommendation, "f");
});

test("parseReviewerOutput falls back when no JSON present", () => {
  const parsed = parseReviewerOutput("just some prose, no json here");
  assert.equal(parsed.structured, false);
  assert.equal(parsed.result.verdict, "needs-attention");
});

test("parseReviewerOutput structured path", () => {
  const parsed = parseReviewerOutput('{"verdict":"approve","summary":"ok","findings":[]}');
  assert.equal(parsed.structured, true);
  assert.equal(parsed.schema_valid, true);
  assert.equal(parsed.result.verdict, "approve");
});
