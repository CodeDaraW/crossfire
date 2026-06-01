import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, flagInt, flagBool } from "../src/cli/args.mjs";

test("parses command, value flags, and positionals", () => {
  const { command, flags, positionals } = parseArgs(["review", "--base", "main", "--wait", "focus", "here"]);
  assert.equal(command, "review");
  assert.equal(flags.base, "main");
  assert.equal(flags.wait, true);
  assert.deepEqual(positionals, ["focus", "here"]);
});

test("supports --flag=value and list flags", () => {
  const { flags } = parseArgs(["review", "--reviewer=claude,codex", "--only", "cursor"]);
  assert.deepEqual(flags.reviewer, ["claude", "codex"]);
  assert.deepEqual(flags.only, ["cursor"]);
});

test("--with is an alias of --reviewer", () => {
  const { flags } = parseArgs(["review", "--with", "claude"]);
  assert.deepEqual(flags.reviewer, ["claude"]);
});

test("-- stops flag parsing", () => {
  const { positionals } = parseArgs(["task", "--", "--write", "literal"]);
  assert.deepEqual(positionals, ["--write", "literal"]);
});

test("flagInt and flagBool", () => {
  const { flags } = parseArgs(["review", "--timeout-ms", "1234"]);
  assert.equal(flagInt(flags, "timeout-ms", 0), 1234);
  assert.equal(flagBool(flags, "missing", true), true);
  assert.equal(flagBool({ x: "false" }, "x", true), false);
});

test("value flag without value throws", () => {
  assert.throws(() => parseArgs(["review", "--base"]));
});

test("leading --help has no command and sets help flag", () => {
  const { command, flags } = parseArgs(["--help"]);
  assert.equal(command, undefined);
  assert.equal(flags.help, true);
});

test("leading --version has no command and sets version flag", () => {
  const { command, flags } = parseArgs(["--version"]);
  assert.equal(command, undefined);
  assert.equal(flags.version, true);
});
