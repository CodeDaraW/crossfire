# Crosscheck

Cross-agent code review and rescue across **Cursor**, **Claude Code**, and **Codex**.

Crosscheck lets the agent you're currently using ask the *other* agents to review
your changes or take on an investigation/fix. The current agent ("self") is
excluded by default, so reviews are genuinely cross-agent.

## Requirements

- Node.js >= 18
- `git`
- At least one agent CLI installed and authenticated: `cursor-agent`, `claude`, `codex`

## Install

```bash
node scripts/install.mjs          # symlink skill + host shells into detected hosts
node scripts/install.mjs --copy   # copy instead of symlink
# or, once on PATH:
crosscheck install
crosscheck uninstall
```

Ensure the installed `crosscheck` bin (e.g. `~/.local/bin/crosscheck`) is on your `PATH`.

## Commands

```bash
crosscheck doctor                       # what's installed / authenticated
crosscheck review --self <host>         # cross-review uncommitted changes
crosscheck adversarial-review --self <host> "focus"
crosscheck review --self <host> --base main
crosscheck review --self <host> --background   # then: status / result / cancel
crosscheck rescue --self <host> "investigate why X"      # read-only by default
crosscheck rescue --self <host> --write "fix the null deref in handler.js"
crosscheck status [job-id]
crosscheck result [job-id] [--raw]
crosscheck cancel <job-id>
crosscheck gate --self <host> [--previous-turn-file <path>]
crosscheck setup [--enable-gate|--disable-gate]
```

## Two lanes

- **Review lane** (`review`, `adversarial-review`, `gate`) — strictly read-only.
  Reviewers run in the repo with read-only permissions; the engine extracts the
  diff deterministically and merges findings with a deterministic arbiter.
- **Rescue / task lane** (`rescue`, `task`) — the only write-capable path. Intent
  is classified (fix → write, investigate → read-only; ambiguous → read-only),
  touched files are tracked, and read-only tasks that mutate the repo are flagged.

## Safety

- Self is excluded by default; use `--allow-self` to override.
- Child invocations set `CROSSCHECK_CHILD=1` to prevent recursive gate triggers.
- Secret-looking env vars are scrubbed before spawning agent CLIs.
- Pre/post `git status` is compared to detect mutation during a review.
- Only Claude's native Stop hook can truly *block* a turn (exit code 2); other
  hosts are advisory.

## Development

```bash
npm test          # node --test
npm run smoke     # end-to-end with fake agents (no real CLI calls)
```

The current product and architecture docs live in `docs/PRODUCT.md`,
`docs/ARCHITECTURE.md`, and `docs/SPEC.md`.
