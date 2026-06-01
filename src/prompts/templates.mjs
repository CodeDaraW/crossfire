import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SCHEMA_HINT = `{
  "verdict": "approve | needs-attention",
  "summary": "one-paragraph summary",
  "findings": [
    {
      "severity": "critical | high | medium | low",
      "title": "short title",
      "body": "what can go wrong and why",
      "file": "relative/path or null",
      "line_start": 0,
      "line_end": 0,
      "confidence": 0.0,
      "recommendation": "concrete fix"
    }
  ],
  "next_steps": ["string"]
}`;

async function load(name) {
  const path = fileURLToPath(new URL(`./${name}.md`, import.meta.url));
  return readFile(path, "utf8");
}

function interpolate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ""));
}

export async function buildReviewPrompt({ kind, reviewer, target, context, focus }) {
  const tplName = kind === "adversarial-review" ? "adversarial-review" : "review";
  const tpl = await load(tplName);
  return interpolate(tpl, {
    REVIEWER: reviewer,
    TARGET: target.label,
    CONTEXT: context.text,
    SCHEMA: SCHEMA_HINT,
    FOCUS: focus ? `Focus the challenge on: ${focus}` : "",
  });
}

export async function buildGatePrompt({ reviewer, target, context }) {
  const tpl = await load("stop-gate");
  return interpolate(tpl, { REVIEWER: reviewer, TARGET: target.label, CONTEXT: context.text });
}

export async function buildTaskPrompt({ taskText, repoLabel, writeMode }) {
  const tpl = await load("task");
  return interpolate(tpl, {
    TASK_TEXT: taskText,
    REPO_LABEL: repoLabel,
    WRITE_MODE: writeMode ? "write-capable" : "read-only",
  });
}
