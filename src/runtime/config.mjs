import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_CONFIG = {
  reviewers: {
    default: "non-self-available",
    // `args` are fixed leading arguments injected before crosscheck's own flags,
    // for private site-specific CLI requirements.
    cursor: { bin: "cursor-agent", args: [], model: null, timeout_ms: 600000 },
    claude: { bin: "claude", args: [], model: null, timeout_ms: 600000 },
    codex: { bin: "codex", args: [], model: null, timeout_ms: 600000 },
  },
  context: {
    max_inline_diff_bytes: 262144,
    max_untracked_file_bytes: 24576,
    secret_path_patterns: [
      ".env",
      ".env.*",
      "*.pem",
      "*.key",
      "*.p12",
      "*.pfx",
      "id_rsa",
      "id_ed25519",
    ],
  },
  jobs: { max_jobs: 50, default_background_threshold_files: 3 },
  arbitration: { mode: "deterministic", llm_arbiter: "self", timeout_ms: 120000 },
  gate: { enabled: false, reviewers: "fastest-non-self", timeout_ms: 900000 },
};

function deepMerge(base, override) {
  if (!override || typeof override !== "object") return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object") {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

/** Merge defaults < user config < repo config (CLI/env applied by callers). */
export async function loadConfig(repoRootPath, env = process.env) {
  let cfg = DEFAULT_CONFIG;
  const userPath = join(env.CROSSCHECK_CONFIG_HOME || homedir(), ".crosscheck", "config.json");
  const user = await readJsonIfExists(userPath);
  if (user) cfg = deepMerge(cfg, user);
  if (repoRootPath) {
    const repo = await readJsonIfExists(join(repoRootPath, ".crosscheck", "config.json"));
    if (repo) cfg = deepMerge(cfg, repo);
  }
  return cfg;
}
