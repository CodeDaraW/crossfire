import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { which } from "../src/runtime/process.mjs";
import { stateExcludeDir } from "../src/runtime/state.mjs";

test("stateExcludeDir returns top segment when data dir is inside repo", async () => {
  const repo = await mkdtemp(join(tmpdir(), "crossfire-state-"));
  try {
    const seg = stateExcludeDir(repo, { CROSSFIRE_DATA_DIR: join(repo, ".state") });
    assert.equal(seg, ".state");
    const outside = stateExcludeDir(repo, { CROSSFIRE_DATA_DIR: "/tmp/elsewhere-xyz" });
    assert.equal(outside, null);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("resolves a bare command name", async () => {
  const sh = await which("sh");
  assert.ok(sh && sh.includes("sh"));
});

test("returns null for a non-existent bare command", async () => {
  assert.equal(await which("definitely-not-a-real-binary-xyz"), null);
});

test("absolute path with spaces is checked via access, not mangled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "crossfire which test "));
  const bin = join(dir, "my agent.mjs");
  await writeFile(bin, "#!/usr/bin/env node\nprocess.exit(0)\n");
  await chmod(bin, 0o755);
  try {
    assert.equal(await which(bin), bin);
    // non-executable path -> null
    const plain = join(dir, "plain.txt");
    await writeFile(plain, "x");
    await chmod(plain, 0o644);
    assert.equal(await which(plain), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
