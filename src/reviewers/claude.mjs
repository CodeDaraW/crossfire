import { which, runProcess } from "../runtime/process.mjs";
import { expandHomeArgs } from "../runtime/env.mjs";

export function createClaudeAdapter(config, env = process.env) {
  const bin = env.CROSSCHECK_CLAUDE_BIN || config?.reviewers?.claude?.bin || "claude";
  const fixedArgs = expandHomeArgs(config?.reviewers?.claude?.args, env);
  return {
    name: "claude",
    async detect() {
      const path = await which(bin);
      return { name: "claude", available: Boolean(path), path: path || null, bin };
    },
    async probeCapabilities(detect) {
      if (!detect.available) return { json_output: false, readonly_mode: false };
      const help = await runProcess(bin, ["--help"], { timeoutMs: 8000 });
      const h = (help.stdout + help.stderr).toLowerCase();
      return {
        print_mode: h.includes("--print") || h.includes("-p"),
        json_output: h.includes("--output-format"),
        permission_mode: h.includes("--permission-mode"),
        json_schema: h.includes("--json-schema"),
        allowed_tools: h.includes("--allowed-tools") || h.includes("--allowedtools"),
        readonly_mode: h.includes("--permission-mode"),
        native_review: false,
        authenticated: true,
      };
    },
    buildInvocation({ prompt, repoRoot, caps, model }) {
      const args = [...fixedArgs, "-p"];
      if (caps?.permission_mode) args.push("--permission-mode", "plan");
      if (caps?.allowed_tools) args.push("--allowed-tools", "Read,Glob,Grep");
      if (model) args.push("--model", model);
      // pass prompt via stdin to avoid arg length limits
      return { cmd: bin, args, cwd: repoRoot, input: prompt };
    },
  };
}
