import { createCursorAdapter } from "./cursor.mjs";
import { createClaudeAdapter } from "./claude.mjs";
import { createCodexAdapter } from "./codex.mjs";
import { runProcess } from "../runtime/process.mjs";
import { scrubEnv } from "../runtime/env.mjs";
import { parseReviewerOutput } from "../schema/validate.mjs";

export function buildAdapters(config, env = process.env) {
  return [createCursorAdapter(config), createClaudeAdapter(config, env), createCodexAdapter(config)];
}

/**
 * Detect availability for all known agents (fast: PATH lookup only).
 * Capability probing (slow: spawns `--help`/`status`) is deferred to ensureCaps,
 * or run eagerly when probe=true (used by `doctor`).
 */
export async function detectAll(config, env = process.env, probe = false) {
  const adapters = buildAdapters(config, env);
  const out = [];
  for (const adapter of adapters) {
    const detect = await adapter.detect();
    const entry = { name: adapter.name, adapter, detect, caps: null };
    if (probe && detect.available) await ensureCaps(entry);
    out.push(entry);
  }
  return out;
}

/** Lazily probe capabilities for a single detected entry. */
export async function ensureCaps(entry) {
  if (entry.caps) return entry.caps;
  if (!entry.detect.available) {
    entry.caps = {};
    return entry.caps;
  }
  try {
    entry.caps = await entry.adapter.probeCapabilities(entry.detect);
  } catch (e) {
    entry.caps = { error: String(e?.message || e) };
  }
  return entry.caps;
}

/**
 * Resolve the reviewer set from flags + self + availability.
 * Returns { reviewers: string[], warnings: string[], error?: string }.
 */
export function selectReviewers({ self, flags, detected }) {
  const availableNames = detected.filter((d) => d.detect.available).map((d) => d.name);
  const warnings = [];

  let requested = null;
  if (flags.only && flags.only.length) requested = flags.only;
  else if (flags.reviewer && flags.reviewer.length) requested = flags.reviewer;

  let reviewers;
  if (requested) {
    reviewers = requested;
    const missing = reviewers.filter((r) => !availableNames.includes(r));
    if (missing.length) warnings.push(`requested reviewer(s) not available: ${missing.join(", ")}`);
    reviewers = reviewers.filter((r) => availableNames.includes(r));
  } else {
    reviewers = availableNames.filter((n) => n !== self || flags["allow-self"]);
  }

  if (self === "unknown" && !requested) {
    warnings.push("could not determine current host (self); reviewer set may include self");
  }

  // Mark self-review unless allowed.
  if (!flags["allow-self"] && !requested) {
    reviewers = reviewers.filter((n) => n !== self);
  }

  if (reviewers.length === 0) {
    return {
      reviewers: [],
      warnings,
      error:
        availableNames.length === 0
          ? "no reviewer CLI available; run `crosscheck doctor`"
          : `no non-self reviewer available (self=${self}, available=${availableNames.join(",") || "none"}); use --allow-self or --only to override`,
    };
  }
  return { reviewers, warnings };
}

/** Run a single reviewer and return a normalized reviewer entry. */
export async function runReview({ detected, name, prompt, repoRoot, timeoutMs, self, env = process.env }) {
  const entry = detected.find((d) => d.name === name);
  if (!entry || !entry.detect.available) {
    return {
      name,
      self_review: name === self,
      status: "skipped",
      duration_ms: 0,
      mode: "prompt-fallback",
      structured: false,
      schema_valid: false,
      result: null,
      raw_output: "",
      error: "not available",
    };
  }
  await ensureCaps(entry);
  const inv = entry.adapter.buildInvocation({ prompt, repoRoot, caps: entry.caps });
  const res = await runProcess(inv.cmd, inv.args, {
    cwd: inv.cwd || repoRoot,
    env: scrubEnv(env),
    timeoutMs,
    input: inv.input,
  });

  if (res.timedOut) {
    return mkEntry(name, self, "timeout", res, null);
  }
  // A non-zero exit is treated as failure regardless of stdout. CLIs commonly
  // print errors (e.g. "ERROR: authentication failed") to stdout and exit 1; we
  // must NOT mistake that for a completed review. Exit code + stderr are kept.
  if (res.code !== 0) {
    const detail = (res.stderr || res.stdout || "").trim().split("\n").slice(0, 3).join(" ").slice(0, 300);
    return mkEntry(name, self, "failed", res, null, `exit ${res.code}${detail ? `: ${detail}` : ""}`);
  }
  const parsed = parseReviewerOutput(res.stdout || res.stderr);
  return {
    name,
    self_review: name === self,
    status: "completed",
    duration_ms: res.durationMs,
    mode: "prompt-fallback",
    structured: parsed.structured,
    schema_valid: parsed.schema_valid,
    result: parsed.result,
    raw_output: res.stdout,
    error: null,
  };
}

function mkEntry(name, self, status, res, result, error = null) {
  return {
    name,
    self_review: name === self,
    status,
    duration_ms: res?.durationMs ?? 0,
    mode: "prompt-fallback",
    structured: false,
    schema_valid: false,
    result,
    raw_output: res?.stdout || "",
    error: error || status,
  };
}
