import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { install, isSymlinkTo } from "../src/install/install.mjs";

test("install creates ~/.local/bin and links crossfire without pre-existing bin dir", async () => {
  const home = await mkdtemp(join(tmpdir(), "crossfire-install-"));
  try {
    const res = await install({ env: { HOME: home, CROSSFIRE_CONFIG_HOME: home } });
    const binPath = join(home, ".local", "bin", "crossfire");
    const installedBin = res.installed.find((entry) => entry.kind === "bin" && entry.path === binPath);

    assert.ok(installedBin, "expected crossfire bin to be installed");
    assert.equal((await lstat(join(home, ".local", "bin"))).isDirectory(), true);
    assert.match(await isSymlinkTo(binPath), /bin\/crossfire$/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
