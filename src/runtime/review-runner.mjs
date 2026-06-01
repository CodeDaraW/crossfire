import { runReview } from "../reviewers/registry.mjs";
import { buildReviewPrompt } from "../prompts/templates.mjs";
import { arbitrate } from "../arbiter/deterministic.mjs";
import { statusPorcelain, workingTreeFingerprint } from "../git/repository.mjs";
import { stateExcludeDir } from "./state.mjs";

/**
 * Host-agnostic review execution: build prompts, fan out reviewers in parallel,
 * detect repo mutation, arbitrate, and assemble the crossfire result object.
 *
 * @param {object} params
 * @param {Array}  detected  detection result from detectAll()
 * @param {function} [onPhase]  optional phase callback for job progress
 */
export async function runReviewJob(params, detected, onPhase) {
  const { kind, self, target, context, reviewers, warnings = [], focus, timeoutMs, env } = params;
  const repoRoot = target.repoRoot;
  // Exclude the crossfire state dir so background workers writing job/raw/result
  // files inside the repo don't get mistaken for the reviewer mutating the tree.
  const excludeDir = stateExcludeDir(repoRoot, env);

  onPhase?.("collecting-context");
  const preStatus = await statusPorcelain(repoRoot);
  const preFingerprint = await workingTreeFingerprint(repoRoot, excludeDir);

  const entries = await Promise.all(
    reviewers.map(async (name) => {
      onPhase?.(`reviewing:${name}`);
      const prompt = await buildReviewPrompt({ kind, reviewer: name, target, context, focus });
      return runReview({ detected, name, prompt, repoRoot, timeoutMs, self, env });
    }),
  );

  onPhase?.("arbitrating");
  const postStatus = await statusPorcelain(repoRoot);
  const postFingerprint = await workingTreeFingerprint(repoRoot, excludeDir);
  const repoChanged = preFingerprint !== postFingerprint;

  const arbitration = arbitrate(entries);
  if (repoChanged && arbitration.verdict === "approve") arbitration.verdict = "needs-attention";

  const status = entries.every((e) => e.status !== "completed")
    ? "failed"
    : entries.some((e) => e.status !== "completed")
      ? "partial"
      : "completed";

  return {
    version: 1,
    kind,
    status,
    self,
    target: {
      cwd: repoRoot,
      mode: target.mode,
      label: target.label,
      base_ref: target.base || null,
      commit: target.commit || null,
      changed_files: context.changed_files,
      diff_stat: context.diff_stat,
      context_mode: context.context_mode,
      truncated: context.truncated,
      omitted_files: context.omitted_files,
    },
    reviewers: entries,
    executors: [],
    arbitration,
    safety: {
      pre_status: preStatus,
      post_status: postStatus,
      repo_changed_during_review: repoChanged,
      warnings,
    },
    follow_up_commands: [],
  };
}
