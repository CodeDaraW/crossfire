---
name: crossfire
description: Cross-agent code review and rescue. Use when the user wants another coding agent (Cursor, Claude Code, or Codex) to review the current changes, run an adversarial/design-challenge review, gate a turn before finishing, or hand off an investigation/fix to a different agent (cross review, 交叉评审, adversarial review, review gate, rescue, cross-agent handoff, 交叉委派).
---

# Crossfire

Crossfire runs a shared `crossfire` CLI that asks OTHER coding agents to review
or work on the current repository. The current agent (you) is "self" and is
excluded from reviewing by default, so the review is genuinely cross-agent.

## When to use

- The user asks for a review of uncommitted changes, a branch, or a commit.
- The user wants an adversarial / "try to break this" / "should we ship" review.
- The user wants to delegate an investigation or a fix to another agent (rescue).
- The user wants a stop-time gate before finishing a turn.

## How to run

Always pass `--self <host>` so crossfire knows who you are. Run the command and
return its stdout to the user verbatim. You may add a short synthesis after the
output, but never overwrite or fabricate reviewer findings.

```bash
crossfire review --self <host>            # cross-review uncommitted changes
crossfire adversarial-review --self <host> "<focus>"
crossfire review --self <host> --base main
crossfire rescue --self <host> "<request>"   # delegate investigate/fix
crossfire status / result / cancel <job-id>
crossfire doctor                              # check which agents are available
```

## Rules (important)

- `review`, `adversarial-review`, and `gate` are READ-ONLY. They never modify the
  repo and never grant write tools to reviewers.
- `rescue` / `task` are the ONLY write-capable lane. Never let a review turn into
  an automatic fix. After a write rescue, recommend running `crossfire review`.
- Do not do the reviewer's or executor's job yourself: run the one command and
  return its output. Do not read the repo, grep, or summarize on their behalf.
- For large diffs, prefer `--background` and report the job id; check `status` /
  `result` later.
- If the CLI fails (missing agent, not authenticated), report the failure and the
  fix steps from `crossfire doctor`. Do not fabricate a substitute review.

See `references/commands.md`, `references/adapters.md`, `references/review-rubric.md`,
`references/rescue-runtime.md`, and `references/troubleshooting.md` for details.
