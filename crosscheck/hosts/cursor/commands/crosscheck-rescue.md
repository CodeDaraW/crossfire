# Crosscheck rescue

Delegate an investigation or fix to another agent. Run exactly one command and return its output verbatim. Do not read the repo or summarize on the executor's behalf.

```bash
crosscheck rescue --self cursor "$ARGUMENTS"
```

If crosscheck made code changes, recommend a follow-up `crosscheck review`.
