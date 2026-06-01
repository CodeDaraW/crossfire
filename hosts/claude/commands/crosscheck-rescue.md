---
description: Delegate an investigation or fix to another agent (rescue lane).
disable-model-invocation: true
---

Use the crosscheck-rescue subagent to delegate this request to another agent. The
subagent is a thin forwarder: it runs exactly one `crosscheck rescue` and returns
the output. It must not read the repo or summarize on the executor's behalf.

Request: $ARGUMENTS
