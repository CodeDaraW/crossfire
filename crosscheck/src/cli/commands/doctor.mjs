import { gitAvailable } from "../../git/repository.mjs";
import { detectAll } from "../../reviewers/registry.mjs";
import { detectSelf } from "../../runtime/env.mjs";
import { loadConfig } from "../../runtime/config.mjs";

export async function run(ctx) {
  const { flags, env, cwd } = ctx;
  const config = await loadConfig(cwd, env);
  const self = detectSelf(flags, env);
  const git = await gitAvailable();
  const detected = await detectAll(config, env, true);

  const report = {
    ready: detected.some((d) => d.detect.available) && git.available,
    self,
    git,
    agents: detected.map((d) => ({
      agent: d.name,
      installed: d.detect.available,
      path: d.detect.path,
      review_readonly: Boolean(d.caps?.readonly_mode),
      json_output: Boolean(d.caps?.json_output),
      native_review: Boolean(d.caps?.native_review),
      authenticated: d.caps?.authenticated ?? null,
      notes: d.caps?.error ? [d.caps.error] : [],
    })),
  };

  if (flags.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return 0;
  }

  const out = [];
  out.push(`crosscheck doctor`);
  out.push(`self host: ${self}`);
  out.push(`git: ${git.available ? git.version : "NOT FOUND"}`);
  out.push("");
  out.push("agents:");
  for (const a of report.agents) {
    if (!a.installed) {
      out.push(`  - ${a.agent}: not found`);
      continue;
    }
    const flagsStr = [
      a.review_readonly ? "readonly" : null,
      a.json_output ? "json" : null,
      a.native_review ? "native-review" : null,
      a.authenticated === false ? "NOT-AUTHED" : null,
    ]
      .filter(Boolean)
      .join(", ");
    out.push(`  - ${a.agent}: ${a.path} [${flagsStr || "ok"}]`);
    for (const n of a.notes) out.push(`      note: ${n}`);
  }
  out.push("");
  const reviewers = report.agents.filter((a) => a.installed && a.agent !== self).map((a) => a.agent);
  out.push(`default reviewers (non-self available): ${reviewers.join(", ") || "(none — install another agent)"}`);
  process.stdout.write(out.join("\n") + "\n");
  return report.ready ? 0 : 1;
}
