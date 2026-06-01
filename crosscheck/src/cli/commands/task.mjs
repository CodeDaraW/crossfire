import { loadConfig } from "../../runtime/config.mjs";
import { detectSelf } from "../../runtime/env.mjs";
import { flagInt } from "../args.mjs";
import { repoRoot } from "../../git/repository.mjs";
import { detectExecutors, selectExecutor } from "../../executors/registry.mjs";
import { runTask } from "../../runtime/task-runner.mjs";
import { renderTaskText } from "../../render/task.mjs";

/**
 * Internal runtime entrypoint. Thin: runs exactly one executor with the given
 * flags. Intent classification lives in `rescue`, not here.
 */
export async function run(ctx) {
  const { flags, positionals, env, cwd } = ctx;
  const config = await loadConfig(cwd, env);
  const self = detectSelf(flags, env);
  const root = await repoRoot(cwd);
  if (!root) {
    process.stderr.write("crosscheck: not a git repository\n");
    return 2;
  }
  const taskText = positionals.join(" ").trim();
  if (!taskText) {
    process.stderr.write("crosscheck task: a task/prompt is required\n");
    return 2;
  }

  const detected = await detectExecutors(config, env);
  const sel = selectExecutor({ self, flags, detected });
  if (sel.error) {
    process.stderr.write(`crosscheck: ${sel.error}\n`);
    return 2;
  }
  const executorEntry = detected.find((d) => d.name === sel.executor);
  const write = flags.write ? true : flags["read-only"] ? false : false;
  const timeoutMs = flagInt(flags, "timeout-ms", 900000);

  const result = await runTask({
    executorEntry,
    taskText,
    repoRoot: root,
    repoLabel: root,
    write,
    model: flags.model,
    timeoutMs,
    env,
  });

  if (flags.format === "json" || flags.json) {
    process.stdout.write(JSON.stringify({ ...result, raw_output: undefined }, null, 2) + "\n");
  } else {
    process.stdout.write(renderTaskText(result) + "\n");
  }
  return result.status === "ok" ? 0 : 1;
}
