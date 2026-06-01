import { install, uninstall } from "../../install/install.mjs";
import { flagBool } from "../args.mjs";

export async function run(ctx) {
  const { command, flags, env } = ctx;

  if (command === "uninstall") {
    const res = await uninstall({ env });
    if (flags.json) {
      process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    } else if (res.note) {
      process.stdout.write(`${res.note}\n`);
    } else {
      process.stdout.write(`Removed ${res.removed.length} item(s).\n`);
      for (const p of res.removed) process.stdout.write(`  - ${p}\n`);
    }
    return 0;
  }

  const copy = flagBool(flags, "copy", false);
  const hosts = flags.hosts && flags.hosts.length ? flags.hosts : null;
  const res = await install({ env, copy, hosts });

  if (flags.json) {
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    return 0;
  }
  process.stdout.write(`Installed ${res.installed.length} item(s) (${copy ? "copy" : "symlink"}):\n`);
  for (const i of res.installed) process.stdout.write(`  + [${i.host}/${i.kind}] ${i.path}\n`);
  if (res.skipped.length) {
    process.stdout.write(`Skipped:\n`);
    for (const s of res.skipped) process.stdout.write(`  - [${s.host}/${s.kind}] ${s.reason}\n`);
  }
  process.stdout.write(
    `\nNotes:\n` +
      `  - Ensure the 'crossfire' bin dir is on PATH (e.g. ~/.local/bin).\n` +
      `  - Claude stop-gate hook is opt-in: enable with 'crossfire setup --enable-gate' and\n` +
      `    add hosts/claude/hooks/hooks.json to your Claude hooks config.\n`,
  );
  return 0;
}
