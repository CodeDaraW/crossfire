# Crosscheck Decision Log

This log records durable decisions from the planning docs and the user/Codex/Claude design discussion. It is the preferred source when historical plan files conflict.

## D-001: codex-plugin-cc is the completeness benchmark

Status: accepted

Crosscheck should match the capability class of `openai/codex-plugin-cc`, including review, adversarial review, rescue/task, background jobs, status/result/cancel, setup/doctor, prompt skill suite, gate, schema output, and resume/session handling.

Rejected alternative: build a small demo or a simple prompt wrapper around `git diff`.

## D-002: Do not split product scope by implementation cost

Status: accepted

The user explicitly does not want a phase split based on AI development cost. Adapter probes, smoke tests, and implementation ordering still matter, but they are support gates and dependency order, not scope cuts.

Rejected alternative: defer background jobs, gate, rescue/task, or prompt skills to a later "final" version.

## D-003: Node CLI is the only behavior runtime

Status: accepted

The runtime owns argument parsing, Git context, reviewer/executor invocation, schema normalization, job state, rendering, and arbitration. Host integrations are thin wrappers.

Rejected alternative: Bash-first engine or three independent host implementations.

## D-004: Default reviewer set excludes self

Status: accepted

Crosscheck is a cross-agent tool. By default it uses available non-self reviewers. Self-review is allowed only when explicit and must be marked.

Rejected alternative: silently fall back to self-review when no other agent is available.

## D-005: Review lane and rescue/task lane are separate

Status: accepted

`review`, `adversarial-review`, and `gate` are always read-only. `rescue` and `task` are the only write-capable path and must record their safety state.

Rejected alternative: let review automatically apply fixes.

## D-006: Review safety is not defined by scratch cwd alone

Status: accepted

Reviewer execution must preserve enough repo context for real review. The safety boundary is read-only permission mode, tool restrictions, env scrubbing, deterministic context collection, and pre/post mutation checks.

Rejected alternative: treat an empty scratch directory as the primary safety model for all reviewers.

## D-007: Deterministic arbitration is the default

Status: accepted

Crosscheck merges findings deterministically by source, file, line, severity, and similarity. An LLM arbiter can be optional later, but it cannot invent new findings or hide reviewer failures.

Rejected alternative: default to an LLM arbiter that rewrites the review result.

## D-008: State must be stable and outside the repo by default

Status: accepted

Background job state should live under `~/.crosscheck` or an explicit external `CROSSCHECK_DATA_DIR`. Storing state inside the target repo currently pollutes mutation detection and can flip review verdicts.

Rejected alternative: default to `$TMPDIR` or repo-local state.

## D-009: Host integration is mixed

Status: accepted

Use a shared runtime and portable skills for the common interaction model. Add native thin shells where host features require them, especially Claude Stop hook and rescue subagent behavior.

Rejected alternatives:

- Pure portable skill, which cannot provide all hook/subagent semantics.
- Full per-host native implementation, which risks behavior drift.

## D-010: Adapter capability must be probed, not guessed

Status: accepted

CLI flags and auth behavior drift. `doctor`, help probes, contract tests, and real E2E determine supported capabilities. Historical docs should not be treated as proof that a flag works today.

Rejected alternative: hard-code guessed Cursor/Claude/Codex flags from old docs.

## D-011: Claude uses default CLI config by default

Status: accepted

Crosscheck should invoke `claude` through the default CLI configuration unless
the user explicitly supplies environment-specific fixed args in private user
config. Repository docs and examples must not include local Claude settings
paths.

Crosscheck still supports `reviewers.claude.args` as a generic adapter feature,
but project docs should describe it without committing machine-local paths.

## D-012: Prior white-box findings must remain regression-gated

Status: accepted

The 2026-05-30 white-box/black-box pass found five product issues:

- reviewer non-zero exit with stdout misclassified as completed
- write rescue missing `touched_files` for already-dirty files
- `review --background --json` emitting text instead of JSON
- repo-internal `CROSSCHECK_DATA_DIR` polluting mutation detection
- background job lifecycle status hiding partial result status

As of 2026-06-01, the flattened repo baseline has tests covering these cases and `./init.sh` passes. Keep these tests as regression gates before adding more automation.
