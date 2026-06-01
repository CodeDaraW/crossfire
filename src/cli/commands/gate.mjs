import { loadConfig } from "../../runtime/config.mjs";
import { detectSelf, isChildInvocation } from "../../runtime/env.mjs";
import { flagInt } from "../args.mjs";
import { readJson } from "../../runtime/state.mjs";
import { resolveTarget } from "../../git/target.mjs";
import { collectContext, isEmptyContext } from "../../git/context.mjs";
import { detectAll, selectReviewers, runReview } from "../../reviewers/registry.mjs";
import { buildGatePrompt } from "../../prompts/templates.mjs";

function emit(verdict, reason, extra = {}, json) {
  const line = `${verdict}: ${reason}`;
  if (json) {
    process.stdout.write(JSON.stringify({ verdict, reason, ...extra }, null, 2) + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export async function run(ctx) {
  const { flags, env, cwd } = ctx;
  const json = Boolean(flags.json);

  // Anti-recursion: never trigger/block from within a child invocation.
  if (isChildInvocation(env)) {
    emit("ALLOW", "advisory: running inside a crossfire child invocation", { source: "anti-recursion" }, json);
    return 0;
  }

  const config = await loadConfig(cwd, env);
  const self = detectSelf(flags, env);

  // 1. previous-turn file: detect whether the last turn changed code.
  let source = "current-git-delta";
  let lowConfidence = false;
  if (flags["previous-turn-file"]) {
    const pt = await readJson(flags["previous-turn-file"]);
    if (!pt) {
      lowConfidence = true;
    } else if (pt.workspace && !(await sameRepoResolved(pt.workspace, cwd))) {
      lowConfidence = true;
    } else {
      source = "previous-turn-file";
      const before = JSON.stringify(pt.changed_files_before || []);
      const after = JSON.stringify(pt.changed_files_after || []);
      const cmdTouched = (pt.commands || []).some((c) => (c.touched_files || []).length);
      if (before === after && !cmdTouched) {
        emit("ALLOW", "no code changes in previous turn", { source }, json);
        return 0;
      }
    }
  } else {
    lowConfidence = true; // no host-provided turn info
  }

  // 2. Build target/context from current working tree.
  const target = await resolveTarget({ scope: "working-tree" }, cwd);
  if (target.error) {
    emit("ALLOW", `cannot resolve target: ${target.error}`, { source }, json);
    return 0;
  }
  const context = await collectContext(target, config);
  if (isEmptyContext(context)) {
    emit("ALLOW", "no code changes detected in working tree", { source }, json);
    return 0;
  }

  // 3. Run a compact adversarial stop-gate review with the fastest non-self reviewer.
  const detected = await detectAll(config, env);
  const reviewerFlags = flags.reviewer && flags.reviewer.length ? { reviewer: flags.reviewer } : {};
  const sel = selectReviewers({ self, flags: reviewerFlags, detected });
  if (sel.error || !sel.reviewers.length) {
    emit("ALLOW", `no reviewer available for gate (${sel.error || "none"})`, { source, advisory: true }, json);
    return 0;
  }
  const reviewer = sel.reviewers[0];
  const timeoutMs = flagInt(flags, "timeout-ms", config.gate?.timeout_ms || 900000);
  const prompt = await buildGatePrompt({ reviewer, target, context });
  const entry = await runReview({ detected, name: reviewer, prompt, repoRoot: target.repoRoot, timeoutMs, self, env });

  const firstLine = (entry.raw_output || "").trim().split("\n")[0] || "";
  const isBlock = /^block\b/i.test(firstLine);
  const reason = firstLine.replace(/^(allow|block)\s*:?\s*/i, "").trim() || (isBlock ? "blocking issue found" : "no blocking issue found");

  const verdict = isBlock ? "BLOCK" : "ALLOW";
  // Only Claude's native Stop hook can truly block in v1; other hosts are advisory.
  // A real BLOCK is honored even at low confidence (we do not ignore blockers).
  const blocking = isBlock && self === "claude";
  emit(verdict, reason + (lowConfidence ? " (low confidence: no previous-turn info)" : ""), {
    source,
    reviewer,
    blocking,
    advisory: !blocking,
  }, json);

  // Only a real (Claude) blocking gate returns a non-zero "block" exit code.
  return blocking ? 2 : 0;
}

async function sameRepoResolved(a, b) {
  const { realpath } = await import("node:fs/promises");
  const norm = async (p) => {
    try {
      return (await realpath(p)).replace(/\/+$/, "");
    } catch {
      return p.replace(/\/+$/, "");
    }
  };
  const ra = await norm(a);
  const rb = await norm(b);
  return ra === rb || rb.startsWith(ra) || ra.startsWith(rb);
}
