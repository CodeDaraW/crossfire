import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import {
  newJobId,
  writeJob,
  readJob,
  jobResultFile,
  jobRawFile,
  atomicWriteJson,
  stateRoot,
} from "./state.mjs";
import { loadConfig } from "./config.mjs";
import { detectAll } from "../reviewers/registry.mjs";
import { runReviewJob } from "./review-runner.mjs";

// Workers are internal Node re-entry. Use the current process executable and the
// JS entrypoint instead of the shell wrapper so jobs run with the same runtime.
const BIN = fileURLToPath(new URL("../../bin/crossfire.mjs", import.meta.url));

function nowIso() {
  return new Date().toISOString();
}

/** Create the initial job record and spawn a detached worker. */
export async function startBackgroundReview(jobParams, cwd) {
  const repoRoot = jobParams.target.repoRoot;
  const id = newJobId(jobParams.kind);
  const job = {
    id,
    kind: jobParams.kind,
    workspaceRoot: repoRoot,
    createdAt: nowIso(),
    startedAt: null,
    completedAt: null,
    heartbeatAt: nowIso(),
    status: "queued",
    phase: "starting",
    pid: null,
    reviewers: jobParams.reviewers,
    executors: [],
    summary: "",
    logFile: null,
    resultFile: jobResultFile(repoRoot, id),
    errorMessage: null,
    // internal spec for the worker (stripped from public renders)
    _spec: {
      kind: jobParams.kind,
      self: jobParams.self,
      target: jobParams.target,
      context: jobParams.context,
      reviewers: jobParams.reviewers,
      warnings: jobParams.warnings,
      focus: jobParams.focus,
      timeoutMs: jobParams.timeoutMs,
    },
  };
  await writeJob(repoRoot, job);

  const child = spawn(process.execPath, [BIN, "__worker", repoRoot, id], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  return job;
}

/** Worker entrypoint: execute a queued job to completion. */
export async function runWorker(ctx) {
  const [repoRoot, id] = ctx.positionals;
  if (!repoRoot || !id) {
    process.stderr.write("crossfire __worker: missing repoRoot/id\n");
    return 2;
  }
  const env = ctx.env;
  const job = await readJob(repoRoot, id, env);
  if (!job || !job._spec) {
    process.stderr.write("crossfire __worker: job not found\n");
    return 2;
  }

  let heartbeat;
  const update = async (patch) => {
    Object.assign(job, patch, { heartbeatAt: nowIso() });
    await writeJob(repoRoot, job, env);
  };

  try {
    await update({ status: "running", startedAt: nowIso(), pid: process.pid, phase: "starting" });
    heartbeat = setInterval(() => {
      job.heartbeatAt = nowIso();
      writeJob(repoRoot, job, env).catch(() => {});
    }, 5000);

    const config = await loadConfig(repoRoot, env);
    const detected = await detectAll(config, env);
    const spec = { ...job._spec, config, env };

    const result = await runReviewJob(spec, detected, (phase) => {
      job.phase = phase;
      job.heartbeatAt = nowIso();
      writeJob(repoRoot, job, env).catch(() => {});
    });

    // Persist raw reviewer outputs to files, then strip from result file.
    for (const r of result.reviewers) {
      if (r.raw_output) {
        const f = jobRawFile(repoRoot, id, r.name, env);
        await writeFile(f, r.raw_output).catch(() => {});
        r.raw_output_file = f;
        delete r.raw_output;
      }
    }
    await atomicWriteJson(jobResultFile(repoRoot, id, env), result);
    await update({
      // Job lifecycle status (terminal). `result_status` preserves the review
      // outcome (completed | partial | failed) so partial coverage is visible.
      status: result.status === "failed" ? "failed" : "completed",
      result_status: result.status,
      phase: "done",
      completedAt: nowIso(),
      summary: result.arbitration?.summary || "",
    });
    return 0;
  } catch (e) {
    await update({ status: "failed", phase: "failed", errorMessage: String(e?.stack || e), completedAt: nowIso() });
    return 1;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

/** Cancel an active job, terminating its process tree. */
export async function cancelJob(repoRoot, id, env) {
  const job = await readJob(repoRoot, id, env);
  if (!job) return { ok: false, error: "job not found" };
  if (["completed", "failed", "canceled"].includes(job.status)) {
    return { ok: false, error: `job already ${job.status}` };
  }
  if (job.pid) {
    try {
      process.kill(-job.pid, "SIGKILL");
    } catch {
      try {
        process.kill(job.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
  job.status = "canceled";
  job.phase = "failed";
  job.completedAt = nowIso();
  await writeJob(repoRoot, job, env);
  return { ok: true, job };
}

export { stateRoot };
