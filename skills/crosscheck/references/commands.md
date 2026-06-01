# Crosscheck commands

```
crosscheck review [--wait|--background] [--base <ref>] [--scope auto|working-tree|branch]
                  [--commit <sha>] [--reviewer a,b] [--only a] [--self <host>]
                  [--allow-self] [--format text|json] [--timeout-ms <ms>]
crosscheck adversarial-review [...same...] [focus...]
crosscheck rescue [--wait|--background] [--resume|--fresh] [--executor a] [--only a]
                  [--write|--read-only] [--model <m>] [--self <host>] [request...]
crosscheck task   [...internal forwarder; prefer rescue...]
crosscheck gate   [--previous-turn-file <path>] [--reviewer a,b] [--self <host>] [--json]
crosscheck status [job-id] [--wait] [--all] [--json]
crosscheck result [job-id] [--json] [--raw] [--reviewer a]
crosscheck cancel <job-id>
crosscheck doctor [--json]
crosscheck setup  [--enable-gate|--disable-gate] [--json]
```

- Default reviewers = all available agents minus self.
- `--only` / `--reviewer` select reviewers; `--with` is a deprecated alias of `--reviewer`.
- Lanes: review/adversarial-review/gate are read-only; rescue/task can be write-capable.
