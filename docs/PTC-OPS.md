# PTC 与 OPS：为什么这么配

## 两个东西各管一层

| 层 | 谁负责 | 说明 |
|---|---|---|
| 工具从哪来 | `dsh-ops`（第三方插件） | 注册 `ops_bash` / `ops_pwsh` / `ops_grep` / `ops_glob` / `ops_inspect_local_file` / `ops_replace` 等 Rust 工具，输出比原生更精简 |
| 工具怎么给模型 | PTC（`tool-presentation {mode: ptc}`） | 模型不再拿到 N 份函数 schema，只拿一个 `run_code` + 自动生成的 SDK；每个工具一个 `tools.xxx` 绑定 |

两者正交：OPS 决定「有什么工具」，PTC 决定「模型怎么调」。dsh-ops 自己的 README 写着「PTC 模式经 SDK 调用底层工具，权限门不变」。

## 为什么 PTC 下单次能做的事更多

原生模式里，一次工具调用 = 一次模型往返 + 一份结果进上下文。取证通常要连做四五步，于是：

- 4~5 次往返，每次都把结果（可能几千字）塞进上下文并计费；
- 中间结果没法只取一列、只看前 20 行。

PTC 里这些动作在同一个程序里：

```ts
// 一次 run_code 完成「找文件 → 并发看头部 → 只回要用的行」
const files = await tools.ops_glob({ pattern: ['**/*.md'] })
const heads = await Promise.all(files.slice(0, 3).map((f) =>
  tools.ops_inspect_local_file({ file_path: f })))
return heads.map((t) => t.split('\n').slice(0, 20).join('\n'))
```

- 1 次往返；
- 中间结果留在程序里，只有 `return`/`console.log` 进上下文；
- 只读调用可用 `Promise.all` 并发（并发上限默认 10）。

## 对「刨根问底」的意义

澄清一轮的流程通常是：**先看一眼现状**（这个仓库有什么、那台机器装了什么、这个插件怎么写）→ **再拿证据组织 6 个具体选项**。PTC 下这两步能塞进同一段程序：

```ts
const hits = await tools.ops_grep({ pattern: 'tool-presentation', path: '~/.dsh/profiles' })
return await tools.ask_user_question({
  questions: [{ id: 'q1', question: '按 grep 出来的 3 处配置，你想要哪种？', options: [...] }],
})
```

## 超时这件事（为什么要改 ptc-runtime）

`run_code` 有自己的执行期限（`dsh-ptc-runtime-node` 的 `timeoutMs`，默认 120 秒）。`ask_user_question` 在里面等待时**算在同一个期限内**，所以：

- 等待要 5 分钟 ⇒ `run_code` 期限必须 ≥ 300 秒，本包设 330 秒（留 30 秒取证余量）；
- 提问本身用 `timed` 模式：到点先返回 `pending`（题还留着），答案之后作为用户消息回来；
- 官方 ask-user README 明确提醒：**PTC 里等待被中断，那个问题可能丢** —— 所以不要让 ask 的 timeout 超过 run_code 的期限。

## 不打包 dsh-ops 本体的原因

`dsh-ops` 是 Windows x64 的原生二进制（Rust）+ 独立发布节奏，塞进本仓库会带来：体积、平台限制、升级不同步、以及第三方代码的再分发义务。本套件只做**对齐**：预设走 PTC、期限调好、文档写清，OPS 装不装都能跑。
