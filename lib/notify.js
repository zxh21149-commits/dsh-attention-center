import { PROVIDERS, providerReady } from './providers.js'

const DEFAULT_TIMEOUT_MINUTES = 5
const DEFAULT_MIN_RUN_SECONDS = 300

function str(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function num(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeNotifyConfig(raw = {}) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const nested = input.notify && typeof input.notify === 'object' && !Array.isArray(input.notify) ? input.notify : {}
  const pick = (flatKey, nestedKey) => (input[flatKey] !== undefined ? input[flatKey] : nested[nestedKey])
  const provider = pick('notifyProvider', 'provider')
  const channel = pick('notifyPushplusChannel', 'pushplusChannel')
  const done = pick('notifyOnDone', 'onDone')
  return {
    provider: PROVIDERS.includes(provider) ? provider : 'none',
    pushplusToken: str(pick('notifyPushplusToken', 'pushplusToken')),
    pushplusChannel: channel === 'qq' || channel === 'both' ? channel : 'wechat',
    qmsgKey: str(pick('notifyQmsgKey', 'qmsgKey')),
    wecomWebhook: str(pick('notifyWecomWebhook', 'wecomWebhook')),
    serverchanKey: str(pick('notifyServerchanKey', 'serverchanKey')),
    webhookUrl: str(pick('notifyWebhookUrl', 'webhookUrl')),
    onError: pick('notifyOnError', 'onError') !== false,
    onQuestion: pick('notifyOnQuestion', 'onQuestion') !== false,
    onDone: done === undefined ? true : done === true,
    questionTimeoutMinutes: clamp(Math.trunc(num(pick('notifyQuestionTimeoutMinutes', 'questionTimeoutMinutes'), DEFAULT_TIMEOUT_MINUTES)), 1, 120),
    minRunSeconds: clamp(Math.trunc(num(pick('notifyMinRunSeconds', 'minRunSeconds'), DEFAULT_MIN_RUN_SECONDS)), 0, 7200),
    testOnStart: pick('notifyTestOnStart', 'testOnStart') === true,
  }
}

/** Parse one `ask_user_question` call's raw model arguments. */
export function parseQuestions(argumentsText) {
  try {
    const parsed = JSON.parse(argumentsText || '{}')
    const list = Array.isArray(parsed?.questions) ? parsed.questions : []
    return list.slice(0, 8).map((question) => ({
      id: String(question?.id ?? ''),
      question: String(question?.question ?? '').trim(),
      options: Array.isArray(question?.options)
        ? question.options.map((option) => String(option?.label ?? '')).filter(Boolean).slice(0, 8)
        : [],
    }))
  } catch {
    return []
  }
}

function clock(at) {
  const date = new Date(at)
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function minutes(ms) {
  return Math.max(1, Math.round(ms / 60000))
}

export function formatMessage(kind, data = {}, config = {}) {
  const sessionTitle = str(data.sessionTitle) || str(data.sessionId) || '未命名会话'
  if (kind === 'question') {
    const lines = [`会话：${sessionTitle}`, `已等：约 ${minutes(data.waitedMs || 0)} 分钟`]
    const questions = Array.isArray(data.questions) ? data.questions : []
    questions.forEach((question, index) => {
      lines.push(`${index + 1}. ${question.question}`)
      if (question.options.length > 0) lines.push(`   选项：${question.options.join(' / ')}`)
    })
    lines.push('回到 DSH 的注意力中心回答；开启自动选择的话，超时后会代你提交推荐项。')
    return { title: '【DSH】有对话在等你答题', content: lines.join('\n'), kind, sessionId: data.sessionId }
  }
  if (kind === 'done') {
    return {
      title: '【DSH】会话完成',
      content: [`会话：${sessionTitle}`, `用时：约 ${minutes(data.runMs || 0)} 分钟`, '回到 DSH 看结果。'].join('\n'),
      kind,
      sessionId: data.sessionId,
    }
  }
  if (kind === 'error') {
    const failure = data.error || {}
    return {
      title: '【DSH】会话失败',
      content: [
        `会话：${sessionTitle}`,
        `错误：${str(failure.code) || 'UNKNOWN'} — ${str(failure.message) || '请求失败'}`,
        `时间：${clock(data.at || Date.now())}`,
        '回到 DSH 可以「重试」或打开会话。',
      ].join('\n'),
      kind,
      sessionId: data.sessionId,
      at: data.at,
    }
  }
  if (kind === 'test') {
    return {
      title: '【DSH】注意力中心已接通',
      content: ['这是一条测试推送。', '以后会话失败、任务完成、或有人等你答题时会收到提醒。'].join('\n'),
      kind,
    }
  }
  return { title: '【DSH】提醒', content: str(data.text) || '有新的提醒。', kind }
}

/**
 * Host-side notification core.
 *
 * It folds session events into three triggers: a failed turn, a completed turn
 * that ran long enough, and an `ask_user_question` call still unanswered after
 * the configured timeout. Sending is injected, so the logic is testable.
 */
export function createNotifier({ config, send, titleOf = () => '', log = () => {}, now = () => Date.now() }) {
  const sent = new Set()
  const turns = new Map()
  const pending = new Map()

  function deliver(kind, data) {
    if (!providerReady(config.provider, config)) return false
    const message = formatMessage(kind, data, config)
    try {
      Promise.resolve(send(message)).catch((error) => log(`push failed: ${error?.message || error}`))
    } catch (error) {
      log(`push threw: ${error?.message || error}`)
    }
    return true
  }

  function pushOnce(key, kind, data) {
    if (sent.has(key)) return false
    sent.add(key)
    return deliver(kind, data)
  }

  function titleFor(session) {
    try {
      return str(titleOf(session)) || String(session?.id ?? '')
    } catch {
      return String(session?.id ?? '')
    }
  }

  function handleEvent(session, event) {
    const sessionId = String(session?.id ?? '')
    if (!sessionId || !event || typeof event.type !== 'string') return
    if (session?.header?.origin === 'subagent') return

    if (event.type === 'turn/start') {
      turns.set(sessionId, event.time)
      return
    }

    if (event.type === 'tool/call') {
      if (event.data?.name !== 'ask_user_question') return
      const callId = String(event.data.callId ?? '')
      if (!callId) return
      pending.set(callId, {
        callId,
        sessionId,
        sessionTitle: titleFor(session),
        at: event.time,
        questions: parseQuestions(event.data.arguments),
        notified: false,
      })
      return
    }

    if (event.type === 'tool/result') {
      const callId = String(event.data?.message?.toolCallId ?? '')
      if (callId) pending.delete(callId)
      return
    }

    if (event.type === 'turn/end') {
      const started = turns.get(sessionId)
      turns.delete(sessionId)
      const turn = event.data?.turn
      const reason = event.data?.reason
      if (reason?.kind === 'error' && config.onError) {
        pushOnce(`err:${sessionId}:${turn}`, 'error', {
          sessionId,
          sessionTitle: titleFor(session),
          turn,
          error: reason.error,
          at: event.time,
        })
      } else if (reason?.kind === 'completed' && config.onDone) {
        const runMs = started !== undefined ? event.time - started : 0
        if (runMs >= config.minRunSeconds * 1000) {
          pushOnce(`done:${sessionId}:${turn}`, 'done', {
            sessionId,
            sessionTitle: titleFor(session),
            turn,
            runMs,
            at: event.time,
          })
        }
      }
    }
  }

  function checkQuestions(at = now()) {
    if (!config.onQuestion) return 0
    let pushed = 0
    for (const entry of pending.values()) {
      if (entry.notified) continue
      if (at - entry.at < config.questionTimeoutMinutes * 60000) continue
      entry.notified = true
      if (pushOnce(`q:${entry.callId}`, 'question', {
        sessionId: entry.sessionId,
        sessionTitle: entry.sessionTitle,
        questions: entry.questions,
        waitedMs: at - entry.at,
        at,
      })) {
        pushed += 1
      }
    }
    return pushed
  }

  function testPush() {
    return deliver('test', {})
  }

  return {
    handleEvent,
    checkQuestions,
    testPush,
    pendingCount: () => pending.size,
    sentCount: () => sent.size,
  }
}
