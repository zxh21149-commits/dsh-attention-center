# dsh-attention-center · PTC 增强套件

一个安装包，三块能力：

| 能力 | 挂在哪 | 干什么 |
|---|---|---|
| **刨根问底 · Inquiry（PTC）** | `preset-inquiry` | 新会话选这个模式：先问 20~30 个问题把方向钉住，再动手。跑在 PTC 上——模型只看到 `run_code` + 自动生成的 SDK |
| **注意力中心** | `attention-core` + `client.js` | 右下角运行中计数、失败/完成提醒、**跨会话答题弹窗**（不用切过去）、可选手机推送 |
| **OPS / PTC 对齐** | 预设内的 `tool-presentation` | PTC 下 `dsh-ops` 的 `ops_*` 工具全部降为 SDK 绑定：一次 `run_code` 里并发取证，中间结果不进上下文 |

> 为什么放一起：刨根问底最怕「问了没人答」——它每轮要等你 5 分钟；注意力中心正好负责把问题递到你眼前、答完自动续上。而 PTC 让每轮取证（读文件 / 查目录 / 看仓库）压进一次 `run_code`，问出来的题才带着证据。

## 装

```text
plugin_manager install_bundle   target = github:zxh21149-commits/dsh-attention-center
```

装完重启 DSH（Host 半要注册投影、技能与预设）；客户端半刷新页面即可。

**依赖**：DSH ≥ 0.2.0；PTC 需要宿主侧 `ptc-runtime`（官方发行版自带，本包会覆盖它的 `timeoutMs`）。
`dsh-ops` 是**可选**的第三方插件（Rust 实现、Windows x64），装了就会以 SDK 绑定出现在 `run_code` 里；没装也能跑，取证换成原生 `bash` / 文件工具。

## 你会得到什么

### 1. 刨根问底 · Inquiry（PTC）

新会话选预设「刨根问底 · Inquiry」，或在任意会话敲 `/pao`、`/pau`、`/inquiry`（`/pao 补充文字` 算种子）。

- 先猜方向给 3 条 → 每轮 6 题、一题一页、可跳过可自填，**推荐项排第一并带 `(Recommended)`**
- 每轮收尾复述三栏：**【已确认】【我的推断】【还差的】**
- 收口出《需求简报》存 `~/.dsh/inquiry/`，你点头才动手
- 你说「够了 / 直接做」立即收口

提问是 **timed** 模式：5 分钟内答完直接拿答案；超时返回 `pending`，题还留着、答案随后作为用户消息回来（PTC 下 `run_code` 有执行期限，阻塞式等待被打断可能丢题）。

### 2. 注意力中心

| 场景 | 表现 |
|---|---|
| 有会话在跑 | 右下角常驻气泡「运行中 N」（点开看是哪几个，点一下跳过去） |
| 某轮失败 | 失败卡：会话名 + 错误摘要；**打开 / 重试 / 忽略** |
| 某轮完成 | 完成卡：哪个会话完成了 + 「看结果」 |
| 别的对话在等你答题 | 居中弹窗，题目从上往下排，**就地选/填/提交**，不用切会话 |
| 没操作 | 默认 **10 分钟**后自动提交推荐项（可切 5/10/20/30/60 或永不）；气泡上有 `⏳N分` 倒计时 |
| 人不在电脑旁 | 手机推送：PushPlus / 企业微信群机器人 / Qmsg / Server酱 / webhook |

自动选择有三道闸，专治「没弹窗却自己选了」：

1. **只对弹窗真正显示过的题生效**——没显示过就一直等；
2. **计时从「第一次显示给你看」开始**，不是从问题创建开始；
3. 自动提交后留一张黄边卡片：**哪个会话 + 每题选了什么** + 打开会话 / 知道了。

### 3. PTC × OPS

同一个任务的两条路：

```text
原生：model → ops_glob → 结果进上下文
      model → ops_grep → 结果进上下文
      model → ops_inspect ×3 → 三份结果进上下文     （5 次往返）

PTC：model → run_code {
        const files = await tools.ops_glob({ pattern: ['**/*.md'] })
        const heads = await Promise.all(files.slice(0, 3).map((f) =>
          tools.ops_inspect_local_file({ file_path: f })))
        return heads.map((t) => t.slice(0, 20))      // 只有这 20 行进上下文
      }                                              （1 次往返）
```

`dsh-ops` 的 README 原话：「PTC 模式经 SDK 调用底层工具，权限门不变」——工具还在、权限门不变，变的只是「怎么调」。

## 配置

### `attention-core`（插件页可编辑）

| 键 | 默认 | 说明 |
|---|---|---|
| `notifyProvider` | `none` | `none` / `pushplus` / `qmsg` / `wecom` / `serverchan` / `webhook` |
| `notifyPushplusToken` / `notifyWecomWebhook` | 空 | 对应渠道凭据（**别贴聊天**，明文存本机） |
| `notifyOnError` / `notifyOnQuestion` / `notifyOnDone` | `true` | 失败 / 提问超时 / 完成是否推 |
| `notifyQuestionTimeoutMinutes` | `5` | 提问多久没人答就推一次 |
| `notifyMinRunSeconds` | `300` | 完成推送的运行时长门槛 |
| `notifyTestOnStart` | `false` | 开一次立刻发测试消息，验完关掉 |

> 推送只在**电脑开机 + DSH 在运行**时发生；睡眠不推。
> 配置也可以写在 `~/.dsh/attention-notify.json`（文件优先，`fs.watch` 热载，保存即生效）。

### `inquiry-core`

`rounds`（默认 4）、`questionsPerRound`（6）、`language`（zh）、`questionBankPath`（自定义题库）、`briefDir`（`~/.dsh/inquiry`）、`autoLoadSkill`。技能正文按这些配置生成，改完即重建。

### `ptc-runtime`（全局）

本包把 `run_code` 默认期限调到 `330000`ms、上限 `600000`ms：提问要等 300s，不抬期限的话 `run_code` 会先在默认 120s 掐断它。**这一条对所有 PTC 预设生效**，不想要就删掉 patch 里那一行。

## 从旧包迁移

之前是三个独立东西（`dsh-inquiry-mode` 包、`dsh-attention-center` 本地插件、手写的 profile patch）：

1. 卸载旧的：插件管理里移除 `dsh-inquiry-mode` 与旧的 `dsh-attention-center`（否则技能 / 命令 / 覆盖层会重复注册）；
2. 装本包；
3. **删掉**你 profile `cordis.patch.yml` 里手写的 `preset-inquiry` / `ptc-runtime` 覆盖（本包自带，留着会互相覆盖）；
4. 重启 DSH，开新会话选「刨根问底 · Inquiry」。

## 回退

删掉 `cordis.patch.yml` 里本套件插入的行 → 重启。客户端半刷新页面即卸。

## 结构

```text
index.js              Host：attention 投影 + 推送接线（client.js 是它的浏览器半）
client.js             浏览器半：角栈气泡 / 答题弹窗 / 提醒卡 / 自动选择
lib/                  projection · notify · providers
inquiry/index.js      刨根问底 Host：技能 + /pao /pau /inquiry
inquiry/lib/          config · bank · prompt · commands
inquiry/banks/        zh.json（8 维约 40 问）/ en.json
cordis.patch.yml      attention-core + inquiry-core + preset-inquiry(PTC) + ptc-runtime
docs/PTC-OPS.md       PTC 与 OPS 的搭配说明
test/                 41 条单测（15 注意力 + 26 刨根问底）
```

## 测试

```bash
node --test        # 41 passing
```

## 许可

MIT。
