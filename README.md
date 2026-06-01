# Crossfire

[简体中文](README.zh-Hans.md)

Cross-agent code review and rescue across **Codex**, **Cursor**, and **Claude Code**.

## Install

Requirements: Node.js 18+, `git`, and at least one non-self agent CLI (`cursor-agent`, `claude`, or `codex`) installed and authenticated.

```bash
mkdir -p ~/.local/bin
node scripts/install.mjs
export PATH="$HOME/.local/bin:$PATH"
```

The installer writes symlinks into agent home directories it detects. If a host is skipped, open that agent once so it creates its home directory, then reinstall. Use `--copy` for a snapshot instead:

```bash
node scripts/install.mjs --copy
```

Add the `export PATH` line to your shell config to make it persistent — host commands call `crossfire` by name.

Restart your agent if it doesn't pick up new skills/commands automatically.

## Quick Start

In any git repo, open your coding agent and run:

**Codex:**
```
Use crossfire to review my current changes.
```

**Claude Code:**
```
/crossfire-review
```

**Cursor:**
```
crossfire-review
```

First time? Check readiness first:

- **Codex:** `Use crossfire to check setup for this repo`
- **Claude:** `/crossfire-setup`
- **Cursor:** `crossfire-setup`

## Commands

| Action | Codex | Claude Code | Cursor |
|--------|-------|-------------|--------|
| Setup | `Use crossfire to check setup` | `/crossfire-setup` | `crossfire-setup` |
| Review | `Use crossfire to review` | `/crossfire-review` | `crossfire-review` |
| Adversarial review | `Use crossfire adversarial review` | `/crossfire-adversarial-review` | `crossfire-adversarial-review` |
| Rescue (read-only) | `Use crossfire rescue in read-only mode` | `/crossfire-rescue --read-only` | `crossfire-rescue --read-only` |
| Rescue (write) | `Use crossfire rescue with write` | `/crossfire-rescue --write` | `crossfire-rescue --write` |
| Status | `Use crossfire status` | `/crossfire-status` | `crossfire-status` |
| Result | `Use crossfire result` | `/crossfire-result <id>` | `crossfire-result <id>` |
| Cancel | `Use crossfire cancel` | `/crossfire-cancel <id>` | `crossfire-cancel <id>` |

Review commands are read-only. Rescue with `--write` is the only path for delegated edits.

## CLI Reference

For debugging or automation:

```bash
crossfire review --self codex --wait
crossfire adversarial-review --self codex "focus on rollback risk"
crossfire rescue --self codex --write --only claude "fix the failing test"
crossfire status <job-id> --wait
crossfire result <job-id>
crossfire doctor --self codex
```

Pass `--self` to identify the current host. Use `--only` or `--executor` to target a specific agent.

## Config

Most projects need no config. For custom binary paths or timeouts, add `.crossfire/config.json`:

```json
{
  "reviewers": {
    "cursor": { "bin": "cursor-agent", "timeout_ms": 600000 },
    "claude": { "bin": "claude", "timeout_ms": 600000 },
    "codex": { "bin": "codex", "timeout_ms": 600000 }
  }
}
```

## Safety

- Self is excluded by default (`--allow-self` to override)
- `review`, `adversarial-review`, `gate` are read-only
- `rescue` is the only write-capable lane
- Secret-looking env vars are scrubbed before spawning child agents
- Repo fingerprints detect mutation during review

## FAQ

**Do I need separate accounts?** No. Crossfire uses existing CLI authentication.

**Does it install into every project?** No. Install once, then use in any git repo.

**Can review modify files?** No. Use rescue `--write` for delegated edits.

**Where does job state live?** `~/.crossfire/state/<repo-slug>-<hash>/`

## Acknowledgements

Inspired by [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc). Thanks to the OpenAI team for the original cross-agent review/rescue product shape.

## License

Apache-2.0. See [LICENSE](LICENSE).
