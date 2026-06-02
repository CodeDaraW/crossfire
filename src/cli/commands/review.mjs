import { loadConfig } from "../../runtime/config.mjs";
import { detectSelf } from "../../runtime/env.mjs";
import { flagInt } from "../args.mjs";
import { resolveTarget } from "../../git/target.mjs";
import { collectContext, isEmptyContext } from "../../git/context.mjs";
import { recommendMode } from "../../git/diff-size.mjs";
import { detectAll, selectReviewers } from "../../reviewers/registry.mjs";
import { runReviewJob } from "../../runtime/review-runner.mjs";
import { stateExcludeDir } from "../../runtime/state.mjs";
import { renderReviewText } from "../../render/text.mjs";

export async function run(ctx) {
  const { command: kind, flags, positionals, env, cwd } = ctx;
  const config = await loadConfig(cwd, env);
  const self = detectSelf(flags, env);

  const target = await resolveTarget(flags, cwd);
  if (target.error) {
    process.stderr.write(`crossfire: ${target.error}\n`);
    return 2;
  }

  const detected = await detectAll(config, env);
  const normalized = normalizeReviewerShorthand(flags, positionals, detected);
  const sel = selectReviewers({ self, flags: normalized.flags, detected });
  if (sel.error) {
    process.stderr.write(`crossfire: ${sel.error}\n`);
    for (const w of sel.warnings) process.stderr.write(`  warning: ${w}\n`);
    return 2;
  }

  const context = await collectContext(target, config, { excludeDir: stateExcludeDir(target.repoRoot, env) });
  if (isEmptyContext(context) && target.mode === "working-tree") {
    process.stdout.write("crossfire: no uncommitted changes to review.\n");
    return 0;
  }

  const focus = normalized.positionals.join(" ").trim();
  const timeoutMs = flagInt(flags, "timeout-ms", config.reviewers?.cursor?.timeout_ms || 600000);
  const jobParams = { kind, self, target, context, reviewers: sel.reviewers, warnings: sel.warnings, focus, timeoutMs, config, env };

  if (flags.background) {
    const { startBackgroundReview } = await import("../../runtime/jobs.mjs");
    const job = await startBackgroundReview(jobParams, cwd);
    if (flags.format === "json" || flags.json) {
      process.stdout.write(
        JSON.stringify(
          {
            job_id: job.id,
            kind: job.kind,
            status: job.status,
            reviewers: job.reviewers,
            status_command: `crossfire status ${job.id}`,
            result_command: `crossfire result ${job.id}`,
            cancel_command: `crossfire cancel ${job.id}`,
          },
          null,
          2,
        ) + "\n",
      );
      return 0;
    }
    process.stdout.write(
      [
        `Crossfire ${kind} started in background.`,
        `Job ID: ${job.id}`,
        `Status: crossfire status ${job.id}`,
        `Result: crossfire result ${job.id}`,
        `Cancel: crossfire cancel ${job.id}`,
      ].join("\n") + "\n",
    );
    return 0;
  }

  if (!flags.wait && recommendMode(context, config) === "background") {
    process.stderr.write(`crossfire: large change; consider --background. Running foreground (--wait assumed).\n`);
  }

  const result = await runReviewJob(jobParams, detected);

  if (flags.format === "json" || flags.json) {
    process.stdout.write(JSON.stringify(stripRaw(result), null, 2) + "\n");
  } else {
    process.stdout.write(renderReviewText(result) + "\n");
  }
  return 0;
}

function stripRaw(result) {
  return { ...result, reviewers: result.reviewers.map((r) => ({ ...r, raw_output: undefined })) };
}

function normalizeReviewerShorthand(flags, positionals, detected) {
  if ((flags.only && flags.only.length) || (flags.reviewer && flags.reviewer.length) || positionals.length === 0) {
    return { flags, positionals };
  }

  const knownAgents = new Set(detected.map((d) => d.name));
  const requested = [];
  for (const token of positionals) {
    const parts = token
      .split(/[,\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0 || parts.some((p) => !knownAgents.has(p))) return { flags, positionals };
    requested.push(...parts);
  }

  return { flags: { ...flags, reviewer: [...new Set(requested)] }, positionals: [] };
}
