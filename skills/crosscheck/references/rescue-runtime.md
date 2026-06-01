# Rescue / task runtime

- `rescue` is the user-facing delegation entrypoint; `task` is the internal runtime.
- Intent: fix/implement/apply/update/修复/实现 -> write-capable; review/diagnose/
  investigate/分析/为什么 -> read-only; ambiguous -> read-only (safe default).
- Explicit `--write` / `--read-only` always overrides classification.
- Resume: continue/keep going/resume/继续/上次 -> `--resume`; `--fresh` forces new.
- A write rescue records touched files and a pre/post status diff; read-only that
  mutates the repo is flagged as a safety violation.
- The forwarder is thin: one `crosscheck task` call, stdout returned verbatim.
