---
description: Delegate investigation, an explicit fix request, or follow-up fix work to another agent.
disable-model-invocation: true
---

Use the crossfire-rescue subagent to delegate this request to another agent. The
subagent is a thin forwarder: it runs exactly one `crossfire rescue` and returns
the output. It must not read the repo or summarize on the executor's behalf.

Request: $ARGUMENTS
