/**
 * Remote push request builders.
 *
 * Every builder is pure: it turns one notification into a `fetch` request.
 * Nothing here sends by itself, so the shapes stay unit-testable.
 */

export const PROVIDERS = Object.freeze(['none', 'pushplus', 'qmsg', 'wecom', 'serverchan', 'webhook'])

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** Whether the selected provider has everything it needs to send. */
export function providerReady(provider, config = {}) {
  switch (provider) {
    case 'pushplus':
      return text(config.pushplusToken).length > 0
    case 'qmsg':
      return text(config.qmsgKey).length > 0
    case 'wecom':
      return /^https?:\/\//.test(text(config.wecomWebhook))
    case 'serverchan':
      return text(config.serverchanKey).length > 0
    case 'webhook':
      return /^https?:\/\//.test(text(config.webhookUrl))
    default:
      return false
  }
}

/**
 * Build the HTTP request for one notification.
 * @returns {{url: string, init: object} | null}
 */
export function buildRequest(provider, config = {}, message = {}) {
  const title = text(message.title)
  const content = typeof message.content === 'string' ? message.content : ''
  const kind = text(message.kind) || 'notice'

  switch (provider) {
    case 'pushplus': {
      const channel = config.pushplusChannel === 'both' ? 'wechat,qq' : config.pushplusChannel === 'qq' ? 'qq' : 'wechat'
      return {
        url: 'https://www.pushplus.plus/send',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: text(config.pushplusToken), title, content, template: 'markdown', channel }),
        },
      }
    }
    case 'qmsg':
      return {
        url: `https://qmsg.zendee.cn/v3/send/${encodeURIComponent(text(config.qmsgKey))}`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ msg: `${title}\n${content}` }).toString(),
        },
      }
    case 'wecom':
      return {
        url: text(config.wecomWebhook),
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ msgtype: 'markdown', markdown: { content: `**${title}**\n${content}` } }),
        },
      }
    case 'serverchan':
      return {
        url: `https://sctapi.ftqq.com/${encodeURIComponent(text(config.serverchanKey))}.send`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ title, desp: content }).toString(),
        },
      }
    case 'webhook':
      return {
        url: text(config.webhookUrl),
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, kind, sessionId: message.sessionId, at: message.at }),
        },
      }
    default:
      return null
  }
}
