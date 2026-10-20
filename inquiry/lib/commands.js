import { randomUUID } from 'node:crypto'
import { buildCommandPrompt } from './prompt.js'

export const COMMAND_NAMES = Object.freeze(['pao', 'pau', 'inquiry'])

function successText(config, rawInput) {
  const hasSeed = String(rawInput ?? '').trim().length > 0
  if (config.language === 'en') {
    return hasSeed
      ? 'Inquiry mode on: I will treat your addition as part of the seed, recap first, then ask.'
      : 'Inquiry mode on: I will recap this conversation first, then start the first round of questions.'
  }
  return hasSeed
    ? '已进入「刨根问底」：会把你的补充当作种子，先复述再提问。'
    : '已进入「刨根问底」：会先综合前面聊过的内容，再开始第一轮提问。'
}

export function createCommandHandler({ config }) {
  return async function handler(invocation) {
    const { agent, rawInput, signal } = invocation
    if (signal?.aborted) {
      return { kind: 'error', text: config.language === 'en' ? 'Cancelled.' : '已取消。' }
    }
    try {
      const text = buildCommandPrompt({ config, rawInput })
      await agent.followup({
        id: randomUUID(),
        role: 'user',
        content: [{ type: 'text', text }],
        source: { kind: 'user' },
      })
      return { kind: 'success', text: successText(config, rawInput) }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        kind: 'error',
        text: config.language === 'en' ? `Could not start inquiry mode: ${message}` : `无法触发问答模式：${message}`,
      }
    }
  }
}

export function commandDefinitions({ config, handler }) {
  const description =
    config.language === 'en'
      ? 'Enter inquiry mode: recap this conversation, then ask focused questions before building'
      : '进入「刨根问底」问答模式（综合本会话已有信息）'
  const hint = config.language === 'en' ? '[extra context]' : '[补充说明]'
  return COMMAND_NAMES.map((name) => ({
    name,
    description,
    input: { hint },
    handler,
  }))
}
