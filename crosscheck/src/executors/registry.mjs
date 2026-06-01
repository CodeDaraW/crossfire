import { which } from "../runtime/process.mjs";
import { expandHomeArgs } from "../runtime/env.mjs";

// Executors reuse the same agent CLIs as reviewers but with task (potentially
// write-capable) invocation and resume support. Detection is PATH-based.

function makeExecutor(name, bin, fixedArgs, build) {
  return {
    name,
    async detect() {
      const path = await which(bin);
      return { name, available: Boolean(path), path: path || null, bin };
    },
    buildTaskInvocation(req) {
      return build({ ...req, bin, fixedArgs });
    },
  };
}

function cursorTask({ bin, fixedArgs, prompt, repoRoot, write, model }) {
  const args = [...fixedArgs, "-p"];
  if (!write) args.push("--mode", "ask"); // read-only
  if (model) args.push("--model", model);
  args.push(prompt);
  return { cmd: bin, args, cwd: repoRoot };
}

function claudeTask({ bin, fixedArgs, prompt, repoRoot, write, model }) {
  const args = [...fixedArgs, "-p"];
  args.push("--permission-mode", write ? "acceptEdits" : "plan");
  if (!write) args.push("--allowed-tools", "Read,Glob,Grep");
  if (model) args.push("--model", model);
  return { cmd: bin, args, cwd: repoRoot, input: prompt };
}

function codexTask({ bin, fixedArgs, prompt, repoRoot, write, model }) {
  const args = [...fixedArgs, "exec"];
  args.push("--sandbox", write ? "workspace-write" : "read-only");
  if (model) args.push("--model", model);
  args.push(prompt);
  return { cmd: bin, args, cwd: repoRoot, input: "" };
}

export function buildExecutors(config, env = process.env) {
  const r = config?.reviewers || {};
  return [
    makeExecutor("cursor", r.cursor?.bin || "cursor-agent", expandHomeArgs(r.cursor?.args, env), cursorTask),
    makeExecutor("claude", env.CROSSCHECK_CLAUDE_BIN || r.claude?.bin || "claude", expandHomeArgs(r.claude?.args, env), claudeTask),
    makeExecutor("codex", r.codex?.bin || "codex", expandHomeArgs(r.codex?.args, env), codexTask),
  ];
}

export async function detectExecutors(config, env = process.env) {
  const out = [];
  for (const ex of buildExecutors(config, env)) {
    out.push({ name: ex.name, executor: ex, detect: await ex.detect() });
  }
  return out;
}

/** Pick the default executor: highest-priority available non-self agent. */
export function selectExecutor({ self, flags, detected }) {
  const available = detected.filter((d) => d.detect.available).map((d) => d.name);
  const requested = (flags.only && flags.only[0]) || (flags.executor && flags.executor[0]);
  if (requested) {
    if (!available.includes(requested)) return { error: `executor not available: ${requested}` };
    return { executor: requested };
  }
  const priority = ["codex", "claude", "cursor"];
  const pick = priority.find((p) => available.includes(p) && p !== self);
  if (!pick) {
    return { error: `no non-self executor available (self=${self}, available=${available.join(",") || "none"})` };
  }
  return { executor: pick };
}
