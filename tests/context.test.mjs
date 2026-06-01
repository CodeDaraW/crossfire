import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveTarget } from "../src/git/target.mjs";
import { collectContext } from "../src/git/context.mjs";
import { workingTreeFingerprint } from "../src/git/repository.mjs";
import { DEFAULT_CONFIG } from "../src/runtime/config.mjs";

let repo;
const git = (args) => execFileSync("git", args, { cwd: repo, stdio: "pipe" });

before(async () => {
  repo = await mkdtemp(join(tmpdir(), "crosscheck-ctx-"));
  git(["init", "-q"]);
  git(["config", "user.email", "t@t.co"]);
  git(["config", "user.name", "t"]);
  await writeFile(join(repo, "app.js"), "const x = 1;\n");
  await writeFile(join(repo, ".env"), "API_KEY=oldsecret\n");
  git(["add", "."]);
  git(["commit", "-qm", "init"]);
});

after(async () => {
  if (repo) await rm(repo, { recursive: true, force: true });
});

test("tracked secret file content is excluded from reviewer context", async () => {
  await writeFile(join(repo, ".env"), "API_KEY=SUPER_SECRET_NEW_VALUE\n");
  await writeFile(join(repo, "app.js"), "const x = 2;\n");
  const target = await resolveTarget({ scope: "working-tree" }, repo);
  const ctx = await collectContext(target, DEFAULT_CONFIG);
  assert.ok(!ctx.text.includes("SUPER_SECRET_NEW_VALUE"), "secret value must not leak into context");
  assert.ok(ctx.text.includes("const x = 2;"), "non-secret diff should still be present");
  assert.ok(ctx.omitted_files.some((o) => o.file === ".env" && o.reason === "secret-path-redacted"));
  // restore
  await writeFile(join(repo, ".env"), "API_KEY=oldsecret\n");
  git(["checkout", "--", "."]);
});

test("fingerprint changes when an already-dirty file is modified again", async () => {
  await writeFile(join(repo, "app.js"), "const x = 99;\n"); // make dirty
  const fp1 = await workingTreeFingerprint(repo);
  await writeFile(join(repo, "app.js"), "const x = 100;\n"); // modify again, status line unchanged
  const fp2 = await workingTreeFingerprint(repo);
  assert.notEqual(fp1, fp2, "fingerprint must detect in-place edit of already-dirty file");
  git(["checkout", "--", "."]);
});

test("fingerprint detects untracked file content change", async () => {
  await writeFile(join(repo, "new.txt"), "a\n");
  const fp1 = await workingTreeFingerprint(repo);
  await writeFile(join(repo, "new.txt"), "b\n");
  const fp2 = await workingTreeFingerprint(repo);
  assert.notEqual(fp1, fp2);
  await rm(join(repo, "new.txt"));
});
