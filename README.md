# Crossfire

[English](README.md) | [简体中文](README.zh-Hans.md) | [日本語](README.ja.md)

Cross-agent code review and task delegation, supporting **Codex**, **Cursor**, and **Claude Code**.

| Codex | Cursor | Claude Code |
|-------|--------|-------------|
| ![Crossfire Codex demo](https://cdn-eo.daraw.cn/projects/crossfire/demo-codex.png) | ![Crossfire Cursor demo](https://cdn-eo.daraw.cn/projects/crossfire/demo-cursor.png) | ![Crossfire Claude demo](https://cdn-eo.daraw.cn/projects/crossfire/demo-claude.png) |

## Install

Requirements: Node.js 18+, `git`, and at least one non-self agent CLI (`cursor-agent`, `claude`, or `codex`) installed and authenticated.

```bash
git clone https://github.com/CodeDaraW/crossfire.git
cd crossfire
node scripts/install.mjs
```

The installer creates `~/.local/bin/crossfire` and writes symlinks into agent home directories it detects. If a host is skipped, open that agent once so it creates its home directory, then reinstall. Use `--copy` for a snapshot instead:

```bash
node scripts/install.mjs --copy
```

If a host command cannot find `crossfire`, make sure `~/.local/bin` is on that agent's launch `PATH`.

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
/crossfire-review
```

First time? Check readiness first:

- **Codex:** `Use crossfire to check setup for this repo`
- **Claude:** `/crossfire-setup`
- **Cursor:** `/crossfire-setup`

Note: Codex TUI uses natural-language skill prompts. In Codex App, Crossfire can also be invoked as a slash command, such as `/crossfire setup`.

## Commands

| Action | Codex | Claude Code | Cursor |
|--------|-------|-------------|--------|
| Setup | `Use crossfire to check setup` | `/crossfire-setup` | `/crossfire-setup` |
| Review | `Use crossfire to review` | `/crossfire-review` | `/crossfire-review` |
| Adversarial review | `Use crossfire adversarial review` | `/crossfire-adversarial-review` | `/crossfire-adversarial-review` |
| Delegate task (read-only) | `Use crossfire to delegate a read-only investigation` | `/crossfire-rescue --read-only` | `/crossfire-rescue --read-only` |
| Delegate task (write) | `Use crossfire to delegate a fix with write access` | `/crossfire-rescue --write` | `/crossfire-rescue --write` |
| Status | `Use crossfire status <id>` | `/crossfire-status <id>` | `/crossfire-status <id>` |
| Result | `Use crossfire result <id>` | `/crossfire-result <id>` | `/crossfire-result <id>` |
| Cancel | `Use crossfire cancel <id>` | `/crossfire-cancel <id>` | `/crossfire-cancel <id>` |

Code review commands are read-only. Delegated tasks with `--write` are the only path for file edits by another agent.

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

Pass `--self` to identify the current host. Use `--only` or `--executor` to target a specific agent. For review commands, a bare agent name is also accepted as shorthand, so `crossfire review codex` selects Codex only.

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
- Delegated tasks are the only write-capable lane
- Secret-looking env vars are scrubbed before spawning child agents
- Repo fingerprints detect mutation during review

## FAQ

**Do I need separate accounts?** No. Crossfire uses existing CLI authentication.

**Does it install into every project?** No. Install once, then use in any git repo.

**Can code review modify files?** No. Use a delegated task with `--write` when another agent should edit files.

**Where does job state live?** `~/.crossfire/state/<repo-slug>-<hash>/`

## Acknowledgements

Inspired by [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc). Thanks to the OpenAI team for the original cross-agent pattern for reviewing code and delegating tasks.

## License

Apache-2.0. See [LICENSE](LICENSE).
