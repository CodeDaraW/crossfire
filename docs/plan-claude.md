# Crosscheck：跨 Coding Agent 交叉 Review / Rescue 系统（终态方案）

> 本文是融合三轮互审（见 `docs/review-claude.md` / `docs/review-gpt.md`）后的终态设计。目标是对齐 `openai/codex-plugin-cc` 的完整能力，并把它“Claude Code 单向调 Codex”的形态推广为 Codex / Cursor / Claude **任意宿主互调**的通用系统。

## 0. 一句话定位

以 **Node CLI 为唯一引擎**、以 `codex-plugin-cc` 为产品与 prompt 参考、面向 Codex/Cursor/Claude 三宿主的交叉 review/rescue 系统：

- **Review lane**（review / adversarial-review / gate）：默认排除 self、向所有可用非 self reviewer **只读** fan-out，raw + schema + 确定性仲裁。
- **Rescue/Task lane**（rescue / task）：独立委派入口，按用户意图选 read-only / write-capable，支持 resume/fresh、后台 job。
- 全局支持：后台 job（status/result/cancel）、setup/doctor、stop gate、结构化 schema、raw 留痕、prompt skill 套件。

## 1. 设计原则

### 1.1 引擎共享，宿主只做薄接入

核心逻辑全部在 Node 引擎（`crosscheck` CLI）：参数解析、Git context 抽取、reviewer/executor 探测与调用、prompt 构造、schema 校验、job 状态、render、setup、gate、仲裁。宿主侧只负责“把用户动作接到 `crosscheck`”，避免三套宿主集成行为漂移。

> 纯 Bash 引擎被否决：shell 无法稳定支撑 schema 校验、job state、raw 归一化、失败/timeout 处理、CLI 能力探测。Bash 只允许作为宿主命令模板里的薄调用层。

### 1.2 默认交叉，显式才自审

- 自动识别 self → 自动探测可用 reviewer → 默认 reviewer = 可用 - self。
- **无非 self reviewer 时给 doctor 诊断，绝不静默退化为自审。**
- 用户显式 `--only self` / `--allow-self` 才允许自审，且输出标注 `self_review: true`。

### 1.3 两条 Lane 严格隔离（采纳 plan-gpt 的核心改进）

| Lane | 命令 | 权限 | 约束 |
| --- | --- | --- | --- |
| Review-only | `review` / `adversarial-review` / `gate` | 永远只读 | 不改 repo、不调 patch/edit 工具、不传危险 flag、pre/post status 必须不变 |
| Rescue/Task | `rescue` / `task` | read-only 或 write-capable | 写能力只能由本 lane 触发，不可由 review 自动触发 |

- 可写能力**只能**来自 rescue/task 入口。
- 用户请求是 review/diagnosis/research/investigate/分析/看看为什么 → read-only。
- 用户请求是 fix/implement/apply/update/修复/实现/改掉 → write-capable。
- **裸 `task` 的默认权限值不靠文档猜测，由 adapter contract tests 对齐 `codex-plugin-cc` upstream 行为后锁定。**
- 可写委派必须记录 pre/post diff、touched_files、sessionId、resumeHint；产生修改后仍建议后续 review。

## 2. 宿主接入层形态（混合，唯一待最终拍板项）

引擎共享不变，分歧只在最外层壳。结论：**采用混合形态**（详见 `docs/review-claude.md` 专节）。

- 三宿主都装一份**可移植 skill**，覆盖 review/adversarial 的发现与触发（满足绝大多数日常用法）。
- **仅 gate（Stop hook）与 rescue 薄转发 subagent** 下沉到宿主原生薄壳——纯 skill 技术上注册不了 hook：
  - Claude：原生 plugin（slash 命令 + Stop-gate hook + rescue subagent）。
  - Cursor：少量 `.cursor/commands/*.md`。
  - Codex：skill 即可。

> 取舍依据：用户既要“可移植简单”又要“完整对齐 codex-plugin-cc（含 gate + rescue 转发）”，二者在纯 skill 下不可兼得；混合是最小代价的全功能解。若用户最终选纯可移植 skill（放弃自动 gate + 原生 rescue subagent）或全 per-host 原生，§3/§17 据此调整。

## 3. 仓库结构

```text
crosscheck/
  package.json
  bin/crosscheck.mjs
  src/
    cli/ main.mjs  args.mjs  commands/{setup,doctor,review,adversarial-review,rescue,task,gate,status,result,cancel,install,uninstall}.mjs
    git/ repository.mjs  target.mjs  context.mjs  diff-size.mjs  worktree.mjs
    reviewers/ registry.mjs  base.mjs  cursor.mjs  claude.mjs  codex.mjs
    executors/ registry.mjs  cursor.mjs  claude.mjs  codex.mjs
    runtime/ process.mjs  timeout.mjs  env.mjs  state.mjs  jobs.mjs  locks.mjs  logs.mjs  safety.mjs
    prompts/ templates.mjs  review.md  adversarial-review.md  stop-gate.md  arbitration.md  task.md
    schema/ review-output.schema.json  task-output.schema.json  crosscheck-result.schema.json  job.schema.json
    arbiter/ deterministic.mjs  llm.mjs
    render/ text.mjs  json.mjs  status.mjs  result.mjs
    install/ detect-hosts.mjs  install.mjs  uninstall.mjs
  skills/                      # 可移植 skill（装入三宿主）
    crosscheck/SKILL.md
    crosscheck-runtime/SKILL.md
    crosscheck-result-handling/SKILL.md
    crosscheck-prompting/SKILL.md + references/{prompt-blocks,recipes,antipatterns}.md
  hosts/                       # 仅“必须原生”的薄壳
    claude/.claude-plugin/plugin.json  commands/*.md  agents/crosscheck-rescue.md  hooks/hooks.json
    cursor/commands/*.md
  scripts/ install.mjs  smoke.mjs
  tests/ *.test.mjs  fixtures/{fake-cursor-agent,fake-claude,fake-codex}.mjs
  docs/ plan-claude.md  plan-gpt.md  review-claude.md  review-gpt.md  architecture.md
```

## 4. 命令设计

总入口：`crosscheck <command> [options] [focus...]`

命令：`setup doctor review adversarial-review rescue task gate status result cancel install uninstall`

- `doctor`：纯只读诊断（CLI/auth/版本/能力矩阵）。`setup`：可按参数安装/配置/启停 gate。
- `review` / `adversarial-review`：
  `[--wait|--background] [--base <ref>] [--scope auto|working-tree|branch] [--commit <sha>] [--reviewer a,b,c] [--only a] [--self <host>] [--allow-self] [--format text|json] [--timeout-ms <ms>]`
  - 普通 review 对齐 upstream：不接受自定义 focus，不挑战设计；要挑战设计用 adversarial。
- `rescue`（用户可见委派入口）：
  `[--wait|--background] [--resume|--fresh] [--executor a,b] [--only a] [--self <host>] [--write|--read-only] [--model <m>] [--effort ...] [--format ...] [--timeout-ms ...] [request...]`
- `task`（内部 runtime，薄转发）：
  `[--wait|--background] [--resume-last|--fresh] [--executor a] [--write|--read-only] [--model ...] [--effort ...] [prompt...]`
- `gate`：`[--previous-turn-file <path>] [--base <ref>] [--scope auto|working-tree] [--reviewer a,b] [--timeout-ms ...] [--json]`
- `status [job-id] [--wait] [--timeout-ms] [--all] [--json]` / `result [job-id] [--json] [--raw] [--reviewer a]` / `cancel [job-id] [--json]`

**参数命名统一**：以 `--reviewer` / `--executor` / `--only` 为准；`--with` 仅作 alias（修复 review 中的 G）。

## 5. wait / background UX

- 显式 `--wait` / `--background` 直接生效。
- 都没传 → 估算规模给推荐：仅 1–2 个小文件且 diff 小 → wait；其余（含规模不明）→ background。
- 规模估算用 `git status --short -uall` + `git diff --shortstat`(cached/working) + branch/commit shortstat；**untracked 也算 reviewable，shortstat 为空不等于无内容**。
- 不支持交互选择的宿主默认 background（除非 `--wait`）。

## 6. Git review target

- 模式：`working-tree` / `branch` / `commit`。`auto`：有 `--commit`→commit；有 `--base`→branch；否则 working tree dirty→working-tree，干净→检测默认 base 走 branch。
- 默认 base 检测顺序：`origin/HEAD` → `origin/main` → `origin/master` → `main` → `master` → 失败要求 `--base`。
- working-tree context：`status -uall` + staged diff + unstaged diff + untracked 文本 + 变更文件清单 + diff stat。
- branch/commit context：base/merge-base/commit list/changed files/diff patch（受大小限制）。

## 7. Context collection（统一执行模型，修复 review 的 A/B）

**唯一执行模型：reviewer 在目标 repo 内以只读权限运行，引擎确定性抽取 diff/context。** 安全边界来自权限模式 + 工具收敛 + 环境清洗 + pre/post status 检测，**不来自 cwd**。彻底取消“scratch cwd 跑 reviewer”的旧描述。

三档 context 级别（按 diff 规模自动选，不改变执行位置）：

- `inline-full`（小 diff）：prompt 内联完整 diff。
- `inline-summary`（中等/含大文件）：内联 status + diff stat + 变更文件 + 关键 patch，标注截断，要求 reviewer 对上下文不足的结论降低 confidence。
- `repo-readonly`（大 diff / 需要 repo inspection）：reviewer 用自身只读权限在 `repoRoot` 读文件。

**worktree 仅用于 branch/commit**（已提交态可天然建 worktree）；**working-tree 一律 in-repo 只读 + 引擎抽 diff，不走 worktree**（彻底回避 worktree 不含未提交改动的 materialization 难题，修复 review 的 B）。

输出始终记录：`{ "context_mode": "...", "truncated": false, "omitted_files": [] }`。

## 8. Reviewer / Executor adapter

reviewer 与 executor 共用 agent adapter，但权限与输出契约不同。每个 adapter：`detect / probeCapabilities / buildInvocation / parseOutput / normalizeError`（executor 另有 `buildTaskInvocation / buildResumeInvocation / parseTaskOutput`）。

能力以 **probe 实测为准，绝不硬编码未验证 flag**：

```json
{ "available": true, "authenticated": true, "path": "...", "version": "...",
  "json_output": true, "readonly_mode": true, "workspace_arg": true,
  "native_review": false, "native_review_supports_working_tree": false,
  "native_review_supports_base": false, "native_review_supports_commit": false }
```

### 8.1 Cursor
- 首选：`cursor-agent -p --mode ask --output-format json [--workspace <repoRoot>] "<prompt>"`。
- 禁危险 flag（`--force`/`--yolo`/`--sandbox disabled`）；默认 `--mode ask`。
- **`--trust`：headless `-p` 在未信任工作区可能弹窗/静默忽略设置，多半需要 `--trust`（仅信任目标 repo）；由 Phase 0/contract test 实测确认（修复 review 的 F）。**

### 8.2 Claude
- 首选：`claude -p --output-format json --permission-mode plan [--json-schema <schema>] "<prompt>"`。
- **评估 `--json-schema` + 只读工具白名单（仅 Read/Glob/Grep，禁 Bash/Edit/Write）以加强结构化与读取面收敛（修复 review 的 H）。**
- 禁 `--dangerously-skip-permissions`，不授写工具。
- 支持 `CROSSCHECK_CLAUDE_BIN`（如 `claude-w` wrapper）；wrapper 缺底层 claude / 会弹交互模型选择时，setup 报告并建议固定默认模型。

### 8.3 Codex
- 优先 native review（若 CLI 支持且支持目标 target）；否则非交互只读 `exec`/prompt fallback；不存在/未登录则 unavailable。
- 不依赖 `codex-companion.mjs` 内部脚本，不把 internal app-server API 当公共契约。
- 默认只读 sandbox + 非交互 approval policy。

## 9. Self detection

优先级：`--self` → 显式 env（`CROSSCHECK_SELF`/`CURSOR_AGENT`/`CLAUDECODE`/Codex env）→ 宿主模板注入（Cursor 命令传 `--self cursor` 等）→ process tree/cwd fallback → unknown。unknown 时不排除任何 reviewer 并 warn；宿主模板必须显式传 `--self` 以避免 unknown。

## 10. Prompt 设计（继承 codex-plugin-cc framing）

- 普通 review：`<role><task><review_priorities><finding_bar><structured_output_contract><grounding_rules><repository_context>`。
- adversarial：`role`(break confidence) / `task`(最强 no-ship 理由) / `operating_stance`(默认怀疑) / `attack_surface`(auth/权限/数据丢失/回滚/竞态/schema drift/可观测性) / `finding_bar` / `structured_output_contract` / `grounding_rules` / `calibration`(宁缺毋滥) / `final_check`。
- stop-gate：只审上一轮真实代码改动；非代码动作立即 ALLOW；首行严格 `ALLOW:`/`BLOCK:`。
- task/rescue：标注 read-only/write-capable；`default_follow_through_policy` + `action_safety` + `verification_loop`；read-only 禁改代码、只出诊断/方案。

## 11. 多 reviewer 仲裁（修复 review 的 E）

**默认 deterministic merge（无 LLM）**：
- critical/high → highest_risk；同文件相近行号 + 标题/正文相似 → 合并并保留所有来源；冲突 → 标记不抹平；单 reviewer 但证据清晰 → 保留；无文件/行号且非全局设计问题 → 降级 weak；**reviewer failure ≠ approve**。

**LLM arbiter 为可选增强**：
- **由 self 宿主执行**（self 不参与 review，正好做裁决，避免自审悖论与额外成本归属不清）。
- 不得新增 unsupported finding；只能从多 reviewer 结论严格归纳。
- **失败回退确定性结果**；全部 reviewer 失败 → verdict = `blocked-by-review-failure`；关键 reviewer 失败但其他通过 → summary 标注 coverage 不完整。

JSON 中 `arbitration` 独立字段，不覆盖 `reviewers[].result`；text 先仲裁结论再 reviewer 原始分节。

## 12. Schema 与词表统一（修复 review 的 D）

三类封闭枚举 + 映射，避免词表打架：

- **reviewer verdict**：`approve` | `needs-attention`。
- **aggregate(arbiter) verdict**：`approve` | `needs-attention` | `blocked-by-review-failure`（仅“全部/关键 reviewer 失败”用第三种）。
- **job status**：`queued` | `running` | `completed` | `failed` | `canceled`。
- **result status**：`completed` | `partial` | `failed` | `canceled`（`partial` = 部分 reviewer 成功）。

映射：reviewer 全 approve → aggregate approve → result completed；任一 needs-attention → aggregate needs-attention；部分失败 → result partial；全部失败 → aggregate blocked-by-review-failure + result failed。

### 12.1 Reviewer output
```json
{ "verdict": "approve|needs-attention", "summary": "string",
  "findings": [{ "severity": "critical|high|medium|low", "title": "", "body": "",
    "file": "rel/path", "line_start": 1, "line_end": 1, "confidence": 0.8, "recommendation": "" }],
  "next_steps": [] }
```
### 12.2 Task output
```json
{ "status": "ok|error|timeout|canceled", "mode": "read-only|write", "summary": "", "final_message": "",
  "touched_files": [], "verification": [], "residual_risks": [], "next_steps": [],
  "sessionId": "string|null", "resumeHint": "string|null" }
```
`touched_files` 对 read-only 必须为空；write 必须尽量列全并保留 executor 原始最终答复。

### 12.3 Crosscheck result
```json
{ "version": 1, "kind": "review|adversarial-review|gate|rescue|task", "job_id": "...",
  "status": "completed|partial|failed|canceled", "self": "codex|cursor|claude|unknown",
  "target": { "cwd": "", "mode": "working-tree|branch|commit", "label": "", "base_ref": null, "commit": null,
    "changed_files": [], "diff_stat": "", "context_mode": "inline-full|inline-summary|repo-readonly",
    "truncated": false, "omitted_files": [] },
  "reviewers": [{ "name": "", "self_review": false, "status": "completed|failed|timeout|skipped",
    "duration_ms": 0, "mode": "native|prompt-fallback", "structured": true, "schema_valid": true,
    "capabilities": {}, "result": {}, "raw_output_file": "", "error": null }],
  "executors": [], "arbitration": {},
  "safety": { "pre_status": "", "post_status": "", "repo_changed_during_review": false, "warnings": [] },
  "follow_up_commands": [] }
```
> `kind` 含 `rescue|task`（修复 review 的 D：result.kind 缺 rescue/task）。

### 12.4 Job
```json
{ "id": "", "kind": "review|adversarial-review|rescue|task|gate", "workspaceRoot": "",
  "createdAt": "", "startedAt": "", "completedAt": null, "heartbeatAt": "",
  "status": "queued|running|completed|failed|canceled",
  "phase": "starting|probing-reviewers|resolving-target|collecting-context|reviewing|arbitrating|rendering|done|failed",
  "pid": 0, "reviewers": [], "executors": [], "summary": "", "logFile": "", "resultFile": "", "errorMessage": null }
```

## 13. State 与后台任务（修复 review 的 C）

### 13.1 State root：稳定目录，非 TMPDIR
```text
${CROSSCHECK_DATA_DIR:-$HOME/.crosscheck}/state/<repo-slug>-<hash>/
  state.json  jobs/<job-id>.json  <job-id>.log  <job-id>.result.json  <job-id>.raw.<reviewer>.log
```
宿主若提供 plugin data dir（如 Claude plugin data env）则优先；否则用 `~/.crosscheck`。**不默认 `$TMPDIR`**（重启/清理会丢）。

### 13.2 并发安全（plan-gpt/我方早期都缺）
- **原子写**：写临时文件 + `rename()` 替换，杜绝半截 JSON。
- **文件锁**：`state.json` 与单个 job 文件更新走 `flock`/lockfile，避免并发 job 互相覆盖。
- **心跳**：running job 周期更新 `heartbeatAt`。
- **僵尸恢复**：读取时若 `pid` 不存在且心跳超时，将 job 标记 `failed`（zombie-recovered），保留 partial logs。

### 13.3 background / status / cancel
- `--background`：建 job record → spawn detached child → 父进程立即回 job id + follow-up 命令。
- `status <id> --wait`：每 ~2s 读 job 文件，终态返回；timeout 保留 running。
- `cancel`：定位 pid → **终止整个 process tree**（非只 kill 父）→ 更新 state → 保留 partial logs。

## 14. 安全模型

- review/gate 默认禁止：改 repo、执行 patch、调 editor/write 工具、传危险 flag、以写权限运行 reviewer、自动执行 reviewer next steps。
- **repo mutation 检测**：review 前后各跑 `git status --porcelain=v1 -uall`；不一致 → `safety.repo_changed_during_review=true` + verdict 至少 needs-attention + text 明确提示。
- **工具收敛 + 环境清洗**：per-agent 收敛工具（如 Claude review 仅 Read/Glob/Grep）；子进程清洗无关 env（尤其敏感凭证），仅注入必要变量。
- **anti-recursion**：gate/review 调用子 agent 时注入 `CROSSCHECK_CHILD=1`，子进程内 gate 自动短路，防止 review-gate 递归触发。
- **secrets**：不主动扫描，但 context collector 默认排除 `.env`/`.env.*`/`*.pem`/`*.key`/`*.p12`/`*.pfx`/`id_rsa`/`id_ed25519`；命中 changed files 时只记路径 + redacted 标记。
- **残余信任声明**：reviewer 仍是完整 agent，可读 repo 内文件并可能联网；Crosscheck 通过权限模式 + 工具收敛 + env 清洗 + pre/post 检测把风险降到“只读评审”级别，但不能 100% 防读取/外泄——文档须明示。

## 15. Gate 设计（补 gate input contract，对应 review-gpt P2）

- 类型：manual（`crosscheck gate`）/ host stop（宿主 hook 自动）。
- 判断：上一轮无代码改动 → 立即 `ALLOW`；有改动 → 跑 adversarial compact review（默认最快非 self reviewer，可配多 reviewer），只找 blocker。
- 首行严格 `ALLOW: <reason>` / `BLOCK: <reason>`，后续可附简短依据。
- **input contract**：`--previous-turn-file` 指向 JSON `{ host, kind, response_text, changed_files_before, changed_files_after, commands, workspace }`；**拿不到 previous-turn 时 fallback 到当前 Git delta gate 并降低 confidence**。
- **阻断能力分级**：v1 **仅 Claude 原生 Stop hook 可真正阻断**；Cursor/Codex gate 为 advisory（只输出 ALLOW/BLOCK，不强制拦截），待各宿主 hook 能力实测后再升级。

## 16. 宿主集成（混合形态）

- **可移植 skill（三宿主共用）**：`crosscheck/SKILL.md` 第三人称 description + 触发词（cross review/交叉评审/crosscheck/adversarial/review gate/rescue/交叉委派）；指示宿主调用 `crosscheck`、review-only lane 不得触发写、stdout 原样返回（可附简短综合不覆盖 findings）、大 diff 推荐 background。
- **三类内部 skill**：`crosscheck-runtime`（只选并调一次命令、stdout 原样）/ `crosscheck-result-handling`（executor 未成功调用时不编造替代结论、审后必停问用户再改、禁自动修复）/ `crosscheck-prompting`（只收紧委派 prompt）。
- **Claude 原生 plugin**：slash 命令（`disable-model-invocation` 用于确定性命令）+ **Stop-gate hook** + **rescue subagent**（薄转发，只调一次 `crosscheck task`，不自读 repo/grep/总结）。
- **Cursor commands**：`.cursor/commands/crosscheck-*.md`，必须显式传 `--self cursor "$ARGUMENTS"`。
- **安装器** `node scripts/install.mjs [--hosts ...] [--link|--copy] [--enable-gate]`：默认 symlink（便于迭代），失败 fallback copy；不覆盖用户同名文件（先备份/提示）。目标：Codex `~/.codex/skills/`、Claude `~/.claude/`（skill + plugin）、Cursor `~/.cursor/skills/` + 项目 `.cursor/commands/`。**安装路径在 Phase 0 对各宿主官方规范实测后锁定**（对应 review-gpt P2）。

## 17. 配置

`.crosscheck/config.json`（repo）/ `~/.crosscheck/config.json`（user）。优先级：**CLI args > env > repo config > user config > defaults**。含 reviewers（bin/model/timeout）、context（max_inline_diff_bytes/max_untracked_file_bytes/secret_path_patterns）、jobs（max_jobs/background_threshold_files）、gate（enabled/reviewers/timeout）。

## 18. 测试计划

- **unit**：args、self detection、reviewer/executor selection、rescue intent 分类、resume/fresh routing、git target、default base、untracked 收集、secret redaction、context truncation、prompt 插值、schema 校验、verdict/status 映射、render、state 原子写/锁、job pruning、cancel process tree。
- **adapter contract tests（核心）**：每 agent 覆盖 binary discovery、auth detection、review readonly invocation（危险 flag 不存在 + 权限模式正确）、task write invocation（仅 rescue/task lane）、JSON/schema 输出与降级、session/resume、background/cancel、repo mutation detection。只有通过的 agent 才声明 supported。
- **fixture**：`fake-cursor-agent/claude/codex` 覆盖成功 JSON / text-only / invalid JSON / 非零退出 / timeout / partial / 无行号 finding；fake executor 覆盖 read-only 成功 / write 含 touched_files / resume-last / fallback / timeout/canceled / read-only 模式下试图写 repo。
- **command asset tests**：review 含 review-only；adversarial 含 design challenge framing；rescue 是 thin forwarder（只调 task）；status/result/cancel `disable-model-invocation`；background 不等待；foreground 返回 stdout 原文；Cursor/Claude 命令传 `--self`；命令不引用未公开内部脚本。
- **integration smoke**：`doctor` / `review --only cursor --wait` / `review --reviewer cursor,claude --background` / `rescue --only cursor --read-only` / `rescue --only claude --write` / `status` / `result` / `cancel` / `adversarial-review --base main`。Codex 不可用不应使整体失败，doctor 正确报 unavailable。
- **safety tests**：review/read-only rescue 后 repo status 不变；write rescue 后 touched_files 与 post diff 一致；fake reviewer 试图写文件被检测；secret 文件不全文入 context；危险 flag 不出现在 invocation。

## 19. 实施顺序

**Phase 0 — 能力核验 + 纵向切片（风险前置，先验证再铺开）**
1. Node package + CLI skeleton + args。
2. 各 CLI 实测：`--help`、auth 探测、JSON/schema 输出、只读模式、native review 能力、Cursor `--trust` 是否必需、session/resume 字段、宿主 hook/data-dir 能力、安装路径规范。
3. 纵向切片：`crosscheck review --only <一个可用 reviewer> --wait --scope working-tree` 端到端跑通（git context → prompt → 调用 → schema → render），确立单 reviewer 真实可用。

**Phase 1 — 横向铺开**
4. Git target/context（含 §7 in-repo 抽 diff、worktree 仅 branch/commit）。
5. schema + render + verdict/status 映射。
6. reviewer/executor registry + fake reviewer/executor + adapter contract tests。
7. 三 adapter（review/task/resume/cancel）。
8. 前台 review/adversarial-review。
9. rescue/task read-only 与 write 路径。
10. state/jobs/logs（原子写 + flock + 心跳 + 僵尸恢复）。
11. background/status/result/cancel。
12. 确定性仲裁（+ 可选 self-arbiter）。
13. setup/doctor。
14. prompt/runtime/result-handling/prompting skill 套件。
15. 可移植 skill + Claude plugin（hooks/subagent）+ Cursor commands。
16. install/uninstall。
17. gate（含 input contract + anti-recursion，Claude 阻断 / 其余 advisory）。
18. integration smoke + 文档。

每步随附测试，不留到最后统一补。

## 20. 不做的事

- review 自动修复 / 自动触发 rescue/task / 自动应用修复。
- 默认让 reviewer 在目标 repo 以写权限运行。
- 多 executor 默认并行写同一 worktree。
- 用 MCP 作默认架构（仅当宿主原生 tool schema 明显更优时再包在同一 runtime 后引入，不改 review model）。
- 依赖各 CLI 未公开内部 API。
- 把 reviewer 输出当事实（必须保留 confidence/grounding/raw）。
- 把所有文件无差别塞进 prompt。

## 21. 验收标准

1. 至少两宿主可用原生入口触发交叉 review。
2. 默认排除 self 且能调至少两个非 self reviewer。
3. review/adversarial 支持 wait/background。
4. rescue/task 支持 read-only/write/wait/background/resume/fresh。
5. status/result/cancel 可用。
6. setup/doctor 准确报 CLI/auth/capability matrix。
7. 每 reviewer/executor raw output 留痕。
8. schema output 可验证，verdict/status 映射自洽。
9. 多 reviewer 确定性仲裁可用（self-arbiter 可选）。
10. review / read-only rescue 后 repo 不变；write rescue 记录 touched_files。
11. stop gate 可启停，Claude 真阻断、其余 advisory。
12. 状态默认稳定目录且并发安全（原子写/锁/心跳/僵尸恢复）。
13. fake reviewer/executor tests 覆盖成功/失败/timeout/invalid JSON。
14. command asset tests 保证两 lane 不混淆。
15. prompt 明确继承 codex-plugin-cc 的 adversarial/rescue/runtime/result-handling/prompting 技巧。
16. 文档覆盖安装/用法/故障排查/配置/安全边界（含残余信任声明）。
```

