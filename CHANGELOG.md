# Changelog

## 0.3.0 — 2026-10-20

把三块能力合进一个包（原先分别是 `dsh-inquiry-mode`、`dsh-attention-center`、手写 profile patch）。

### 新增

- `inquiry/`：刨根问底 Host（`inquiry-mode` 技能 + `/pao` `/pau` `/inquiry`），题库 zh/en 各一套。
- `cordis.patch.yml` 里的 `preset-inquiry` 改为 **PTC 形态**：`tool-presentation {mode: ptc}`、关闭 `workflow-ptc`/`tool-workflow`、`tool-ask-user {mode: timed, timeout: 300}`。
- `ptc-runtime` 期限覆盖：`timeoutMs: 330000`、`maxTimeoutMs: 600000`（5 分钟提问窗口的前提）。
- `docs/PTC-OPS.md`：PTC × dsh-ops 的搭配说明。

### 修复（来自 0.2.3）

- 右下角气泡 / 运行列表 / 提醒卡原先各自 `position: fixed` 且共用坐标，会互相压；改为单一纵向角栈。
- 弹窗打开时只保留失败卡与自动选择记录，完成卡收进气泡徽章；弹窗底部留出角栈空间。
- 自动选择加三道闸：只对**弹窗真正显示过**的题生效、计时从**首次显示**起算、每次自动提交留**可归因**的黄边记录卡（会话名 + 每题选了什么）。
- 自动选择默认 5 → **10 分钟**，新增 30/60 分钟；气泡显示 `⏳N分` 倒计时。

### 修复（来自 inquiry 0.1.x）

- `/pao` 等命令注入的消息补上 `id` 与 `role: 'user'`（缺这两个字段会让会话在下次加载时报
  `event at seq N lacks an identified message`）。

### 测试

- `node --test`：41 条通过（15 注意力 + 26 刨根问底）。
