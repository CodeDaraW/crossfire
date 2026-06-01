import { which, runProcess } from "../runtime/process.mjs";
import { expandHomeArgs } from "../runtime/env.mjs";

export function createCursorAdapter(config) {
  const bin = config?.reviewers?.cursor?.bin || "cursor-agent";
  const fixedArgs = expandHomeArgs(config?.reviewers?.cursor?.args);
  return {
    name: "cursor",
    async detect() {
      const path = await which(bin);
      return { name: "cursor", available: Boolean(path), path: path || null, bin };
    },
    async probeCapabilities(detect) {
      if (!detect.available) return { json_output: false, readonly_mode: false };
      const help = await runProcess(bin, ["--help"], { timeoutMs: 8000 });
      const h = (help.stdout + help.stderr).toLowerCase();
      const status = await runProcess(bin, ["status"], { timeoutMs: 8000 });
      const authenticated = status.code === 0 && !/not logged in|unauthenticated|please log in/i.test(status.stdout + status.stderr);
      return {
        json_output: h.includes("--output-format"),
        readonly_mode: h.includes("--mode"),
        workspace_arg: h.includes("--workspace"),
        trust_flag: h.includes("--trust"),
        native_review: false,
        authenticated,
      };
    },
    buildInvocation({ prompt, repoRoot, caps, model }) {
      const args = [...fixedArgs, "-p"];
      if (caps?.readonly_mode) args.push("--mode", "ask");
      if (caps?.trust_flag && repoRoot) args.push("--trust");
      if (model) args.push("--model", model);
      args.push(prompt);
      return { cmd: bin, args, cwd: repoRoot };
    },
  };
}
