# Crossfire commands

```
crossfire review [--wait|--background] [--base <ref>] [--scope auto|working-tree|branch]
                  [--commit <sha>] [--reviewer a,b] [--only a] [--self <host>]
                  [--allow-self] [--format text|json] [--timeout-ms <ms>]
crossfire adversarial-review [...same...] [focus...]
crossfire rescue [--wait|--background] [--resume|--fresh] [--executor a] [--only a]
                  [--write|--read-only] [--model <m>] [--self <host>] [request...]
crossfire task   [...internal forwarder; prefer rescue...]
crossfire gate   [--previous-turn-file <path>] [--reviewer a,b] [--self <host>] [--json]
crossfire status [job-id] [--wait] [--all] [--json]
crossfire result [job-id] [--json] [--raw] [--reviewer a]
crossfire cancel <job-id>
crossfire doctor [--json]
crossfire setup  [--enable-gate|--disable-gate] [--json]
```

- Default reviewers = all available agents minus self.
- `--only` / `--reviewer` select reviewers; `--with` is a deprecated alias of `--reviewer`.
- For host command shorthand, bare reviewer names such as `codex` or `claude,codex` select those reviewers.
- Lanes: review/adversarial-review/gate are read-only; rescue/task can be write-capable.
