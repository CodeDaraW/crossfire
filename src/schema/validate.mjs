// Tolerant extraction + normalization of reviewer output.
// Agents often wrap JSON in prose or markdown fences; we recover gracefully.

const SEVERITIES = ["critical", "high", "medium", "low"];

/** Find the first balanced JSON object/array in a string. */
export function extractJson(text) {
  if (!text) return null;
  // Prefer fenced ```json blocks.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fence) candidates.push(fence[1]);
  candidates.push(text);

  for (const cand of candidates) {
    const start = cand.indexOf("{");
    if (start === -1) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < cand.length; i++) {
      const ch = cand[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const slice = cand.slice(start, i + 1);
          try {
            return JSON.parse(slice);
          } catch {
            break; // try next candidate
          }
        }
      }
    }
  }
  return null;
}

function clampSeverity(s) {
  const v = String(s || "").toLowerCase();
  return SEVERITIES.includes(v) ? v : "medium";
}

function normalizeFinding(f) {
  if (!f || typeof f !== "object") return null;
  const title = String(f.title || f.summary || "").trim();
  const body = String(f.body || f.description || f.detail || "").trim();
  if (!title && !body) return null;
  return {
    severity: clampSeverity(f.severity || f.level),
    title: title || "(untitled finding)",
    body,
    file: f.file || f.path || null,
    line_start: Number.isFinite(f.line_start) ? f.line_start : (Number.isFinite(f.line) ? f.line : null),
    line_end: Number.isFinite(f.line_end) ? f.line_end : null,
    confidence: typeof f.confidence === "number" ? f.confidence : null,
    recommendation: f.recommendation || f.fix || null,
  };
}

/**
 * Normalize an arbitrary parsed object into a ReviewerOutput.
 * Returns { result, schema_valid }.
 */
export function normalizeReviewOutput(obj) {
  if (!obj || typeof obj !== "object") {
    return { schema_valid: false, result: null };
  }
  const findingsRaw = Array.isArray(obj.findings) ? obj.findings : [];
  const findings = findingsRaw.map(normalizeFinding).filter(Boolean);
  let verdict = String(obj.verdict || "").toLowerCase();
  if (verdict !== "approve" && verdict !== "needs-attention") {
    verdict = findings.length ? "needs-attention" : "approve";
  }
  const result = {
    verdict,
    summary: String(obj.summary || "").trim(),
    findings,
    next_steps: Array.isArray(obj.next_steps) ? obj.next_steps.map(String) : [],
  };
  const schema_valid =
    (obj.verdict === "approve" || obj.verdict === "needs-attention") &&
    typeof obj.summary === "string" &&
    Array.isArray(obj.findings);
  return { schema_valid, result };
}

/**
 * Parse raw agent stdout into a structured reviewer result.
 * Returns { structured, schema_valid, result, raw }.
 */
export function parseReviewerOutput(rawText) {
  const json = extractJson(rawText);
  if (json) {
    const { schema_valid, result } = normalizeReviewOutput(json);
    if (result) return { structured: true, schema_valid, result, raw: rawText };
  }
  // Best-effort fallback: treat the whole text as a single summary finding.
  const text = (rawText || "").trim();
  return {
    structured: false,
    schema_valid: false,
    raw: rawText,
    result: {
      verdict: text ? "needs-attention" : "approve",
      summary: text ? text.slice(0, 4000) : "(no output)",
      findings: [],
      next_steps: [],
    },
  };
}
