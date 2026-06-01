#!/usr/bin/env node
// Local smoke test: builds a throwaway repo, points claude/codex at the fakes,
// and exercises review + rescue + gate end-to-end without calling real agents.
import { mkdtemp, writeFile, mkdir, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const BIN = join(HERE, "..", "bin", "crossfire.mjs");
const FAKE_CLAUDE = join(HERE, "..", "tests", "fixtures", "fake-claude.mjs");
const FAKE_CODEX = join(HERE, "..", "tests", "fixtures", "fake-codex.mjs");

const repo = await mkdtemp(join(tmpdir(), "crossfire-smoke-"));
const env = { ...process.env, CURSOR_AGENT: "", CLAUDECODE: "", CROSSFIRE_DATA_DIR: join(repo, ".state") };
const cc = (args) => execFileSync(process.execPath, [BIN, ...args], { cwd: repo, env, encoding: "utf8" });
const git = (args) => execFileSync("git", args, { cwd: repo, stdio: "pipe" });

try {
  for (const f of [FAKE_CLAUDE, FAKE_CODEX]) await chmod(f, 0o755);
  git(["init", "-q"]);
  git(["config", "user.email", "t@t.co"]);
  git(["config", "user.name", "t"]);
  await writeFile(join(repo, "handler.js"), "function h(i){return i.value;}\n");
  git(["add", "."]);
  git(["commit", "-qm", "init"]);
  await writeFile(join(repo, "handler.js"), "function h(i){return i.value.trim();}\n");
  await mkdir(join(repo, ".crossfire"), { recursive: true });
  await writeFile(
    join(repo, ".crossfire", "config.json"),
    JSON.stringify({ reviewers: { claude: { bin: FAKE_CLAUDE }, codex: { bin: FAKE_CODEX } } }),
  );

  process.stdout.write("== review ==\n");
  const review = JSON.parse(cc(["review", "--self", "cursor", "--wait", "--json"]));
  process.stdout.write(`verdict=${review.arbitration.verdict} reviewers=${review.reviewers.map((r) => r.name).join(",")}\n`);

  process.stdout.write("== rescue (read-only) ==\n");
  const rescue = JSON.parse(cc(["rescue", "--self", "cursor", "--only", "codex", "--read-only", "--json", "investigate"]));
  process.stdout.write(`mode=${rescue.mode} status=${rescue.status}\n`);

  process.stdout.write("== gate ==\n");
  const gate = JSON.parse(cc(["gate", "--self", "cursor", "--reviewer", "codex", "--json"]));
  process.stdout.write(`verdict=${gate.verdict} blocking=${gate.blocking}\n`);

  process.stdout.write("\nSMOKE OK\n");
} finally {
  await rm(repo, { recursive: true, force: true });
}
