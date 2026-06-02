# Crossfire Product Contract

## Purpose

Crossfire is a cross-agent code review and task delegation system for Codex, Cursor, and Claude Code. It generalizes the `codex-plugin-cc` idea from a one-way "Claude Code calls Codex" workflow into a multi-host system where the current host can ask other coding agents to review code or handle a delegated task.

The product target is the complete `codex-plugin-cc` style capability set, not a demo. Implementation cost is not used to shrink product scope.

## Users

- A developer working in Codex, Cursor, or Claude Code who wants independent code review from another coding agent.
- A developer who wants to delegate a focused investigation or fix to another agent while preserving review safety.
- A future agent session that needs a durable, testable workflow rather than ad hoc prompts.

## Two Lanes

### Review Lane

Commands:

- `review`
- `adversarial-review`
- `gate`

Contract:

- Always read-only.
- Default reviewer set is all available non-self agents.
- Self review requires explicit opt-in through `--allow-self` or a direct `--only` selection.
- Crossfire collects Git context, invokes reviewers, normalizes output, stores raw output, and deterministically arbitrates findings.
- Code review must never auto-fix code. If a fix is desired, use the task delegation lane and then review the result.

### Task Delegation Lane

Commands:

- `rescue`
- `task`

Contract:

- This is the only write-capable lane.
- Explicit `--write` and `--read-only` override intent classification.
- Fix/implement/apply/update style requests may become write-capable.
- Investigate/review/diagnose/research style requests remain read-only.
- Write-capable results must preserve executor output, repo mutation state, touched files, and session/resume hints.

## Required User-Facing Commands

- `doctor`: diagnose Git, CLIs, auth, and adapter capability.
- `setup`: configure/install host integrations.
- `review`: normal code review.
- `adversarial-review`: challenge design assumptions and release safety.
- `gate`: stop/review gate, blocking only where the host supports it.
- `rescue`: user-facing task delegation entry.
- `task`: thin internal task runtime.
- `status`: inspect background jobs.
- `result`: retrieve completed job output and raw reviewer logs.
- `cancel`: cancel active jobs.
- `install` / `uninstall`: install or remove host assets.

## Safety Requirements

- Review/gate/adversarial commands run with read-only policy and detect repo mutation before/after.
- Dangerous agent flags are not allowed in review invocation.
- Child invocations set `CROSSFIRE_CHILD=1` to avoid recursive gate loops.
- Environment variables are scrubbed before spawning agent CLIs.
- Secret-looking changed paths such as `.env`, `.env.*`, private keys, and certificates are omitted from prompt context and recorded in `omitted_files`.
- State data should live outside the target repo by default. Repo-internal state dirs can corrupt mutation detection.

## Completion Benchmark

Crossfire is considered product-complete only when these are all true:

- Cursor, Claude, and Codex adapters have tested review and task invocation contracts.
- Review-only lane cannot silently mutate the repo.
- Delegated task write changes are auditable, including changes to pre-dirty files.
- Background jobs survive normal CLI return, expose status/result/cancel, and do not hide partial coverage.
- Real E2E covers Cursor review, Codex review, Claude review, background review, gate, and write delegation.

## Current Documentation

- `docs/SPEC.md`: detailed current command, schema, state, gate, and verification contracts.
- `docs/ARCHITECTURE.md`: runtime structure and module boundaries.
- `docs/DECISIONS.md`: durable decisions extracted from the multi-agent planning/review process.
- `docs/IMPLEMENTATION_STATUS.md`: verified state, regression coverage, and remaining work.
