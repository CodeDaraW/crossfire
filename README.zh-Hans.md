# Crosscheck

[English](README.md)

让 **Codex**、**Cursor**、**Claude Code** 互相 review 和 fix。

Crosscheck 让你在当前正在使用的 agent 调用本机其他 coding agent 做 review，或接手一项具体的排查 / 修复。当前 agent 即 `self`，默认不参与评审，所以 review 是真正的跨 agent review。


## 功能一览

- Codex skill：让 Codex 调用本机其他 agent 做 review/rescue。
- Claude Code 命令，例如 `/crosscheck-review`、`/crosscheck-rescue`、
  `/crosscheck-status`、`/crosscheck-result`。
- Cursor 命令文件，使用同一组 `crosscheck-*` 命令名。
- 一套共享 runtime，保证不同宿主的行为一致。
- 只读 review、adversarial review、后台任务、status/result/cancel、
  setup/doctor，以及显式请求时才可写的 rescue。

## 环境要求

- Node.js 18 或更高版本。
- `git`。
- 至少一个非当前宿主的 agent CLI 已安装并登录：
  - `cursor-agent`
  - `claude`
  - `codex`

例如你正在 Codex 里运行 Crosscheck，就至少需要 Cursor 或 Claude 中的一个可用，才能形成真正的 cross review。

## 安装

在本仓库 checkout 目录下安装一次：

```bash
mkdir -p ~/.local/bin
node scripts/install.mjs
```

安装这一步之所以走命令行，是因为它要把 runtime 和宿主侧的文件接入本机各
agent 目录。日常使用应该在 coding agent UI 里通过 skill/command 完成，而不是让用户手动输入
`crosscheck review`。

默认安装使用 symlink，方便本地开发时修改立即生效。如果想安装一份快照，用：

```bash
node scripts/install.mjs --copy
```

安装器会写入：

- `~/.local/bin/crosscheck`
- 如果 `~/.codex` 存在：`~/.codex/skills/crosscheck`
- 如果 `~/.claude` 存在：`~/.claude/skills/crosscheck`、`~/.claude/commands/*`、`~/.claude/agents/*`
- 如果 `~/.cursor` 存在：`~/.cursor/skills/crosscheck`、`~/.cursor/commands/*`

确保 `~/.local/bin` 在 `PATH` 中：

```bash
export PATH="$HOME/.local/bin:$PATH"
crosscheck --help
```

之后可以直接用 CLI 管理安装：

```bash
crosscheck install
crosscheck install --copy
crosscheck install --hosts codex,cursor
crosscheck uninstall
```

`crosscheck install` 只会安装到已经存在的宿主目录。如果某个 host 被跳过，先打开或安装对应 host，让它创建自己的 home 目录，然后重新运行 install。

安装后，如果宿主没有自动发现新 skill/command，重启或 reload 对应 agent。

## 在 Agent 里第一次运行

在 Codex、Cursor 或 Claude Code 中打开任意 git 仓库。Crosscheck 不需要复制文件到项目里；安装好的 skill/command 会针对当前 workspace 运行。

先检查 setup/readiness：

- 在 Codex 里说：`Use crosscheck to check setup for this repo`。
- 在 Claude Code 里运行：`/crosscheck-setup`。
- 在 Cursor 里运行已安装的 `crosscheck-setup` 命令。

然后做一次普通 review：

- 在 Codex 里说：`Use crosscheck to review my current changes`。
- 在 Claude Code 里运行：`/crosscheck-review`。
- 在 Cursor 里运行已安装的 `crosscheck-review` 命令。

如果 setup 提示没有可用的非 self reviewer，安装或登录至少一个其他本机 agent CLI 后再试。例如你正在 Codex 里用 Crosscheck，就需要 Cursor 或 Claude 至少有一个可用，review 才是真正的 cross-agent review。

## 宿主命令与 Skill

### Codex

Codex 使用安装好的 `crosscheck` skill。需要时用自然语言点名 Crosscheck：

```text
Use crosscheck to review my current changes.
Use crosscheck to run an adversarial review focused on rollback risk.
Use crosscheck to ask another agent to investigate why the tests are failing.
Use crosscheck to show the latest background job result.
```

skill 会负责补上正确的 self 身份并调用 runtime。你只需像平时对 coding agent 说话那样提出请求即可。

### Claude Code

Claude Code 提供显式 command 文件：

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

review 命令永远只读。`/crosscheck-rescue --write` 才是委派写代码的路径。

### Cursor

Cursor 提供一组同名命令文件：

```text
crosscheck-setup
crosscheck-review
crosscheck-adversarial-review
crosscheck-rescue
crosscheck-status
crosscheck-result
crosscheck-cancel
```

在 Cursor 的 agent command 入口里运行它们。如果你的 Cursor 版本把项目/用户命令渲染成 slash commands，它们会以同名形式出现，例如 `/crosscheck-review`。

## 常见 Agent 流程

### 发版前 Review

让当前 agent 运行 Crosscheck review，或使用宿主命令：

```text
Codex:  Use crosscheck to review my current changes in the background.
Claude: /crosscheck-review --background
Cursor: crosscheck-review --background
```

然后查看 status/result：

```text
Codex:  Use crosscheck to wait for the job and show the result.
Claude: /crosscheck-status <job-id> --wait，然后 /crosscheck-result <job-id>
Cursor: crosscheck-status <job-id> --wait，然后 crosscheck-result <job-id>
```

### 挑战一个高风险方案

需要另一个 agent 质疑设计时，用 adversarial review：

```text
Codex:  Use crosscheck to run an adversarial review focused on data loss and rollback.
Claude: /crosscheck-adversarial-review focus on data loss and rollback
Cursor: crosscheck-adversarial-review focus on data loss and rollback
```

### 把问题交给另一个 Agent

需要不同 agent 排查或修复时，用 rescue：

```text
Codex:  Use crosscheck rescue to ask another agent to find the root cause.
Claude: /crosscheck-rescue --read-only find the root cause
Cursor: crosscheck-rescue --read-only find the root cause
```

委派写代码时：

```text
Codex:  Use crosscheck rescue with write permission to apply the smallest safe fix.
Claude: /crosscheck-rescue --write apply the smallest safe fix
Cursor: crosscheck-rescue --write apply the smallest safe fix
```

write rescue 之后，合入前再跑一次 Crosscheck review。

### 在任意项目中快速试用

先做一个无害本地改动，再让当前 agent 使用 Crosscheck：

```bash
printf "\n# crosscheck test\n" >> README.md
```

```text
Codex:  Use crosscheck to review my current changes.
Claude: /crosscheck-review
Cursor: crosscheck-review
```

然后用你平时的方式撤销测试改动。

## Runtime CLI

仍会安装 `crosscheck` 二进制，因为所有宿主 skill/command 底层都会调用它。日常 agent 使用通常不需要直接输入 CLI。

只有在调试、自动化或开发 Crosscheck 本身时，才建议直接调用：

```bash
crosscheck doctor --self codex
crosscheck setup --self codex
crosscheck review --self codex --wait
crosscheck review --self codex --background --json
crosscheck status <job-id> --wait
crosscheck result <job-id>
crosscheck rescue --self codex --write "apply the smallest safe fix"
```

Runtime 命令：

- `review`：普通只读交叉 review。
- `adversarial-review`：只读设计/风险挑战 review。
- `rescue`：把排查或修复委派给另一个 agent。
- `status`、`result`、`cancel`：后台任务管理。
- `doctor`、`setup`：本机 readiness 检查。
- `gate`：给支持原生 hook 的宿主使用的 stop-time 只读 review gate。

直接调用 CLI 时，需要传 `--self codex`、`--self cursor` 或 `--self claude`。宿主 skill/command 会自动补这个参数。

## CLI 参考

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

## 配置

大多数项目不需要配置。只有当某个项目需要自定义二进制路径、超时或与本机相关的私有 adapter 参数时，才需要添加 `.crosscheck/config.json`：

```json
{
  "reviewers": {
    "cursor": { "bin": "cursor-agent", "timeout_ms": 600000 },
    "claude": { "bin": "claude", "timeout_ms": 600000 },
    "codex": { "bin": "codex", "timeout_ms": 600000 }
  }
}
```

配置合并顺序：

1. 默认配置
2. 用户配置 `${CROSSCHECK_CONFIG_HOME:-$HOME}/.crosscheck/config.json`
3. 项目配置 `.crosscheck/config.json`
4. 命令行参数和环境变量，由调用方或 adapter 处理

不要把本机 settings 路径或 secret 提交到项目配置里。

## 安全模型

- 默认排除 self；需要自审时显式用 `--allow-self`。
- `review`、`adversarial-review`、`gate` 永远只读。
- `rescue` / `task` 是唯一可写 lane。
- 子进程会注入 `CROSSCHECK_CHILD=1`，避免 gate 递归触发。
- 调用 agent CLI 前会清洗看起来像 secret 的环境变量。
- 看起来像 secret 的变更路径会从 prompt context 中脱敏，并记录到 `omitted_files`。
- review 前后会比较 repo fingerprint，检测 reviewer 是否修改了仓库。
- write rescue 会记录 touched files，包括任务前已经 dirty 的文件被再次修改的情况。

## FAQ

### 需要给每个 agent 单独准备账号吗？

不需要。Crosscheck 使用本机 CLI 已经拥有的登录状态。你只需要保证有足够的非 self CLI 可用于当前 review 或 task。

### Crosscheck 会安装到每个项目里吗？

不会。Crosscheck 安装到用户级 host 目录和 `PATH` 后，在 coding agent 中打开任意 git 仓库，用已安装的 Crosscheck skill/command 即可。

### 为什么要传 `--self`？

Crosscheck 默认排除当前宿主，避免把自审伪装成交叉 review。宿主侧命令会自动传 `--self`，直接用 CLI 时建议显式传。

### Review 可以改文件吗？

不可以。Review lane 永远只读。需要委派修改时通过宿主 skill/command 使用 rescue write，然后再跑 review。

### 后台任务状态存在哪里？

默认在：

```text
~/.crosscheck/state/<repo-slug>-<hash>/
```

可以用 `CROSSCHECK_DATA_DIR` 覆盖。

## 致谢

Crosscheck 受 [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc)
启发。感谢 OpenAI 团队提供的单宿主跨 agent review/rescue 产品形态和
prompt/runtime 思路。

## License

Apache-2.0。见 [LICENSE](LICENSE)。

## 开发

```bash
./init.sh
npm test
npm run smoke
```

当前产品和架构文档：

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/SPEC.md`
- `docs/DECISIONS.md`
- `docs/IMPLEMENTATION_STATUS.md`
