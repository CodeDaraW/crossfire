# Crossfire Architecture

## Repository Layout

The project is now flattened into the repo root:

```text
bin/                 user-facing executable wrapper plus JS entrypoint
src/                 shared Node runtime
hosts/               thin host integration assets
skills/              portable skills and references
tests/               unit and integration tests with fake agents
scripts/             install and smoke helpers
docs/                product, architecture, decisions, plans, reviews
```

## Runtime Boundary

The Node CLI is the single source of behavior. Host assets must stay thin: they pass user intent and host identity to `crossfire`, then render or return the result. They should not duplicate Git context collection, reviewer selection, arbitration, state handling, or task delegation logic.

The installable executable is `bin/crossfire`. It is a small shell wrapper that
finds Node and then runs `bin/crossfire.mjs`. Internal re-entry paths such as
background workers can call `bin/crossfire.mjs` directly with `process.execPath`
to keep the worker on the same Node runtime. Fake-agent smoke tests exercise the
wrapper so the production executable is covered.

## Core Modules

- `src/cli/`: command dispatch and argument parsing.
- `src/git/`: repo root, target resolution, context collection, secret-path redaction, and mutation fingerprinting.
- `src/reviewers/`: review adapters for Cursor, Claude, and Codex.
- `src/executors/`: task delegation adapters for Cursor, Claude, and Codex.
- `src/runtime/`: process execution, environment scrubbing, config, jobs, state, review runner, and task runner.
- `src/prompts/`: prompt templates for review, adversarial review, gate, and task.
- `src/schema/`: tolerant extraction and normalization of reviewer JSON.
- `src/arbiter/`: deterministic multi-reviewer merge.
- `src/render/`: text renderers for review and task results.
- `src/install/`: host detection and asset installation.

## Review Flow

```text
host command / skill
  -> crossfire review
  -> load config and detect self
  -> resolve Git target
  -> collect deterministic context
  -> select available non-self reviewers
  -> build read-only review prompts
  -> invoke reviewer CLIs
  -> parse/normalize outputs
  -> compare repo pre/post fingerprint
  -> deterministic arbitration
  -> render text or JSON
```

Important constraints:

- Review is read-only even when the reviewer is a full coding agent.
- Context is collected by Crossfire, not left entirely to reviewer exploration.
- `repo_changed_during_review` must be represented as a safety issue.
- Raw reviewer output is preserved for background jobs.

## Task Delegation Flow

```text
host command / skill
  -> crossfire rescue or task
  -> load config and detect self
  -> select executor
  -> classify read-only/write intent
  -> build task prompt
  -> invoke executor CLI with matching permission mode
  -> compare repo pre/post fingerprint
  -> return task result, touched files, session info, warnings
```

The runtime detects content-level repository mutation via a working-tree
fingerprint, and the touched-file list uses a per-file content fingerprint
(`perFileFingerprint`/`diffFingerprints` in `src/git/repository.mjs`), so an
edit to a file that was already dirty before the task is still reported in
`touched_files`. This was a prior known issue and is now closed with regression
coverage (see `docs/IMPLEMENTATION_STATUS.md` and `docs/DECISIONS.md` D-012).

## State Model

State root:

```text
${CROSSFIRE_DATA_DIR:-$HOME/.crossfire}/state/<repo-slug>-<hash>/
  jobs/
    <job-id>.json
    <job-id>.result.json
    <job-id>.raw.<reviewer>.log
```

Design principles:

- Job files are the source of truth.
- `status` scans job files rather than relying on a central mutable index.
- Writes should be atomic.
- State should not be stored inside the target repo unless mutation detection excludes it.

## Configuration

Default config lives in `src/runtime/config.mjs`.

Config merge order:

1. defaults
2. user config at `${CROSSFIRE_CONFIG_HOME:-$HOME}/.crossfire/config.json`
3. repo config at `.crossfire/config.json`
4. command flags and environment handled by callers/adapters

Claude invocation:

Use the default `claude` CLI configuration for normal operation. Fixed leading
adapter args are supported for private, environment-specific user config, but
repository docs should not commit local settings paths.

The adapter path expands `~` in fixed args and injects those args into review/task invocations.

## Host Assets

- `skills/crossfire/`: main portable skill.
- `skills/crossfire-runtime/`: runtime usage guidance.
- `skills/crossfire-result-handling/`: how to handle and present results.
- `skills/crossfire-prompting/`: prompt patterns and anti-patterns.
- `hosts/claude/`: Claude slash commands, Stop hook, and task delegation agent.
- `hosts/cursor/`: Cursor command assets.

The intended shape is mixed integration: shared runtime plus portable skills, with native thin shells only where hooks or deterministic commands require them.

## Detailed Contracts

Detailed command, schema, state, gate, prompt, and verification contracts live
in `docs/SPEC.md`. Keep this architecture document focused on module boundaries
and runtime flow.

## Verification Layers

- Unit tests: `node --test tests/*.test.mjs`
- Fake-agent smoke: `node scripts/smoke.mjs` (invokes `bin/crossfire`)
- Real-agent E2E: manual matrix using authenticated Cursor, Codex, and Claude
- Adapter contract tests: required before declaring a CLI capability supported

Run `./init.sh` for the local deterministic baseline.
