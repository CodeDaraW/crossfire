---
description: Delegate investigation, an explicit fix request, or follow-up fix work to another agent.
disable-model-invocation: true
---

Use the crossfire-rescue subagent to delegate this request to another agent. The
subagent is a thin forwarder: it runs exactly one `crossfire rescue` and returns
the output. It must not read the repo or summarize on the executor's behalf.

Before invoking the subagent, parse `$ARGUMENTS` for a named executor:

- Known executors are `claude`, `codex`, and `cursor` (case-insensitive).
- If the user names exactly one known executor in natural language, tell the
  subagent to run `crossfire rescue --self claude --executor <executor> ...`.
- Do not treat the executor name as task request text.
- If no executor is named, pass `$ARGUMENTS` as the task request and let
  Crossfire choose the default non-self executor.

Request: $ARGUMENTS
