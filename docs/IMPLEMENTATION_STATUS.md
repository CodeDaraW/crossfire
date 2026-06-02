# Crossfire Implementation Status

Last updated: 2026-06-02 17:30 Asia/Shanghai

## Current Shape

The project has been flattened into the repository root. The previous nested `crossfire/` directory is gone from the working layout.

Main implementation directories:

- `bin/`
- `src/`
- `skills/`
- `hosts/`
- `tests/`
- `scripts/`
- `docs/`

## Implemented

- User-facing CLI wrapper: `bin/crossfire`
- Node CLI entrypoint: `bin/crossfire.mjs` for internal Node re-entry
- Commands: `doctor`, `setup`, `review`, `adversarial-review`, `rescue`, `task`, `gate`, `status`, `result`, `cancel`, `install`, `uninstall`
- Reviewer adapters: Cursor, Claude, Codex
- Executor adapters: Cursor, Claude, Codex
- Fixed adapter args with `~` expansion for private site-specific CLI requirements
- Git target/context collection for working-tree, branch, and commit
- Secret-path redaction for changed `.env`/key-like files
- Content-aware working tree fingerprint for mutation detection
- Tolerant JSON extraction and schema normalization
- Deterministic arbitration
- Background job state and raw output files
- Portable skills and thin host assets
- Unit and integration tests with fake agent CLIs
- Smoke script with fake agents that exercises the user-facing `bin/crossfire` wrapper
- Static host-asset tests that guard Cursor/Claude command prompts against
  blindly passing natural-language agent mentions as focus/request text

## Current Local Verification

Run from the flattened repo root:

```bash
./init.sh
```

Latest result from 2026-06-02 17:30 Asia/Shanghai:

- Node runtime: bundled Codex Node `v24.14.0`
- Unit/integration tests: 51 passed, 0 failed
- Smoke tests: `SMOKE OK`, via `bin/crossfire`

The harness fallback path is intentional: this non-interactive shell does not expose `node`/`npm`, so `init.sh` uses the bundled Node runtime and prepends it to `PATH` for fake-agent shebangs.

## Prior Real-Agent Verification

From the 2026-05-30 white-box and black-box pass before the repo flattening:

- `node --test tests/*.test.mjs`: 42 tests passed
- `node scripts/smoke.mjs`: passed; this smoke path now invokes `bin/crossfire`
- `crossfire --help` and `crossfire --version`: passed
- Branch and commit review with tracked `.env`: secret content did not leak; `omitted_files` recorded `.env`
- Real Cursor review: completed, schema-valid, no repo mutation
- Real Codex review: completed, schema-valid, no repo mutation
- Real Claude review: completed, schema-valid, no repo mutation
- Real Codex write-capable delegated task: created `rescue-note.txt`, recorded `touched_files=["rescue-note.txt"]`
- Background job with repo-external `CROSSFIRE_DATA_DIR`: completed and returned result

Real-agent E2E should be rerun after flattening for adapter, state, permission, and host-integration changes.

## Prior Findings Now Covered Locally

The following findings were open in the 2026-05-30 review but now have local regression coverage in the 2026-06-01 baseline.

### Reviewer non-zero exit can be misclassified as completed

File: `src/reviewers/registry.mjs`

Prior observed behavior:

- If a reviewer exits non-zero but writes stdout, Crossfire parses stdout and marks the reviewer `completed`.
- Example black-box reproduction: fake reviewer prints `ERROR: authentication failed` and exits 1; result has `status=completed`, `reviewer_failures=[]`.

Current regression evidence:

- Test `reviewer with non-zero exit + stdout error is marked failed, not completed` passes.

### Write rescue misses already-dirty touched files

File: `src/runtime/task-runner.mjs`

Prior observed behavior:

- If an executor modifies a file that was already dirty before the task, `repo_changed=true` but `touched_files=[]`.
- Current warning is not enough for auditability.

Current regression evidence:

- Test `write rescue records an edit to an already-dirty file in touched_files` passes.

### `review --background --json` emits text

File: `src/cli/commands/review.mjs`

Prior observed behavior:

- Background launch ignores JSON mode and prints human text with `Job ID: ...`.

Current regression evidence:

- Test `review --background --json returns a job object` passes.

### Repo-internal state dir pollutes mutation detection

Files: `src/runtime/state.mjs`, `src/runtime/jobs.mjs`, `src/runtime/review-runner.mjs`

Prior observed behavior:

- If `CROSSFIRE_DATA_DIR` points inside the target repo, background worker writes make the repo dirty during review.
- This can turn an approve arbitration into `needs-attention`.

Current regression evidence:

- Tests `stateExcludeDir returns top segment when data dir is inside repo` and `in-repo state dir does not flip approve to needs-attention (background)` pass.

### Background job status hides partial result status

File: `src/runtime/jobs.mjs`

Prior observed behavior:

- Job lifecycle status is set to `completed` for any result that is not `failed`, including `partial`.

Current regression evidence:

- Test `background job preserves partial result_status when a reviewer fails` passes.

## Remaining Work

1. Rerun real Cursor/Codex/Claude E2E after flattening.
2. Verify `scripts/install.mjs` host install/uninstall behavior after flattening.
3. Turn the manual real-agent matrix into a repeatable documented command set.
4. Keep `./init.sh` green after any implementation change.

## Entrypoint Notes

`bin/crossfire` is the installable/user-facing executable and is what smoke
tests exercise. It resolves symlinks, finds Node, and loads login-shell `PATH`
by default so GUI-launched coding agents can still find CLIs installed through
shell managers such as fnm/asdf/nvm. Set `CROSSFIRE_LOGIN_PATH=0` for
deterministic tests or environments that must not read login-shell `PATH`.

`bin/crossfire.mjs` remains the JS entrypoint. Integration tests and background
workers may call it with `process.execPath` by design so they run with the same
Node runtime instead of going through another shell wrapper.

## Real-Agent E2E Notes

Use an external state dir during E2E:

```bash
export CROSSFIRE_DATA_DIR="$(mktemp -d)"
```

Claude should use the default CLI configuration unless a private local test
environment explicitly overrides adapter args outside committed docs.

Suggested matrix:

- `crossfire doctor --json`
- Cursor as reviewer
- Codex as reviewer
- Claude as reviewer
- background review plus `status --wait` and `result --json`
- gate ALLOW/BLOCK path
- write-capable and read-only delegated tasks
- branch and commit target review with redacted secret-path changes
