import { spawn } from "node:child_process";

/**
 * Run a child process to completion, capturing stdout/stderr.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @param {object} [opts]
 * @param {string} [opts.cwd]
 * @param {Record<string,string>} [opts.env]
 * @param {number} [opts.timeoutMs]
 * @param {string} [opts.input]   data written to stdin (stdin is closed after)
 * @param {boolean} [opts.detached]
 * @returns {Promise<{code:number|null, signal:string|null, stdout:string, stderr:string, timedOut:boolean, durationMs:number, error?:Error}>}
 */
export function runProcess(cmd, args = [], opts = {}) {
  const { cwd, env, timeoutMs, input, detached = false } = opts;
  const started = Date.now();

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        env: env || process.env,
        stdio: ["pipe", "pipe", "pipe"],
        detached,
      });
    } catch (error) {
      resolve({
        code: null,
        signal: null,
        stdout: "",
        stderr: String(error?.message || error),
        timedOut: false,
        durationMs: Date.now() - started,
        error,
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let timer = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({ ...result, durationMs: Date.now() - started });
    };

    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        if (detached && child.pid) {
          // Child is its own process group leader; kill the group.
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            /* ignore */
          }
        }
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }, timeoutMs);
    }

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (error) => {
      finish({
        code: null,
        signal: null,
        stdout,
        stderr: stderr || String(error?.message || error),
        timedOut,
        error,
      });
    });
    child.on("close", (code, signal) => {
      finish({ code, signal, stdout, stderr, timedOut });
    });

    if (input !== undefined) {
      try {
        child.stdin.write(input);
      } catch {
        /* ignore */
      }
    }
    try {
      child.stdin.end();
    } catch {
      /* ignore */
    }
  });
}

/**
 * Resolve an executable. Path-like values (absolute or containing a slash) are
 * checked directly with `fs.access(X_OK)` so paths with spaces or unusual
 * characters are not mangled. Bare command names are resolved via a safe shell
 * `command -v` that passes the name as an argument (no string interpolation).
 * Returns the resolved path, or null if not found / not executable.
 */
export async function which(bin) {
  const name = String(bin || "");
  if (!name) return null;

  if (name.includes("/")) {
    const { access, constants } = await import("node:fs/promises");
    try {
      await access(name, constants.X_OK);
      return name;
    } catch {
      return null;
    }
  }

  // Bare name: pass via positional arg ($1), never interpolated into the script.
  const res = await runProcess("/bin/sh", ["-c", 'command -v -- "$1" 2>/dev/null', "sh", name], { timeoutMs: 5000 });
  const path = res.stdout.trim().split("\n")[0];
  return path || null;
}
