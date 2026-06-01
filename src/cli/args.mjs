// Minimal, dependency-free argument parser for crossfire.
//
// Flags that take a value must be listed in VALUE_FLAGS; everything else
// starting with `--` (or known short aliases) is treated as a boolean.
// Comma-separated values for list flags are split into arrays.

const VALUE_FLAGS = new Set([
  "base",
  "commit",
  "scope",
  "reviewer",
  "executor",
  "only",
  "self",
  "format",
  "timeout-ms",
  "model",
  "effort",
  "previous-turn-file",
  "hosts",
  "data-dir",
  "arbiter",
]);

const LIST_FLAGS = new Set(["reviewer", "executor", "only", "hosts"]);

const ALIASES = {
  // long alias -> canonical
  with: "reviewer",
};

function canonical(name) {
  return ALIASES[name] || name;
}

export function parseArgs(argv) {
  const args = [...argv];
  // The command is the first token only if it is not a flag; this lets global
  // flags like `--help` / `--version` work without a subcommand.
  const command = args.length && !args[0].startsWith("-") ? args.shift() : undefined;
  const flags = {};
  const positionals = [];

  for (let i = 0; i < args.length; i++) {
    let token = args[i];

    if (token === "--") {
      // everything after `--` is positional
      positionals.push(...args.slice(i + 1));
      break;
    }

    if (token.startsWith("--")) {
      let name = token.slice(2);
      let inlineValue;
      const eq = name.indexOf("=");
      if (eq !== -1) {
        inlineValue = name.slice(eq + 1);
        name = name.slice(0, eq);
      }
      name = canonical(name);

      if (VALUE_FLAGS.has(name)) {
        let value = inlineValue;
        if (value === undefined) {
          value = args[i + 1];
          i++;
        }
        if (value === undefined) {
          throw new Error(`flag --${name} requires a value`);
        }
        if (LIST_FLAGS.has(name)) {
          const parts = value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          flags[name] = [...(flags[name] || []), ...parts];
        } else {
          flags[name] = value;
        }
      } else {
        flags[name] = inlineValue === undefined ? true : inlineValue;
      }
      continue;
    }

    // bare positional
    positionals.push(token);
  }

  return { command, flags, positionals };
}

export function flagInt(flags, name, fallback) {
  const v = flags[name];
  if (v === undefined) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function flagBool(flags, name, fallback = false) {
  const v = flags[name];
  if (v === undefined) return fallback;
  if (v === true) return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return Boolean(v);
}
