---
name: crosscheck-result-handling
description: How to present crosscheck review/task results. Use after running crosscheck. Show findings faithfully, never auto-apply fixes, and never invent results when an agent did not actually run.
---

# crosscheck-result-handling

- Present reviewer findings faithfully: severity, file/line, recommendation, source.
- Keep raw output available; do not compress away paths, line numbers, or errors.
- After a review, STOP. Ask the user before changing any code. Never auto-fix.
- If an executor/reviewer did not run successfully, say so. Do NOT fabricate a
  substitute answer or pretend the review happened.
- For write rescues, list touched files and recommend a follow-up `crosscheck review`.
