# Prompt blocks

Reusable XML blocks for delegation prompts:

- `<task>`: concrete goal + repository + read-only/write mode.
- `<default_follow_through_policy>`: take the reasonable low-risk path and keep going.
- `<action_safety>`: scoped edits + list touched files (write); no edits (read-only).
- `<verification_loop>`: verify against the request before finalizing.
