# Crossfire

[English](README.md)

跨 Agent 进行 Code Review 与问题排查修复，支持 **Codex**、**Cursor**、**Claude Code**。

## 安装

需要：Node.js 18+、`git`、至少一个非当前 Agent 的 CLI（`cursor-agent`、`claude` 或 `codex`）已安装并登录。

```bash
mkdir -p ~/.local/bin
node scripts/install.mjs
export PATH="$HOME/.local/bin:$PATH"
```

请把 PATH 变更持久写入 shell 或 Coding Agent 的启动环境，宿主命令会直接按名称调用 `crossfire`。

安装器只会向已检测到的 Agent home 目录写入符号链接。如果某个 host 被跳过，先打开一次对应 Agent，让它创建 home 目录，然后重新安装。
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
crossfire-review
```

首次使用？先检查环境：

- **Codex:** `Use crossfire to check setup for this repo`
- **Claude:** `/crossfire-setup`
- **Cursor:** `crossfire-setup`

## 命令速查

| 操作 | Codex | Claude Code | Cursor |
|------|-------|-------------|--------|
| 检查环境 | `Use crossfire to check setup` | `/crossfire-setup` | `crossfire-setup` |
| 审查 | `Use crossfire to review` | `/crossfire-review` | `crossfire-review` |
| adversarial review | `Use crossfire adversarial review` | `/crossfire-adversarial-review` | `crossfire-adversarial-review` |
| rescue（只读） | `Use crossfire rescue in read-only mode` | `/crossfire-rescue --read-only` | `crossfire-rescue --read-only` |
| rescue（可写） | `Use crossfire rescue with write` | `/crossfire-rescue --write` | `crossfire-rescue --write` |
| 状态 | `Use crossfire status` | `/crossfire-status` | `crossfire-status` |
| 结果 | `Use crossfire result` | `/crossfire-result <id>` | `crossfire-result <id>` |
| 取消 | `Use crossfire cancel` | `/crossfire-cancel <id>` | `crossfire-cancel <id>` |

`review` 命令只读，`rescue --write` 是唯一可委派写操作的路径。

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

直接调用 CLI 时，`--self` 表示当前宿主。要指定目标 Agent，用 `--only` 或 `--executor`。

## 配置

一般无需配置，但如果需要自定义二进制路径或超时，添加 `.crossfire/config.json`：

```json
{
  "reviewers": {
    "cursor": { "bin": "cursor-Agent", "timeout_ms": 600000 },
    "claude": { "bin": "claude", "timeout_ms": 600000 },
    "codex": { "bin": "codex", "timeout_ms": 600000 }
  }
}
```

## 安全模型

- 默认排除 self（`--allow-self` 可覆盖）
- `review`、`adversarial-review`、`gate` 只读
- `rescue` 是唯一可写路径
- 调用外部 Agent CLI 前，清除环境变量中的敏感变量
- review 前后对比 repo fingerprint，检测审查期间的仓库改动

## FAQ

**需要给每个 Agent 单独账号吗？**   
不需要。Crossfire 使用 CLI 已有的登录状态。


**会安装到每个项目吗？**   
不会。装一次，在任意 git 仓库使用。

**review 能改文件吗？**   
不能。委派写操作通过宿主命令或 skill 使用 `rescue --write`。

**任务状态存哪？**  
`~/.crossfire/state/<repo-slug>-<hash>/`

## 致谢

受 [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc) 启发。感谢 OpenAI 团队提供的跨 Agent review/rescue 产品形态。
