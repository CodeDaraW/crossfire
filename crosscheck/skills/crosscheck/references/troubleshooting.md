# Troubleshooting

- `no non-self reviewer available`: install/authenticate another agent CLI, or use
  `--allow-self` (not a true cross review). Run `crosscheck doctor`.
- Reviewer `not authenticated`: log in to that CLI (e.g. `cursor-agent status`).
- Claude only found as a wrapper (`claude-w`): set `CROSSCHECK_CLAUDE_BIN=claude-w`.
- Background job stuck: `crosscheck status <id>`; stale workers are auto-recovered
  via pid/heartbeat. Cancel with `crosscheck cancel <id>`.
- Large diff truncated: results note `truncated: true`; narrow scope with `--base`
  or review a specific `--commit`.
