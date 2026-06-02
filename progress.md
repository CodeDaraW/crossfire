# Session Progress Log

## Current State

**Last Updated:** 2026-06-02 17:30 Asia/Shanghai
**Active Feature:** feat-005 - Host integration assets
**Repository Shape:** Project was flattened from `crossfire/` into the repo root. Runtime files now live at `bin/`, `src/`, `skills/`, `hosts/`, `tests/`, and `docs/`.

## Status

### What's Done

- [x] Historical planning/review content has been extracted into the current docs.
- [x] Implementation exists in the flattened repo root.
- [x] Harness template files were initialized:
  - `AGENTS.md`
  - `feature_list.json`
  - `progress.md`
  - `session-handoff.md`
  - `init.sh`
- [x] Prior white-box and black-box review found a concrete issue set:
  - reviewer non-zero exit classification
  - `touched_files` missing already-dirty file edits
  - `review --background --json` emitting text
  - repo-internal state dir polluting mutation detection
  - background job status hiding partial result status
- [x] Current baseline now has regression coverage for that issue set.
- [x] `./init.sh` passes in the flattened repo root.
- [x] Remaining useful details from the five historical process docs have been extracted into `docs/SPEC.md`.
- [x] The five historical process docs have been removed.
- [x] README now documents install, per-project initialization, optional project config, and quick manual tests.
- [x] README has been reorganized in a `codex-plugin-cc`-style structure and `README.zh-Hans.md` has been added.
- [x] License metadata now aligns with `openai/codex-plugin-cc` using Apache-2.0, with acknowledgements added to both READMEs.
- [x] README now presents Crossfire as an agent skill/command workflow first, with the CLI documented as the shared runtime/debug layer.
- [x] Project naming has been changed to Crossfire across package metadata, CLI binary, host commands, skills, config/state directories, environment variables, docs, and tests.
- [x] Cursor and Claude review/adversarial/rescue host commands now instruct the
  host agent to parse natural-language agent mentions into `--reviewer` or
  `--executor` instead of blindly passing `$ARGUMENTS` as focus/request text.
- [x] `tests/host-assets.test.mjs` guards the named reviewer/executor parsing
  instructions for Cursor and Claude command assets.

### What's In Progress

- [x] Fix host command natural-language agent selection drift.
  - Details: Cursor `/crossfire-review 让 Codex 看看` was reported to fan out to all non-self reviewers because the command template passed the full phrase as focus text. Cursor and Claude review/adversarial/rescue commands now document explicit reviewer/executor extraction rules.
  - Blockers: none.

### What's Next

1. Rerun the real-agent E2E matrix after flattening.
2. Verify `scripts/install.mjs` against real Codex/Cursor/Claude host locations.
3. Document repeatable real-agent E2E commands and expected assertions.

## Blockers / Risks

- [x] The repo's default shell environment may not expose `node`/`npm`; `init.sh` now falls back to the bundled Codex Node runtime when available and exports that directory into `PATH`.
- [x] Historical process docs have been removed after useful content was extracted into current docs.
- [ ] Real-agent E2E uses user accounts and should run intentionally, not as part of every baseline check.

## Decisions Made

- **Use codex-plugin-cc as the completeness benchmark**:
  - Context: The target is not a demo and should include code review, task delegation, background jobs, gate, setup/doctor, prompt skills, schema output, and resume/session handling.
  - Alternatives considered: A smaller prompt-wrapper or review-only skill was rejected.
- **Node CLI is the single runtime**:
  - Context: Argument parsing, Git context, schema normalization, state, jobs, and arbitration need one source of truth.
  - Alternatives considered: Bash-first and per-host implementations were rejected.
- **Keep review and task delegation as separate lanes**:
  - Context: Review/adversarial/gate must stay read-only; write capability belongs only to delegated tasks.
  - Alternatives considered: Letting review auto-fix was rejected.
- **Default deterministic arbitration**:
  - Context: Multi-reviewer aggregation must be reproducible and must not invent findings.
  - Alternatives considered: Default LLM arbiter was rejected; LLM arbiter can be optional later.
- **Use mixed host integration**:
  - Context: Portable skills cover common triggering, while native thin shells are needed for hooks/subagents.
  - Alternatives considered: Pure portable skill and full per-host native implementations were both too limiting in one direction.

## Files Modified This Session

- `AGENTS.md` - Project-specific harness guidance.
- `init.sh` - Robust baseline verification with npm or direct Node fallback.
- `feature_list.json` - Real feature state tracker.
- `progress.md` - Current continuity log.
- `session-handoff.md` - Next-session handoff.
- `README.md` - Correct flattened-doc links.
- `README.zh-Hans.md` - Simplified Chinese README.
- `LICENSE` - Apache-2.0 license text aligned with `openai/codex-plugin-cc`.
- `package.json` - License metadata aligned to Apache-2.0.
- `package-lock.json` - Root package license metadata aligned to Apache-2.0.
- `bin/crossfire` - User-facing executable wrapper.
- `bin/crossfire.mjs` - Renamed CLI entrypoint.
- `hosts/claude/commands/crossfire-*.md` - Renamed Claude commands.
- `hosts/cursor/commands/crossfire-*.md` - Renamed Cursor commands.
- `skills/crossfire*` - Renamed portable skills.
- `docs/PRODUCT.md` - Product contract.
- `docs/ARCHITECTURE.md` - Runtime architecture.
- `docs/SPEC.md` - Current detailed contracts extracted from historical process docs.
- `docs/DECISIONS.md` - Durable decision log.
- `docs/IMPLEMENTATION_STATUS.md` - Verified status and open findings.
- Five historical process docs under `docs/` - Removed after useful content was extracted.
- `skills/crossfire/references/adapters.md` - Removed local Claude settings examples from adapter docs.
- `src/runtime/config.mjs` - Removed local Claude settings example from default config comments.
- `tests/adapters.test.mjs` - Replaced local Claude settings fixture with a generic fixed-args fixture.

Latest README update:

- Added install prerequisites (`~/.local/bin` and `PATH`).
- Documented exactly what `scripts/install.mjs` installs.
- Added project initialization flow using `doctor` / `setup`.
- Added quick manual review/background/task-delegation test commands.
- Reorganized into What You Get, Install, First Run, Usage, Typical Flows, Configuration, Safety, FAQ.
- Added a Simplified Chinese version with matching content.
- Added Apache-2.0 license sections and `openai/codex-plugin-cc` acknowledgements to both READMEs.
- Reworked usage docs around Codex skill prompts plus Claude/Cursor `crossfire-*` commands; direct CLI examples are now secondary.
- Renamed the product surface to Crossfire, including CLI command `crossfire`, `.crossfire` config/state paths, and `CROSSFIRE_*` environment variables.

Latest entrypoint update:

- Added/kept `bin/crossfire` as the user-facing executable wrapper.
- Updated `npm run crossfire` and smoke verification to exercise `bin/crossfire`.
- Kept integration tests and background workers on `bin/crossfire.mjs` by design so internal re-entry uses the current Node runtime.
- Documented `CROSSFIRE_LOGIN_PATH=0` as the deterministic-test opt-out for login-shell PATH loading.

## Evidence of Completion

- [x] Baseline verification: `./init.sh`
  - Result: 48 tests passed; smoke returned `SMOKE OK`.
  - Last run: 2026-06-01 15:47 Asia/Shanghai, after deleting historical process docs.
- [x] Baseline after README install docs update: `./init.sh`
  - Result: 48 tests passed; smoke returned `SMOKE OK`.
  - Last run: 2026-06-01 15:57 Asia/Shanghai.
- [x] Baseline after bilingual README rewrite: `./init.sh`
  - Result: 48 tests passed; smoke returned `SMOKE OK`.
  - Last run: 2026-06-01 16:01 Asia/Shanghai.
- [x] Baseline after license/acknowledgement update: `./init.sh`
  - Result: 48 tests passed; smoke returned `SMOKE OK`.
  - Last run: 2026-06-01 16:05 Asia/Shanghai.
- [x] Baseline after agent-first README rewrite: `./init.sh`
  - Result: 48 tests passed; smoke returned `SMOKE OK`.
  - Last run: 2026-06-01 16:33 Asia/Shanghai.
- [x] Baseline after Crossfire rename: `./init.sh`
  - Result: 48 tests passed; smoke returned `SMOKE OK`.
  - Last run: 2026-06-01 21:40 Asia/Shanghai.
- [x] Baseline after executable wrapper coverage update: `./init.sh`
  - Result: 48 tests passed; smoke returned `SMOKE OK`.
  - Last run: 2026-06-01 22:16 Asia/Shanghai.
- [x] Baseline after host command named-agent parsing update: `./init.sh`
  - Result: 51 tests passed; smoke returned `SMOKE OK`.
  - Last run: 2026-06-02 17:30 Asia/Shanghai.
- [x] Codex host setup probe after executable wrapper coverage update
  - Result: `crossfire setup --self codex` reported reviewers `cursor, claude`.
- [x] Rename residual scan
  - Result: no old project name remained in tracked or ignored workspace files, excluding `.git`, `node_modules`, and `.agents`.
- [x] Documentation reviewed for stale nested path references.

## Notes for Next Session

Start with `feat-007` or real host verification for `feat-005`. The local regression baseline is green, but real Cursor/Codex/Claude E2E has not been rerun since the repo was flattened.
