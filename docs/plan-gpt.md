# Crosscheck 终态方案：跨 Coding Agent 交叉 Review / Rescue Skill

## 0. 结论

Crosscheck 的目标不是做一个轻量 demo，也不是简单把 `git diff` 塞给另一个 CLI。目标是做一个能力尽可能对齐 `openai/codex-plugin-cc` 的交叉协作系统：把 `codex-plugin-cc` 中“Claude Code 调 Codex review/rescue”的单向形态扩展成多宿主、多 reviewer / executor 的通用形态。

最终形态应具备这些能力：

- 在 Codex、Cursor、Claude Code 任意宿主中触发交叉 review。
- 默认排除当前宿主 self，调用所有可用的非 self reviewer。
- 支持显式指定 reviewer，包括 Cursor、Claude Code、Codex，以及后续扩展的 Gemini、Aider 等。
- 支持普通 review、adversarial review、stop/review gate。
- 支持 `setup`、`review`、`adversarial-review`、`rescue`、`task`、`status`、`result`、`cancel`、`gate` 等完整命令。
- 支持前台等待和后台任务。
- 支持 rescue/task 会话恢复：`--resume`、`--fresh`、`--resume-last`、session id、resume hint。
- 保存每个 reviewer 的原始输出，同时归一化成统一 schema。
- 对多个 reviewer 的输出做仲裁聚合，产出共识、冲突、最高风险项和建议处理顺序。
- review/gate lane 默认只读，不允许被调用 reviewer 修改目标仓库。
- rescue/task lane 是独立委派入口，可按用户意图或显式 flag 进入可写模式，不能和 review-only lane 混用。
- 重点复用 `codex-plugin-cc` 的实现分层、review target 选择、job state、prompt 技巧、runtime/result-handling/prompting skill 套件、schema 输出、后台任务、resume 和 hook/gate 思路。

本方案与此前两版草案相比的核心变化：

- 不再把后台任务、状态管理、review gate 放到“以后再做”；它们是终态的一等能力。
- 不再把 `rescue/task`、会话恢复、prompt/runtime/result-handling skills 视为越界；这些属于对齐 `codex-plugin-cc` 的核心范围。
- 不再以实现成本区分 demo 和最终版；AI 开发下应直接朝完整产品形态设计。
- Claude 方案中的“默认 fan-out 给所有非 self reviewer”和“共享安装”保留。
- GPT 方案中的“Node runtime、schema、adapter、timeout、安全检查”保留。
- 纯 Bash 引擎不作为主 runtime；Bash 只作为宿主命令模板中的薄调用层。

## 1. 设计原则

### 1.1 Crosscheck 是 review system，不是 prompt wrapper

Crosscheck 必须显式处理：

- review 范围如何确定。
- reviewer 如何选择。
- reviewer 如何安全执行。
- 输出如何保存、展示、复查、取消。
- 多 reviewer 之间如何聚合。
- 当前宿主如何在不同 IDE/agent 中触发同一能力。

如果只做 `crosscheck.sh | claude -p | cursor-agent -p`，它会很快遇到这些问题：

- 大 diff prompt 过长。
- 多 reviewer 输出不可比较。
- reviewer 失败后无法恢复。
- 用户无法查看后台结果。
- 无法对 review gate 做可靠控制。
- 无法稳定测试。
- 无法判断 CLI flag 随版本变化后的兼容性。

所以终态采用公共 runtime + 宿主薄集成，而不是每个宿主各写一套逻辑。

### 1.2 以 `codex-plugin-cc` 为主要参考

重点参考这些实现思路：

- 命令层：`review`、`adversarial-review`、`setup`、`status`、`result`、`cancel` 分离。
- review-only 指令：命令层强约束只运行 review，不修复、不 patch、不改代码。
- wait/background UX：小 review 推荐前台，大 review 推荐后台。
- Git target resolution：自动在 working tree 和 branch diff 之间选择。
- untracked 文件处理：把 untracked 也当作 reviewable work。
- 结构化 schema：`verdict`、`summary`、`findings`、`next_steps`。
- adversarial prompt：用角色、任务、攻击面、finding bar、grounding、calibration、final check 分层约束。
- job state：workspace scoped state、job 文件、log 文件、status/result/cancel。
- rescue/task：通过薄 forwarder 把 investigation、明确 fix request、follow-up work 委派给另一个 agent。
- resume/fresh：对可恢复的 rescue/task thread 做显式继续或新开。
- prompt skill suite：runtime 只转发、result-handling 不编造、prompting 只收紧委派 prompt。
- setup：检查 CLI、auth、runtime，并给出可执行修复步骤。
- stop review gate：宿主停止前可以自动触发只读审查。

Crosscheck 不应照抄 `codex-plugin-cc` 的 Claude 专用细节，但应复用它的产品结构和 review 方法论。

### 1.3 公共 runtime，宿主只做薄封装

核心逻辑放在 Node runtime：

- 参数解析。
- Git context 收集。
- reviewer 探测。
- reviewer 调用。
- prompt 构造。
- JSON/schema 校验。
- job 状态。
- render。
- setup。
- gate。

宿主侧只做薄封装：

- Codex：portable skill 调用 `crosscheck`。
- Claude Code：portable skill/reference + plugin slash command/Stop hook/rescue forwarder 调用 `crosscheck`。
- Cursor：portable skill/rule + command/plugin shim 调用 `crosscheck`。

这样可以避免三套宿主集成出现行为漂移。

### 1.4 默认交叉，允许显式自审

默认行为：

- 自动识别当前宿主 self。
- 自动检测可用 reviewer。
- 默认 reviewer = 可用 reviewer - self。
- 如果没有非 self reviewer，给出 setup/doctor 诊断，不静默退化为 self review。

用户显式指定时允许自审：

```bash
crosscheck review --only codex
crosscheck review --reviewer cursor,claude,codex --allow-self
```

自审不是默认路径，输出必须标明 `self_review: true` 或在 text render 中提示“此 reviewer 与当前宿主相同，不属于交叉 review”。

### 1.5 两条 Lane：Review 只读，Rescue 独立委派

Crosscheck 必须把 review lane 和 rescue/task lane 严格分开。

Review lane 包括：

```text
review
adversarial-review
gate
```

这些命令永远是 review-only：

- 不修改目标仓库。
- 不调用 patch/apply/edit 工具。
- 不向 reviewer 授予写权限。
- 不运行危险 flag，例如 `--force`、`--yolo`、`--dangerously-skip-permissions`。
- review 前后检查目标 repo 状态，发现变化要报告 safety violation。

Rescue/task lane 包括：

```text
rescue
task
```

这些命令对齐 `codex-plugin-cc` 的 `/codex:rescue`：用于 investigation、明确 fix request、follow-up rescue work、继续先前委派线程。它们可以进入可写模式，但必须满足：

- 可写能力只能来自独立 `rescue/task` 入口，不能由 `review` 自动触发。
- 用户显式要求 review、diagnosis、research、read-only 时必须只读。
- 用户明确要求 fix、implement、apply、update、修复、实现时，`rescue` 可以默认选择 write-capable executor。
- 内部 `task` runtime 支持 `--write` / `--read-only`，但用户心智以 `rescue` 为主；裸 `task` 的默认值应由 adapter contract tests 对齐 upstream 行为后固定。
- 可写委派必须记录 pre/post diff、touched files、session id 和 resume hint。
- rescue/task 结果返回后，宿主不能把它当作 review 结果；如果产生代码修改，仍应建议后续 review。

### 1.6 关键取舍与思考

#### 1.6.1 对齐 `codex-plugin-cc` 不等于只做 review

`codex-plugin-cc` 的能力边界不是单个 `/codex:review`。它同时包含：

- review/adversarial-review 的只读审查路径。
- rescue 这种把明确问题、investigation、fix request 委派给另一个 agent 的路径。
- task runtime、background job、status/result/cancel。
- resume/fresh/session handling。
- runtime、result-handling、prompting 三类 skill，把“怎么调用”“怎么展示”“怎么收紧委派 prompt”拆开。

因此 Crosscheck 的终态必须覆盖 review + rescue/task 两类协作。真正需要控制的是 lane 隔离，而不是把 rescue/task 排除在目标之外。

#### 1.6.2 Review 的安全边界不是 `scratch cwd`

早期草案容易把“在 scratch 目录运行 reviewer”当成安全模型，但这对 native reviewer 不够真实：

- 如果只把 diff 内联到 prompt，scratch cwd 可用，且更容易限制 reviewer 看到的上下文。
- 如果 reviewer 需要读相邻文件、package metadata、类型定义或调用链，必须允许它在真实 repo 上下文中只读运行。
- working tree 包含 staged、unstaged、untracked，不能简单用普通 `git worktree` 复刻；否则会漏 review 范围。
- branch/commit 是已提交态，才适合用 disposable worktree 做隔离优化。

所以最终取舍是：review 范围由 Crosscheck 引擎确定性抽取；运行位置按 adapter 能力选择；安全边界由只读权限、工具白名单、危险 flag 禁用、环境清洗和 pre/post repo 状态检测共同保证。

#### 1.6.3 默认仲裁应是确定性合并，LLM arbiter 只是增强

多 reviewer 输出需要聚合，但不能让一个额外 LLM 默认“重新 review 一遍”。否则会出现三个问题：

- arbiter 可能发明原 reviewer 没有提出的新 finding。
- arbiter 的结论不可稳定复现，测试困难。
- 在所有 reviewer 已经失败或上下文不足时，arbiter 可能掩盖 coverage 问题。

因此默认仲裁采用确定性规则：按文件/行号/标题相似度合并 finding，提升 critical/high，保留冲突和 reviewer 来源。可选 LLM arbiter 只能在确定性结果之后做摘要和排序，并且必须遵守“不新增 finding、不覆盖 raw output、失败则 fallback deterministic”的规则。

#### 1.6.4 宿主集成采用“共享 runtime + 可移植 skill + 必要原生薄壳”

只做 Claude plugin、Codex skill 或 Cursor command 都会让能力漂移；只做一个纯 CLI 又损失宿主内的 discoverability 和 hook/subagent 能力。最终取舍是混合形态：

- 共享 Node runtime 是唯一行为真相。
- 可移植 `crosscheck` skill 安装到支持 skill 的宿主，用来承载统一心智、prompt 技巧和故障处理规则。
- 每个宿主只补必要薄壳：Claude slash command/Stop hook/rescue subagent，Codex skill 入口，Cursor command/plugin shim。

这样既保留 `codex-plugin-cc` 的 prompt skill 思路，又避免三套实现分别演化。

#### 1.6.5 Adapter contract tests 是支持门槛，不是阶段规划

用户不需要 demo/最终版分层，但 CLI flag 和权限语义会随 Cursor、Claude、Codex 版本变化。Crosscheck 不能靠文档猜测当前 CLI 行为。

因此 adapter contract tests 和 `doctor` 是终态产品的一部分：

- 支持某个 adapter 前必须实测 json output、只读模式、workspace 参数、resume、cancel、schema 能力。
- 如果某个能力不稳定，就在 capability matrix 标记 partial/unavailable，而不是在命令中假装支持。
- 这不是 Phase 0，也不是成本控制；它是避免把错误权限语义写进产品契约。

#### 1.6.6 写权限只属于 rescue/task，且必须可追溯

`codex-plugin-cc` 的 rescue 默认可能把 fix request 转成 write-capable task，但 review 命令不会因此变成“review 后顺手修”。Crosscheck 保持同样语义：

- review/adversarial/gate 永远只读。
- rescue/task 可以可写，但必须是独立入口、显式记录模式、保留 executor raw output。
- read-only 与 write-capable 的判断来自用户显式 flag 和意图分类；冲突时显式 flag 优先。
- 写入后必须记录 touched files、pre/post diff 摘要、verification 和 resume hint，便于后续再触发 review。

## 2. 产品能力矩阵

| 能力 | 终态要求 | 说明 |
| --- | --- | --- |
| 普通 review | 必须 | 找 bug、回归、缺失测试、风险 |
| adversarial review | 必须 | 挑战设计、假设、边界、是否应发布 |
| rescue | 必须 | 对齐 `/codex:rescue`，委派 investigation / fix request / follow-up work |
| task runtime | 必须 | 内部执行入口，支持 read-only / write-capable、resume-last、background |
| multi-reviewer fan-out | 必须 | 默认调用所有非 self 可用 reviewer |
| executor 指定 | 必须 | `--executor`、`--only`，默认排除 self |
| reviewer 指定 | 必须 | `--reviewer`、`--only` |
| self 检测 | 必须 | env、host hint、process/context，多层 fallback |
| setup/doctor | 必须 | 检查 CLI、auth、版本、可用 flag |
| background job | 必须 | `--background`、job id、log、status/result/cancel |
| wait mode | 必须 | `--wait` 前台等待 |
| 自动 wait/background 建议 | 必须 | 小 diff 前台，大 diff 后台 |
| resume/fresh | 必须 | rescue/task 支持继续上次 thread 或强制新开 |
| status | 必须 | 当前 workspace 的 active/recent jobs |
| result | 必须 | 完整输出，不压缩 |
| cancel | 必须 | 取消 active job |
| stop gate | 必须 | 宿主结束前可触发 review gate |
| structured output | 必须 | schema 统一 |
| raw output 保存 | 必须 | 每个 reviewer 原始输出可追溯 |
| arbiter 聚合 | 必须 | 多 reviewer 共识、冲突、最高风险 |
| prompt skill 套件 | 必须 | 对齐 prompting / runtime / result-handling 三类 skill |
| install | 必须 | 安装到 Codex / Claude / Cursor |
| tests | 必须 | unit、fixture、integration smoke |

## 3. 仓库结构

建议结构：

```text
crosscheck/
  package.json
  package-lock.json
  bin/
    crosscheck.mjs
  src/
    cli/
      main.mjs
      args.mjs
      commands/
        setup.mjs
        review.mjs
        adversarial-review.mjs
        rescue.mjs
        task.mjs
        status.mjs
        result.mjs
        cancel.mjs
        gate.mjs
        doctor.mjs
    git/
      repository.mjs
      target.mjs
      context.mjs
      diff-size.mjs
      worktree.mjs
    reviewers/
      registry.mjs
      base.mjs
      cursor.mjs
      claude.mjs
      codex.mjs
    executors/
      registry.mjs
      cursor.mjs
      claude.mjs
      codex.mjs
    runtime/
      process.mjs
      timeout.mjs
      env.mjs
      scratch.mjs
      state.mjs
      jobs.mjs
      locks.mjs
      logs.mjs
      safety.mjs
      sessions.mjs
      gate-input.mjs
    prompts/
      templates.mjs
      review.md
      adversarial-review.md
      stop-gate.md
      arbitration.md
      task.md
    schema/
      review-output.schema.json
      task-output.schema.json
      crosscheck-result.schema.json
      job.schema.json
      gate-input.schema.json
    render/
      text.mjs
      json.mjs
      status.mjs
      result.mjs
    install/
      detect-hosts.mjs
      install.mjs
      uninstall.mjs
  skills/
    cross-agent-review/
      SKILL.md
      agents/
        openai.yaml
      references/
        adapters.md
        commands.md
        review-rubric.md
        rescue-runtime.md
        troubleshooting.md
    crosscheck-runtime/
      SKILL.md
    crosscheck-result-handling/
      SKILL.md
    crosscheck-prompting/
      SKILL.md
      references/
        prompt-blocks.md
        recipes.md
        antipatterns.md
  hosts/
    claude/
      .claude-plugin/
        plugin.json
      commands/
        crosscheck-review.md
        crosscheck-adversarial-review.md
        crosscheck-rescue.md
        crosscheck-status.md
        crosscheck-result.md
        crosscheck-cancel.md
        crosscheck-setup.md
      agents/
        crosscheck-rescue.md
      hooks/
        hooks.json
    cursor/
      .cursor-plugin/
        plugin.json
      commands/
        crosscheck-review.md
        crosscheck-adversarial-review.md
        crosscheck-rescue.md
        crosscheck-status.md
        crosscheck-result.md
        crosscheck-cancel.md
        crosscheck-setup.md
  scripts/
    install.mjs
    smoke.mjs
  tests/
    args.test.mjs
    git-target.test.mjs
    context.test.mjs
    reviewers.test.mjs
    render.test.mjs
    state.test.mjs
    jobs.test.mjs
    commands.test.mjs
    fixtures/
      fake-cursor-agent.mjs
      fake-claude.mjs
      fake-codex.mjs
  docs/
    plan-gpt.md
    plan-claude.md
    architecture.md
```

说明：

- `src/` 是唯一真实 runtime。
- `skills/` 是可移植 skill 资产，安装到支持 skill/rule 的宿主。
- `hosts/claude` 和 `hosts/cursor` 是必要原生薄壳；Claude 包含 slash command、Stop hook、rescue subagent，Cursor 先提供 commands。
- `scripts/install.mjs` 负责将资产安装/软链到各宿主目录。
- `docs/architecture.md` 可由本方案拆出，但本方案本身应足够指导实现。

## 4. 命令设计

### 4.1 总入口

```bash
crosscheck <command> [options] [focus...]
```

命令：

```text
setup
doctor
review
adversarial-review
rescue
task
gate
status
result
cancel
install
uninstall
```

`doctor` 是只读诊断；`setup` 可以提示安装或配置。

### 4.2 setup

```bash
crosscheck setup [--json] [--install-missing] [--enable-gate] [--disable-gate]
```

职责：

- 检查 Node/npm。
- 检查 `crosscheck` runtime 可执行。
- 检查 Git。
- 检查 reviewer/executor CLI：
  - `cursor-agent`
  - `claude`
  - configured Claude wrapper，例如 `claude-w`
  - `codex`
- 检查 reviewer/executor auth/login：
  - Cursor：`cursor-agent status` 或 `cursor-agent whoami`。
  - Claude：`claude`/wrapper 的可用性和非交互调用能力。
  - Codex：`codex` 是否存在、是否可执行、是否支持目标 review/exec 模式。
- 检查关键 flag 是否支持：
  - Cursor：`-p`、`--mode ask`、`--output-format json`、`--workspace`。
  - Claude：`-p`、`--output-format json`、只读/plan 权限模式。
  - Codex：优先 native review；否则 fallback 到只读 prompt/exec。
- 检查宿主安装：
  - Codex skill 是否安装。
  - Claude plugin/commands 是否安装。
  - Cursor command/plugin 是否安装。
- 支持启用/禁用 gate。

输出字段：

```json
{
  "ready": true,
  "crosscheck": {"version": "x.y.z", "path": "..."},
  "git": {"available": true, "version": "..."},
  "reviewers": {
    "cursor": {"available": true, "authenticated": true, "path": "...", "capabilities": []},
    "claude": {"available": true, "authenticated": true, "path": "...", "wrapper": "claude-w", "capabilities": []},
    "codex": {"available": false, "authenticated": false, "path": null, "capabilities": []}
  },
  "hosts": {
    "codex": {"installed": true, "path": "..."},
    "claude": {"installed": true, "path": "..."},
    "cursor": {"installed": false, "path": null}
  },
  "gate": {"enabled": false},
  "next_steps": []
}
```

### 4.3 doctor

```bash
crosscheck doctor [--json]
```

`doctor` 不做安装、不改配置，只报告当前状态。

与 `setup` 的区别：

- `doctor` 是纯只读。
- `setup` 可以根据参数安装/配置。

### 4.4 review

```bash
crosscheck review [--wait|--background] [--base <ref>] [--scope auto|working-tree|branch] [--commit <sha>] [--reviewer cursor,claude,codex] [--only cursor] [--self codex|cursor|claude] [--allow-self] [--format text|json] [--timeout-ms <ms>]
```

普通 review 目标：

- 找行为 bug。
- 找回归。
- 找缺失测试。
- 找边界条件。
- 找错误处理问题。
- 找兼容性问题。
- 找安全/权限/数据一致性风险。

普通 review 对齐 `codex-plugin-cc`：不接受自定义 focus text，不挑战“是否应该这么设计”。需要聚焦某个风险或挑战设计时使用 `adversarial-review`。

### 4.5 adversarial-review

```bash
crosscheck adversarial-review [--wait|--background] [--base <ref>] [--scope auto|working-tree|branch] [--commit <sha>] [--reviewer cursor,claude,codex] [--only cursor] [--self codex|cursor|claude] [--allow-self] [--format text|json] [--timeout-ms <ms>] [focus...]
```

adversarial review 目标：

- 挑战实现路径是否正确。
- 挑战设计选择。
- 挑战隐含假设。
- 找 release blocker。
- 优先找高成本、高风险、难发现的问题。

它不是“更严格的普通 review”，而是设计/架构/风险层面的 challenge review。这一点应继承 `codex-plugin-cc` 的 prompt framing。

### 4.6 rescue

```bash
crosscheck rescue [--wait|--background] [--resume|--fresh] [--executor cursor,claude,codex] [--only codex] [--self codex|cursor|claude] [--write|--read-only] [--model <model>] [--effort none|minimal|low|medium|high|xhigh] [--format text|json] [--timeout-ms <ms>] [request...]
```

`rescue` 是用户可见的交叉委派入口，对齐 `codex-plugin-cc` 的 `/codex:rescue`，用于：

- investigation：让另一个 agent 深挖问题。
- explicit fix request：让另一个 agent 按请求修复。
- follow-up rescue work：继续上一轮委派的工作。
- stuck handoff：当前宿主卡住时交给另一个 agent。

默认 executor：

- 默认 executor = 可用 agent - self 中优先级最高的一个。
- 不默认并行可写；如果用户指定多个 executor 且需要可写，必须报错或强制每个 executor 使用独立 worktree。
- `--only` 等价于 `--executor` 的单值形式。

权限语义：

- `rescue` 可以是 read-only，也可以是 write-capable，但不能和 review lane 混淆。
- 如果用户显式传 `--read-only`，必须只读。
- 如果用户显式传 `--write`，使用可写 executor。
- 如果用户请求是 review、diagnosis、research、investigate、分析原因、看看为什么，默认 read-only。
- 如果用户请求是 fix、implement、apply、update、修复、实现、改掉，默认 write-capable。
- 默认判断必须在最终实现中通过 upstream `codex-plugin-cc` 行为和本地 adapter contract tests 锁定；不能靠文档猜测。

resume/fresh：

- `--resume`：继续该 repo 上最近一次同 executor 的 rescue/task session。
- `--fresh`：强制新开 session。
- 如果用户没有传 `--resume`/`--fresh`，但存在可恢复 session，交互式宿主应询问继续还是新开；非交互式宿主按请求语义判断，明显“继续/keep going/apply top fix/继续上次”则 resume，否则 fresh。
- result/status 必须展示 `sessionId` 和 `resumeHint`。

### 4.7 task

```bash
crosscheck task [--wait|--background] [--resume-last|--fresh] [--executor cursor|claude|codex] [--self codex|cursor|claude] [--write|--read-only] [--model <model>] [--effort none|minimal|low|medium|high|xhigh] [--format text|json] [--timeout-ms <ms>] [prompt...]
```

`task` 是内部 runtime 入口，类似 `codex-companion.mjs task`。宿主命令和 rescue 子代理可以调用它，但普通用户文档应优先推荐 `crosscheck rescue`。

规则：

- 每次 rescue handoff 最终只调用一次 `task`，薄转发，不在转发层读 repo、grep、总结或替代 executor 工作。
- `--write` 映射到 executor 的可写权限；未写入权限时使用 read-only。
- `--resume-last` 是内部 resume 控制；用户可见入口用 `--resume`。
- `--background` 创建 job，`--wait` 前台等待。
- task 输出必须被 result-handling 规则约束：executor 未成功调用时不能编造替代答案。

### 4.8 gate

```bash
crosscheck gate [--previous-turn-file <path>] [--base <ref>] [--scope auto|working-tree] [--reviewer cursor,claude,codex] [--timeout-ms <ms>] [--json]
```

用途：

- 宿主准备停止或结束一次代码修改 turn 时，自动跑 compact review gate。
- 如果上一轮没有产生代码修改，立即 ALLOW。
- 如果有修改，跑 adversarial stop-gate review。
- 输出首行必须是：
  - `ALLOW: <short reason>`
  - `BLOCK: <short reason>`

gate 不是完整 review 结果页，而是 stop-time blocker 判断。

`--previous-turn-file` 必须指向宿主生成的 gate input JSON。拿不到该文件时，gate fallback 到当前 Git delta，并在输出中降低 confidence，不能假装知道上一轮真实动作。

### 4.9 status

```bash
crosscheck status [job-id] [--wait] [--timeout-ms <ms>] [--all] [--json]
```

无 job id：

- 显示当前 workspace 的 active/recent jobs。
- 紧凑表格。
- 字段包括 job id、kind、reviewers、status、phase、elapsed/duration、summary、follow-up command。

有 job id：

- 显示该 job 的完整状态、log excerpt、result availability。

### 4.10 result

```bash
crosscheck result [job-id] [--json] [--raw] [--reviewer cursor]
```

职责：

- 显示已完成 job 的完整输出。
- 默认显示聚合 text result。
- `--json` 显示 schema 输出。
- `--raw` 显示每个 reviewer 原始输出。
- `--reviewer` 只看某个 reviewer。

### 4.11 cancel

```bash
crosscheck cancel [job-id] [--json]
```

职责：

- 取消 active job。
- 终止子进程树。
- 更新 job state 为 `canceled`。
- 保留已产生的 partial output 和 logs。

## 5. wait/background UX

沿用 `codex-plugin-cc` 的交互思路：

- 如果用户传 `--wait`，直接前台执行。
- 如果用户传 `--background`，直接后台执行。
- 如果用户都没传，先估算 review 大小，再给宿主命令层一个推荐。

大小估算：

- working tree：
  - `git status --short --untracked-files=all`
  - `git diff --shortstat --cached`
  - `git diff --shortstat`
  - untracked 文件/目录也算 reviewable work。
- branch：
  - `git diff --shortstat <base>...HEAD`
- commit：
  - `git show --shortstat --format=short <sha>`

推荐规则：

- 只有 1-2 个小文件、无目录级变更、diff 很小：推荐 wait。
- 其他情况，包括规模不明：推荐 background。
- 不要因为 diff shortstat 为空就断言无内容；必须检查 untracked。
- 不确定时跑 review，而不是说没东西可审。

宿主命令层应有类似 `AskUserQuestion` 的体验：

- `Wait for results`
- `Run in background`

在不支持交互选择的宿主中，默认 background，除非用户显式 `--wait`。

## 6. Git review target

### 6.1 target mode

支持：

```text
working-tree
branch
commit
```

`auto` 规则：

1. 如果传 `--commit`，使用 commit。
2. 如果传 `--base`，使用 branch。
3. 如果传 `--scope working-tree`，使用 working-tree。
4. 如果传 `--scope branch`，使用 branch。
5. 如果 scope 是 auto：
   - working tree dirty：使用 working-tree。
   - 否则：检测默认 base，使用 branch。

### 6.2 默认 base 检测

按顺序：

1. `origin/HEAD` 指向的分支。
2. `origin/main`
3. `origin/master`
4. `main`
5. `master`
6. 如果都失败，要求用户传 `--base`。

### 6.3 working tree context

必须包括：

- `git status --short --untracked-files=all`
- staged diff
- unstaged diff
- untracked text files
- changed file list
- diff stat

untracked 限制：

- 单文件超过阈值时只记录路径和 size。
- binary 文件只记录路径和 binary 标记。
- 目录只记录路径和 directory 标记。

### 6.4 branch context

必须包括：

- base ref
- merge base
- `base...HEAD` diff stat
- commit list
- changed file list
- diff patch，受大小限制

### 6.5 commit context

必须包括：

- commit sha
- parent sha
- subject/body
- changed file list
- diff patch，受大小限制

## 7. Context collection 与执行位置策略

核心原则：review 范围由 Crosscheck 引擎确定性抽取，安全边界来自权限模式、工具收敛、环境清洗和 pre/post 状态检测，不来自 cwd 本身。

Crosscheck 支持三种 context 模式：

### 7.1 inline-full

适用：

- diff 小。
- prompt-only reviewer 足以完成审查。

行为：

- 引擎内联完整 status、diff、changed files、合规 untracked 文本。
- 默认仍在 `repoRoot` 只读运行，贴近 native reviewer 和 `codex-plugin-cc` 的运行心智。
- 只有 prompt-only adapter 且 contract tests 证明无需 repo inspection 时，才可选择 scratch cwd 作为读取面优化；这不是默认安全边界。
- finding 必须基于内联 context。

### 7.2 inline-summary

适用：

- diff 中等。
- 包含大文件、二进制、密钥路径、被截断文件。

行为：

- 引擎内联 status、diff stat、changed files、关键 patch、截断说明。
- prompt 明确要求 reviewer 对覆盖不足的结论降低 confidence。
- reviewer 如需读取相邻文件，必须通过 adapter 的只读权限在 repoRoot 内执行；不能自行扩大 review 范围后不标注。

### 7.3 repo-readonly

适用：

- native reviewer 必须在真实 repo 中运行。
- 大 diff 需要读取相邻文件、跨文件调用关系或 package metadata。
- working-tree review 包含 staged、unstaged、untracked，无法可靠用普通 `git worktree` materialize。

行为：

- reviewer 在 `repoRoot` 内运行，但必须使用只读权限和工具白名单。
- 引擎仍然先生成 manifest 和 review target summary，告诉 reviewer 只审 scoped changes。
- working-tree 默认使用 repo-readonly，不使用普通 `git worktree`，避免漏掉 staged/unstaged/untracked。
- branch/commit 这种已提交态可选使用 disposable worktree；这只是隔离优化，不是默认安全边界。
- review 前后必须比对 `git status --porcelain=v1 --untracked-files=all`。

默认选择：

- 小 diff：inline-full。
- 中等 diff：inline-summary。
- native reviewer 或大 diff：repo-readonly。
- execution cwd 默认 repoRoot；scratch 只是 prompt-only adapter 的显式优化分支。
- branch/commit 可用 disposable worktree；working-tree 不走 worktree materialization，除非实现完整支持 staged/unstaged/untracked/binary/submodule/apply failure/cleanup。

无论哪种模式，最终输出都必须记录：

```json
{
  "context_mode": "inline-full|inline-summary|repo-readonly|disposable-worktree",
  "truncated": false,
  "omitted_files": [],
  "execution_cwd": "scratch|repoRoot|worktree",
  "readonly_policy": "prompt-only|agent-readonly|native-readonly"
}
```

## 8. Reviewer registry

### 8.1 Reviewer 定义

每个 reviewer adapter 实现：

```js
{
  name: "cursor",
  detect(env, cwd): Availability,
  probeCapabilities(env, cwd): Capabilities,
  buildInvocation(request): Invocation,
  parseOutput(result): ReviewerResult,
  normalizeError(error): ReviewerResult
}
```

### 8.2 Availability

```json
{
  "name": "cursor",
  "available": true,
  "path": "/Users/.../cursor-agent",
  "version": "string|null",
  "authenticated": true,
  "auth_hint": null,
  "capabilities": {
    "json_output": true,
    "readonly_mode": true,
    "workspace_arg": true,
    "native_review": false,
    "background_native": false
  },
  "warnings": []
}
```

### 8.3 Cursor adapter

首选调用：

```bash
cursor-agent -p --mode ask --output-format json --workspace <repoRoot-or-scratch> [--trust] "<prompt>"
```

必须：

- 不传 `--force`。
- 不传 `--yolo`。
- 不传 `--sandbox disabled`。
- `--trust` 是否必需由 adapter contract tests 决定；如果 headless `cursor-agent` 对 workspace 要求 trust，adapter 可以传 `--trust`，但只能 trust Crosscheck 已解析的目标 repoRoot/scratch，不能 trust 任意当前目录。
- 默认 `--mode ask`，不使用 plan/write 能力。
- 支持 `--model` 透传，但默认不指定模型。
- review lane 即使传 `--trust`，也必须保持 ask/read-only 语义，并通过 pre/post status 检测确认目标 repo 未变化。

探测：

- `cursor-agent --help`
- `cursor-agent status` 或 `cursor-agent whoami`
- `cursor-agent models` 可选
- headless workspace 是否要求 `--trust`

失败处理：

- 未登录：给出 login 指令。
- 不支持 json：fallback text parser，并标记 `structured=false`。
- 超时：status = `timeout`，保留 partial output。

### 8.4 Claude adapter

首选调用形态，具体参数名由 `doctor` 从当前 Claude CLI help 中验证后落地：

```bash
claude -p --permission-mode plan --output-format json [--json-schema <review-output.schema.json>] [<readonly-tool-whitelist-flag> Read,Glob,Grep] "<prompt>"
```

可配置 wrapper：

```bash
CROSSCHECK_CLAUDE_BIN=claude-w
```

必须：

- 不传 `--dangerously-skip-permissions`。
- 不授予写工具。
- review lane 只允许只读工具，例如 `Read`、`Glob`、`Grep`；具体工具名由 `doctor` 读取当前 Claude CLI help 后确认。
- 小 diff 默认用 context bundle；大 diff/native inspection 可在 repoRoot 内只读读取相邻文件，但不得扩大 review 范围后不标注。
- 支持模型透传，但默认不指定。
- 如果当前 Claude CLI 的 `--json-schema` 与 `--permission-mode plan` 不兼容，adapter contract tests 必须降级为 `--output-format json` + prompt schema 校验，并在 capabilities 中标记 `schema_output=partial`。

探测：

- configured Claude binary `--help`
- `--json-schema` 可用性
- tool whitelist 参数形式
- 非交互调用能力
- auth/wrapper 状态

本机特殊注意：

- 如果只发现 `claude-w` 而找不到 `claude`，`setup` 应报告 wrapper 可用但底层 Claude 可能缺失。
- 如果 wrapper 会弹交互模型选择，setup 应建议配置默认模型或通过 env 固定模型，避免 background job 卡住。

### 8.5 Codex adapter

优先级：

1. 如果当前 Codex CLI 支持 native review，并且支持所需 target，优先 native review。
2. 否则使用 Codex 非交互只读 prompt/exec fallback。
3. 如果 `codex` 不存在或未登录，报告 unavailable。

必须：

- 不依赖 `codex-plugin-cc` 的内部 `codex-companion.mjs`。
- 不把 internal app-server API 当公共契约。
- 通过 `codex --help` / `codex review --help` / `codex exec --help` 实测能力。
- 默认只读 sandbox 和 non-interactive approval policy。

潜在调用示例必须由实现时探测决定，不能在方案中硬编码为唯一真相。

## 9. Executor registry

Executor 与 reviewer 使用同一批 agent adapter，但权限和输出契约不同。

### 9.1 Executor 定义

每个 executor adapter 实现：

```js
{
  name: "codex",
  detect(env, cwd): Availability,
  probeCapabilities(env, cwd): Capabilities,
  buildTaskInvocation(request): Invocation,
  parseTaskOutput(result): TaskResult,
  buildResumeInvocation(request): Invocation,
  normalizeTaskError(error): TaskResult
}
```

### 9.2 Rescue 与 Task 的对齐语义

对齐 `codex-plugin-cc` 时，用户可见入口是 `rescue`，内部 runtime 是 `task`。

`task` runtime：

- 支持 `--write` / `--read-only`。
- 支持 `--resume-last` / `--fresh`。
- 支持 `--background` / `--wait`。
- 支持 model/effort 透传。
- 不自行判断用户意图；只按传入 flag 执行。

`rescue` forwarder：

- 负责把用户请求收紧成更好的 task prompt。
- 负责剥离 routing flags，不把 `--background`、`--wait`、`--resume`、`--fresh`、model/effort 当作自然语言任务。
- 默认倾向写入能力：当用户请求明确是 fix/implement/apply/update/修复/实现时，调用 `task --write`。
- 当用户明确要求 read-only，或请求只是 review/diagnosis/research/investigate/分析原因/看看为什么时，调用 `task --read-only`。
- 如果用户请求含糊但像 follow-up，例如 continue/keep going/resume/apply top fix/继续上次，默认加 `--resume-last`。
- rescue 子代理或宿主命令必须是薄转发器：只调用一次 `crosscheck task ...`，返回 stdout 原文，不自己读 repo、不 grep、不总结、不替 executor 做工作。

### 9.3 TaskResult

```json
{
  "name": "codex",
  "status": "ok|error|timeout|canceled",
  "mode": "read-only|write",
  "summary": "string",
  "final_message": "string",
  "touched_files": [],
  "pre_diff": "path-or-null",
  "post_diff": "path-or-null",
  "sessionId": "string|null",
  "resumeHint": "string|null",
  "raw_output_file": "path",
  "error": null
}
```

可写 task 必须记录 `touched_files`、pre/post diff 和 resume hint。只读 task 不应修改 repo；若修改，按 safety violation 处理。

## 10. Adapter Contract Tests 与 Doctor 验收

不把 CLI 能力核验拆成“阶段”或“可选范围”。最终实现必须内置 adapter contract tests 和 `setup/doctor` 实测，只有通过的 agent 才能声明 supported。

每个 agent 的 contract tests 必须覆盖：

- binary discovery：路径、版本、缺失时错误文案。
- auth detection：未登录时的诊断和 next steps。
- review readonly invocation：危险 flag 不存在，权限模式正确。
- task write invocation：只有 rescue/task lane 可触发写权限。
- JSON/schema output：字段解析、invalid JSON 降级、raw output 保存。
- session/resume：session id 提取、resume hint 构造、resume-last 行为。
- background/cancel：后台 worker、timeout、进程树终止、partial output 保留。
- repo mutation detection：review 前后 status 不变；task 可写时记录 touched files。

`crosscheck doctor --json` 必须输出每个 agent 的 capability matrix：

```json
{
  "agent": "codex",
  "installed": true,
  "authenticated": true,
  "review_readonly": true,
  "task_write": true,
  "json_output": true,
  "schema_output": true,
  "resume": true,
  "background_cancel": true,
  "notes": []
}
```

## 11. Self detection

Self detection 不应只靠单个 env。按优先级：

1. `--self <host>`。
2. 显式 env：
   - `CROSSCHECK_SELF`
   - `CURSOR_AGENT`
   - `CLAUDECODE`
   - Codex/Codex app 可识别 env，如果存在。
3. 宿主命令模板注入：
   - Cursor command 调用时传 `--self cursor`。
   - Claude command 调用时传 `--self claude`。
   - Codex skill 调用时传 `--self codex`。
4. process tree / cwd / known plugin env fallback。
5. unknown。

如果 self unknown：

- 默认不排除任何 reviewer。
- 输出 warning：无法确定当前宿主，默认 reviewer 可能包含 self。
- 宿主模板必须避免 unknown，直接传 `--self`。

## 12. Prompt 设计

### 12.1 普通 review prompt

结构：

```text
<role>
You are {reviewer} performing a software code review.
</role>

<task>
Review the provided repository context for material defects.
Target: ...
</task>

<review_priorities>
- correctness bugs
- regressions
- missing tests for changed behavior
- security and permission boundaries
- data loss/corruption
- concurrency/race/idempotency
- error handling and degraded dependencies
- compatibility/schema/version drift
</review_priorities>

<finding_bar>
Report only material findings.
No style-only feedback.
No speculative findings without evidence.
Each finding must explain impact and concrete fix.
</finding_bar>

<structured_output_contract>
Return valid JSON matching schema.
</structured_output_contract>

<grounding_rules>
Every finding must cite file and line.
If context is truncated, say so and lower confidence.
</grounding_rules>

<repository_context>
...
</repository_context>
```

### 12.2 Adversarial prompt

Adversarial prompt 应基本继承 `codex-plugin-cc` 的强 framing：

- `role`：目标是 break confidence，不是 validate。
- `task`：找最强 no-ship 理由。
- `operating_stance`：默认怀疑。
- `attack_surface`：auth、permissions、data loss、rollback、race、schema drift、observability。
- `review_method`：试图推翻改动。
- `finding_bar`：只报 material findings。
- `structured_output_contract`：只返回 JSON。
- `grounding_rules`：不编造文件、行号、行为。
- `calibration_rules`：宁可一个强 finding，不要多个弱 finding。
- `final_check`：确认 finding 不是风格问题。

### 12.3 Stop gate prompt

继承 `codex-plugin-cc` 的 stop gate 思路：

- 只 review 上一轮宿主实际产生的代码修改。
- 如果上一轮只是 status/setup/result/report，立即 ALLOW。
- 不把旧改动归咎于当前 turn。
- 首行必须是 `ALLOW:` 或 `BLOCK:`。
- BLOCK 只能用于真正 blocking issue。

### 12.4 Task / Rescue prompt

Task prompt 对齐 `codex-plugin-cc` 的 rescue 思路，但保持 model-agnostic：

- 明确任务文本和 repo。
- 标注当前是 read-only 还是 write-capable。
- 要求 executor 完整跟进，不停在第一版答案。
- 可写时要求 scoped changes，不做无关重构。
- 结束时列出 touched files、验证结果、残余风险。
- read-only 时禁止修改代码，只输出诊断、方案或下一步建议。

结构：

```text
<task>
{{TASK_TEXT}}
Repository: {{REPO_LABEL}}
Mode: {{WRITE_MODE}}
</task>

<default_follow_through_policy>
Default to the most reasonable low-risk interpretation and keep going.
Only stop for missing details that change correctness, safety, or irreversible actions.
</default_follow_through_policy>

<action_safety>
If write-capable, keep edits tightly scoped and list touched files.
If read-only, do not modify files.
</action_safety>

<verification_loop>
Verify against the requested task before finalizing.
</verification_loop>
```

### 12.5 Arbitration prompt

默认不调用 LLM arbiter。多个 reviewer 完成后，Crosscheck 先运行确定性仲裁器。

输入：

- target summary
- reviewer normalized outputs
- reviewer raw excerpts
- context truncation metadata
- failures/timeouts

确定性仲裁器输出：

```json
{
  "verdict": "approve|needs-attention|blocked-by-review-failure",
  "summary": "string",
  "consensus_findings": [],
  "conflicting_findings": [],
  "highest_risk_findings": [],
  "recommended_order": [],
  "reviewer_failures": [],
  "confidence": 0.0
}
```

规则：

- 不发明新 finding，除非从多个 reviewer 结论中可严格归纳。
- 合并重复 finding。
- 标记 reviewer 之间的冲突。
- 如果所有 reviewer 都失败，verdict = `blocked-by-review-failure`。
- 如果关键 reviewer 失败但其他 reviewer 通过，应在 summary 中说明 review coverage 不完整。

可选 LLM arbiter 只作为增强：

- 必须由当前宿主 self 运行，不能默认再调用另一个外部 reviewer。
- 输入只能是 deterministic arbitration draft、normalized outputs、必要 raw excerpts 和 truncation metadata。
- 只能改写 summary、排序 recommended_order、解释冲突；不能新增 finding、删除来源或覆盖 raw output。
- 如果 LLM arbiter 超时、失败或输出 schema 不合法，直接使用 deterministic arbitration。
- 配置默认值为 `arbitration.mode = "deterministic"`；用户可显式改为 `"llm-assisted"`。

## 13. Schema

### 13.1 Reviewer output schema

沿用并扩展 `codex-plugin-cc`：

```json
{
  "verdict": "approve|needs-attention",
  "summary": "string",
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "title": "string",
      "body": "string",
      "file": "relative/path",
      "line_start": 1,
      "line_end": 1,
      "confidence": 0.8,
      "recommendation": "string"
    }
  ],
  "next_steps": ["string"]
}
```

### 13.2 Task output schema

```json
{
  "status": "ok|error|timeout|canceled",
  "mode": "read-only|write",
  "summary": "string",
  "final_message": "string",
  "touched_files": [],
  "verification": [],
  "residual_risks": [],
  "next_steps": [],
  "sessionId": "string|null",
  "resumeHint": "string|null"
}
```

`touched_files` 对 read-only task 必须为空。write-capable task 必须尽量列出所有修改文件，并在 raw output 中保留 executor 原始最终答复。

### 13.3 Crosscheck result schema

```json
{
  "version": 1,
  "kind": "review|adversarial-review|rescue|task|gate",
  "job_id": "review-...",
  "status": "completed|failed|canceled|partial",
  "self": "codex|cursor|claude|unknown",
  "target": {
    "cwd": "/absolute/path",
    "mode": "working-tree|branch|commit",
    "label": "string",
    "base_ref": "main",
    "commit": null,
    "changed_files": [],
    "diff_stat": "string",
    "context_mode": "inline-full|inline-summary|repo-readonly|disposable-worktree",
    "execution_cwd": "repoRoot|scratch|worktree",
    "readonly_policy": "prompt-only|agent-readonly|native-readonly",
    "truncated": false,
    "omitted_files": []
  },
  "reviewers": [
    {
      "name": "cursor",
      "self_review": false,
      "status": "completed|failed|timeout|skipped",
      "duration_ms": 1234,
      "capabilities": {},
      "result": {},
      "raw_output_file": "/path/to/raw.log",
      "error": null
    }
  ],
  "executors": [],
  "arbitration": {},
  "safety": {
    "pre_status": "string",
    "post_status": "string",
    "repo_changed_during_review": false,
    "warnings": []
  },
  "follow_up_commands": []
}
```

### 13.4 词表与映射

三类状态必须分开，不能混用。

Reviewer verdict：

```text
approve
needs-attention
```

Aggregate verdict：

```text
approve
needs-attention
blocked-by-review-failure
```

Result status：

```text
completed
partial
failed
canceled
```

Job status：

```text
queued
running
completed
failed
canceled
```

`job.status` 只表示 worker 生命周期；`result.status` 表示审查/委派结果完整性，允许 `partial`。

映射规则：

- 所有 reviewer `approve`，且没有 safety warning → aggregate `approve`，result status `completed`，job status `completed`。
- 任一 reviewer `needs-attention` 或 safety warning → aggregate `needs-attention`，result status `completed`，job status `completed`。
- 所有 reviewer failed/timeout/skipped → aggregate `blocked-by-review-failure`，result status `failed`，job status `failed`。
- 部分 reviewer 成功、部分失败 → result status `partial`，job status `completed`，aggregate 根据成功 reviewer verdict 决定，并在 summary 标注 coverage 不完整。
- 被用户取消 → result status `canceled`，job status `canceled`。
- findings 不影响 CLI exit code；命令成功完成即 exit 0。环境/参数/所有 reviewer 失败才非 0。

### 13.5 Job schema

```json
{
  "id": "review-...",
  "kind": "review|adversarial-review|rescue|task|gate",
  "workspaceRoot": "/absolute/path",
  "createdAt": "iso",
  "startedAt": "iso",
  "completedAt": "iso|null",
  "status": "queued|running|completed|failed|canceled",
  "resultStatus": "completed|partial|failed|canceled|null",
  "phase": "starting|collecting-context|reviewing|arbitrating|done|failed",
  "pid": 123,
  "reviewers": ["cursor", "claude"],
  "executors": ["codex"],
  "summary": "string",
  "logFile": "/path",
  "resultFile": "/path",
  "errorMessage": null
}
```

## 14. State 与后台任务

### 14.1 State root

类似 `codex-plugin-cc`，按 workspace root hash 隔离。默认使用稳定目录，不使用 `$TMPDIR`，否则重启或系统清理后 `status/result` 会丢失。

```text
${CROSSCHECK_DATA_DIR:-~/.crosscheck}/state/<repo-slug>-<hash>/
  config.json
  jobs/
    <job-id>.json
    <job-id>.log
    <job-id>.result.json
    <job-id>.raw.cursor.log
    <job-id>.raw.claude.log
  sessions/
    cursor.json
    claude.json
    codex.json
```

如果宿主提供 plugin data dir：

- Claude plugin 可用 plugin data env。
- Codex/Cursor 如有类似 env，则优先使用。
- 否则 fallback 到 `~/.crosscheck`。

### 14.2 Job lifecycle

```text
queued
running
completed
failed
canceled
```

phase：

```text
starting
probing-reviewers
resolving-target
collecting-context
reviewing:<reviewer>
arbitrating
rendering
done
failed
```

### 14.3 并发安全

后台 job 必须支持多个 job 并行运行，且不能因为进程崩溃留下不可读状态。

规则：

- 单写者：每个 `jobs/<jobId>.json` 只由对应 worker 写；其他进程只读。
- 原子写：状态文件写入使用 `write tmp + fsync + rename`，不就地改写。
- 列表来源：`status` 扫描 `jobs/*.json`，不依赖单一 index 文件作为唯一真相。
- 如果维护 `index.json` 缓存，必须用 lock file / flock 保护，损坏时可重建。
- 心跳：running job 每 5s 内更新 `heartbeatAt`。
- 僵尸恢复：读取 running job 时，如果 pid 不存在或 heartbeat 超时，标记为 `failed`，errorMessage = `worker died`。
- session 文件也使用 tmp+rename；损坏时 fallback fresh，不阻塞 status/result。

### 14.4 Background 执行

`--background` 行为：

- 创建 job record。
- spawn detached child process。
- 子进程继续执行实际 review。
- 父进程立即输出 job id 和 follow-up commands。

输出示例：

```text
Crosscheck review started in background.
Job ID: review-mabc123
Status: crosscheck status review-mabc123
Result: crosscheck result review-mabc123
Cancel: crosscheck cancel review-mabc123
```

### 14.5 Status wait

`crosscheck status <job-id> --wait --timeout-ms 240000`：

- 每隔 2s 读取 job file。
- completed/failed/canceled 后返回最终状态。
- timeout 后保留 job running。

### 14.6 Cancel

Cancel 必须：

- 找到 job pid。
- 终止 process tree，而不是只 kill 父进程。
- 更新 job state。
- 保留 partial logs。

## 15. Render

### 15.1 Review text render

顺序：

1. Header：
   - kind
   - target
   - reviewers
   - verdict
2. Arbitration summary：
   - final verdict
   - highest risk
   - consensus
   - conflicts
3. Reviewer sections：
   - reviewer name
   - status
   - verdict
   - findings
   - next steps
4. Failures/timeouts。
5. Safety warnings。
6. Follow-up commands。

Finding 格式：

```text
[high] Missing tenant boundary check
file: path/to/file.go:42
confidence: 0.86

What can go wrong...

Recommendation: ...
Reviewer: cursor
```

### 15.2 Status render

无 job id 时用表格：

```text
| Job ID | Kind | Reviewers | Status | Phase | Elapsed | Summary | Next |
```

有 job id 时显示完整状态。

### 15.3 Result render

必须保留完整细节，不压缩 findings、路径、行号、错误、parse failure。

### 15.4 JSON render

直接输出 schema JSON。

## 16. 安全模型

### 16.1 禁止项

所有 review/gate 默认禁止：

- 修改目标 repo。
- 执行 patch。
- 调用 editor/write tools。
- 传危险 CLI flag。
- 让 reviewer 在目标 repo 中以写权限运行。
- 自动执行 reviewer 的 next steps。

### 16.2 Repo mutation detection

review 前：

```bash
git status --porcelain=v1 --untracked-files=all
```

review 后再跑一次。

如果状态不同：

- `safety.repo_changed_during_review = true`
- verdict 至少为 `needs-attention`
- text render 明确提示。

### 16.3 Reviewer / Executor 运行位置

运行位置不能单纯用 “scratch 目录 = 安全” 来定义。最终策略按 lane 区分：

- review lane：默认由 Crosscheck 引擎确定性抽取 diff/context，并在 `repoRoot` 内以只读权限运行；只有 prompt-only adapter 经 contract tests 证明无需 repo inspection 时，才可选择 scratch cwd 作为读取面优化。
- rescue/task lane：executor 默认在 `repoRoot` 内运行；read-only task 使用只读权限，write-capable task 使用明确写权限。
- 大 diff / repo inspection：优先使用 agent 自身只读权限或 disposable worktree，而不是让 reviewer 自行发现 review 范围。

安全边界来自权限模式、工具收敛、环境清洗和 pre/post status/diff 检测，不来自 cwd 本身。任何在 `repoRoot` 内运行的 review 都必须证明危险 flag 不存在，且 review 后 repo 状态不变。

### 16.4 Secrets

不主动扫描 secrets；但 context collector 应避免把 `.env`、密钥文件、二进制等 untracked 内容全文塞入 prompt。

默认排除：

```text
.env
.env.*
*.pem
*.key
*.p12
*.pfx
id_rsa
id_ed25519
```

如果这些文件在 changed files 中出现，记录路径和 redacted 标记。

### 16.5 Anti-recursion

自动 gate / review 调用子 agent 时必须注入：

```bash
CROSSCHECK_CHILD=1
```

任何 Crosscheck 宿主入口检测到 `CROSSCHECK_CHILD=1` 时：

- 禁止再次触发 host stop gate。
- 不自动 fan-out 到会再次触发同一宿主 hook 的路径。
- 如果用户显式在子进程内运行 `crosscheck gate`，返回 advisory 结果，不执行阻断 hook。

这样避免 Claude Stop hook 调用 Crosscheck，Crosscheck 再调用子 agent，子 agent 停止时又触发 gate 的递归链。

## 17. 宿主集成

宿主集成采用混合形态：共享 Node runtime + 可移植 skill + 必要原生薄壳。

### 17.1 可移植 Crosscheck skill

提供一套宿主无关的 `cross-agent-review` skill，并尽量安装到所有支持 skill 的宿主。它不是实现 runtime，而是把统一心智、触发规则、prompt 技巧和结果处理规则带进宿主。

`skills/cross-agent-review/SKILL.md`：

- frontmatter description 覆盖：
  - cross review
  - 交叉评审
  - ask Cursor/Claude/Codex to review
  - adversarial review
  - review gate
  - rescue / cross-agent handoff / 交叉委派
- 指令：
  - 调用共享 `crosscheck` runtime。
  - review/adversarial-review/gate 必须 review-only。
  - rescue/task 是独立委派入口，不得由 review 自动触发。
  - 不自行替代 reviewer/executor 产出结论。
  - stdout 原样返回；可以在多 reviewer 后附简短综合，但不能覆盖原始 findings。
  - 大 diff 推荐 background。
  - 如果 adapter 调用失败，只报告失败和可执行修复步骤，不编造替代 review。

Skill references：

- `commands.md`：命令用法。
- `adapters.md`：不同 reviewer/executor 限制。
- `review-rubric.md`：普通 review 与 adversarial review prompt 思路。
- `rescue-runtime.md`：rescue/task、write/read-only、resume/fresh、result-handling 规则。
- `troubleshooting.md`：常见 setup 问题。

同时提供三类内部 skill，对齐 `codex-plugin-cc`：

- `crosscheck-runtime`：只负责选择并调用一次 `crosscheck` 命令，保持 stdout 原样，不自行读 repo 或解决任务。
- `crosscheck-result-handling`：呈现 review/task 结果；executor 未成功调用时不编造替代结论。
- `crosscheck-prompting`：只用于把用户的 rescue/task 请求收紧成更好的委派 prompt，不用于宿主自己解题。

安装目标按宿主能力选择：

- Codex：`~/.codex/skills/cross-agent-review`
- Claude：如果 Claude Code 支持 skill 目录，则安装同一套 skill；否则由 plugin references 承载同等内容。
- Cursor：如果 Cursor 支持全局/项目 skill 或 rule-like artifact，则安装同一套指令；否则由 `.cursor/commands` 模板引用同等规则。

### 17.2 Codex integration

Codex 侧以 skill 为主，不额外复制 runtime 逻辑。

Codex skill 调用示例：

```bash
crosscheck review --self codex "$ARGUMENTS"
crosscheck adversarial-review --self codex "$ARGUMENTS"
crosscheck rescue --self codex "$ARGUMENTS"
crosscheck status --self codex "$ARGUMENTS"
crosscheck result --self codex "$ARGUMENTS"
```

Codex skill 必须遵守：

- review/adversarial/gate 不触发写入。
- rescue/task 使用 runtime 的 intent classification 和显式 flag，不由 skill 自己判断权限。
- 结果展示走 `crosscheck-result-handling`，不把宿主自己的分析混进 reviewer/executor raw output。

### 17.3 Claude plugin

Claude Code 侧仍需要原生 plugin，因为 `codex-plugin-cc` 的关键能力包含 slash command、Stop hook 和 rescue subagent/forwarder。

命令：

```text
/crosscheck:setup
/crosscheck:review
/crosscheck:adversarial-review
/crosscheck:rescue
/crosscheck:status
/crosscheck:result
/crosscheck:cancel
```

命令设计参考 `codex-plugin-cc`：

- `disable-model-invocation: true` 用于 deterministic command。
- `review` 命令负责 wait/background 选择。
- 命令层明确 review-only。
- `rescue` 命令通过薄 subagent/forwarder 调用 `crosscheck task`，对齐 `codex:codex-rescue`，不得自己读 repo 或总结。
- foreground 返回 stdout 原文。
- background 不等待结果，只提示 status/result/cancel。

Hooks：

- 可选 Stop hook 调用 `crosscheck gate --self claude`。
- setup 支持 enable/disable gate。

### 17.4 Cursor integration

Cursor 侧先提供 command templates；如果 Cursor plugin/rule 体系能稳定提供更好入口，再补 `.cursor-plugin/plugin.json` 或全局安装。

Cursor v1 command templates：

```text
.cursor/commands/crosscheck-review.md
.cursor/commands/crosscheck-adversarial-review.md
.cursor/commands/crosscheck-rescue.md
.cursor/commands/crosscheck-status.md
.cursor/commands/crosscheck-result.md
.cursor/commands/crosscheck-cancel.md
.cursor/commands/crosscheck-setup.md
```

Cursor command 必须显式传：

```bash
crosscheck review --self cursor "$ARGUMENTS"
crosscheck rescue --self cursor "$ARGUMENTS"
```

Cursor 集成不假设存在 Stop hook；只有在当前 Cursor 官方能力确认后才加入类似 gate hook。

### 17.5 安装器

```bash
node scripts/install.mjs [--hosts codex,claude,cursor] [--link|--copy] [--enable-gate]
```

默认：

- 使用 symlink，便于本地迭代。
- 如果宿主不支持 symlink 或权限失败，fallback copy。
- 不覆盖用户已有同名文件；先备份或提示。

安装目标：

- Portable skill：安装到 Codex/Claude/Cursor 各自支持的 skill/rule 目录；不支持时跳过并记录 warning。
- Codex native：一般无需额外 native layer。
- Claude native：`~/.claude/plugins/crosscheck` 或当前 Claude plugin 目录规范。
- Cursor native：项目级 `.cursor/commands` 或用户级支持目录，按当前 Cursor 官方能力确认。

## 18. Native reviewer 与 fallback

### 18.1 原则

优先使用 reviewer 的 native review 能力，因为 native review 通常更懂自身上下文和工具限制。

但不能硬编码未验证 flag。每个 adapter 在 setup/probe 阶段记录实际能力：

```json
{
  "native_review": true,
  "native_review_supports_working_tree": true,
  "native_review_supports_base": true,
  "native_review_supports_commit": false,
  "json_output": true
}
```

### 18.2 Fallback

如果 native review 不满足：

- 构建 Crosscheck prompt。
- 提供 context bundle。
- 要求 schema JSON 输出。
- 解析失败时保留 raw output 并运行 best-effort extractor。

### 18.3 Reviewer output trust

每个 reviewer result 记录：

```json
{
  "mode": "native|prompt-fallback",
  "structured": true,
  "schema_valid": true,
  "raw_preserved": true
}
```

## 19. 多 reviewer 仲裁

### 19.1 为什么需要仲裁

多个 reviewer 的输出会出现：

- 重复 finding。
- 同一问题严重级别不同。
- 一个 reviewer 认为 approve，另一个 reviewer block。
- reviewer 因上下文不足误报。
- 某个 reviewer 失败或超时。

如果只拼接输出，用户要自己做大量判断。Crosscheck 应提供仲裁层，但保留 raw output 供追溯。

仲裁默认由 deterministic merger 完成，不默认启动新的 LLM。原因是仲裁层的职责是整理 reviewer 已经给出的证据，而不是再做一次隐藏审查。

### 19.2 仲裁规则

- critical/high finding 默认进入 highest risk。
- 同文件相近行号、标题/正文相似的 finding 合并。
- 合并后保留所有 reviewer 来源。
- 若 reviewer 冲突，标记 conflict，不强行抹平。
- 如果 finding 只有一个 reviewer 提出，但证据清晰，仍保留。
- 如果 finding 没有文件/行号且不是全局设计问题，降级或标记 weak。
- reviewer failure 不等于 approve。
- 如果所有 reviewer 都失败，aggregate verdict = `blocked-by-review-failure`。
- 如果部分 reviewer 失败，result status = `partial`，job status 仍为 `completed`，summary 必须说明 coverage 不完整。
- 可选 LLM arbiter 只能消费 deterministic merger 的结果做摘要/排序，不能新增 finding；失败时无条件 fallback deterministic。

### 19.3 输出

Text 中先给仲裁结果，再给 reviewer 原始分节。

JSON 中 `arbitration` 独立字段，不覆盖 `reviewers[].result`。

## 20. Gate 设计

### 20.1 Gate 类型

支持：

- manual gate：用户运行 `crosscheck gate`。
- host stop gate：宿主 hook 自动运行。

### 20.2 Gate 判断

Gate 不应重跑完整多 reviewer 大 review，除非需要。默认：

- 如果上一轮没有代码改动：ALLOW。
- 如果有代码改动：
  - 运行 adversarial compact review。
  - reviewer 默认使用最快可用非 self reviewer；也可以配置多 reviewer。
  - 只找 blocker。
- 如果拿不到上一轮信息：fallback 到当前 Git delta gate，输出必须标注 `source = current-git-delta`，confidence 降级。

### 20.3 Gate input contract

宿主 stop hook 或 command wrapper 如果能拿到上一轮信息，必须写入 `--previous-turn-file`：

```json
{
  "version": 1,
  "host": "claude|cursor|codex|unknown",
  "turn_id": "string|null",
  "kind": "assistant-turn|tool-run|manual",
  "workspace": "/absolute/path",
  "response_text": "string",
  "changed_files_before": ["relative/path"],
  "changed_files_after": ["relative/path"],
  "commands": [
    {
      "cmd": "string",
      "exit_code": 0,
      "touched_files": ["relative/path"],
      "started_at": "iso|null",
      "completed_at": "iso|null"
    }
  ],
  "generated_at": "iso"
}
```

字段规则：

- `workspace` 必须和当前 repo root 匹配；不匹配则拒绝使用该文件。
- `changed_files_before/after` 用于判断上一轮是否产生真实代码改动。
- `commands[].touched_files` 是宿主可观测到的工具/命令写入；拿不到时可为空，但 gate 要降级 confidence。
- `response_text` 只用于辅助判断，不能替代 Git delta 和 touched files。

阻断语义：

- Claude Stop hook：`BLOCK` 应映射为当前 Claude hook 支持的阻断机制；如果只能用 exit code，则 `BLOCK` 非 0，`ALLOW` 为 0。
- Cursor/Codex：除非官方 hook 能力经 contract tests 证明可阻断，否则 gate 只做 advisory 输出，不伪装成强阻断。

### 20.4 Gate 输出

第一行严格：

```text
ALLOW: no code changes in previous turn
```

或：

```text
BLOCK: high-confidence data loss risk in path/to/file.go:42
```

后续可以有简短依据。

## 21. 配置

配置文件：

```text
.crosscheck/config.json
```

用户级：

```text
~/.crosscheck/config.json
```

优先级：

1. CLI args
2. env vars
3. repo config
4. user config
5. defaults

配置示例：

```json
{
  "reviewers": {
    "default": "non-self-available",
    "claude": {
      "bin": "claude-w",
      "model": null,
      "timeout_ms": 600000
    },
    "cursor": {
      "bin": "cursor-agent",
      "model": null,
      "timeout_ms": 600000
    },
    "codex": {
      "bin": "codex",
      "model": null,
      "timeout_ms": 600000
    }
  },
  "context": {
    "max_inline_diff_bytes": 262144,
    "max_untracked_file_bytes": 24576,
    "secret_path_patterns": [".env", ".env.*", "*.pem", "*.key"]
  },
  "jobs": {
    "max_jobs": 50,
    "default_background_threshold_files": 3
  },
  "arbitration": {
    "mode": "deterministic",
    "llm_arbiter": "self",
    "timeout_ms": 120000
  },
  "install": {
    "strategy": "portable-skill-plus-native-thin-shells"
  },
  "gate": {
    "enabled": false,
    "reviewers": "fastest-non-self",
    "timeout_ms": 900000
  }
}
```

## 22. 测试计划

### 22.1 Unit tests

必须覆盖：

- args parsing。
- self detection。
- reviewer selection。
- executor selection。
- rescue intent classification：read-only vs write-capable。
- resume/fresh routing。
- Git target resolution。
- default base detection。
- working tree dirty detection。
- untracked file collection。
- secret redaction。
- context truncation。
- prompt interpolation。
- schema validation。
- text render。
- JSON render。
- state read/write。
- atomic state write and corrupted file recovery。
- job pruning。
- stale running job recovery by pid/heartbeat。
- cancel process tree。
- task output schema。
- gate input schema and fallback to current Git delta。
- anti-recursion behavior when `CROSSCHECK_CHILD=1`。
- deterministic arbitration merge。
- optional LLM arbiter fallback。

### 22.2 Fixture tests

提供 fake reviewer：

- `fake-cursor-agent.mjs`
- `fake-claude.mjs`
- `fake-codex.mjs`

覆盖：

- successful JSON output。
- text-only output。
- invalid JSON。
- non-zero exit。
- timeout。
- partial output。
- finding without line。
- approve。
- needs-attention。

同时提供 fake executor 覆盖：

- read-only task success。
- write-capable task success with touched files。
- resume-last。
- invalid JSON / text-only fallback。
- timeout / canceled。
- executor 试图在 read-only 模式写 repo。

Adapter contract fixtures 必须覆盖：

- Cursor headless 是否要求 `--trust`。
- Cursor `--mode ask/plan` 在 `--print` 下是否保持 read-only。
- Claude `--json-schema` 是否可与 plan/permission mode 同用。
- Claude readonly tool whitelist 的当前 flag 名称。
- Codex review/exec/read-only sandbox 的当前 flag 组合。

### 22.3 Command asset tests

类似 `codex-plugin-cc` 的 command tests：

- review command 必须包含 review-only。
- adversarial command 必须包含 design challenge framing。
- rescue command 必须是 thin forwarder，只调用 task，不自己 inspect repo。
- runtime skill 必须说明 task/rescue 的 flag 归一化和 stdout 原样返回。
- result-handling skill 必须说明失败时不编造替代答案。
- status/result/cancel 必须 disable model invocation。
- background command 不等待结果。
- foreground command 返回 stdout 原文。
- Cursor/Claude commands 必须传 `--self`。
- portable skill 与 native thin shell 必须都指向共享 runtime，不复制 review/rescue 逻辑。
- Claude Stop hook 必须注入 `CROSSCHECK_CHILD=1` 给子 agent 调用。
- gate command 必须定义 `--previous-turn-file` schema，缺失时显式 fallback。
- 命令不得引用未公开内部脚本。
- Markdown 文档与 command assets 不得存在未配对 code fence。

### 22.4 Integration smoke

在本机真实环境：

```bash
crosscheck doctor
crosscheck review --only cursor --wait --scope working-tree
crosscheck review --only claude --wait --scope working-tree
crosscheck review --reviewer cursor,claude --background --scope working-tree
crosscheck rescue --only cursor --read-only "investigate why this test fails"
crosscheck rescue --only claude --write "fix the smallest safe issue in this sample repo"
crosscheck rescue --only cursor --resume "continue the last investigation"
crosscheck status
crosscheck result <job-id>
crosscheck cancel <job-id>
crosscheck adversarial-review --only cursor --wait --base main "重点看权限和数据一致性"
```

Codex CLI 如果本机不可用，不让整个测试失败；doctor 应正确报告 unavailable。

### 22.5 Safety tests

- reviewer 运行位置符合 adapter policy：prompt-only 可 scratch，native/read-only inspection 可 repoRoot。
- review 后目标 repo status 不变。
- read-only rescue/task 后目标 repo status 不变。
- write-capable rescue/task 后 touched files 与 post diff 一致。
- fake reviewer 试图写文件时被检测。
- secret 文件不被全文纳入 context。
- dangerous flags 不出现在 invocation。
- state 文件写入满足 tmp+fsync+rename；并发 status/result 读取不读到半写文件。
- gate/review 子进程不会递归触发新的 host stop gate。

## 23. 实施顺序

虽然不按成本降级目标，但实现仍应按依赖顺序推进：

1. Node package 与 CLI skeleton。
2. Git target/context。
3. schema 和 render。
4. reviewer/executor registry 与 fake reviewer/executor。
5. Cursor/Claude/Codex adapters，包括 review、task、resume、cancel。
6. foreground review/adversarial-review。
7. rescue/task read-only 与 write-capable 路径。
8. state/jobs/logs。
9. background/status/result/cancel。
10. arbitration。
11. setup/doctor 与 adapter contract tests。
12. prompt/runtime/result-handling skill 套件。
13. Codex skill。
14. Claude plugin commands/hooks/subagent。
15. Cursor command/plugin。
16. install/uninstall。
17. gate。
18. integration smoke 和文档。

每一步都应有测试，不等最后统一补。

## 24. 与 `docs/plan-claude.md` 的最终取舍

Claude 方案正确的地方：

- 目标是任意宿主互调。
- 默认排除 self。
- 默认 fan-out 到所有可用非 self reviewer。
- 需要 `--self`、`--only`、`--reviewer`、`--executor`、`--base`、`--commit`、`--adversarial`；`--with` 只保留为兼容 alias，不作为主接口。
- 需要安装到多个宿主。
- 输出应保留每个 reviewer 分节。

Claude 方案需要升级的地方：

- 主 runtime 不应是 shell；应是 Node。
- 不应只做 foreground 或依赖宿主 background；应内建 job state。
- 不应只聚合 verbatim；应 raw + schema + arbitration。
- 不应把 `codex review` flag 当作未经验证的事实；adapter 要 probe capabilities。
- 不应把后台 job、status/result/cancel、gate 视作后续扩展；这些是完整体验的一部分。
- 不应把 rescue/task、resume、prompt/runtime/result-handling skills 视为越界；这些属于对齐 `codex-plugin-cc` 的能力范围。
- 不应只用普通 rubric；要复用 `codex-plugin-cc` 的 adversarial prompt 技巧和 structured output contract。

GPT 旧方案需要升级的地方：

- 不应强调 v0 低维护。
- 不应把 Cursor/Claude 集成降级成模板；最终态要提供宿主原生入口。
- 不应把 background/status/result/cancel 推迟。
- 不应把 gate 推迟。
- 不应把 rescue/task 和 prompt skill 套件排除出主范围；正确做法是和 review-only lane 隔离。
- 不应只做单 reviewer 体验；默认多 reviewer fan-out + arbitration。

## 25. 不做的事情

即使是终态，也明确不做：

- review 命令自动修复代码。
- review 命令自动触发 rescue/task 或应用修复。
- 默认把 reviewer 放到目标 repo 中写权限运行。
- 多个 executor 默认并行写同一个 worktree。
- 用 MCP 作为默认架构。
- 依赖 Codex/Cursor/Claude 的未公开内部 API。
- 把 reviewer 输出直接当作事实；必须保留 confidence、grounding、raw output。
- 把所有文件内容无差别塞进 prompt。

MCP 的判断：

- 只有当宿主自然语言 tool schema 明显优于 CLI，或需要 IDE 原生 tool result contract 时再引入。
- 即便引入 MCP，也应包在同一个 runtime 后面，不改变核心 review model。

## 26. 最终验收标准

认为 Crosscheck 达到终态，需要满足：

1. 在至少两个宿主中可以用原生命令触发交叉 review。
2. 默认排除 self，并能调用至少两个非 self reviewer。
3. `review` 和 `adversarial-review` 都支持 wait/background。
4. `rescue/task` 支持 read-only、write-capable、wait/background、resume/fresh。
5. `status/result/cancel` 可用。
6. setup/doctor 能准确报告 CLI/auth/capability。
7. 每个 reviewer/executor raw output 被保存。
8. schema output 可验证。
9. 多 reviewer deterministic arbitration 可用；可选 LLM arbiter 失败时 fallback deterministic。
10. review 后目标 repo 不发生修改。
11. read-only rescue/task 后目标 repo 不发生修改；write-capable rescue/task 记录 touched files。
12. stop gate 可启用/禁用。
13. state 使用稳定目录，status/result 跨重启可查；状态写入原子，崩溃后可恢复。
14. fake reviewer/executor tests 覆盖成功、失败、timeout、invalid JSON。
15. adapter contract tests 锁定 Cursor/Claude/Codex 当前 CLI 的权限、schema、resume、workspace/trust 行为。
16. command asset tests 保证 review-only lane 和 rescue/task lane 不混淆。
17. 宿主集成满足共享 runtime + portable skill + 必要 native thin shell。
18. gate input contract、fallback、阻断/ advisory 分级、anti-recursion 都有测试覆盖。
19. prompt 明确继承 `codex-plugin-cc` 的 adversarial review、rescue forwarding、runtime/result-handling/prompting 技巧。
20. 文档说明安装、使用、故障排查、配置和安全边界，且 Markdown lint 通过。

## 27. 一句话版本

Crosscheck 应实现为一个以 Node runtime 为核心、以 `codex-plugin-cc` 为产品和 prompt 参考、面向 Codex/Cursor/Claude 多宿主的完整交叉 review/rescue 系统：review lane 默认多 reviewer 只读 fan-out；rescue/task lane 独立支持 read-only/write-capable 委派、resume/fresh；整体支持后台 job、状态查询、结果保存、取消、setup、gate、schema、raw output、prompt skill 套件和仲裁聚合。
