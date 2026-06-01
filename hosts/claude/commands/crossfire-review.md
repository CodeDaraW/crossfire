---
description: Cross-review the current changes with other agents (read-only).
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(crossfire:*), Bash(node:*), Bash(git:*)
---

Run a read-only cross-agent review of the current changes and return the output verbatim.

This is REVIEW-ONLY: do not modify any files, and do not turn findings into fixes.
For a large diff, run in the background and report the job id.

```bash
crossfire review --self claude $ARGUMENTS
```

After the command, present the findings faithfully and STOP. Ask the user before
making any change.
