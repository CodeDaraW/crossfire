# Session Progress Log

## Current State

**Last Updated:** 2026-06-01 16:33 Asia/Shanghai  
**Active Feature:** feat-001 - Harness baseline and real project records  
**Repository Shape:** Project was flattened from `crosscheck/` into the repo root. Runtime files now live at `bin/`, `src/`, `skills/`, `hosts/`, `tests/`, and `docs/`.

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
- [x] README now presents Crosscheck as an agent skill/command workflow first, with the CLI documented as the shared runtime/debug layer.

### What's In Progress

- [x] Replace harness placeholders with Crosscheck-specific product, architecture, decision, implementation-status, progress, and handoff records.
  - Details: Convert historical design discussion into durable docs that a future agent can use directly.
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
  - Context: The target is not a demo and should include review, rescue/task, background jobs, gate, setup/doctor, prompt skills, schema output, and resume/session handling.
  - Alternatives considered: A smaller prompt-wrapper or review-only skill was rejected.
- **Node CLI is the single runtime**:
  - Context: Argument parsing, Git context, schema normalization, state, jobs, and arbitration need one source of truth.
  - Alternatives considered: Bash-first and per-host implementations were rejected.
- **Keep review and rescue/task as separate lanes**:
  - Context: Review/adversarial/gate must stay read-only; write capability belongs only to rescue/task.
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
- `docs/PRODUCT.md` - Product contract.
- `docs/ARCHITECTURE.md` - Runtime architecture.
- `docs/SPEC.md` - Current detailed contracts extracted from historical process docs.
- `docs/DECISIONS.md` - Durable decision log.
- `docs/IMPLEMENTATION_STATUS.md` - Verified status and open findings.
- Five historical process docs under `docs/` - Removed after useful content was extracted.
- `skills/crosscheck/references/adapters.md` - Removed local Claude settings examples from adapter docs.
- `src/runtime/config.mjs` - Removed local Claude settings example from default config comments.
- `tests/adapters.test.mjs` - Replaced local Claude settings fixture with a generic fixed-args fixture.

Latest README update:

- Added install prerequisites (`~/.local/bin` and `PATH`).
- Documented exactly what `scripts/install.mjs` installs.
- Added project initialization flow using `doctor` / `setup`.
- Added quick manual review/background/rescue test commands.
- Reorganized into What You Get, Install, First Run, Usage, Typical Flows, Configuration, Safety, FAQ.
- Added a Simplified Chinese version with matching content.
- Added Apache-2.0 license sections and `openai/codex-plugin-cc` acknowledgements to both READMEs.
- Reworked usage docs around Codex skill prompts plus Claude/Cursor `crosscheck-*` commands; direct CLI examples are now secondary.

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
- [x] Documentation reviewed for stale nested path references.

## Notes for Next Session

Start with `feat-007` or real host verification for `feat-005`. The local regression baseline is green, but real Cursor/Codex/Claude E2E has not been rerun since the repo was flattened.
