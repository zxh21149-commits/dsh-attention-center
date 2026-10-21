# Changelog

## 0.3.2 — 2026-10-21

配合 `dsh-draft-keepalive` 的语音接入点，**没有改变任何用户可见行为**。

### 改动

- 答案输入框外面包了一层 `inputWrap`（`position: relative`），把 `marginTop: 8` / `marginLeft: 28`
  从 input 挪到这一层。
  原因：原先 input 带 `width: 100%` 又带 `marginLeft: 28`，比父元素还宽 28px，
  任何「按父元素绝对定位」的装饰元素都会落到框外。
- 给答案输入框加了 `data-ka-answer="1"` 标记，供 `dsh-draft-keepalive` 挂语音按钮。
  没有该插件时这个属性完全无副作用。

### 为什么不是功能变更

控件位置、交互、提交逻辑、样式观感全部不变；只是把缩进换了一层 DOM，并加了一个 data 属性。

### 验收

- `node --check client.js` 通过；与工作副本逐字节一致（`diff -q`）。
- 真机：问答弹窗里答案框位置不变，语音按钮落在框内（单行居中 / 多行贴底）。


## 0.3.1 — 2026-10-20

UI 优化（P0/P1/P2 全做，纯客户端，刷新页面即生效）。

### 排版与层级

- 字号改成三级：题干 **14px/600**、选项 **13px**、会话名/时间 **11px**；正文行高 1.6（原先几乎全是 12px）。
- 会话名从一行灰字改成**胶囊标签**；题目左侧加 `q1…q6` 编号徽章。

### 交互

- 选项热区 `5px 8px` → **`8px 12px` / 最小高度 36px**，圆角 10。
- 选中态加**单选圆点 / 多选方框**图形 + 品牌色边框（不再只靠底色差）。
- 弹窗底部独立**操作条**（提交 / 打开会话），不再随内容滚走。
- 自动选择的原生下拉改成**自绘外观**（去边框感 + 尾部箭头）。
- 长题分页：每题 3 题一页，带 `‹ 1/2 ›` 步进；底部保留「N 题」提示。

### 视觉

- 提醒卡按类型分色：失败红 / 完成绿 / 自动选择琥珀，左侧 3px 色条 + 图标。
- 倒计时从底部小字改成**顶部进度条**（随剩余时间收缩），气泡上的 `⏳N分` 保留。
- 入场动效 8px 上移 + 120ms；`prefers-reduced-motion` 下自动关闭。

### 可访问性与快捷键

- 弹窗 `role="dialog" aria-modal`，选项 `role=radio/checkbox` + `aria-checked`。
- `Esc` 关闭、`1…9` 选当前页对应选项、`Enter` 提交；输入框内不劫持按键。
- 错误详情加「复制」，一键拷走 `code: message`。

### 窄屏

- ≤640px 自动切换成**底部抽屉**（全宽、上圆角），角栈让位。

### 测试

- 15 条单测通过；SSR 六场景通过（新增断言：`q1` 徽章、`role="radio"`、`aria-checked`、`⏳10分`）。

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