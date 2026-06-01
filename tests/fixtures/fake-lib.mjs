// Shared logic for fake agent CLIs used in tests and smoke runs.
// Each fake emulates the subset of CLI behavior crossfire adapters rely on:
//   --help        -> prints flag names so capability probing succeeds
//   status        -> reports "Logged in" (cursor auth probe)
//   exec --help    -> codex exec help
// otherwise it reads the prompt (from argv or stdin) and emits a review JSON.

import { readFileSync, writeFileSync } from "node:fs";

const HELP = `fake agent
  -p, --print            print mode
  --mode <m>             ask|plan
  --output-format <fmt>  text|json
  --workspace <dir>
  --trust
  --permission-mode <m>  plan
  --json-schema <file>
  --allowed-tools <list>
  --model <m>
  --sandbox <mode>       read-only
  exec                   non-interactive exec
  review                 native review
`;

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

export function runFake({ name, scenario }) {
  const argv = process.argv.slice(2);

  if (argv.includes("--help") && !argv.includes("exec")) {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv[0] === "exec" && argv.includes("--help")) {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv[0] === "status" || argv[0] === "whoami") {
    process.stdout.write("Logged in as fake@example.com\n");
    return 0;
  }

  // Otherwise: produce a review result, OR perform a task if this is a task prompt.
  const prompt = argv[argv.length - 1] || readStdin();

  if (/VERY FIRST LINE|stop-time review gate|ALLOW: <short reason>/.test(prompt)) {
    if (process.env.FAKE_GATE === "block") {
      process.stdout.write("BLOCK: fake gate found a high-confidence data loss risk\nsee handler.js:12\n");
    } else {
      process.stdout.write("ALLOW: fake gate found no blocking issue\n");
    }
    return 0;
  }

  if (/action_safety|verification_loop|Mode: (write-capable|read-only)/.test(prompt)) {
    const writeCapable = /Mode: write-capable/.test(prompt) || argv.includes("workspace-write") || argv.includes("acceptEdits");
    if (writeCapable) {
      // Simulate a scoped edit so touched_files / pre-post diff are exercised.
      // FAKE_WRITE_TARGET lets a test point the edit at an already-dirty file.
      const target = process.env.FAKE_WRITE_TARGET || "rescue-fix.txt";
      try {
        writeFileSync(target, `applied by fake executor ${Date.now()}\n`);
      } catch {
        /* ignore */
      }
      process.stdout.write(`Applied a scoped fix. Touched: ${target}\nsession_id: fake-sess-123\n`);
    } else {
      process.stdout.write("Diagnosis: the null dereference at handler.js:12 is the root cause. No files modified.\n");
    }
    return 0;
  }

  if (scenario === "fail") {
    // Emulate a CLI that prints an error to stdout and exits non-zero.
    process.stdout.write("ERROR: authentication failed\n");
    return 1;
  }

  let payload;
  if (scenario === "approve") {
    payload = { verdict: "approve", summary: `${name}: no material issues found.`, findings: [], next_steps: [] };
  } else if (scenario === "invalid") {
    process.stdout.write("I reviewed the code and it looks mostly fine but check error handling.\n");
    return 0;
  } else {
    payload = {
      verdict: "needs-attention",
      summary: `${name}: found a potential issue.`,
      findings: [
        {
          severity: scenario === "critical" ? "critical" : "high",
          title: "Missing null check on input",
          body: "The handler dereferences input without checking for null, risking a crash.",
          file: "src/handler.js",
          line_start: 12,
          line_end: 12,
          confidence: 0.8,
          recommendation: "Guard against null before dereferencing.",
        },
      ],
      next_steps: ["Add a regression test for the null path."],
    };
  }
  process.stdout.write(JSON.stringify(payload) + "\n");
  return 0;
}
