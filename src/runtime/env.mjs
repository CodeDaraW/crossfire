// Self-detection and child-environment hygiene.

export const HOSTS = ["cursor", "claude", "codex"];

/** Expand a leading `~` in each fixed arg to the user's home directory. */
export function expandHomeArgs(args = [], env = process.env) {
  const home = env.HOME || env.USERPROFILE || "";
  return (Array.isArray(args) ? args : []).map((a) =>
    typeof a === "string" && home && (a === "~" || a.startsWith("~/")) ? home + a.slice(1) : a,
  );
}

/**
 * Detect which agent is hosting crosscheck right now.
 * Priority: --self flag > explicit env > unknown.
 * Host command templates are expected to pass --self explicitly.
 */
export function detectSelf(flags = {}, env = process.env) {
  if (flags.self && HOSTS.includes(flags.self)) return flags.self;
  if (env.CROSSCHECK_SELF && HOSTS.includes(env.CROSSCHECK_SELF)) return env.CROSSCHECK_SELF;
  if (env.CURSOR_AGENT) return "cursor";
  if (env.CLAUDECODE) return "claude";
  if (env.CODEX_SANDBOX || env.CODEX_HOME || env.CODEX_AGENT) return "codex";
  return "unknown";
}

export function isChildInvocation(env = process.env) {
  return env.CROSSCHECK_CHILD === "1";
}

// Environment variables that should never leak into spawned reviewer/executor
// processes. We pass through PATH/HOME/locale/agent-auth essentials only.
const SENSITIVE_PATTERNS = [
  /SECRET/i,
  /TOKEN/i,
  /PASSWORD/i,
  /PASSWD/i,
  /_KEY$/i,
  /APIKEY/i,
  /API_KEY/i,
  /PRIVATE/i,
  /CREDENTIAL/i,
];

// Variables we explicitly keep even if they match a sensitive pattern, because
// the target agent CLI needs them to authenticate.
const KEEP_ALLOWLIST = new Set([
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "CURSOR_API_KEY",
]);

/**
 * Produce a scrubbed copy of env for a child agent process.
 * Drops obviously-sensitive variables that are not on the auth allowlist,
 * and injects CROSSCHECK_CHILD=1 to prevent recursive gate triggering.
 */
export function scrubEnv(env = process.env, extra = {}) {
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue;
    if (KEEP_ALLOWLIST.has(k)) {
      out[k] = v;
      continue;
    }
    if (SENSITIVE_PATTERNS.some((re) => re.test(k))) continue;
    out[k] = v;
  }
  out.CROSSCHECK_CHILD = "1";
  return { ...out, ...extra };
}
