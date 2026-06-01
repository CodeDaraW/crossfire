---
name: crosscheck-runtime
description: Internal runtime contract for invoking the crosscheck CLI. Use when forwarding a review/rescue/task to crosscheck. Select and run exactly ONE crosscheck command, keep its stdout verbatim, and never solve the task yourself.
---

# crosscheck-runtime

- Choose exactly one `crosscheck <command>` invocation for the request.
- Normalize routing flags yourself (`--background`, `--wait`, `--resume`, `--fresh`,
  `--reviewer`, `--executor`, `--self`, `--model`, `--effort`); never treat them as
  part of the natural-language task text.
- Run the command once. Return its stdout unmodified.
- Do not read the repository, grep, or summarize on the agent's behalf.
- On failure, surface the error and the `crosscheck doctor` fix steps.
