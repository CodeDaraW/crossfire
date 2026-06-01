import { repoRoot } from "../../git/repository.mjs";
import { listJobs, readJob, reconcile } from "../../runtime/state.mjs";
import { flagInt } from "../args.mjs";

const SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run(ctx) {
  const { flags, positionals, env, cwd } = ctx;
  const root = await repoRoot(cwd);
  if (!root) {
    process.stderr.write("crosscheck: not a git repository\n");
    return 2;
  }
  const id = positionals[0];

  if (id) {
    let job = reconcile(await readJob(root, id, env));
    if (!job) {
      process.stderr.write(`crosscheck: job not found: ${id}\n`);
      return 2;
    }
    if (flags.wait) {
      const timeout = flagInt(flags, "timeout-ms", 240000);
      const deadline = Date.now() + timeout;
      while (["queued", "running"].includes(job.status) && Date.now() < deadline) {
        await SLEEP(2000);
        job = reconcile(await readJob(root, id, env));
        if (!job) break;
      }
    }
    if (flags.json) {
      process.stdout.write(JSON.stringify(publicJob(job), null, 2) + "\n");
    } else {
      process.stdout.write(renderOne(job) + "\n");
    }
    return 0;
  }

  const jobs = await listJobs(root, env);
  if (flags.json) {
    process.stdout.write(JSON.stringify(jobs.map(publicJob), null, 2) + "\n");
    return 0;
  }
  if (!jobs.length) {
    process.stdout.write("No crosscheck jobs for this workspace.\n");
    return 0;
  }
  const rows = [["Job ID", "Kind", "Reviewers", "Status", "Phase", "Summary"]];
  for (const j of jobs.slice(0, 20)) {
    const status = j.result_status && j.result_status !== j.status ? `${j.status}(${j.result_status})` : j.status;
    rows.push([j.id, j.kind, (j.reviewers || []).join("+"), status, j.phase || "", (j.summary || "").slice(0, 50)]);
  }
  process.stdout.write(renderTable(rows) + "\n");
  return 0;
}

function publicJob(j) {
  const { _spec, ...rest } = j || {};
  return rest;
}

function renderOne(j) {
  return [
    `Job: ${j.id}`,
    `kind: ${j.kind}`,
    `status: ${j.status}${j.result_status && j.result_status !== j.status ? ` (result: ${j.result_status})` : ""}  phase: ${j.phase || ""}`,
    `reviewers: ${(j.reviewers || []).join(", ")}`,
    `created: ${j.createdAt}  completed: ${j.completedAt || "-"}`,
    j.errorMessage ? `error: ${j.errorMessage}` : "",
    j.summary ? `summary: ${j.summary}` : "",
    ["completed", "failed", "partial"].includes(j.status) ? `result: crosscheck result ${j.id}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderTable(rows) {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
  return rows
    .map((r) => r.map((c, i) => String(c).padEnd(widths[i])).join("  "))
    .join("\n");
}
