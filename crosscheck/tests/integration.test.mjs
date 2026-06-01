import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const BIN = join(HERE, "..", "bin", "crosscheck.mjs");
const FAKE_CLAUDE = join(HERE, "fixtures", "fake-claude.mjs");
const FAKE_CODEX = join(HERE, "fixtures", "fake-codex.mjs");

let repo;

function git(args) {
  execFileSync("git", args, { cwd: repo, stdio: "pipe" });
}

function runCC(args, extraEnv = {}) {
  const env = { ...process.env, CURSOR_AGENT: "", CLAUDECODE: "", CROSSCHECK_DATA_DIR: join(repo, ".state"), ...extraEnv };
  const out = execFileSync(process.execPath, [BIN, ...args], { cwd: repo, env, encoding: "utf8" });
  return out;
}

before(async () => {
  repo = await mkdtemp(join(tmpdir(), "crosscheck-it-"));
  for (const f of [FAKE_CLAUDE, FAKE_CODEX]) await chmod(f, 0o755);
  git(["init", "-q"]);
  git(["config", "user.email", "t@t.co"]);
  git(["config", "user.name", "t"]);
  await writeFile(join(repo, "handler.js"), "function h(i){return i.value;}\n");
  git(["add", "."]);
  git(["commit", "-qm", "init"]);
  await writeFile(join(repo, "handler.js"), "function h(i){return i.value.trim();}\n");
  await mkdir(join(repo, ".crosscheck"), { recursive: true });
  await writeFile(
    join(repo, ".crosscheck", "config.json"),
    JSON.stringify({ reviewers: { claude: { bin: FAKE_CLAUDE }, codex: { bin: FAKE_CODEX } } }),
  );
});

after(async () => {
  if (repo) await rm(repo, { recursive: true, force: true });
});

test("review fans out to non-self reviewers and arbitrates", () => {
  const out = runCC(["review", "--self", "cursor", "--wait", "--json"], {
    FAKE_CLAUDE_SCENARIO: "needs-attention",
    FAKE_CODEX_SCENARIO: "critical",
  });
  const res = JSON.parse(out);
  assert.equal(res.kind, "review");
  assert.equal(res.status, "completed");
  const names = res.reviewers.map((r) => r.name).sort();
  assert.deepEqual(names, ["claude", "codex"]);
  assert.ok(!res.reviewers.some((r) => r.name === "cursor"), "self must be excluded");
  assert.equal(res.arbitration.verdict, "needs-attention");
  assert.equal(res.arbitration.merged_findings.length, 1);
});

test("review approve path yields approve verdict", () => {
  const out = runCC(["review", "--self", "cursor", "--wait", "--json"], {
    FAKE_CLAUDE_SCENARIO: "approve",
    FAKE_CODEX_SCENARIO: "approve",
  });
  const res = JSON.parse(out);
  assert.equal(res.arbitration.verdict, "approve");
});

test("--only selects a single reviewer", () => {
  const out = runCC(["review", "--self", "cursor", "--only", "codex", "--wait", "--json"], {
    FAKE_CODEX_SCENARIO: "approve",
  });
  const res = JSON.parse(out);
  assert.deepEqual(res.reviewers.map((r) => r.name), ["codex"]);
});

test("rescue write touches files; read-only does not", () => {
  const wOut = runCC(["rescue", "--self", "cursor", "--only", "codex", "--write", "--json", "fix the bug"]);
  const w = JSON.parse(wOut);
  assert.equal(w.mode, "write");
  assert.ok(w.touched_files.includes("rescue-fix.txt"));
  // clean up the created file so the read-only check is meaningful
  git(["checkout", "--", "."]);
  execFileSync("rm", ["-f", join(repo, "rescue-fix.txt")]);

  const rOut = runCC(["rescue", "--self", "cursor", "--only", "codex", "--read-only", "--json", "investigate the bug"]);
  const r = JSON.parse(rOut);
  assert.equal(r.mode, "read-only");
  assert.deepEqual(r.touched_files, []);
});

test("gate allows when reviewer returns ALLOW", () => {
  const out = runCC(["gate", "--self", "cursor", "--reviewer", "codex", "--json"]);
  const res = JSON.parse(out);
  assert.equal(res.verdict, "ALLOW");
  assert.equal(res.blocking, false);
});

test("reviewer with non-zero exit + stdout error is marked failed, not completed", () => {
  const out = runCC(["review", "--self", "cursor", "--only", "codex", "--wait", "--json"], {
    FAKE_CODEX_SCENARIO: "fail",
  });
  const res = JSON.parse(out);
  const codex = res.reviewers.find((r) => r.name === "codex");
  assert.equal(codex.status, "failed");
  assert.match(codex.error, /exit 1/);
  assert.equal(res.arbitration.reviewer_failures.length, 1);
  assert.equal(res.arbitration.verdict, "blocked-by-review-failure");
});

test("write rescue records an edit to an already-dirty file in touched_files", () => {
  // make handler.js dirty BEFORE the task
  execFileSync("sh", ["-c", `echo '// pre-dirty' >> '${join(repo, "handler.js")}'`]);
  const out = runCC(["rescue", "--self", "cursor", "--only", "codex", "--write", "--json", "fix the bug"], {
    FAKE_WRITE_TARGET: "handler.js",
  });
  const r = JSON.parse(out);
  assert.ok(r.touched_files.includes("handler.js"), `expected handler.js in ${JSON.stringify(r.touched_files)}`);
  git(["checkout", "--", "."]);
});

test("review --background --json returns a job object", () => {
  const out = runCC(["review", "--self", "cursor", "--only", "codex", "--background", "--json"], {
    FAKE_CODEX_SCENARIO: "approve",
  });
  const res = JSON.parse(out);
  assert.ok(res.job_id, "expected job_id");
  assert.ok(res.status_command.includes(res.job_id));
  assert.ok(res.result_command.includes(res.job_id));
});

test("in-repo state dir does not flip approve to needs-attention (background)", async () => {
  const start = JSON.parse(
    runCC(["review", "--self", "cursor", "--only", "codex", "--background", "--json"], { FAKE_CODEX_SCENARIO: "approve" }),
  );
  // poll until done
  let res;
  for (let i = 0; i < 30; i++) {
    const st = JSON.parse(runCC(["status", start.job_id, "--json"]));
    if (["completed", "failed", "partial"].includes(st.status) || st.result_status) {
      res = JSON.parse(runCC(["result", start.job_id, "--json"]));
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(res, "background job did not finish in time");
  assert.equal(res.safety.repo_changed_during_review, false);
  assert.equal(res.arbitration.verdict, "approve");
});

test("background job preserves partial result_status when a reviewer fails", async () => {
  const start = JSON.parse(
    runCC(["review", "--self", "cursor", "--reviewer", "claude,codex", "--background", "--json"], {
      FAKE_CLAUDE_SCENARIO: "approve",
      FAKE_CODEX_SCENARIO: "fail",
    }),
  );
  let st;
  for (let i = 0; i < 30; i++) {
    st = JSON.parse(runCC(["status", start.job_id, "--json"]));
    if (st.result_status || ["completed", "failed"].includes(st.status)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal(st.status, "completed", "job lifecycle should be completed");
  assert.equal(st.result_status, "partial", "result_status should expose partial coverage");
});
