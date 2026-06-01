import { repoRoot } from "../../git/repository.mjs";
import { cancelJob } from "../../runtime/jobs.mjs";

export async function run(ctx) {
  const { flags, positionals, env, cwd } = ctx;
  const root = await repoRoot(cwd);
  if (!root) {
    process.stderr.write("crossfire: not a git repository\n");
    return 2;
  }
  const id = positionals[0];
  if (!id) {
    process.stderr.write("crossfire cancel: job id required\n");
    return 2;
  }
  const res = await cancelJob(root, id, env);
  if (!res.ok) {
    process.stderr.write(`crossfire: ${res.error}\n`);
    return 1;
  }
  if (flags.json) {
    process.stdout.write(JSON.stringify({ id, status: "canceled" }, null, 2) + "\n");
  } else {
    process.stdout.write(`Canceled job ${id}.\n`);
  }
  return 0;
}
