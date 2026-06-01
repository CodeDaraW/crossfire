import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSelf, scrubEnv, isChildInvocation } from "../src/runtime/env.mjs";

test("detectSelf honors --self over env", () => {
  assert.equal(detectSelf({ self: "claude" }, { CURSOR_AGENT: "1" }), "claude");
});

test("detectSelf reads host env vars", () => {
  assert.equal(detectSelf({}, { CURSOR_AGENT: "1" }), "cursor");
  assert.equal(detectSelf({}, { CLAUDECODE: "1" }), "claude");
  assert.equal(detectSelf({}, { CODEX_HOME: "/x" }), "codex");
  assert.equal(detectSelf({}, {}), "unknown");
});

test("scrubEnv drops secrets, keeps auth allowlist, sets child flag", () => {
  const out = scrubEnv({
    PATH: "/usr/bin",
    MY_SECRET: "x",
    GITHUB_TOKEN: "y",
    OPENAI_API_KEY: "keep",
    HOME: "/home/u",
  });
  assert.equal(out.PATH, "/usr/bin");
  assert.equal(out.HOME, "/home/u");
  assert.equal(out.OPENAI_API_KEY, "keep");
  assert.equal(out.MY_SECRET, undefined);
  assert.equal(out.GITHUB_TOKEN, undefined);
  assert.equal(out.CROSSCHECK_CHILD, "1");
});

test("isChildInvocation", () => {
  assert.equal(isChildInvocation({ CROSSCHECK_CHILD: "1" }), true);
  assert.equal(isChildInvocation({}), false);
});
