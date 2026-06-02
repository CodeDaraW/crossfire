---
description: Cross-review the current changes with other agents (read-only).
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(crossfire:*), Bash(node:*), Bash(git:*)
---

Run a read-only cross-agent review of the current changes and return the output verbatim.

This is REVIEW-ONLY: do not modify any files, and do not turn findings into fixes.
For a large diff, run in the background and report the job id.

Before running the command, parse `$ARGUMENTS` for named reviewers:

- Known reviewers are `claude`, `codex`, and `cursor` (case-insensitive).
- If the user names one or more known reviewers in natural language, add
  `--reviewer <comma-separated-reviewers>` and do not treat those names as
  review focus text.
- Pass only the remaining substantive text as the optional focus argument.
- If no reviewer is named, pass `$ARGUMENTS` as focus text.
- Do not run the fixed form `crossfire review --self claude $ARGUMENTS` when
  `$ARGUMENTS` contains a reviewer mention.

```bash
crossfire review --self claude
crossfire review --self claude --reviewer codex
crossfire review --self claude --reviewer cursor,codex "focus on rollback risk"
```

After the command, present the findings faithfully and STOP. Ask the user before
making any change.
