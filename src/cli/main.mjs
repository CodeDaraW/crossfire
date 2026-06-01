import { parseArgs } from "./args.mjs";

const COMMANDS = {
  doctor: () => import("./commands/doctor.mjs"),
  setup: () => import("./commands/setup.mjs"),
  review: () => import("./commands/review.mjs"),
  "adversarial-review": () => import("./commands/review.mjs"),
  rescue: () => import("./commands/rescue.mjs"),
  task: () => import("./commands/task.mjs"),
  gate: () => import("./commands/gate.mjs"),
  status: () => import("./commands/status.mjs"),
  result: () => import("./commands/result.mjs"),
  cancel: () => import("./commands/cancel.mjs"),
  install: () => import("./commands/install.mjs"),
  uninstall: () => import("./commands/install.mjs"),
};

const HELP = `crossfire <command> [options] [focus...]

Review lane (read-only):
  review                 cross-review uncommitted / branch / commit changes
  adversarial-review     design/risk challenge review
  gate                   stop-time blocker review (ALLOW/BLOCK)

Rescue/task lane (delegation; can be write-capable):
  rescue                 delegate investigation / fix to another agent
  task                   internal runtime entrypoint (thin forwarder)

Runtime:
  status [job-id]        list or inspect background jobs
  result [job-id]        full output of a finished job
  cancel <job-id>        cancel an active job

Setup:
  doctor                 read-only capability diagnosis
  setup                  check + optionally install/configure
  install / uninstall    (un)install host integrations

Common flags:
  --reviewer a,b,c  --executor a  --only a  --self <host>  --allow-self
  --base <ref>  --commit <sha>  --scope auto|working-tree|branch
  --wait | --background   --format text|json   --timeout-ms <ms>
`;

export async function main(argv) {
  const { command, flags, positionals } = parseArgs(argv);

  // Version takes precedence so `--version` (command === undefined) is not
  // swallowed by the no-command help branch below.
  if (command === "version" || flags.version) {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const pkgPath = fileURLToPath(new URL("../../package.json", import.meta.url));
    const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  if (!command || command === "help" || flags.help) {
    process.stdout.write(HELP);
    return 0;
  }

  if (command === "__worker") {
    const { runWorker } = await import("../runtime/jobs.mjs");
    return runWorker({ command, flags, positionals, cwd: process.cwd(), env: process.env });
  }

  const loader = COMMANDS[command];
  if (!loader) {
    process.stderr.write(`crossfire: unknown command '${command}'\n\n${HELP}`);
    return 2;
  }

  const mod = await loader();
  const ctx = {
    command,
    flags,
    positionals,
    cwd: process.cwd(),
    env: process.env,
  };
  return mod.run(ctx);
}
