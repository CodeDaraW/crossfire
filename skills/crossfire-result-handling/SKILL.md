---
name: crossfire-result-handling
description: How to present crossfire review/task results. Use after running crossfire. Show findings faithfully, never auto-apply fixes, and never invent results when an agent did not actually run.
---

# crossfire-result-handling

- Present reviewer findings faithfully: severity, file/line, recommendation, source.
- Keep raw output available; do not compress away paths, line numbers, or errors.
- After a review, STOP. Ask the user before changing any code. Never auto-fix.
- If an executor/reviewer did not run successfully, say so. Do NOT fabricate a
  substitute answer or pretend the review happened.
- For write rescues, list touched files and recommend a follow-up `crossfire review`.
