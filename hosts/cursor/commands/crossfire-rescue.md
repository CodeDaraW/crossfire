# Crossfire rescue

Delegate an investigation or fix to another agent. Run exactly one command and
return its output verbatim. Do not read the repo or summarize on the executor's
behalf.

Before running the command, parse `$ARGUMENTS` for a named executor:

- Known executors are `claude`, `codex`, and `cursor` (case-insensitive).
- If the user names exactly one known executor in natural language, add
  `--executor <executor>` and do not treat that name as task request text.
- Pass the remaining substantive text as the task request.
- If no executor is named, pass `$ARGUMENTS` as the task request and let
  Crossfire choose the default non-self executor.
- Do not run the fixed form `crossfire rescue --self cursor "$ARGUMENTS"` when
  `$ARGUMENTS` contains an executor mention.

Examples:

```bash
crossfire rescue --self cursor "investigate the failing test"
crossfire rescue --self cursor --executor codex "fix the failing test"
crossfire rescue --self cursor --executor claude --read-only "diagnose the flaky smoke test"
```

If crossfire made code changes, recommend a follow-up `crossfire review`.
