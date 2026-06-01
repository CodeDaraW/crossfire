# Review by Claude（交叉评审结论）

> 评审人：Claude（Cursor 宿主）。本轮交叉评审：Claude review `plan-gpt.md`，Codex(只读) review `plan-final.md`。
> 本文记录 Claude 侧结论：① 对 `docs/plan-gpt.md` 的评审；② 对 Codex 评审 `plan-final.md` 各 finding 的裁决与落实。
> 相关：`docs/plan-gpt.md`、`docs/plan-claude.md`、`docs/plan-final.md`（终态规格，已据本文更新，见其 §19）。

---

## 1. Claude review `docs/plan-gpt.md`

### Findings

1. **[高] scratch 临时目录跑 reviewer（§4、§5）是设计错误。**
   reviewer 在临时目录只拿到内联 diff，读不到相邻文件上下文，review 质量显著下降；且与 Codex 原生 review（必须在 repo 内运行）冲突。codex-plugin-cc 本身就在 `repoRoot` 用只读 sandbox 跑——"临时目录沙箱"是幻觉边界，真正的只读保证来自权限模式而非 cwd。
   **Fix：** reviewer 在目标 repo 内以只读模式运行；安全靠 per-agent 权限/工具收敛 + `git status` 前后比对 +（终态）引擎侧确定性抽取 diff。

2. **[高] 完整度不足，不满足"对标 codex-plugin-cc"。**
   GPT 方案主动把后台 job 状态机、Review Gate、会话恢复、prompt 工程 skill 套件、委派子代理全部划到 v0 之外。在"完整对标"目标下这是最大缺口。
   **Fix：** 全部补回（status/result/cancel + worker、gate、resume、prompting/result-handling/runtime skills、rescue 子代理）。

3. **[高] 只定义了输出 schema，却没给"每个 CLI 如何产出该 schema"的落地机制。**
   claude 用 `--json-schema`、codex 用 `--output-schema`、cursor 无 schema flag（只能 prompt 约束 + 解析）。仅留 `raw_excerpt` 兜底但未说明 per-adapter 策略。
   **Fix：** 在 adapter 层固定各家结构化产出方式与解析失败降级（`ok-unstructured` + 保留 raw）。

4. **[中] 宿主识别只说"查环境变量和进程上下文"，未指名，无法实现。**
   **Fix：** 钉死 `CURSOR_AGENT` / `CLAUDECODE` / `CODEX_*` + `--self` 覆盖（终态 §3）。

5. **[中] 偏离用户已确认的三宿主安装。**
   GPT 只做 Codex skill + command 模板，把安装器后置；用户已选"同时装进 Cursor/Claude/Codex"。
   **Fix：** 保留 `install.sh` 三宿主软链安装。

6. **[中] 对 Codex flag 过度保守。**
   坚持"不假设 `codex review` flag 存在"，导致未给出确定调用形态；而其形态已用 `--help` 核实存在（仅 JSON 字段等运行期细节待核验）。
   **Fix：** 给出确定命令形态，运行期细节交由 Phase 0 核验。

### 保留的优点（已吸收进终态）

Node CLI、JSON schema 输出契约、每 reviewer 超时、review 前后 `git status` 比对、危险 flag 黑名单、大 diff 降级、部分失败容忍、详尽测试计划与明确 v0 边界。

### Verdict

方向正确但**完整度与"只读/上下文"取舍需返工**；其工程健壮性（Node/schema/超时/降级/测试）应全部保留。合并后采用 `plan-final.md`。

---

## 2. Claude 对 Codex review（针对 `plan-final.md`）的裁决

Codex 给出 7 条（2 Critical / 3 High / 2 Medium），总评 No-ship as written。Claude 裁决：

1. **[严重] 厂商 CLI 契约号称"已实测"但仍有未决项（§2/§18）** → **采纳**。新增 Phase 0 能力核验门禁；§2/§5.1 标注"待锁定"。
2. **[严重] "只读"并非对所有 agent 可强制（§2/§5/§9）** → **采纳**。§9 升级为 per-agent 沙箱/工具收敛 + 环境清洗 + 残余信任声明（claude review 禁 Bash）。
3. **[高] 大 diff self-collect 不可复现（§4.2）** → **采纳**。改为引擎侧确定性抽取 + manifest + chunked/manifest-only，reviewer 默认不跑 shell。
4. **[高] 后台 job 竞态（§8）** → **采纳**。单写者 + 原子写 + flock + 心跳 + 僵尸恢复（§8.3a）。
5. **[高] 跨宿主 gate 阻断未验证（§10）** → **采纳**。仅 Claude 阻断级，Cursor/Codex advisory，加 `CROSSCHECK_CHILD` 防递归。
6. **[中] `task` 默认可写过激（§6.2）** → **部分采纳**。裸 `task` 默认改 `--read-only`，rescue 入口保留 `--write`；可写强制 pre/post diff + `touched_files`。**注：此项反转了第 3 轮"默认可写"的决定，待用户最终确认。**
7. **[中] v1 范围过大（§17）** → **采纳为实施纪律**（Phase 0 + 垂直切片先过 smoke），最终范围不变。

### 分歧点

- Codex #7 主张"砍 v1 范围"，与用户"不计成本、完整对标"冲突——故只取其**风险隔离/排序**精神，不削减最终交付范围。
- Codex #6 与用户第 3 轮"默认可写"选择冲突——采取折中（裸 task 安全默认、rescue 入口保留可写），并显式回交用户确认。

### 综合结论

Codex 的 5 条 Critical/High 均为真问题且已落实到 `plan-final.md`；其 No-ship 关切（未验证契约 + 不可强制只读 + 竞态 + 未验证阻断）已通过 Phase 0 门禁、沙箱策略、并发安全、gate 分级转化为可执行约束。终态规格视为可进入实现（自 Phase 0 起步）。

---

## 3. Claude review `docs/plan-gpt.md`（扩展版 1583 行，第二轮，找问题）

扩展版整体很完整，且在以下方面**强于** `plan-final.md`，应反向吸收：§16 native_review 细粒度能力标志（supports_working_tree/base/commit）、§14.4 密钥路径排除清单、§19 配置优先级（CLI>env>repo>user>defaults）、§24 验收标准、§1.4“无非 self reviewer 时给 doctor 诊断而非静默自审”。

但通读后仍有真问题，按严重度：

### Findings

1. **[严重·内部矛盾] §7 执行模型与 §8.5/§16 native review 自相矛盾。**
   §7.1 让 reviewer 在 **scratch cwd** 运行、§7.3 大 diff 用 **disposable worktree**；但 §16/§8.5 又**优先 native review**（Codex `codex review` 必须在真实 repo 内、读取自身上下文）。native review 无法在空 scratch cwd 或不含未提交改动的 worktree 里跑。两套设计并存却未给出谁优先、如何切换 → 实现时必然撞车。
   **修复：** 二选一并锁定。建议（与 `plan-final.md` 一致）**reviewer 在目标 repo 内只读运行 + 引擎侧确定性抽 diff**，彻底放弃 scratch/worktree；native review 才能成立。

2. **[严重] working-tree 的 worktree materialization 仍未解决（§7.3）。**
   `git worktree` **默认不含 staged/unstaged/untracked**，而 working-tree 正是默认 review 目标。GPT 自己的 `review-gpt.md` [P1] 也承认这点未定义，但 `plan-gpt.md` 正文未补 materialization 算法（staged/unstaged/untracked/binary/submodule/apply 失败/清理）。即“最常见路径 + 最复杂实现”仍是空洞。
   **修复：** 若坚持 worktree 需补完整 materialization；更简方案是放弃 worktree、走 in-repo（见 #1）。

3. **[严重] native + scratch + 统一 schema 三者不可兼得，未调和（§11.1 / §16）。**
   §11.1 要求**每个** reviewer 产出结构化 JSON schema；但 native `codex review` 输出自有文本格式、不吃 `--output-schema`。于是“native 优先”与“schema 统一”冲突，多 reviewer 聚合会结构不一致——正是要避免的问题，文中未给映射方案。
   **修复：** 要么 native 路径只存 raw + 标 `ok-unstructured`（牺牲同构），要么统一走 `exec --output-schema`/`--json-schema`（牺牲 native）。需明确默认。

4. **[高] LLM arbiter 作为主聚合路径风险偏高（§10.4 / §17）。**
   §10.4 让一个 LLM arbiter 产出 verdict/consensus/conflict，§17 才补确定性合并规则，两者主次不清；且**未指明 arbiter 由哪个 agent 执行**（某 reviewer？宿主 self？）——涉及额外成本、自审悖论、幻觉“共识”。“不发明新 finding”对 LLM 难以强约束。
   **修复：** 默认 **deterministic merge**（无 LLM），LLM arbiter 为可选增强且不得新增 finding、失败回退确定性结果；并明确 arbiter 执行体（建议宿主 self，因 self 不参与 review 正好做裁决）。

5. **[高] verdict/status 词表三套不统一。**
   §11.1 reviewer verdict ∈ {approve, needs-attention}；§10.4 arbiter verdict 多了 `blocked-by-review-failure`；§11.2 result status ∈ {completed, failed, canceled, partial}。三套词表无映射，渲染/判定易错。
   **修复：** 统一并给出映射表（reviewer verdict、aggregate verdict、job status 各自封闭枚举 + 关系）。

6. **[高] 后台状态放 `$TMPDIR`（§12.1）会丢（无并发安全）。**
   `${CROSSCHECK_DATA_DIR:-$TMPDIR/crosscheck}`：TMPDIR 重启/系统清理会被清空，重启后 `status/result` 失效；且与 `plan-final.md` 同样**缺并发安全**（原子写/锁/心跳/僵尸恢复）。
   **修复：** 默认稳定目录（`~/.crosscheck` 或 XDG state），非 TMPDIR；补原子写 + flock + 心跳 + 僵尸恢复。

7. **[中] 安全模型仍只防 repo 写入、不防读取/外泄（§14）。**
   §14 检测 review 前后 `git status` 变化，但 reviewer 仍是完整 agent，可读任意文件（含 §14.4 清单外的源码内密钥）并联网。§8.3/§8.4 未做**工具白名单/禁 shell/环境清洗**。
   **修复：** per-agent 工具收敛（claude review 禁 Bash，仅 Read/Glob/Grep）、子进程环境清洗、残余信任声明。

8. **[中] §8.3 Cursor “默认不传 --trust” 与 headless 非交互冲突。**
   headless `-p` 在未信任工作区可能触发 trust 弹窗或静默忽略设置。实测倾向 headless 需要 `--trust`。
   **修复：** Phase 0 实测；很可能需 `--trust`（仅信任目标 repo）。

9. **[中] 宿主集成形态偏离用户已选“可移植 skill 装三宿主”。**
   §3/§15 是 Codex-skill + Claude-plugin + Cursor-commands 三种**不同形态**（即 plugin_per_host），而用户第 1 轮选的是 portable_skill（一份 skill 装进三宿主）。更原生但与决策不符。
   **修复：** 要么回到统一 skill 形态，要么显式回交用户确认改用 per-host 原生形态。

10. **[低] §22 仍列 `--with`，与 §4 的 `--reviewer/--only` 不一致**（GPT 自评也提了，正文未清）。**修复：** 统一 `--reviewer`，`--with` 至多做 alias。

11. **[低] §8.4 Claude 用 `--permission-mode plan` 但未用 `--json-schema`**：plan 模式可能倾向产出“计划”而非直接 review 结论，且结构化仅靠 prompt 较弱。**修复：** 评估 `--json-schema` + 只读工具白名单组合（见 `plan-final.md` §2.2）。

### 小结

`plan-gpt.md` 的产品完整度与若干细节优于 `plan-final.md`，但**核心执行模型（scratch/worktree vs native vs schema 三角）存在未解的内部矛盾**（#1–#3），这是它最需要先解决的问题；其余为词表统一、状态持久化/并发、读取面安全、宿主形态与决策一致性。建议两版在“**reviewer 在 repo 内只读 + 引擎抽 diff + 默认确定性聚合**”上收敛，再把 plan-gpt 的 native 能力标志、密钥清单、配置优先级、验收标准并入。

---

## 4. Claude review `docs/plan-gpt.md`（更新版 1883 行，第三轮）

### 已修复 / 反而更优（应反向吸收进 `plan-final.md`）

- **双 Lane 分离（§1.5）**：把 review-only lane（review/adversarial/gate）与 rescue/task lane 严格分开，rescue 走 thin forwarder、按用户意图（fix/implement→写，review/investigate→只读）选权限，裸 `task` 默认值“由 adapter contract tests 对齐 upstream 后固定”。这比 `plan-final.md` 我那套“task 默认只读、rescue 入口写”的折中**更清晰、更贴近 codex-plugin-cc**。建议 `plan-final.md` 反向采纳此双 lane 模型。
- **§16.3 运行位置调和**：明确“安全边界来自权限模式/工具收敛/环境清洗/pre-post 检测，不来自 cwd”，方向上化解了第二轮 #1（native vs scratch）矛盾。
- 新增 executor registry（§9）、task output schema（§13.2）、rescue/task 的 fixture/contract/safety 测试，完整度提升。

### 仍存在的问题（第三轮）

- **A [中高] §7 与 §16.3 自相矛盾未同步**：§7.1 仍写“reviewer 在 scratch cwd 运行”、§7.3 仍以 worktree/副本作为大 diff 模型，但 §16.3 已改判“不靠 cwd、可 repoRoot 只读”。两套指引并存。**修复：** 用 §16.3 重写 §7，默认“引擎抽 diff + repoRoot 只读”。
- **B [高] working-tree 的 worktree materialization 仍空（§7.3）**：`git worktree` 默认不含 staged/unstaged/untracked，而 working-tree 是默认目标。**修复：** worktree 仅用于 branch/commit（已提交态天然可建 worktree）；working-tree 一律 in-repo 只读，别走 worktree。
- **C [高] 后台状态默认 `$TMPDIR`（§14.1）会丢且无并发安全**：重启/清理即失效；仍缺原子写/锁/心跳/僵尸恢复。**修复：** 默认 `~/.crosscheck` 稳定目录 + tmp+rename 原子写 + flock + 心跳。
- **D [中] verdict/status 三套词表无映射**：reviewer `{approve,needs-attention}`、arbiter 多 `blocked-by-review-failure`、result status `{completed,failed,canceled,partial}`；且 §13.3 `result.kind` 未含 rescue/task，而 §13.4 `job.kind` 含。**修复：** 统一枚举 + 映射表，result.kind 补 rescue/task。
- **E [中] LLM arbiter 执行体与默认未定**：§12.5 仍以 LLM arbiter 为主，未说由哪个 agent 执行、是否默认确定性。**修复：** 默认 deterministic merge（§19.2 规则已在），LLM arbiter 可选、**由 self 执行**（self 不参与 review，正好做裁决）、不得新增 finding、失败回退确定性。
- **F [低中] §8.3 Cursor “默认不传 `--trust`”**：headless `-p` 在未信任工作区可能弹窗/静默忽略设置，多半需 `--trust`（仅信任目标 repo）。**修复：** Phase 0/contract test 实测，很可能需要。
- **G [低] §24 仍残留 `--with`**，与 §4 `--reviewer/--only` 不一致。**修复：** 统一，`--with` 至多 alias。
- **H [低] §8.4 Claude 用 plan 模式但未上 `--json-schema`**，结构化偏弱。**修复：** 评估 `--json-schema` + 只读工具白名单。
- **I [需确认] 宿主集成形态：per-host 三形态 vs 可移植统一 skill**（§3/§17）。详见下方专节。

### 专节：宿主接入层形态之争（finding I 展开）

**先厘清不变量：** 两种方案的**引擎完全一样**——共享的 Node `crosscheck` CLI（参数解析、抽 diff、调 reviewer、聚合仲裁、job 状态全在里面）。分歧**只在最外层那薄薄一层“宿主如何把用户动作接到 `crosscheck`”**。

**方案 A：一份可移植 SKILL.md 装进三宿主（第 1 轮决策）**
- 只写一个 `crosscheck/SKILL.md`，`install` 软链/拷贝到 `~/.codex/skills/`、`~/.claude/skills/`、`~/.cursor/skills/`。
- 三宿主加载同一文件，内容本质是“用户提到交叉评审时去跑 `crosscheck ...` 并原样返回”。
- 触发是 **model-invoked**：agent 依据 description/触发词自行判断是否调用。
- 优点：一份资产、维护最省。缺点：拿不到下面三项原生能力。

**方案 B：per-host 三形态（plan-gpt 现状 §3/§17）**
- 每宿主一份该宿主原生格式：Codex → Skill；Claude → Plugin（`.claude-plugin/plugin.json` + slash 命令 + hooks + subagent）；Cursor → command 模板（`.cursor/commands/*.md`）。
- 触发是 **user-invoked / 确定性**（`/crosscheck:review` 必跑，可 `disable-model-invocation`）。
- 优点：最贴 codex-plugin-cc、UX 原生。缺点：三套资产需同步。

**关键：差异不只是风格，而是三项能力的有无。** 可移植 skill 是“agent 自愿调用的一段说明”，技术上做不到以下 codex-plugin-cc 依赖的事：

| 能力 | 可移植 skill (A) | 宿主原生 (B) |
| --- | --- | --- |
| 确定性触发（不靠模型心情） | 否 | 是 |
| Stop / review-gate（靠 hook 注册） | **否**（skill 注册不了 hook） | 是（Claude Stop hook） |
| rescue 薄转发 subagent（只调一次 task、不自读 repo） | 勉强（靠 prompt，不可靠） | 是（原生 subagent） |
| 维护成本 | 低（一份） | 高（三套） |
| UX 原生度 | 一般 | 高 |

**根因判断：** 这是用户两个要求自身的冲突——第 1 轮选“可移植 skill”是为简单；后续又要求“完整对齐 codex-plugin-cc”，而其中的 **review-gate（Stop hook）与 rescue subagent 转发，纯 skill 在技术上无法实现**（至少 Claude 上必须原生 plugin 才能挂 hook）。因此 GPT 转 per-host **不是误解，而是为满足“完整对齐”的新要求**。结论：不能既要纯 skill 的简单、又要 gate/subagent 的全功能。

**推荐：方案 C 混合。** 引擎共享不变；接入层按需混合：
- 三宿主都装那份**可移植 skill**，覆盖 review/adversarial 的发现与触发（满足绝大多数日常用法）；
- **仅对需要 hook/subagent 的功能**追加宿主原生薄壳：主要是 **Claude plugin 挂 Stop-gate + rescue subagent**，Cursor 视情况加少量 command。
- 收益：主体一份 skill、维护省；gate/rescue 转发等“必须原生”的能力不丢；避免三套全量重写。

**待用户拍板：** A（纯可移植 skill，放弃自动 gate + 原生 rescue subagent）/ B（per-host 三形态，最全但三套同步）/ C（混合，推荐）。此决策直接决定 §3 仓库结构与 §17 宿主集成章节的写法。

### 第三轮小结

更新版用双 lane + skill 套件**修掉了我上轮过半的问题，且双 lane 比 `plan-final.md` 更优**。剩余集中在四点：§7/§16.3 一致性（A/B）、状态持久化与并发（C）、词表统一（D）、arbiter 执行体（E）。两版已高度收敛，建议以“双 lane + in-repo 只读 + 引擎抽 diff + 默认确定性聚合 + 稳定状态目录”为合并基线。

---

## 5. Claude review `docs/plan-gpt.md`（更新版 2091 行，第四轮）

### 第三轮 findings 处置：A–I 基本全部解决

- **A（§7↔§16.3 矛盾）已解**：§7 重写为“引擎确定性抽 diff、安全不来自 cwd”，并新增 §1.6.2 阐明取舍，与 §16.3 方向一致。
- **B（worktree materialization）已解**：§7.3 明确“working-tree 默认 repo-readonly、不走普通 worktree；branch/commit 才可选 disposable worktree”——正是建议解法。
- **C（$TMPDIR + 并发）已解**：§14.1 改默认 `~/.crosscheck` 稳定目录；§14.3 新增并发安全（单写者 + tmp+fsync+rename + 扫描 jobs/*.json + flock + 5s 心跳 + 僵尸恢复）。
- **D（三套词表）已解**：§13.4 新增词表与映射表；§13.3 `kind` 补 rescue/task/gate。
- **E（arbiter 执行体/默认）已解**：§12.5/§19 默认 deterministic、LLM arbiter 可选且由 self 运行、不新增 finding、失败 fallback、`arbitration.mode=deterministic`。
- **F（Cursor --trust）已解**：§8.3 改为“是否必需由 contract test 决定，且仅 trust 目标 repoRoot/scratch”。
- **G（--with）已解**：§24 降级为兼容 alias。
- **H（Claude --json-schema）已解**：§8.4 补 `--json-schema` + 只读工具白名单 + 不兼容时标 `schema_output=partial`。
- **I（宿主形态）已解并与我方收敛**：§1.6.4/§17 改为“共享 runtime + 可移植 skill + 必要原生薄壳”的混合形态。

另外新增的 §1.6「关键取舍与思考」把执行模型、仲裁、宿主形态、contract test、写权限的理由都写清楚了，质量高。

### 第四轮残留（均为低/中，无阻断）

- **[中] gate input contract 仍缺**（§4.8/§20 只列 `--previous-turn-file`）：未定义 previous-turn 文件的字段 schema 与“拿不到时 fallback 到当前 Git delta”——这是 review-gpt 自己提的 P2，至今未补。我 `plan-claude.md` §15 已补，建议并入。
- **[中] 缺 anti-recursion 守卫**：gate 自动触发 + 被调子 agent 自身也可能触发 gate → 潜在递归。plan-gpt 未提 `CROSSCHECK_CHILD` 之类短路；我 `plan-claude.md` §14 已写，建议并入。
- **[低] 词表归属小混淆**：§13.4 把 `partial` 列进“Job status”，但 §13.5 job.status 枚举无 partial，§13.3 result.status 才有 partial。partial 应属 result/aggregate 维度，非 job status。
- **[低] §3 仓库结构与正文脱节**：§3 仍是旧的 `skills/cross-agent-review + plugins/claude + plugins/cursor`，未体现 §17“portable skill 也装 Claude/Cursor”、§14.1 新增 `sessions/`；且 §7 已弱化 scratch 却仍列 `runtime/scratch.mjs`；schema 文件名 `crosscheck-output.schema.json` 与 §13.3 “crosscheck result schema” 命名不一致。
- **[低] §7 记录字段与 §13.3 schema 不对齐**：§7 末尾 JSON 含 `execution_cwd`/`readonly_policy`，但 §13.3 `target` 只有 `context_mode/truncated/omitted_files`，未纳入这两个字段。
- **[低] §7 与 §16.3 内容重复**：运行位置策略两处各写一遍、措辞略异。建议合并为单一真相源，避免再次漂移（这正是当初 A 矛盾的结构性根源）。
- **[低·设计建议] §7.1 仍以 scratch cwd 为 prompt-only 默认**：方向虽与 §1.6.2 一致，但多一条 `execution_cwd=scratch` 分支会扩大实现与 safety 测试矩阵（§22.5 需测两种 cwd）。可简化为“一律 repoRoot 只读，scratch 仅作可选优化”。

### 第四轮小结

`plan-gpt.md` 已达到**可实施质量**：第三轮 A–I 全部落实，并与我 `plan-claude.md` 在“双 lane + in-repo 只读 + 引擎抽 diff + 确定性仲裁 + 稳定状态目录 + 混合宿主形态”上完全收敛。剩余仅两条值得补（gate input contract、anti-recursion 守卫，二者我方已写），其余为结构图/字段/词表的一致性打磨。两版可正式合并，差异已无实质设计分歧。

---

## 6. Claude review `docs/plan-gpt.md`（更新版 2178 行，第五轮·收尾）

第四轮两条中等 finding 已全部解决，质量高：

- **gate input contract 已补**：§20.3 给出完整 previous-turn JSON schema（host/turn_id/kind/workspace/response_text/changed_files_before-after/commands[]/generated_at）+ 字段规则（`workspace` 必须匹配 repo root，否则拒用）；§20.2 补“拿不到则 fallback 到 current Git delta、标注 `source=current-git-delta`、降 confidence”。
- **anti-recursion 已补**：§16.5 `CROSSCHECK_CHILD=1`——子进程内禁止再触发 host stop gate、不 fan-out 到会再触发同宿主 hook 的路径、显式运行 gate 时返回 advisory 不阻断；§17.3/§22 有测试覆盖。
- **阻断/advisory 分级已补**：§20.3 “阻断语义”——Claude Stop hook 的 `BLOCK` 映射到 hook 阻断（或 exit code 非 0），Cursor/Codex 除非 contract tests 证明可阻断否则仅 advisory。与我 `plan-claude.md` §15 一致。
- **顺带修了第四轮的 partial 词表归属**：§19.2 line 1804 改为“result status = partial，job status 仍为 completed”，归属清晰。

仍残留的纯低优一致性项（不阻断实施，留待合并时统一）：§3 仓库结构图未跟上 §17 混合形态 / §14.1 的 `sessions/` / 已弱化的 `scratch.mjs` / schema 文件命名；§7 末尾 `execution_cwd`/`readonly_policy` 字段未并入 §13.3 `target`；§7 与 §16.3 运行位置策略仍重复（建议合并为单一真相源）。

### 第五轮小结（终）

`plan-gpt.md` 与 `plan-claude.md` 已**完全收敛、无实质设计分歧**，且达到可直接实施的质量。剩余只有“结构图/字段/重复段”三处低优一致性打磨，可在合并时顺手清理。互审到此可收口。
