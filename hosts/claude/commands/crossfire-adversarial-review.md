---
description: Adversarial design/risk challenge review by another agent (read-only).
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(crossfire:*), Bash(node:*), Bash(git:*)
---

Run a read-only adversarial review (challenge the design, find no-ship reasons) and
return the output verbatim. REVIEW-ONLY.

Before running the command, parse `$ARGUMENTS` for named reviewers:

- Known reviewers are `claude`, `codex`, and `cursor` (case-insensitive).
- If the user names one or more known reviewers in natural language, add
  `--reviewer <comma-separated-reviewers>` and do not treat those names as
  adversarial focus text.
- Pass only the remaining substantive text as the optional focus argument.
- If no reviewer is named, pass `$ARGUMENTS` as focus text.
- Do not run the fixed form
  `crossfire adversarial-review --self claude $ARGUMENTS` when `$ARGUMENTS`
  contains a reviewer mention.

```bash
crossfire adversarial-review --self claude
crossfire adversarial-review --self claude --reviewer codex
crossfire adversarial-review --self claude --reviewer cursor "focus on rollback risk"
```
