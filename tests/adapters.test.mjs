import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaudeAdapter } from "../src/reviewers/claude.mjs";
import { createCodexAdapter } from "../src/reviewers/codex.mjs";
import { createCursorAdapter } from "../src/reviewers/cursor.mjs";
import { buildExecutors } from "../src/executors/registry.mjs";

const config = {
  reviewers: {
    claude: { bin: "claude", args: ["--config", "~/agent-config.json"] },
    codex: { bin: "codex", args: ["--config", "key=val"] },
    cursor: { bin: "cursor-agent", args: ["--foo"] },
  },
};
const env = { HOME: "/home/u" };

test("claude reviewer prepends fixed args (with ~ expansion) before -p", () => {
  const a = createClaudeAdapter(config, env);
  const inv = a.buildInvocation({ prompt: "x", repoRoot: "/r", caps: { permission_mode: true } });
  assert.deepEqual(inv.args.slice(0, 3), ["--config", "/home/u/agent-config.json", "-p"]);
});

test("codex reviewer prepends fixed args before exec", () => {
  const a = createCodexAdapter(config);
  const inv = a.buildInvocation({ prompt: "x", repoRoot: "/r", caps: { sandbox_flag: true } });
  assert.deepEqual(inv.args.slice(0, 3), ["--config", "key=val", "exec"]);
});

test("cursor reviewer prepends fixed args before -p", () => {
  const a = createCursorAdapter(config);
  const inv = a.buildInvocation({ prompt: "x", repoRoot: "/r", caps: {} });
  assert.equal(inv.args[0], "--foo");
  assert.equal(inv.args[1], "-p");
});

test("executors also inject fixed args", () => {
  const execs = buildExecutors(config, env);
  const claude = execs.find((e) => e.name === "claude");
  const inv = claude.buildTaskInvocation({ prompt: "x", repoRoot: "/r", write: true });
  assert.deepEqual(inv.args.slice(0, 3), ["--config", "/home/u/agent-config.json", "-p"]);
});
