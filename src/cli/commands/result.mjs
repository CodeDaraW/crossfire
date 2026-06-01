import { repoRoot } from "../../git/repository.mjs";
import { listJobs, readJob, jobResultFile, readJson } from "../../runtime/state.mjs";
import { renderReviewText } from "../../render/text.mjs";
import { readFile } from "node:fs/promises";

export async function run(ctx) {
  const { flags, positionals, env, cwd } = ctx;
  const root = await repoRoot(cwd);
  if (!root) {
    process.stderr.write("crossfire: not a git repository\n");
    return 2;
  }

  let id = positionals[0];
  if (!id) {
    const jobs = await listJobs(root, env);
    const done = jobs.find((j) => ["completed", "failed", "partial"].includes(j.status));
    if (!done) {
      process.stderr.write("crossfire: no finished job found\n");
      return 2;
    }
    id = done.id;
  }

  const job = await readJob(root, id, env);
  if (!job) {
    process.stderr.write(`crossfire: job not found: ${id}\n`);
    return 2;
  }
  if (["queued", "running"].includes(job.status)) {
    process.stdout.write(`Job ${id} is still ${job.status}. Try: crossfire status ${id} --wait\n`);
    return 0;
  }

  const result = await readJson(jobResultFile(root, id, env));
  if (!result) {
    process.stderr.write(`crossfire: no result available for ${id} (status ${job.status})\n`);
    if (job.errorMessage) process.stderr.write(`  ${job.errorMessage}\n`);
    return 1;
  }

  if (flags.raw) {
    for (const r of result.reviewers || []) {
      if (flags.reviewer && flags.reviewer.length && !flags.reviewer.includes(r.name)) continue;
      process.stdout.write(`===== raw: ${r.name} =====\n`);
      if (r.raw_output_file) {
        try {
          process.stdout.write((await readFile(r.raw_output_file, "utf8")) + "\n");
        } catch {
          process.stdout.write("(raw output file missing)\n");
        }
      } else {
        process.stdout.write("(no raw output)\n");
      }
    }
    return 0;
  }

  if (flags.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stdout.write(renderReviewText(result) + "\n");
  }
  return 0;
}
