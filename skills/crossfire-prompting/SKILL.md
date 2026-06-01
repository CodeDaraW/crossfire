---
name: crossfire-prompting
description: How to tighten a user's rescue/task request into a better delegation prompt for crossfire. Use only to sharpen the request text, not to solve the task in the host agent.
---

# crossfire-prompting

Use this only to convert a vague user request into a crisp delegation prompt.

- State the concrete goal and the repository.
- Make the success criteria explicit and verifiable.
- Mark read-only vs write intent clearly; default to read-only when ambiguous.
- Do not embed routing flags into the task text.
- Do not attempt to solve the task in the host; the executor does the work.

See `references/prompt-blocks.md`, `references/recipes.md`, `references/antipatterns.md`.
