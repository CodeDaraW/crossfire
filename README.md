# Crosscheck

[简体中文](README.zh-Hans.md)

Cross-agent code review and rescue across **Codex**, **Cursor**, and
**Claude Code**.

Crosscheck lets the agent you are currently using ask the *other* local coding
agents to review your changes or take on a focused investigation/fix. The
current agent is "self" and is excluded by default, so reviews are genuinely
cross-agent.

This project is inspired by the product shape of
[`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc), but it
generalizes the flow from "Claude Code calls Codex" into "Codex, Cursor, and
Claude can call each other."

## What You Get

- A Codex skill that lets Codex invoke other local agents for review/rescue.
- Claude Code commands such as `/crosscheck-review`, `/crosscheck-rescue`,
  `/crosscheck-status`, and `/crosscheck-result`.
- Cursor command assets with the same `crosscheck-*` command names.
- A shared runtime underneath those skills/commands so behavior is consistent
  across hosts.
- Read-only review, adversarial review, background jobs, status/result/cancel,
  setup/doctor, and write-capable rescue when explicitly requested.

## Requirements

- Node.js 18 or later.
- `git`.
- At least one non-self agent CLI installed and authenticated:
  - `cursor-agent`
  - `claude`
  - `codex`

For example, if you are running from Codex, install and authenticate either
Cursor or Claude so Crosscheck has a non-self reviewer.

## Install

Install Crosscheck once from this repo checkout:

```bash
mkdir -p ~/.local/bin
node scripts/install.mjs
```

That install step is intentionally CLI-shaped because it wires the runtime and
host assets into your local agent homes. Day-to-day use should happen from the
coding agent UI through skills or commands, not by typing `crosscheck review`
yourself.

The default install uses symlinks so local development changes are picked up
immediately. Use `--copy` if you want a snapshot:

```bash
node scripts/install.mjs --copy
```

The installer writes:

- `~/.local/bin/crosscheck`
- `~/.codex/skills/crosscheck` when `~/.codex` exists
- `~/.claude/skills/crosscheck`, `~/.claude/commands/*`, and
  `~/.claude/agents/*` when `~/.claude` exists
- `~/.cursor/skills/crosscheck` and `~/.cursor/commands/*` when `~/.cursor`
  exists

Make sure the binary is on your `PATH`:

```bash
export PATH="$HOME/.local/bin:$PATH"
crosscheck --help
```

After that, you can manage installation through the CLI:

```bash
crosscheck install
crosscheck install --copy
crosscheck install --hosts codex,cursor
crosscheck uninstall
```

`crosscheck install` only installs into host directories that already exist. If
a host is skipped, open/install that host once so it creates its home directory,
then rerun install.

After installation, restart or reload the agent host if it does not pick up new
skills/commands automatically.

## First Run In An Agent

Open any git repository in Codex, Cursor, or Claude Code. Crosscheck does not
copy files into the project; the installed skill/command runs against the
current workspace.

Start with setup/readiness:

- In Codex, ask: `Use crosscheck to check setup for this repo`.
- In Claude Code, run: `/crosscheck-setup`.
- In Cursor, run the installed `crosscheck-setup` command.

Then try a normal review:

- In Codex, ask: `Use crosscheck to review my current changes`.
- In Claude Code, run: `/crosscheck-review`.
- In Cursor, run the installed `crosscheck-review` command.

If setup says no non-self reviewer is available, install or authenticate at
least one of the other local agent CLIs and try again. For example, when using
Crosscheck from Codex, either Cursor or Claude must be available so the review is
actually cross-agent.

## Host Commands And Skills

### Codex

Codex uses the installed `crosscheck` skill. Use natural language and name
Crosscheck when you want the skill:

```
Use crosscheck to review my current changes.
Use crosscheck to run an adversarial review focused on rollback risk.
Use crosscheck to ask another agent to investigate why the tests are failing.
Use crosscheck to show the latest background job result.
```

The skill is responsible for adding the correct self identity and calling the
runtime. The user-facing instruction is the request you would naturally give to
a coding agent.

### Claude Code

Claude Code gets explicit command files:

```text
/crosscheck-setup
/crosscheck-review
/crosscheck-adversarial-review challenge the migration and rollback plan
/crosscheck-rescue --read-only find the root cause of the failing test
/crosscheck-rescue --write apply the smallest safe fix
/crosscheck-status
/crosscheck-result <job-id>
/crosscheck-cancel <job-id>
```

The review commands are read-only. `/crosscheck-rescue --write` is the path for
delegated edits.

### Cursor

Cursor gets command assets with matching names:

```text
crosscheck-setup
crosscheck-review
crosscheck-adversarial-review
crosscheck-rescue
crosscheck-status
crosscheck-result
crosscheck-cancel
```

Run them from Cursor's agent command surface. If your Cursor build renders
project/user commands as slash commands, they appear with the same names, for
example `/crosscheck-review`.

## Common Agent Flows

### Review Before Shipping

Ask the current agent to run Crosscheck review, or use the host command:

```text
Codex:  Use crosscheck to review my current changes in the background.
Claude: /crosscheck-review --background
Cursor: crosscheck-review --background
```

Then ask for status/result:

```text
Codex:  Use crosscheck to wait for the job and show the result.
Claude: /crosscheck-status <job-id> --wait, then /crosscheck-result <job-id>
Cursor: crosscheck-status <job-id> --wait, then crosscheck-result <job-id>
```

### Challenge A Risky Direction

Use adversarial review when you want another agent to argue against the design:

```text
Codex:  Use crosscheck to run an adversarial review focused on data loss and rollback.
Claude: /crosscheck-adversarial-review focus on data loss and rollback
Cursor: crosscheck-adversarial-review focus on data loss and rollback
```

### Hand A Problem To Another Agent

Use rescue when you want a different agent to investigate or fix:

```text
Codex:  Use crosscheck rescue to ask another agent to find the root cause.
Claude: /crosscheck-rescue --read-only find the root cause
Cursor: crosscheck-rescue --read-only find the root cause
```

For delegated edits:

```text
Codex:  Use crosscheck rescue with write permission to apply the smallest safe fix.
Claude: /crosscheck-rescue --write apply the smallest safe fix
Cursor: crosscheck-rescue --write apply the smallest safe fix
```

After write rescue, run Crosscheck review again before shipping.

### Try It In Any Repo

Make a harmless local change, then ask your current agent to use Crosscheck:

```bash
printf "\n# crosscheck test\n" >> README.md
```

```text
Codex:  Use crosscheck to review my current changes.
Claude: /crosscheck-review
Cursor: crosscheck-review
```

Then revert the test edit in your normal workflow.

## Runtime CLI

The `crosscheck` binary is still installed because all host skills and commands
use it under the hood. You normally do not need the CLI for day-to-day agent
usage.

Use it directly only for debugging, automation, or when developing Crosscheck:

```bash
crosscheck doctor --self codex
crosscheck setup --self codex
crosscheck review --self codex --wait
crosscheck review --self codex --background --json
crosscheck status <job-id> --wait
crosscheck result <job-id>
crosscheck rescue --self codex --write "apply the smallest safe fix"
```

Runtime commands:

- `review`: normal read-only cross-agent review.
- `adversarial-review`: read-only design/risk challenge review.
- `rescue`: delegate investigation or fix work to another agent.
- `status`, `result`, `cancel`: background job management.
- `doctor`, `setup`: local readiness checks.
- `gate`: stop-time read-only review gate for hosts with a native hook.

When calling the CLI directly, pass `--self codex`, `--self cursor`, or
`--self claude`. Host skills/commands add this automatically.

## CLI Reference

```bash
crosscheck review [--wait|--background] [--base <ref>] [--scope auto|working-tree|branch]
                  [--commit <sha>] [--reviewer a,b] [--only a] [--self <host>]
                  [--allow-self] [--format text|json] [--timeout-ms <ms>]
crosscheck adversarial-review [...same...] [focus...]
crosscheck rescue [--wait|--background] [--resume|--fresh] [--executor a] [--only a]
                  [--write|--read-only] [--model <m>] [--self <host>] [request...]
crosscheck gate   [--previous-turn-file <path>] [--reviewer a,b] [--self <host>] [--json]
crosscheck status [job-id] [--wait] [--all] [--json]
crosscheck result [job-id] [--json] [--raw] [--reviewer a]
crosscheck cancel <job-id>
crosscheck doctor [--json]
crosscheck setup  [--enable-gate|--disable-gate] [--json]
```

## Configuration

Most projects do not need config. Add `.crosscheck/config.json` only when a
project needs custom binary paths, timeouts, or private site-specific adapter
args:

```json
{
  "reviewers": {
    "cursor": { "bin": "cursor-agent", "timeout_ms": 600000 },
    "claude": { "bin": "claude", "timeout_ms": 600000 },
    "codex": { "bin": "codex", "timeout_ms": 600000 }
  }
}
```

Config merge order:

1. defaults
2. user config at `${CROSSCHECK_CONFIG_HOME:-$HOME}/.crosscheck/config.json`
3. repo config at `.crosscheck/config.json`
4. command flags and environment handled by callers/adapters

Do not commit machine-local settings paths or secrets in project config.

## Safety Model

- Self is excluded by default; use `--allow-self` to override.
- `review`, `adversarial-review`, and `gate` are read-only.
- `rescue` / `task` are the only write-capable lane.
- Child invocations set `CROSSCHECK_CHILD=1` to prevent recursive gate triggers.
- Secret-looking environment variables are scrubbed before spawning agent CLIs.
- Secret-looking changed paths are redacted from prompt context and listed in
  `omitted_files`.
- Pre/post repo fingerprints detect mutation during review.
- Write rescue records touched files, including edits to files that were already
  dirty before the task.

## FAQ

### Do I need separate accounts for all agents?

No. Crosscheck uses the local CLIs and whatever authentication they already have.
You only need enough installed/authenticated non-self CLIs for the review or task
you want to run.

### Does Crosscheck install into every project?

No. Install Crosscheck once into your user-level host directories and `PATH`.
Then open any git repository in your coding agent and use the installed
Crosscheck skill/command there.

### Why do commands need `--self`?

Crosscheck excludes the current host by default. Host command assets pass
`--self` automatically, but direct CLI usage should pass it explicitly.

### Is review allowed to modify files?

No. Review lane commands are read-only. Use rescue with write permission through
the host command/skill for delegated edits, then run another review.

### Where does background job state live?

By default under:

```text
~/.crosscheck/state/<repo-slug>-<hash>/
```

You can override it with `CROSSCHECK_DATA_DIR`.

## Acknowledgements

Crosscheck is inspired by
[`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc). Thanks
to the OpenAI team for the original single-host cross-agent review/rescue
product shape and prompt/runtime ideas that informed this project.

## License

Apache-2.0. See [LICENSE](LICENSE).

## Development

```bash
./init.sh
npm test
npm run smoke
```

The current product and architecture docs live in:

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/SPEC.md`
- `docs/DECISIONS.md`
- `docs/IMPLEMENTATION_STATUS.md`
