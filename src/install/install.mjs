import { mkdir, symlink, copyFile, rm, readdir, stat, lstat, readlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { detectHostTargets } from "./detect-hosts.mjs";
import { atomicWriteJson, readJson } from "../runtime/state.mjs";

const PKG_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const BIN = join(PKG_ROOT, "bin", "crossfire");
const SKILL_SRC = join(PKG_ROOT, "skills", "crossfire");

function manifestPath(env) {
  return join(env.CROSSFIRE_CONFIG_HOME || homedir(), ".crossfire", "install-manifest.json");
}

async function ensureDir(d) {
  await mkdir(d, { recursive: true });
}

async function linkOrCopy(src, dest, copy) {
  await ensureDir(dirname(dest));
  try {
    await rm(dest, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  if (copy) {
    const st = await stat(src);
    if (st.isDirectory()) {
      await ensureDir(dest);
      for (const name of await readdir(src)) await linkOrCopy(join(src, name), join(dest, name), true);
    } else {
      await copyFile(src, dest);
    }
  } else {
    await symlink(src, dest);
  }
}

/** Install portable skill + native host shells. */
export async function install({ env = process.env, copy = false, hosts = null } = {}) {
  const targets = await detectHostTargets(env);
  const installed = [];
  const skipped = [];

  for (const t of targets) {
    if (hosts && t.host !== "all" && !hosts.includes(t.host)) continue;
    if (!t.present) {
      skipped.push({ ...t, reason: "host not detected" });
      continue;
    }
    try {
      if (t.kind === "skill") {
        await linkOrCopy(SKILL_SRC, t.dir, copy);
        installed.push({ host: t.host, kind: t.kind, path: t.dir });
      } else if (t.kind === "bin") {
        await ensureDir(t.parent);
        await linkOrCopy(BIN, t.dir, false);
        installed.push({ host: t.host, kind: t.kind, path: t.dir });
      } else if (t.merge) {
        // Merge command/agent files into an existing host directory.
        const src = join(PKG_ROOT, t.source);
        await ensureDir(t.dir);
        for (const name of await readdir(src)) {
          const dest = join(t.dir, name);
          await linkOrCopy(join(src, name), dest, copy);
          installed.push({ host: t.host, kind: t.kind, path: dest });
        }
      }
    } catch (e) {
      skipped.push({ ...t, reason: String(e?.message || e) });
    }
  }

  await atomicWriteJson(manifestPath(env), { installedAt: new Date().toISOString(), copy, entries: installed });
  return { installed, skipped };
}

/** Remove everything we installed, based on the manifest. */
export async function uninstall({ env = process.env } = {}) {
  const manifest = await readJson(manifestPath(env));
  const removed = [];
  if (!manifest) return { removed, note: "no install manifest found" };
  for (const entry of manifest.entries || []) {
    try {
      await rm(entry.path, { recursive: true, force: true });
      removed.push(entry.path);
    } catch {
      /* ignore */
    }
  }
  await rm(manifestPath(env), { force: true });
  return { removed };
}

export async function isSymlinkTo(path) {
  try {
    const st = await lstat(path);
    if (!st.isSymbolicLink()) return null;
    return await readlink(path);
  } catch {
    return null;
  }
}
