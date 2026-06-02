# AGENTS.md

Project harness for reliable agent-assisted development in Crossfire.

Crossfire is a Node CLI plus host integration assets for cross-agent code
review and task delegation across Codex, Cursor, and Claude Code. The authoritative
product direction is the current implementation plus the docs listed below.
Earlier plan/review process docs have been extracted into these current docs.

## Startup Workflow

Before writing code:

1. **Confirm working directory** with `pwd`
2. **Read this file** completely
3. **Read project docs** in this order:
   - `README.md`
   - `docs/PRODUCT.md`
   - `docs/ARCHITECTURE.md`
   - `docs/SPEC.md`
   - `docs/DECISIONS.md`
   - `docs/IMPLEMENTATION_STATUS.md`
4. **Run `./init.sh`** to verify the local baseline
5. **Read `feature_list.json`** to choose the current work item
6. **Review recent commits** with `git log --oneline -5`

If baseline verification is failing, repair that first before adding new scope.

## Working Rules

- **One feature at a time**: Pick exactly one unfinished feature from `feature_list.json`
- **Verification required**: Don't claim done without running verification commands
- **Update artifacts**: Before ending session, update `progress.md` and `feature_list.json`
- **Stay in scope**: Don't modify files unrelated to the current feature
- **Leave clean state**: Next session must be able to run `./init.sh` immediately
- **Respect the lane boundary**: review/adversarial/gate are read-only; only delegated task commands (`rescue`/`task`) may be write-capable
- **Do not hide agent failures**: non-zero exits, timeouts, and partial reviewer coverage must be represented explicitly
- **Do not infer current CLI contracts from old plans**: use tests, `doctor`, and direct CLI probes

## Required Artifacts

- `feature_list.json` — Feature state tracker (source of truth)
- `progress.md` — Session continuity log
- `init.sh` — Standard startup and verification path
- `session-handoff.md` — Current handoff for the next agent session
- `docs/PRODUCT.md` — Product scope and user-facing contract
- `docs/ARCHITECTURE.md` — Current runtime architecture
- `docs/SPEC.md` — Detailed current command, schema, state, gate, and verification contracts
- `docs/DECISIONS.md` — Durable decisions from the cross-agent design process
- `docs/IMPLEMENTATION_STATUS.md` — Verified state, open issues, and E2E notes

## Definition of Done

A feature is done only when ALL of the following are true:

- [ ] Target behavior is implemented
- [ ] Required verification actually ran (tests / lint / type-check)
- [ ] Evidence recorded in `feature_list.json` or `progress.md`
- [ ] Repository remains restartable from standard startup path

## End of Session

Before ending a session:

1. Update `progress.md` with current state
2. Update `feature_list.json` with new feature status
3. Record any unresolved risks or blockers
4. Commit with descriptive message once work is in safe state
5. Leave repo clean enough for next session to run `./init.sh` immediately

## Verification Commands

```bash
# Full verification (recommended)
./init.sh
```

Required checks:
- dependency install when `npm` is available
- unit tests
- smoke tests with fake agents

Real Cursor/Codex/Claude E2E should be run when the feature touches adapters,
invocation, permissions, state, or host integration. Do not commit local
Claude settings paths; use the default Claude CLI configuration unless a test
explicitly needs a disposable fixture.

## Escalation

If you encounter:
- **Architecture decisions**: Consult project architecture docs if present, otherwise ask user
- **Unclear requirements**: Check product/requirements docs if present, otherwise ask user
- **Repeated test failures**: Update progress, flag for human review
- **Scope ambiguity**: Re-read `feature_list.json` for definition of done
- **Spec conflict**: Prefer current code, `docs/SPEC.md`, `docs/DECISIONS.md`, and `docs/IMPLEMENTATION_STATUS.md`
