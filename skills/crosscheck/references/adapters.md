# Reviewer / executor adapters

| Agent | Reviewer call (read-only) | Executor write call | Notes |
| --- | --- | --- | --- |
| cursor | `cursor-agent -p --mode ask [--trust] <prompt>` | `cursor-agent -p <prompt>` | `--trust` only for the resolved repo; never `--force`/`--yolo` |
| claude | `claude -p --permission-mode plan --allowed-tools Read,Glob,Grep` (stdin) | `claude -p --permission-mode acceptEdits` | configurable via `CROSSCHECK_CLAUDE_BIN` |
| codex | `codex exec --sandbox read-only <prompt>` | `codex exec --sandbox workspace-write <prompt>` | native `codex review` may be used when available |

Capabilities are probed at runtime (`crosscheck doctor`); flags are never assumed
without verification. Reviewers run in the repo root with read-only permissions;
the engine extracts the diff deterministically.

## Fixed args (site-specific CLI flags)

Each agent accepts `bin` plus fixed leading `args` in config, injected before
crosscheck's own flags. This supports private local CLI requirements without
requiring a wrapper script. Do not commit machine-local settings paths in shared
repo config or docs.

```json
{ "reviewers": { "claude": { "bin": "claude", "args": [] } } }
```

A leading `~` in an arg is expanded to `$HOME`. The same `bin`/`args` are reused
for the executor (rescue/task) lane.
