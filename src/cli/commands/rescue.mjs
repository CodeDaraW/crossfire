import { loadConfig } from "../../runtime/config.mjs";
import { detectSelf } from "../../runtime/env.mjs";
import { flagInt } from "../args.mjs";
import { repoRoot } from "../../git/repository.mjs";
import { detectExecutors, selectExecutor } from "../../executors/registry.mjs";
import { runTask } from "../../runtime/task-runner.mjs";
import { classifyIntent, classifyResume } from "../../runtime/intent.mjs";
import { renderTaskText } from "../../render/task.mjs";

/**
 * User-facing delegation entrypoint. Classifies read-only vs write-capable
 * from the request (unless an explicit flag is given), then forwards to a
 * single executor task. This is the thin forwarder: it does not read the repo
 * itself or summarize on the executor's behalf.
 */
export async function run(ctx) {
  const { flags, positionals, env, cwd } = ctx;
  const config = await loadConfig(cwd, env);
  const self = detectSelf(flags, env);
  const root = await repoRoot(cwd);
  if (!root) {
    process.stderr.write("crossfire: not a git repository\n");
    return 2;
  }
  const request = positionals.join(" ").trim();
  if (!request) {
    process.stderr.write("crossfire rescue: a request is required\n");
    return 2;
  }

  const detected = await detectExecutors(config, env);
  const sel = selectExecutor({ self, flags, detected });
  if (sel.error) {
    process.stderr.write(`crossfire: ${sel.error}\n`);
    return 2;
  }
  const executorEntry = detected.find((d) => d.name === sel.executor);

  const mode = classifyIntent(request, flags);
  const resume = classifyResume(request, flags);
  const write = mode === "write";
  const timeoutMs = flagInt(flags, "timeout-ms", 900000);

  process.stderr.write(`crossfire rescue -> executor=${sel.executor} mode=${mode} resume=${resume}\n`);

  const result = await runTask({
    executorEntry,
    taskText: request,
    repoRoot: root,
    repoLabel: root,
    write,
    model: flags.model,
    timeoutMs,
    env,
  });
  result.resume = resume;

  if (flags.format === "json" || flags.json) {
    process.stdout.write(JSON.stringify({ ...result, raw_output: undefined }, null, 2) + "\n");
  } else {
    process.stdout.write(renderTaskText(result) + "\n");
  }
  return result.status === "ok" ? 0 : 1;
}
