import { readFileSync, watch } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'
import { createAttentionProjection } from './lib/projection.js'
import { createNotifier, normalizeNotifyConfig } from './lib/notify.js'
import { buildRequest, providerReady } from './lib/providers.js'

/**
 * Host half of the attention center.
 *
 * 1. Registers the client-visible `attention` projection (failed turns).
 * 2. Optionally forwards failures, completions and unanswered questions to a
 *    phone through one configured push channel.
 *
 * Push settings come from the plugin row config and are overridden by
 * `~/.dsh/attention-notify.json`, which the user can edit without the Web UI.
 * The file is watched, so saving it applies immediately.
 */
export const name = 'attention-core'
export const inject = ['sessionProjections']

export const Config = z.object({
  notifyProvider: z
    .union(['none', 'pushplus', 'qmsg', 'wecom', 'serverchan', 'webhook'])
    .default('none')
    .description('远程推送渠道：none 关闭 / pushplus 微信或QQ / qmsg QQ / wecom 企业微信机器人 / serverchan 微信 / webhook 自定义'),
  notifyPushplusToken: z.string().default('').description('PushPlus token：pushplus.plus 微信扫码后在「一对一推送」里复制'),
  notifyPushplusChannel: z
    .union(['wechat', 'qq', 'both'])
    .default('wechat')
    .description('PushPlus 发到哪：wechat 微信 / qq QQ / both 都发'),
  notifyQmsgKey: z.string().default('').description('Qmsg酱 key：qmsg.zendee.cn QQ 登录后复制'),
  notifyWecomWebhook: z.string().default('').description('企业微信群机器人 webhook 完整地址'),
  notifyServerchanKey: z.string().default('').description('Server酱 SendKey：sct.ftqq.com 微信扫码获取'),
  notifyWebhookUrl: z.string().default('').description('通用 webhook 地址：POST {title, content, kind, sessionId}'),
  notifyOnError: z.boolean().default(true).description('会话失败时推送'),
  notifyOnQuestion: z.boolean().default(true).description('提问超过时限仍没人答时推送'),
  notifyOnDone: z.boolean().default(true).description('会话完成时推送（只推运行够长的）'),
  notifyQuestionTimeoutMinutes: z.number().min(1).max(120).step(1).default(5).description('提问等待多少分钟后推送'),
  notifyMinRunSeconds: z.number().min(0).max(7200).step(1).default(300).description('完成推送的最短运行秒数（默认 5 分钟）'),
  notifyTestOnStart: z.boolean().default(false).description('加载时发一条测试推送（验证 token 用，验完关掉）'),
})

/** Absolute path of the out-of-band notification config file. */
export function notifyConfigPath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'attention-notify.json')
}

function readFileConfig() {
  try {
    const parsed = JSON.parse(readFileSync(notifyConfigPath(), 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function apply(ctx, rawConfig = {}) {
  ctx.effect(() => ctx.sessionProjections.register(createAttentionProjection()), 'attention projection')

  ctx.effect(function* () {
    let disposers = []

    const boot = () => {
      for (const dispose of disposers.splice(0)) {
        try {
          dispose()
        } catch {
          /* already gone */
        }
      }
      const notify = normalizeNotifyConfig({ ...(rawConfig || {}), ...readFileConfig() })
      if (!providerReady(notify.provider, notify)) return

      const notifier = createNotifier({
        config: notify,
        titleOf: (session) => {
          try {
            const value = ctx.sessionProjections.stateOf(session, 'title')
            return typeof value === 'string' ? value : ''
          } catch {
            return ''
          }
        },
        send: async (message) => {
          const request = buildRequest(notify.provider, notify, message)
          if (!request) return
          const response = await fetch(request.url, {
            ...request.init,
            signal: AbortSignal.timeout(10000),
          })
          if (!response.ok) {
            console.warn(`[dsh-attention-center] push failed: HTTP ${response.status}`)
          }
        },
        log: (text) => console.warn(`[dsh-attention-center] ${text}`),
      })

      disposers.push(ctx.on('session/event', (session, event) => notifier.handleEvent(session, event)))
      const timer = setInterval(() => notifier.checkQuestions(Date.now()), 30000)
      timer.unref?.()
      disposers.push(() => clearInterval(timer))

      if (notify.testOnStart) notifier.testPush()
    }

    boot()

    let debounce
    let watcher
    try {
      watcher = watch(notifyConfigPath(), { persistent: false }, () => {
        clearTimeout(debounce)
        debounce = setTimeout(() => boot(), 300)
      })
    } catch {
      /* the file may not exist yet */
    }

    yield () => {
      clearTimeout(debounce)
      watcher?.close()
      for (const dispose of disposers.splice(0)) {
        try {
          dispose()
        } catch {
          /* already gone */
        }
      }
    }
  }, 'attention notifier')
}
