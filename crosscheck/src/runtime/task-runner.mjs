import { runProcess } from "./process.mjs";
import { scrubEnv } from "./env.mjs";
import { statusPorcelain, workingTreeFingerprint, perFileFingerprint, diffFingerprints } from "../git/repository.mjs";
import { buildTaskPrompt } from "../prompts/templates.mjs";

// Best-effort session id extraction from agent stdout.
function extractSession(raw) {
  const m =
    /session[_-]?id["':\s]+([A-Za-z0-9._-]{6,})/i.exec(raw || "") ||
    /resume[_-]?id["':\s]+([A-Za-z0-9._-]{6,})/i.exec(raw || "");
  return m ? m[1] : null;
}

/**
 * Execute a single task/rescue against one executor.
 * Returns a TaskResult with safety + touched-file accounting.
 */
export async function runTask({ executorEntry, taskText, repoRoot, repoLabel, write, model, timeoutMs, env = process.env }) {
  const prompt = await buildTaskPrompt({ taskText, repoLabel, writeMode: write });
  const preStatus = await statusPorcelain(repoRoot);
  const preFingerprint = await workingTreeFingerprint(repoRoot);
  // Per-file snapshot lets us detect edits to files that were already dirty.
  const prePerFile = write ? await perFileFingerprint(repoRoot) : null;

  const inv = executorEntry.executor.buildTaskInvocation({ prompt, repoRoot, write, model });
  const res = await runProcess(inv.cmd, inv.args, {
    cwd: inv.cwd || repoRoot,
    env: scrubEnv(env),
    timeoutMs,
    input: inv.input,
  });

  const postStatus = await statusPorcelain(repoRoot);
  const postFingerprint = await workingTreeFingerprint(repoRoot);
  // Content-aware: catches already-dirty files modified again (status unchanged).
  const changed = preFingerprint !== postFingerprint;
  // touched_files via per-file content comparison, so editing an already-dirty
  // file is captured (status-diff alone would report an empty list).
  const touchedFiles = write ? diffFingerprints(prePerFile, await perFileFingerprint(repoRoot)) : [];

  let status = res.timedOut ? "timeout" : res.code === 0 ? "ok" : "error";
  const warnings = [];

  if (!write && changed) {
    status = res.timedOut ? "timeout" : "error";
    warnings.push("read-only task modified the repository (safety violation)");
  }

  return {
    name: executorEntry.name,
    status,
    mode: write ? "write" : "read-only",
    summary: (res.stdout || "").trim().split("\n").slice(-1)[0]?.slice(0, 200) || "",
    final_message: res.stdout || res.stderr || "",
    touched_files: write ? touchedFiles : [],
    pre_status: preStatus,
    post_status: postStatus,
    repo_changed: changed,
    sessionId: extractSession(res.stdout),
    resumeHint: null,
    raw_output: res.stdout,
    error: status === "ok" ? null : res.stderr || res.error?.message || status,
    warnings,
  };
}
