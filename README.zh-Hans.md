# Crossfire

[English](README.md) | [简体中文](README.zh-Hans.md) | [日本語](README.ja.md)

跨 Agent 代码审查与任务分派，支持 **Codex**、**Cursor**、**Claude Code**。

| Codex | Cursor | Claude Code |
|-------|--------|-------------|
| ![Crossfire Codex demo](https://cdn-eo.daraw.cn/projects/crossfire/demo-codex.png) | ![Crossfire Cursor demo](https://cdn-eo.daraw.cn/projects/crossfire/demo-cursor.png) | ![Crossfire Claude demo](https://cdn-eo.daraw.cn/projects/crossfire/demo-claude.png) |

## 安装

需要：Node.js 18+、`git`、至少一个非当前 Agent 的 CLI（`cursor-agent`、`claude` 或 `codex`）已安装并登录。

```bash
git clone https://github.com/CodeDaraW/crossfire.git
cd crossfire
node scripts/install.mjs
```

安装器会创建 `~/.local/bin/crossfire`，并向已检测到的 Agent home 目录写入符号链接。如果某个 host 被跳过，先打开一次对应 Agent，让它创建 home 目录，然后重新安装。
如果宿主命令找不到 `crossfire`，确认 `~/.local/bin` 已经在该 Agent 的启动 `PATH` 中。
如果 Agent 未自动识别新 skill/command，重启 Agent 即可。

## 快速开始

在任意 git 仓库中打开 Coding Agent：

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

首次使用？先检查环境：

- **Codex:** `Use crossfire to check setup for this repo`
- **Claude:** `/crossfire-setup`
- **Cursor:** `/crossfire-setup`

Note: Codex TUI 使用自然语言 skill prompt；在 Codex App 里也可以用 slash command，例如 `/crossfire setup`。

## 命令速查


| 操作                 | Codex                           | Claude Code                     | Cursor                          |
| ------------------ | ------------------------------- | ------------------------------- | ------------------------------- |
| 检查环境               | `Use crossfire to check setup`                 | `/crossfire-setup`              | `/crossfire-setup`              |
| Review             | `Use crossfire to review`                      | `/crossfire-review`             | `/crossfire-review`             |
| Adversarial Review | `Use crossfire adversarial review`             | `/crossfire-adversarial-review` | `/crossfire-adversarial-review` |
| 分派任务（只读）           | `Use crossfire to delegate a read-only investigation` | `/crossfire-rescue --read-only` | `/crossfire-rescue --read-only` |
| 分派任务（可写）           | `Use crossfire to delegate a fix with write access`   | `/crossfire-rescue --write`     | `/crossfire-rescue --write`     |
| 状态                 | `Use crossfire status <id>`                    | `/crossfire-status <id>`        | `/crossfire-status <id>`        |
| 结果                 | `Use crossfire result <id>`                    | `/crossfire-result <id>`        | `/crossfire-result <id>`        |
| 取消                 | `Use crossfire cancel <id>`                    | `/crossfire-cancel <id>`        | `/crossfire-cancel <id>`        |


审查代码只读；带 `--write` 的分派任务是唯一允许外部 Agent 改代码的路径。

## CLI 参考

调试或自动化时直接调用：

```bash
crossfire review --self codex --wait
crossfire adversarial-review --self codex "focus on rollback risk"
crossfire rescue --self codex --write --only claude "fix the failing test"
crossfire status <job-id> --wait
crossfire result <job-id>
crossfire doctor --self codex
```

直接调用 CLI 时，`--self` 表示当前宿主。要指定目标 Agent，用 `--only` 或 `--executor`。审查代码时也支持裸 agent 名作为简写，所以 `crossfire review codex` 只会选择 Codex。

## 配置

一般无需配置，但如果需要自定义二进制路径或超时，添加 `.crossfire/config.json`：

```json
{
  "reviewers": {
    "cursor": { "bin": "cursor-agent", "timeout_ms": 600000 },
    "claude": { "bin": "claude", "timeout_ms": 600000 },
    "codex": { "bin": "codex", "timeout_ms": 600000 }
  }
}
```

## 安全模型

- 默认排除 self（`--allow-self` 可覆盖）
- `review`、`adversarial-review`、`gate` 只读
- 分派任务是唯一可写路径
- 调用外部 Agent CLI 前，清除环境变量中的敏感变量
- 审查代码前后对比 repo fingerprint，检测审查期间的仓库改动

## FAQ

**需要给每个 Agent 单独账号吗？**  
不需要。Crossfire 使用 CLI 已有的登录状态。

**会安装到每个项目吗？**  
不会。装一次，在任意 git 仓库使用。

**审查代码能改文件吗？**
不能。分派任务带 `--write` 时才允许外部 Agent 改代码。

**任务状态存哪？**  
`~/.crossfire/state/<repo-slug>-<hash>/`

## 致谢

受 `[openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc)` 启发。感谢 OpenAI 团队提供的跨 Agent 审查代码和分派任务的产品形态。
