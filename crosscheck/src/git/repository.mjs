import { createHash } from "node:crypto";
import { runProcess } from "../runtime/process.mjs";

/** Run a git command in `cwd`, returning trimmed stdout (or "" on failure). */
export async function git(args, cwd) {
  const res = await runProcess("git", args, { cwd, timeoutMs: 20000 });
  return { ok: res.code === 0, stdout: res.stdout, stderr: res.stderr, code: res.code };
}

export async function gitOut(args, cwd) {
  const res = await git(args, cwd);
  return res.ok ? res.stdout.trimEnd() : "";
}

/** Resolve the repository root for `cwd`, or null if not a git repo. */
export async function repoRoot(cwd) {
  const res = await git(["rev-parse", "--show-toplevel"], cwd);
  if (!res.ok) return null;
  return res.stdout.trim() || null;
}

/** Porcelain v1 status including untracked, used for mutation detection. */
export async function statusPorcelain(cwd) {
  return gitOut(["status", "--porcelain=v1", "--untracked-files=all"], cwd);
}

export async function isDirty(cwd) {
  const s = await statusPorcelain(cwd);
  return s.trim().length > 0;
}

/**
 * Content-aware fingerprint of the working tree, used to detect mutation during
 * a review/task. Unlike comparing `git status` alone, this also catches the case
 * where an already-dirty tracked file is modified again (status line unchanged
 * but content differs), by hashing the full `git diff HEAD` patch. Untracked
 * file *content* is folded in via size+blob hash so new/edited untracked files
 * are detected too.
 */
export async function workingTreeFingerprint(cwd, excludeDir = null) {
  const ex = excludeDir ? ["--", ".", `:(exclude)${excludeDir}`, `:(exclude)${excludeDir}/**`] : [];
  const status = await gitOut(["status", "--porcelain=v1", "--untracked-files=all", ...ex], cwd);
  const trackedDiff = await gitOut(["diff", "HEAD", ...ex], cwd);
  // Hash untracked file contents (cheap blob hashing via git hash-object).
  const others = await gitOut(["ls-files", "--others", "--exclude-standard", "-z", ...ex], cwd);
  const untrackedFiles = others ? others.split("\0").filter(Boolean) : [];
  let untrackedSig = "";
  if (untrackedFiles.length) {
    const res = await git(["hash-object", "--", ...untrackedFiles], cwd);
    untrackedSig = res.ok ? `${untrackedFiles.join("\n")}\n${res.stdout}` : untrackedFiles.join("\n");
  }
  return createHash("sha256").update(`${status}\u0000${trackedDiff}\u0000${untrackedSig}`).digest("hex");
}

/**
 * Map of {changed-or-untracked file -> content hash} for the working tree.
 * Used to compute which files an executor actually touched, including files
 * that were ALREADY dirty before the task (status-only comparison misses these).
 * Deleted/absent files get a sentinel hash.
 */
export async function perFileFingerprint(cwd) {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const tracked = await gitOut(["diff", "--name-only", "HEAD", "-z"], cwd);
  const untracked = await gitOut(["ls-files", "--others", "--exclude-standard", "-z"], cwd);
  const files = new Set(
    [...tracked.split("\0"), ...untracked.split("\0")].map((f) => f.trim()).filter(Boolean),
  );
  const map = {};
  for (const f of files) {
    try {
      const content = await readFile(join(cwd, f));
      map[f] = createHash("sha256").update(content).digest("hex");
    } catch {
      map[f] = "<absent>";
    }
  }
  return map;
}

/** Files whose content hash differs between two perFileFingerprint snapshots. */
export function diffFingerprints(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [];
  for (const k of keys) {
    if (before[k] !== after[k]) changed.push(k);
  }
  return changed.sort();
}

export async function gitAvailable() {
  const res = await runProcess("git", ["--version"], { timeoutMs: 5000 });
  return { available: res.code === 0, version: res.stdout.trim() || null };
}
