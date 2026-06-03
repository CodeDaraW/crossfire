# Crossfire

[English](README.md) | [简体中文](README.zh-Hans.md)

クロスエージェント コードレビューとタスク委譲。**Codex**、**Cursor**、**Claude Code** に対応。

| Codex | Cursor | Claude Code |
|-------|--------|-------------|
| ![Crossfire Codex demo](https://cdn-eo.daraw.cn/projects/crossfire/demo-codex.png) | ![Crossfire Cursor demo](https://cdn-eo.daraw.cn/projects/crossfire/demo-cursor.png) | ![Crossfire Claude demo](https://cdn-eo.daraw.cn/projects/crossfire/demo-claude.png) |

## インストール

前提条件: Node.js 18+、`git`、および少なくとも1つのエージェント CLI（`cursor-agent`、`claude`、`codex`）がインストール・認証済みであること。

```bash
git clone https://github.com/CodeDaraW/crossfire.git
cd crossfire
node scripts/install.mjs
```

インストーラーは `~/.local/bin/crossfire` を作成し、検出したエージェントのホームディレクトリにシンボリックリンクを配置します。あるホストがスキップされた場合、そのエージェントを一度開いてホームディレクトリを作成してから再インストールしてください。スナップショットとしてインストールする場合は `--copy` を使用します:

```bash
node scripts/install.mjs --copy
```

ホストコマンドが `crossfire` を見つけられない場合、`~/.local/bin` がそのエージェントの起動時 `PATH` に含まれていることを確認してください。

エージェントが新しいスキルやコマンドを自動認識しない場合、エージェントを再起動してください。

## クイックスタート

任意の git リポジトリで、コーディングエージェントを開いて実行:

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

初めて使う場合、まず準備状態を確認:

- **Codex:** `Use crossfire to check setup for this repo`
- **Claude:** `/crossfire-setup`
- **Cursor:** `/crossfire-setup`

Note: Codex TUI は自然言語スキルプロンプトを使用します。Codex App では、`/crossfire setup` のようなスラッシュコマンドとして Crossfire を呼び出すこともできます。

## コマンド

| 操作 | Codex | Claude Code | Cursor |
|------|-------|-------------|--------|
| セットアップ確認 | `Use crossfire to check setup` | `/crossfire-setup` | `/crossfire-setup` |
| レビュー | `Use crossfire to review` | `/crossfire-review` | `/crossfire-review` |
| アドバーサリアルレビュー | `Use crossfire adversarial review` | `/crossfire-adversarial-review` | `/crossfire-adversarial-review` |
| タスク委譲（読み取り専用） | `Use crossfire to delegate a read-only investigation` | `/crossfire-rescue --read-only` | `/crossfire-rescue --read-only` |
| タスク委譲（書き込み可能） | `Use crossfire to delegate a fix with write access` | `/crossfire-rescue --write` | `/crossfire-rescue --write` |
| ステータス | `Use crossfire status <id>` | `/crossfire-status <id>` | `/crossfire-status <id>` |
| 結果 | `Use crossfire result <id>` | `/crossfire-result <id>` | `/crossfire-result <id>` |
| キャンセル | `Use crossfire cancel <id>` | `/crossfire-cancel <id>` | `/crossfire-cancel <id>` |

コードレビューココマンドは読み取り専用です。`--write` を指定した委譲タスクのみが、他のエージェントによるファイル編集を許可します。

## CLI リファレンス

デバッグや自動化用:

```bash
crossfire review --self codex --wait
crossfire adversarial-review --self codex "focus on rollback risk"
crossfire rescue --self codex --write --only claude "fix the failing test"
crossfire status <job-id> --wait
crossfire result <job-id>
crossfire doctor --self codex
```

`--self` で現在のホストを指定します。`--only` または `--executor` で特定のエージェントをターゲットにします。レビューココマンドでは、エージェント名のみの指定もショートハンドとして受け付けます（例: `crossfire review codex` は Codex のみを選択）。

## 設定

ほとんどのプロジェクトでは設定不要です。バイナリパスやタイムアウトをカスタマイズする場合、`.crossfire/config.json` を追加:

```json
{
  "reviewers": {
    "cursor": { "bin": "cursor-agent", "timeout_ms": 600000 },
    "claude": { "bin": "claude", "timeout_ms": 600000 },
    "codex": { "bin": "codex", "timeout_ms": 600000 }
  }
}
```

## 安全性

- デフォルトで自分自身を除外（`--allow-self` で上書き可）
- `review`、`adversarial-review`、`gate` は読み取り専用
- 委譲タスクのみが書き込み可能な経路
- シークレットっぽい環境変数は子エージェント起動前に削除
- レビュー中のリポジトリ改変を検出するためフィンガープリントを比較

## FAQ

**各エージェントに別アカウントが必要？**  
不要。Crossfire は既存の CLI 認証情報を使用します。

**全プロジェクトにインストールされる？**  
いいえ。一度インストールすれば、任意の git リポジトリで使用可能です。

**コードレビューでファイルを変更できる？**  
いいえ。他のエージェントにファイル編集させるには、`--write` 付きの委譲タスクを使用してください。

**ジョブ状態はどこに保存される？**  
`~/.crossfire/state/<repo-slug>-<hash>/`

## 謝辞

[`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc) に着想を得ました。コードレビューとタスク委譲におけるクロスエージェントパターンを提供してくれた OpenAI チームに感謝します。

## ライセンス

Apache-2.0。詳細は [LICENSE](LICENSE) を参照。
