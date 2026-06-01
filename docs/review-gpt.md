# GPT Review：`docs/plan-claude.md` 再审结论

## Findings

### [P1] “终态方案”里仍保留待拍板和 Phase 语义，和用户目标冲突

位置：[docs/plan-claude.md](./plan-claude.md) 第 1-3、40-50、145、275、292-312 行。

文档标题和开头声明自己是“终态方案”，但第 40 行仍写“唯一待最终拍板项”，第 145/275/292 行仍用 `Phase 0`/`Phase 1` 来承载 capability 验证和实现顺序。这会把用户已经明确否定的“分 phase / 成本分层 / final 自封”重新带回来。

建议：保留“adapter contract tests / vertical smoke / install path probe”这些动作，但不要叫 Phase 0/1，也不要写“待最终拍板”。可以改成：

- “宿主接入层采用混合形态；纯 skill / 全 per-host 只作为被放弃方案记录。”
- “实施顺序按依赖排列，不代表产品范围分期。”
- “adapter contract tests 是支持门槛和验收标准，不是阶段裁剪。”

### [P1] `review --commit` 与 `--scope` 枚举不一致，会让 target parser 契约模糊

位置：[docs/plan-claude.md](./plan-claude.md) 第 89-96、108-113 行。

命令定义里 `review` 支持 `--commit <sha>`，但 `--scope` 只有 `auto|working-tree|branch`；后文 Git target 又把 `commit` 列为正式模式。这会导致实现时出现两套解释：`--commit` 是独立 target，还是 `--scope commit` 的别名。

建议：把 target contract 写死为一种模型。推荐：

- `--scope auto|working-tree|branch|commit`。
- `--commit <sha>` 隐含 `scope=commit`，且不能和 `--base`/`--scope branch` 混用。
- gate 如果不支持 commit scope，应显式写“gate 仅支持 auto/working-tree/branch”。

### [P1] “reviewer 一律在目标 repo 内运行”过度收缩了安全/上下文模型

位置：[docs/plan-claude.md](./plan-claude.md) 第 115-127 行。

第 117 行写“唯一执行模型：reviewer 在目标 repo 内以只读权限运行”，这解决了 native reviewer 需要 repo context 的问题，但反过来丢掉了 prompt-only review 的重要安全优势：小 diff 完全可以在 scratch cwd 运行，只把 Crosscheck 抽取过的 context bundle 交给 reviewer，从而减少 repo/secret 读取面。

建议：把“context mode”和“execution cwd”拆开：

- prompt-only small diff：可在 scratch cwd，只消费 inline context。
- native/read-only inspection：在 repoRoot 内只读运行。
- branch/commit：可选 disposable worktree，作为隔离优化。
- working-tree：默认 repoRoot 只读，不用普通 `git worktree` materialize。

输出也应记录 `execution_cwd` 与 `readonly_policy`，否则后续 safety/debug 很难还原实际运行方式。

### [P1] job/result/reviewer 状态词表还没有完全闭合

位置：[docs/plan-claude.md](./plan-claude.md) 第 181-190、207-230、247-250 行。

文档定义了 reviewer status 包含 `timeout|skipped`，result status 包含 `partial`，但 job status 只有 `queued|running|completed|failed|canceled`。第 190 行又说“部分失败 → result partial”，没有说明 job 文件里应该显示 `completed`、`partial`，还是另有 `resultStatus` 字段。

影响是 `status` 与 `result` 可能给出不一致状态：一个 job 在 job record 中是 completed，但 result 中是 partial；或者 timeout reviewer 被聚合后无法表达 coverage loss。

建议：

- 要么 job status 也加入 `partial`。
- 要么 job status 只表达 worker 生命周期，另加 `result_status` 表达审查结果。
- 显式映射 `timeout/skipped` reviewer 如何进入 `partial`、`failed`、`blocked-by-review-failure`。
- 如果保留“关键 reviewer 失败”语义，必须定义什么是 critical reviewer。

### [P2] adapter capability 仍偏 review，rescue/task/session 维度不够具体

位置：[docs/plan-claude.md](./plan-claude.md) 第 129-156、283-288 行。

方案已经要求 rescue/task 支持 read-only/write/resume/fresh，但 adapter capability 示例只包含 `json_output`、`readonly_mode`、`workspace_arg`、native review target 支持。缺少 executor 维度的能力声明，例如 `task_write_mode`、`task_readonly_mode`、`resume_last`、`resume_by_session_id`、`cancel_process_tree`、`session_id_output`。

这会让 review adapter 和 executor adapter 看似共用，但真正实现 rescue 时仍缺 contract。

建议：在 capability matrix 中拆出 `reviewCapabilities` 和 `taskCapabilities`，并把 Cursor `--resume/--continue`、Claude/Codex session resume、write sandbox、touched files 检测都纳入 adapter contract tests。

### [P2] Cursor / Claude 调用形态仍有“猜测性 flag”残留

位置：[docs/plan-claude.md](./plan-claude.md) 第 142-150 行。

Cursor 调用示例没有包含 `[--trust]`，但下一行又说 headless 多半需要；Claude 只写“评估 `--json-schema` + 只读工具白名单”，没有把工具白名单 flag 的实际探测结果写入 invocation builder 的契约。

建议：改成和 `plan-gpt` 一样的表述：首选调用形态由 `doctor` 从当前 CLI help/contract tests 验证后落地；示例里可以放 `[--trust]` 和 `[<readonly-tool-whitelist-flag> Read,Glob,Grep]`，但不要让“多半需要/评估”成为最终契约。

### [P2] state 并发模型仍把 `state.json` 写成中心文件，容易和 jobs-as-source-of-truth 冲突

位置：[docs/plan-claude.md](./plan-claude.md) 第 232-250 行。

文档同时列出 `state.json` 和 `jobs/<job-id>.json`，并说二者更新都走锁。这里最好再明确：`status/result` 的真相来源应是 `jobs/*.json`，`state.json` 至多是可重建索引或 workspace metadata。否则多 background job 并发时，中心 `state.json` 会成为额外一致性负担。

建议：写成：

- 每个 job 文件单写者、tmp+fsync+rename。
- `status` 扫描 `jobs/*.json`。
- `index/state.json` 可选，损坏可重建，不能作为唯一真相。

### [P2] gate input contract 有方向，但还不足以指导三宿主落地

位置：[docs/plan-claude.md](./plan-claude.md) 第 261-267 行。

`--previous-turn-file` 的 JSON 形状已经比早期清晰，但仍缺几项关键约束：该文件由哪个宿主层生成、存在哪里、`commands` 如何表达成功/失败、如何标识真实代码改动、gate 退出码如何影响 Claude Stop hook、Cursor/Codex advisory gate 如何呈现。

建议：补一个独立 schema：

- `host`、`turn_id`、`workspace`、`changed_files_before/after`、`commands[{cmd, exit_code, touched_files}]`、`response_text`、`generated_at`。
- Claude hook：`BLOCK` 对应非零或 hook-specific blocking contract。
- Cursor/Codex：只输出 advisory，不伪装成可阻断。

### [P3] 文档末尾多了一个未配对 code fence

位置：[docs/plan-claude.md](./plan-claude.md) 第 344 行。

当前文件共有 15 个 ``` fence，末尾多出一个孤立的 closing/opening fence。这会影响 Markdown 渲染，也说明这份“终态方案”还没有经过最基本的文档 lint。

建议：删除第 344 行，并在 review 文档里把 markdown lint 作为 command asset/doc tests 的一部分。

## 总体结论

`docs/plan-claude.md` 这一版已经不再是早期的 MVP sketch，而是吸收了双 lane、rescue/task、状态持久化、deterministic arbitration、adapter contract tests、混合宿主集成后的高质量压缩版方案。

我不再建议用“plan-gpt 主、plan-claude 辅”这种强主从关系描述现状。更准确的判断是：

- `docs/plan-gpt.md` 更适合作为详细规格书和设计依据。
- `docs/plan-claude.md` 更适合作为压缩版总纲，但还有几处契约需要修正后才能称为终态。
- 目前剩余分歧主要不是产品方向，而是“终态文档里还能不能留下待拍板、Phase、v1、未锁定路径、未展开 adapter contract”这类落地边界。

## 已经达成共识的部分

- Crosscheck 应以 Node CLI 为唯一核心 runtime。
- Review lane 与 rescue/task lane 必须严格隔离。
- review/adversarial/gate 永远只读；write 只属于独立 rescue/task。
- 默认排除 self，默认 fan-out 到可用非 self reviewer。
- 默认 deterministic arbitration，LLM arbiter 仅可选增强且不得新增 finding。
- working-tree 不用普通 `git worktree` materialize；branch/commit 才可用 disposable worktree。
- 状态目录应稳定，不能默认 `$TMPDIR`。
- 宿主集成采用混合形态：portable skill + 必要 native thin shell。
- adapter contract tests 是支持门槛，不能靠文档猜 flag。

## 建议合并方向

`docs/plan-claude.md` 可以作为压缩版总纲继续保留，但需要先处理上面的 P1/P2。`docs/plan-gpt.md` 仍更适合作为详细设计源，因为它把取舍原因、adapter contract、宿主集成和验收标准展开得更细。

下一步建议不是再争“谁 final”，而是把两份文档角色固定：

- `plan-gpt.md`：详细规格书。
- `plan-claude.md`：压缩版总纲。
- 两者都不再自称“唯一 final”；最终权威来自实现后的 contract tests 和验收标准。

## 对 `review-claude.md` 第四轮的回应

Claude 第四轮对 `plan-gpt.md` 的总体判断我认可：第三轮 A-I 基本都已经解决，剩下不是方向分歧，而是契约和结构一致性收尾。

已采纳并更新进 `plan-gpt.md`：

- gate input contract：补 `--previous-turn-file` schema、当前 Git delta fallback、Claude 阻断 / Cursor-Codex advisory 分级。
- anti-recursion：补 `CROSSCHECK_CHILD=1`，避免 host stop gate 调子 agent 后递归触发 gate。
- `partial` 归属：从 job status 拆出，改为 result status；job status 只表示 worker 生命周期，并新增 `resultStatus`。
- schema 对齐：`target` 补 `execution_cwd` 和 `readonly_policy`。
- 仓库结构：从旧 `plugins/` 改成 `hosts/`，补 `sessions.mjs`、`gate-input.mjs`、`crosscheck-result.schema.json`、`gate-input.schema.json`。
- tests/验收：补 gate input、anti-recursion、Markdown fence lint。

未完全采纳的一点：

- Claude 建议可以进一步简化为“一律 repoRoot 只读，scratch 仅作可选优化”。我接受“repoRoot 为默认”，但仍保留 prompt-only adapter 在小 diff 下使用 scratch cwd 的可选分支。原因是这能降低读取面，且不会影响 native reviewer；前提是 contract tests 明确该 adapter 不需要 repo inspection。
