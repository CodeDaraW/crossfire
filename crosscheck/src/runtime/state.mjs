import { mkdir, writeFile, rename, readFile, readdir, open } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, isAbsolute, dirname, basename } from "node:path";
import { createHash } from "node:crypto";

/** Resolve the stable state root for a repo. Never uses $TMPDIR. */
export function stateRoot(repoRootPath, env = process.env) {
  const base = env.CROSSCHECK_DATA_DIR || join(homedir(), ".crosscheck");
  const slug = (repoRootPath ? repoRootPath.split("/").filter(Boolean).pop() : "no-repo") || "repo";
  const hash = createHash("sha1").update(repoRootPath || "no-repo").digest("hex").slice(0, 10);
  return join(base, "state", `${slug}-${hash}`);
}

/**
 * If the crosscheck data dir lives inside the repo, return the repo-relative
 * top-level segment to exclude from review change-detection (e.g. ".state").
 * Realpath-normalizes both sides so macOS /var vs /private/var symlinks match.
 */
export function stateExcludeDir(repoRootPath, env = process.env) {
  if (!repoRootPath) return null;
  const dataDir = env.CROSSCHECK_DATA_DIR || join(homedir(), ".crosscheck");
  // Realpath the deepest existing ancestor, then re-append the missing tail, so
  // not-yet-created dirs still normalize symlinks (e.g. /var -> /private/var).
  const real = (p) => {
    const segs = [];
    let cur = p;
    for (;;) {
      try {
        return segs.length ? join(realpathSync(cur), ...segs) : realpathSync(cur);
      } catch {
        const parent = dirname(cur);
        if (parent === cur) return p;
        segs.unshift(basename(cur));
        cur = parent;
      }
    }
  };
  const rel = relative(real(repoRootPath), real(dataDir));
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return rel.split(/[\\/]/)[0];
}

export function jobsDir(repoRootPath, env) {
  return join(stateRoot(repoRootPath, env), "jobs");
}
export function sessionsDir(repoRootPath, env) {
  return join(stateRoot(repoRootPath, env), "sessions");
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

/** Atomic write: tmp file + fsync + rename. */
export async function atomicWriteJson(path, data) {
  await ensureDir(path.slice(0, path.lastIndexOf("/")));
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  const json = JSON.stringify(data, null, 2);
  const fh = await open(tmp, "w");
  try {
    await fh.writeFile(json);
    await fh.sync();
  } finally {
    await fh.close();
  }
  await rename(tmp, path);
}

export async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

export function jobFile(repoRootPath, id, env) {
  return join(jobsDir(repoRootPath, env), `${id}.json`);
}
export function jobLogFile(repoRootPath, id, env) {
  return join(jobsDir(repoRootPath, env), `${id}.log`);
}
export function jobResultFile(repoRootPath, id, env) {
  return join(jobsDir(repoRootPath, env), `${id}.result.json`);
}
export function jobRawFile(repoRootPath, id, reviewer, env) {
  return join(jobsDir(repoRootPath, env), `${id}.raw.${reviewer}.log`);
}

export async function writeJob(repoRootPath, job, env) {
  await atomicWriteJson(jobFile(repoRootPath, job.id, env), job);
  return job;
}

export async function readJob(repoRootPath, id, env) {
  return readJson(jobFile(repoRootPath, id, env));
}

/** List jobs by scanning jobs/*.json (no central index as single source of truth). */
export async function listJobs(repoRootPath, env) {
  const dir = jobsDir(repoRootPath, env);
  let names = [];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const jobs = [];
  for (const n of names) {
    if (!n.endsWith(".json") || n.endsWith(".result.json")) continue;
    const job = await readJson(join(dir, n));
    if (job) jobs.push(reconcile(job));
  }
  return jobs.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

const HEARTBEAT_TIMEOUT_MS = 30000;

/** Detect zombie jobs: running but pid dead or heartbeat stale. */
export function reconcile(job) {
  if (job.status !== "running") return job;
  const stale = job.heartbeatAt && Date.now() - new Date(job.heartbeatAt).getTime() > HEARTBEAT_TIMEOUT_MS;
  let alive = true;
  if (job.pid) {
    try {
      process.kill(job.pid, 0);
    } catch {
      alive = false;
    }
  }
  if (!alive || stale) {
    return { ...job, status: "failed", errorMessage: "worker died", phase: "failed" };
  }
  return job;
}

export function newJobId(kind) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${kind}-${Date.now().toString(36)}${rand}`;
}
