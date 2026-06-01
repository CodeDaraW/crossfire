import { homedir } from "node:os";
import { join } from "node:path";
import { access } from "node:fs/promises";

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Discover host integration targets. Returns descriptors describing where the
 * portable skill and native shells should be installed for each detected host.
 */
export async function detectHostTargets(env = process.env) {
  const home = env.HOME || homedir();
  const targets = [];

  const codexSkills = join(home, ".codex", "skills");
  targets.push({ host: "codex", kind: "skill", dir: join(codexSkills, "crosscheck"), parent: codexSkills, present: await exists(join(home, ".codex")) });

  const claudeHome = join(home, ".claude");
  targets.push({ host: "claude", kind: "skill", dir: join(claudeHome, "skills", "crosscheck"), parent: join(claudeHome, "skills"), present: await exists(claudeHome) });
  targets.push({ host: "claude", kind: "commands", dir: join(claudeHome, "commands"), parent: claudeHome, present: await exists(claudeHome), source: "hosts/claude/commands", merge: true });
  targets.push({ host: "claude", kind: "agents", dir: join(claudeHome, "agents"), parent: claudeHome, present: await exists(claudeHome), source: "hosts/claude/agents", merge: true });

  const cursorHome = join(home, ".cursor");
  targets.push({ host: "cursor", kind: "skill", dir: join(cursorHome, "skills", "crosscheck"), parent: join(cursorHome, "skills"), present: await exists(cursorHome) });
  targets.push({ host: "cursor", kind: "commands", dir: join(cursorHome, "commands"), parent: cursorHome, present: await exists(cursorHome), source: "hosts/cursor/commands", merge: true });

  const localBin = join(home, ".local", "bin");
  targets.push({ host: "all", kind: "bin", dir: join(localBin, "crosscheck"), parent: localBin, present: await exists(localBin) });

  return targets;
}
