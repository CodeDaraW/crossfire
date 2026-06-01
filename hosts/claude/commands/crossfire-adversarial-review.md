---
description: Adversarial design/risk challenge review by another agent (read-only).
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(crossfire:*), Bash(node:*), Bash(git:*)
---

Run a read-only adversarial review (challenge the design, find no-ship reasons) and
return the output verbatim. REVIEW-ONLY.

```bash
crossfire adversarial-review --self claude $ARGUMENTS
```
