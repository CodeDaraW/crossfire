# Crossfire Current Specification

This document preserves the useful implementation contracts that used to live
in the historical planning and review process docs. It should be read with
`docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, and `docs/DECISIONS.md`.

## Command Surface

Main entry:

```bash
crossfire <command> [options] [focus...]
```

Commands:

- `doctor`: read-only Git/agent capability diagnosis.
- `setup`: check and optionally configure/install host assets.
- `review`: normal read-only cross-agent review.
- `adversarial-review`: read-only challenge review focused on release/design risk.
- `gate`: stop-time ALLOW/BLOCK review gate.
- `rescue`: user-facing task delegation for investigation or fix work.
- `task`: thin internal task runtime for executor delegation.
- `status`: list or inspect background jobs.
- `result`: render a finished job result and optional raw reviewer output.
- `cancel`: terminate an active job.
- `install` / `uninstall`: install or remove host integration assets.

Common flags:

- `--self <cursor|claude|codex>`: explicit host identity.
- `--reviewer a,b,c`: reviewer allowlist for review lane.
- `--executor a`: executor selection for rescue/task lane.
- `--only a`: single reviewer/executor selector.
- `--allow-self`: allow current host to be included.
- `--base <ref>`: branch comparison base.
- `--commit <sha>`: commit review target.
- `--scope auto|working-tree|branch`: target selection hint.
- `--wait` / `--background`: foreground or detached job execution.
- `--format text|json` or `--json`: render mode.
- `--timeout-ms <ms>`: per-agent timeout.
- `--model <name>`: optional model pass-through when an adapter supports it.
- `--previous-turn-file <path>`: gate input from host integration.
- `--with`: compatibility alias for `--reviewer`.

## Target Resolution

Target modes:

- `working-tree`: staged, unstaged, and untracked changes.
- `branch`: `merge-base(base, HEAD)...HEAD`.
- `commit`: one specific commit.

Resolution order:

1. `--commit` selects commit mode.
2. `--base` or `--scope branch` selects branch mode.
3. `--scope working-tree` selects working-tree mode.
4. `auto` selects working-tree when dirty; otherwise it tries default branch detection.

Default base detection: `origin/HEAD`, `origin/main`, `origin/master`, `main`, then `master`.

## Context Collection

Crossfire deterministically extracts reviewer context before invoking agents.

Working-tree context includes status, staged diff, unstaged diff, diff stat,
changed file list, and small untracked file contents. Branch/commit context
includes changed file list, diff stat, patch text, and commit/status text where
relevant.

Context modes:

- `inline-full`: full diff is included in the prompt.
- `inline-summary`: large diff is truncated and marked lower-confidence.
- `repo-readonly`: context is too large for full inline confidence; reviewer still runs with read-only policy in the repo.

Secret-path handling:

- Secret-looking changed paths are recorded in `omitted_files` and excluded from diff/stat context.
- Default patterns include `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa`, and `id_ed25519`.

State-dir handling:

- If `CROSSFIRE_DATA_DIR` is inside the target repo, Crossfire excludes that top-level state directory from context and mutation fingerprints.
- Repo-external state remains the preferred default.

## Reviewer Contract

Reviewer entries are built from Cursor, Claude, and Codex adapters. Detection is
PATH-based first; expensive capability probes are lazy except in `doctor`.

Default reviewer selection:

- requested `--only` or `--reviewer` wins.
- if no explicit reviewer flag is present and all review positionals are known agent names, treat them as a host-command shorthand for `--reviewer`.
- otherwise use all available reviewers except `self`.
- unknown `self` warns and does not exclude any reviewer.
- no usable reviewer is an error, not silent self-review.

Reviewer statuses:

- `completed`
- `failed`
- `timeout`
- `skipped`

Important failure rule:

- Non-zero reviewer exit is a failure even when stdout is non-empty.
- This prevents auth/CLI errors printed to stdout from becoming fake review coverage.

Adapter flags are probed and guarded by tests. Do not infer current CLI support
from old design text.

## Executor Contract

Executor selection:

- requested `--only` or `--executor` wins.
- otherwise priority is `codex`, then `claude`, then `cursor`, excluding `self`.

Task mode:

- `read-only`: diagnosis/investigation only.
- `write`: scoped edits allowed.

Intent classification:

- fix/implement/apply/update style requests lean write.
- investigate/review/diagnose/research style requests lean read-only.
- ambiguous requests default read-only.
- explicit `--write` / `--read-only` overrides classification.

Write auditing:

- Crossfire records pre/post status and content-aware working tree fingerprints.
- Write mode uses per-file fingerprints so edits to already-dirty files appear in `touched_files`.
- Read-only mode that mutates the repo returns an error and warning.

Session extraction:

- `sessionId` is best-effort from executor stdout fields such as `session_id` or `resume_id`.
- `resumeHint` is reserved for future richer resume support.

## Output Contracts

Reviewer output after normalization:

```json
{
  "verdict": "approve|needs-attention",
  "summary": "string",
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "title": "string",
      "body": "string",
      "file": "relative/path or null",
      "line_start": 1,
      "line_end": 1,
      "confidence": 0.8,
      "recommendation": "string"
    }
  ],
  "next_steps": ["string"]
}
```

Task result:

```json
{
  "name": "codex|claude|cursor",
  "status": "ok|error|timeout",
  "mode": "read-only|write",
  "summary": "string",
  "final_message": "string",
  "touched_files": ["relative/path"],
  "pre_status": "string",
  "post_status": "string",
  "repo_changed": false,
  "sessionId": null,
  "resumeHint": null,
  "error": null,
  "warnings": []
}
```

Review result includes:

- `version`, `kind`, `status`, `self`
- `target` with mode, cwd, changed files, diff stat, context mode, truncation, omitted files
- `reviewers[]`
- `arbitration`
- `safety`
- `follow_up_commands`

Status word boundaries:

- Reviewer verdict: `approve` or `needs-attention`.
- Aggregate verdict: `approve`, `needs-attention`, or `blocked-by-review-failure`.
- Result status: `completed`, `partial`, or `failed`.
- Job lifecycle status: `queued`, `running`, `completed`, `failed`, or `canceled`.
- Job `result_status` preserves `completed|partial|failed` when lifecycle status is `completed`.

## Arbitration

Default arbitration is deterministic.

Rules:

- Similar findings are merged by file/line/title similarity.
- Highest severity and confidence are preserved when findings merge.
- Sources are retained for every merged finding.
- Critical/high findings are surfaced as highest-risk.
- Reviewer failures never count as approvals.
- If all reviewers fail, aggregate verdict is `blocked-by-review-failure`.

LLM arbitration is not the default. If added later, it must not invent findings
or overwrite raw reviewer results.

## Background Jobs

State root:

```text
${CROSSFIRE_DATA_DIR:-$HOME/.crossfire}/state/<repo-slug>-<hash>/
  jobs/<job-id>.json
  jobs/<job-id>.result.json
  jobs/<job-id>.raw.<reviewer>.log
```

Lifecycle:

1. `--background` writes a queued job record.
2. Parent spawns a detached worker and returns a launch payload.
3. Worker updates heartbeat and phase.
4. Worker writes stripped result JSON plus raw reviewer logs.
5. Worker marks lifecycle `completed` or `failed`, and records `result_status`.

Reliability rules:

- Job JSON writes use temp file, fsync, and rename.
- `status` scans `jobs/*.json`; no central state file is required as source of truth.
- Running jobs with dead pid or stale heartbeat reconcile to failed.
- `cancel` terminates the process group where possible.

## Gate Contract

Gate is review-lane and read-only.

Previous-turn file shape:

```json
{
  "host": "claude|cursor|codex",
  "turn_id": "string",
  "kind": "stop|manual",
  "workspace": "/absolute/repo/root",
  "response_text": "string",
  "changed_files_before": ["path"],
  "changed_files_after": ["path"],
  "commands": [
    {
      "cmd": "string",
      "exit_code": 0,
      "touched_files": ["path"]
    }
  ],
  "generated_at": "ISO-8601"
}
```

Rules:

- If the file is missing, unreadable, or workspace-mismatched, gate falls back to current Git delta with low confidence.
- If previous-turn data shows no code changes, gate returns `ALLOW`.
- Reviewer first line must be `ALLOW: <reason>` or `BLOCK: <reason>`.
- Only Claude Stop hook is treated as blocking in the current product contract; other hosts are advisory unless proven otherwise.
- `CROSSFIRE_CHILD=1` disables recursive gate behavior.

## Configuration

Merge order:

1. defaults in `src/runtime/config.mjs`
2. user config at `${CROSSFIRE_CONFIG_HOME:-$HOME}/.crossfire/config.json`
3. repo config at `.crossfire/config.json`
4. command flags and environment handled by callers/adapters

Defaults:

- reviewer bins: `cursor-agent`, `claude`, `codex`
- reviewer args: empty arrays
- reviewer timeout: `600000ms`
- max inline diff bytes: `262144`
- max untracked file bytes: `24576`
- background threshold files: `3`
- gate timeout: `900000ms`

Fixed adapter args:

- `reviewers.<agent>.args` are private, site-specific leading CLI args.
- A leading `~` in an arg expands to `$HOME`.
- Do not commit local settings paths in repo docs or shared config.

## Prompt Contracts

Prompt sources live in `src/prompts/`.

Review prompt must enforce independent review, material defects only, no
style-only feedback, grounded file/line findings, structured JSON output, and
explicit confidence when context is truncated.

Adversarial review adds release/design risk framing, assumption challenge, and
a high bar for no-ship findings.

Task/rescue prompt must enforce mode label, no edits in read-only mode, scoped
edits in write mode, verification before final response, and touched-file
reporting by executor with runtime audit as backstop.

## Verification Matrix

Baseline:

```bash
./init.sh
```

Required local checks:

- unit/integration tests with fake CLIs
- smoke script with fake agents
- JSON fixture parsing
- state and background job behavior
- safety/mutation checks

Real-agent E2E should cover:

- `crossfire doctor --json`
- Cursor reviewer
- Codex reviewer
- Claude reviewer
- background review plus `status --wait` and `result --json`
- gate ALLOW/BLOCK path
- write-capable and read-only delegated tasks
- branch and commit targets with redacted secret-path changes

## Non-Goals

- Do not implement a shell-only engine.
- Do not let review automatically fix code.
- Do not treat self-review as cross-review.
- Do not use historical plan text as proof that a vendor CLI flag works today.
- Do not store machine-local settings paths in committed docs or shared config.
