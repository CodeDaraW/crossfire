# Crossfire review

Run a read-only cross-agent review of the current changes and return the output
verbatim. REVIEW-ONLY: do not modify files or turn findings into fixes.

Before running the command, parse `$ARGUMENTS` for named reviewers:

- Known reviewers are `claude`, `codex`, and `cursor` (case-insensitive).
- If the user names one or more known reviewers in natural language, add
  `--reviewer <comma-separated-reviewers>` and do not treat those names as
  review focus text.
- Pass only the remaining substantive text as the optional focus argument.
- If no reviewer is named, pass `$ARGUMENTS` as focus text.
- Do not run the fixed form `crossfire review --self cursor "$ARGUMENTS"` when
  `$ARGUMENTS` contains a reviewer mention.

Examples:

```bash
crossfire review --self cursor
crossfire review --self cursor --reviewer codex
crossfire review --self cursor --reviewer claude,codex "focus on rollback risk"
```
