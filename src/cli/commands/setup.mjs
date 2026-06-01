import { homedir } from "node:os";
import { join } from "node:path";
import { gitAvailable } from "../../git/repository.mjs";
import { detectAll } from "../../reviewers/registry.mjs";
import { detectSelf } from "../../runtime/env.mjs";
import { loadConfig } from "../../runtime/config.mjs";
import { atomicWriteJson, readJson } from "../../runtime/state.mjs";

export async function run(ctx) {
  const { flags, env, cwd } = ctx;
  const self = detectSelf(flags, env);
  const config = await loadConfig(cwd, env);

  // Gate enable/disable persists to user config.
  if (flags["enable-gate"] || flags["disable-gate"]) {
    const path = join(env.CROSSFIRE_CONFIG_HOME || homedir(), ".crossfire", "config.json");
    const cfg = (await readJson(path)) || {};
    cfg.gate = { ...(cfg.gate || {}), enabled: Boolean(flags["enable-gate"]) };
    await atomicWriteJson(path, cfg);
    process.stdout.write(`gate ${flags["enable-gate"] ? "enabled" : "disabled"} in ${path}\n`);
  }

  const git = await gitAvailable();
  const detected = await detectAll(config, env, true);
  const next_steps = [];

  if (!git.available) next_steps.push("install git");
  for (const d of detected) {
    const isSelf = d.name === self;
    if (!d.detect.available) {
      if (!isSelf) next_steps.push(`install ${d.name} CLI to enable it as a reviewer/executor`);
    } else if (d.caps?.authenticated === false) {
      if (!isSelf) next_steps.push(`authenticate ${d.name} (e.g. \`${d.detect.bin} login\` or \`status\`)`);
    }
  }
  const reviewers = detected.filter((d) => d.detect.available && d.name !== self);
  if (reviewers.length === 0) {
    next_steps.push("install at least one non-self agent CLI to enable cross review");
  }

  const report = {
    ready: git.available && reviewers.length > 0,
    self,
    git,
    reviewers: detected.map((d) => ({
      name: d.name,
      available: d.detect.available,
      authenticated: d.caps?.authenticated ?? null,
      path: d.detect.path,
    })),
    gate: { enabled: Boolean(config.gate?.enabled) },
    next_steps,
  };

  if (flags.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return report.ready ? 0 : 1;
  }
  process.stdout.write(`crossfire setup\nself: ${self}\nready: ${report.ready}\n`);
  process.stdout.write(`reviewers available: ${reviewers.map((r) => r.name).join(", ") || "(none)"}\n`);
  if (next_steps.length) {
    process.stdout.write("next steps:\n");
    for (const s of next_steps) process.stdout.write(`  - ${s}\n`);
  }
  return report.ready ? 0 : 1;
}
