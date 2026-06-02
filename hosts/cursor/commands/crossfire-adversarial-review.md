# Crossfire adversarial review

Run a read-only adversarial (design/risk challenge) review and return the output
verbatim. REVIEW-ONLY.

Before running the command, parse `$ARGUMENTS` for named reviewers:

- Known reviewers are `claude`, `codex`, and `cursor` (case-insensitive).
- If the user names one or more known reviewers in natural language, add
  `--reviewer <comma-separated-reviewers>` and do not treat those names as
  adversarial focus text.
- Pass only the remaining substantive text as the optional focus argument.
- If no reviewer is named, pass `$ARGUMENTS` as focus text.
- Do not run the fixed form
  `crossfire adversarial-review --self cursor "$ARGUMENTS"` when `$ARGUMENTS`
  contains a reviewer mention.

Examples:

```bash
crossfire adversarial-review --self cursor
crossfire adversarial-review --self cursor --reviewer codex
crossfire adversarial-review --self cursor --reviewer claude "focus on rollback risk"
```
