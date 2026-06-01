import { which, runProcess } from "../runtime/process.mjs";
import { expandHomeArgs } from "../runtime/env.mjs";

export function createCodexAdapter(config) {
  const bin = config?.reviewers?.codex?.bin || "codex";
  const fixedArgs = expandHomeArgs(config?.reviewers?.codex?.args);
  return {
    name: "codex",
    async detect() {
      const path = await which(bin);
      return { name: "codex", available: Boolean(path), path: path || null, bin };
    },
    async probeCapabilities(detect) {
      if (!detect.available) return { json_output: false, readonly_mode: false };
      const help = await runProcess(bin, ["--help"], { timeoutMs: 8000 });
      const h = (help.stdout + help.stderr).toLowerCase();
      const execHelp = await runProcess(bin, ["exec", "--help"], { timeoutMs: 8000 });
      const eh = (execHelp.stdout + execHelp.stderr).toLowerCase();
      return {
        has_exec: h.includes("exec") || eh.length > 0,
        native_review: h.includes("review"),
        sandbox_flag: eh.includes("--sandbox") || h.includes("--sandbox"),
        readonly_mode: eh.includes("read-only") || eh.includes("--sandbox"),
        json_output: eh.includes("--json") || eh.includes("--output"),
        authenticated: true,
      };
    },
    buildInvocation({ prompt, repoRoot, caps, model }) {
      // Default path: non-interactive exec in read-only sandbox.
      const args = [...fixedArgs, "exec"];
      if (caps?.sandbox_flag) args.push("--sandbox", "read-only");
      if (model) args.push("--model", model);
      args.push(prompt);
      return { cmd: bin, args, cwd: repoRoot, input: "" };
    },
  };
}
