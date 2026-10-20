import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRequest, providerReady } from '../lib/providers.js'
import { createNotifier, formatMessage, normalizeNotifyConfig, parseQuestions } from '../lib/notify.js'

function makeNotifier(overrides = {}, configOverrides = {}) {
  const sent = []
  const config = {
    ...normalizeNotifyConfig({ notifyProvider: 'pushplus', notifyPushplusToken: 'tok' }),
    ...configOverrides,
  }
  const notifier = createNotifier({
    config,
    send: (message) => {
      sent.push(message)
      return Promise.resolve()
    },
    titleOf: () => '测试会话',
    ...overrides,
  })
  return { notifier, sent }
}

function toolCall(callId, time = 1000) {
  return {
    type: 'tool/call',
    time,
    data: {
      turn: 1,
      step: 1,
      callId,
      name: 'ask_user_question',
      arguments: JSON.stringify({
        questions: [{ id: 'q1', question: '中午吃什么？', options: [{ label: '面' }, { label: '饭' }], multi_select: false }],
      }),
    },
  }
}

test('providerReady only accepts a configured provider', () => {
  assert.equal(providerReady('none', {}), false)
  assert.equal(providerReady('pushplus', { pushplusToken: ' t ' }), true)
  assert.equal(providerReady('pushplus', {}), false)
  assert.equal(providerReady('wecom', { wecomWebhook: 'https://qyapi.weixin.qq.com/x' }), true)
  assert.equal(providerReady('webhook', { webhookUrl: 'not-a-url' }), false)
  assert.equal(providerReady('qmsg', { qmsgKey: 'k' }), true)
})

test('push request builders produce the documented shapes', () => {
  const pushplus = buildRequest('pushplus', { pushplusToken: 'tok', pushplusChannel: 'both' }, { title: 't', content: 'c' })
  assert.equal(pushplus.url, 'https://www.pushplus.plus/send')
  assert.equal(pushplus.init.method, 'POST')
  const pushplusBody = JSON.parse(pushplus.init.body)
  assert.equal(pushplusBody.token, 'tok')
  assert.equal(pushplusBody.channel, 'wechat,qq')
  assert.equal(pushplusBody.template, 'markdown')

  const qmsg = buildRequest('qmsg', { qmsgKey: 'my key' }, { title: 't', content: 'c' })
  assert.equal(qmsg.url, 'https://qmsg.zendee.cn/v3/send/my%20key')
  assert.ok(qmsg.init.body.includes('msg='))

  const wecom = buildRequest('wecom', { wecomWebhook: 'https://qyapi.weixin.qq.com/hook?key=1' }, { title: 't', content: 'c' })
  assert.equal(wecom.url, 'https://qyapi.weixin.qq.com/hook?key=1')
  assert.equal(JSON.parse(wecom.init.body).msgtype, 'markdown')

  const serverchan = buildRequest('serverchan', { serverchanKey: 'SCT1' }, { title: 't', content: 'c' })
  assert.equal(serverchan.url, 'https://sctapi.ftqq.com/SCT1.send')
  assert.ok(serverchan.init.body.includes('title=t'))

  const webhook = buildRequest('webhook', { webhookUrl: 'https://example.com/hook' }, { title: 't', content: 'c', kind: 'error', sessionId: 's1' })
  assert.equal(JSON.parse(webhook.init.body).kind, 'error')

  assert.equal(buildRequest('none', {}, { title: 't' }), null)
})

test('parseQuestions tolerates model arguments', () => {
  const parsed = parseQuestions(JSON.stringify({ questions: [{ id: 'a', question: 'Q?', options: [{ label: 'A' }, { label: 'B' }] }] }))
  assert.deepEqual(parsed, [{ id: 'a', question: 'Q?', options: ['A', 'B'] }])
  assert.deepEqual(parseQuestions('not json'), [])
})

test('formatMessage renders each kind', () => {
  const question = formatMessage('question', { sessionTitle: 'S', sessionId: 's1', waitedMs: 600000, questions: [{ question: 'Q1?', options: ['A', 'B'] }] })
  assert.match(question.title, /等你答题/)
  assert.match(question.content, /Q1\?/)
  assert.match(question.content, /A \/ B/)

  const failure = formatMessage('error', { sessionTitle: 'S', error: { code: 'E1', message: 'boom' }, at: Date.now() })
  assert.match(failure.content, /E1 — boom/)

  const done = formatMessage('done', { sessionTitle: 'S', runMs: 180000 })
  assert.match(done.content, /用时：约 3 分钟/)

  assert.match(formatMessage('test', {}).title, /已接通/)
})

test('an unanswered question pushes once after the timeout', () => {
  const { notifier, sent } = makeNotifier({}, { questionTimeoutMinutes: 10 })
  notifier.handleEvent({ id: 's1', header: {} }, toolCall('call-1', 1000))
  assert.equal(notifier.pendingCount(), 1)
  assert.equal(notifier.checkQuestions(1000 + 9 * 60000), 0)
  assert.equal(sent.length, 0)
  assert.equal(notifier.checkQuestions(1000 + 11 * 60000), 1)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].kind, 'question')
  assert.equal(notifier.checkQuestions(1000 + 20 * 60000), 0)
  assert.equal(sent.length, 1)

  notifier.handleEvent({ id: 's1', header: {} }, { type: 'tool/result', time: 2, data: { message: { toolCallId: 'call-1' } } })
  assert.equal(notifier.pendingCount(), 0)
})

test('a failed turn pushes once and ignores subagents', () => {
  const { notifier, sent } = makeNotifier()
  notifier.handleEvent({ id: 's1', header: {} }, { type: 'turn/start', time: 1000, data: { turn: 1 } })
  notifier.handleEvent({ id: 's1', header: {} }, { type: 'turn/end', time: 2000, data: { turn: 1, reason: { kind: 'error', error: { code: 'E1', message: 'boom' } } } })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].kind, 'error')
  notifier.handleEvent({ id: 's1', header: {} }, { type: 'turn/end', time: 3000, data: { turn: 1, reason: { kind: 'error', error: { code: 'E1', message: 'boom' } } } })
  assert.equal(sent.length, 1)

  notifier.handleEvent({ id: 'child', header: { origin: 'subagent' } }, { type: 'turn/end', time: 4000, data: { turn: 1, reason: { kind: 'error', error: { code: 'E2' } } } })
  assert.equal(sent.length, 1)
})

test('completion pushes only when enabled and long enough', () => {
  const off = makeNotifier({}, { onDone: false })
  off.notifier.handleEvent({ id: 's1', header: {} }, { type: 'turn/start', time: 0, data: { turn: 1 } })
  off.notifier.handleEvent({ id: 's1', header: {} }, { type: 'turn/end', time: 300000, data: { turn: 1, reason: { kind: 'completed' } } })
  assert.equal(off.sent.length, 0)

  const short = makeNotifier({}, { onDone: true, minRunSeconds: 60 })
  short.notifier.handleEvent({ id: 's1', header: {} }, { type: 'turn/start', time: 0, data: { turn: 1 } })
  short.notifier.handleEvent({ id: 's1', header: {} }, { type: 'turn/end', time: 5000, data: { turn: 1, reason: { kind: 'completed' } } })
  assert.equal(short.sent.length, 0)

  const long = makeNotifier({}, { onDone: true, minRunSeconds: 60 })
  long.notifier.handleEvent({ id: 's1', header: {} }, { type: 'turn/start', time: 0, data: { turn: 1 } })
  long.notifier.handleEvent({ id: 's1', header: {} }, { type: 'turn/end', time: 120000, data: { turn: 1, reason: { kind: 'completed' } } })
  assert.equal(long.sent.length, 1)
  assert.equal(long.sent[0].kind, 'done')
})

test('a disabled provider never sends', () => {
  const sent = []
  const notifier = createNotifier({
    config: normalizeNotifyConfig({ notifyProvider: 'none' }),
    send: (message) => sent.push(message),
    titleOf: () => 'S',
  })
  notifier.handleEvent({ id: 's1', header: {} }, { type: 'turn/end', time: 0, data: { turn: 1, reason: { kind: 'error', error: { code: 'E' } } } })
  assert.equal(sent.length, 0)
})

test('normalizeNotifyConfig reads flat keys, clamps and stays backward compatible', () => {
  const config = normalizeNotifyConfig({
    notifyProvider: 'qmsg',
    notifyQuestionTimeoutMinutes: 999,
    notifyMinRunSeconds: -5,
    notifyOnDone: 'yes',
  })
  assert.equal(config.provider, 'qmsg')
  assert.equal(config.questionTimeoutMinutes, 120)
  assert.equal(config.minRunSeconds, 0)
  assert.equal(config.onDone, false)
  assert.equal(normalizeNotifyConfig().provider, 'none')
  assert.equal(normalizeNotifyConfig().questionTimeoutMinutes, 5)
  assert.equal(normalizeNotifyConfig().onDone, true)

  const legacy = normalizeNotifyConfig({ notify: { provider: 'pushplus', pushplusToken: ' x ', onDone: true } })
  assert.equal(legacy.provider, 'pushplus')
  assert.equal(legacy.pushplusToken, 'x')
  assert.equal(legacy.onDone, true)
})

test('the shipped row defaults target WeChat via PushPlus', () => {
  const config = normalizeNotifyConfig({
    notifyProvider: 'pushplus',
    notifyPushplusToken: '',
    notifyPushplusChannel: 'wechat',
    notifyOnError: true,
    notifyOnQuestion: true,
    notifyQuestionTimeoutMinutes: 5,
    notifyOnDone: true,
    notifyMinRunSeconds: 300,
    notifyTestOnStart: false,
  })
  assert.equal(config.provider, 'pushplus')
  assert.equal(config.pushplusChannel, 'wechat')
  assert.equal(config.questionTimeoutMinutes, 5)
  assert.equal(config.onDone, true)
  assert.equal(config.minRunSeconds, 300)
  assert.equal(providerReady(config.provider, config), false)
})
