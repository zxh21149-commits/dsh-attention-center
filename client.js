window.__ModuleLoader__.load({
  id: 'dsh-attention-center',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'attention'
    const DISMISS_KEY = 'dsh.attention.dismissed.v1'
    const MUTE_KEY = 'dsh.attention.muted.v1'
    const AUTO_KEY = 'dsh.attention.auto.v1'
    /* Auto-pick menu. Minutes; no value here means "never".
       Idle time is only counted for a question the popup actually showed, so
       a longer default costs nothing — it just means fewer surprise picks. */
    const AUTO_OPTIONS = ['5', '10', '20', '30', '60']
    const DEFAULT_AUTO = '10'

    const DICT = {
      en: {
        'pill.running': 'Running {count}',
        'pill.idle': 'Idle',
        'pill.waiting': 'Answer {count}',
        'pill.failed': 'Failed {count}',
        'pill.done': 'Done {count}',
        'pill.title': 'Attention center',
        'pill.mute': 'Mute alerts',
        'pill.unmute': 'Unmute alerts',
        'pill.empty': 'No session is running.',
        'error.title': 'Session failed',
        'error.open': 'Open',
        'error.retry': 'Retry',
        'error.dismiss': 'Dismiss',
        'error.copy': 'Copy',
        'done.title': 'Session finished',
        'done.open': 'Open result',
        'done.dismiss': 'Got it',
        'question.title': 'A conversation is waiting for your answer',
        'question.waitingCount': '{count} conversation(s) waiting',
        'question.custom': 'Type your answer',
        'question.submit': 'Submit',
        'question.later': 'Later',
        'question.openSession': 'Open session',
        'question.multiHint': 'Multi-select',
        'question.close': 'Close',
        'question.auto': 'Auto-pick',
        'question.auto.off': 'Never',
        'question.auto.minutes': 'After {count} min',
        'question.auto.hint': 'If idle for {count} min, the recommended options are submitted automatically',
        'question.auto.offHint': 'No automatic selection',
        'question.auto.submitted': 'No activity for a while — the recommended answers were submitted automatically.',
        'question.auto.toast': 'Auto-submitted · {title}',
        'question.auto.picked': 'Picked: {answer}',
        'question.auto.ack': 'Got it',
        'question.auto.empty': '(nothing picked)',
        'question.auto.seenOnly': 'Only questions this popup has shown are auto-picked.',
        'pill.countdown': '⏳ {count}m',
        'question.submitting': 'Submitting…',
        'question.plan': 'A plan is waiting for review',
      },
      zh: {
        'pill.running': '运行中 {count}',
        'pill.idle': '空闲',
        'pill.waiting': '待答 {count}',
        'pill.failed': '失败 {count}',
        'pill.done': '完成 {count}',
        'pill.title': '注意力中心',
        'pill.mute': '静音提醒',
        'pill.unmute': '开启提醒声音',
        'pill.empty': '当前没有会话在运行。',
        'error.title': '会话失败',
        'error.open': '打开',
        'error.retry': '重试',
        'error.dismiss': '忽略',
        'error.copy': '复制',
        'done.title': '会话完成',
        'done.open': '看结果',
        'done.dismiss': '知道了',
        'question.title': '有对话在等你回答',
        'question.waitingCount': '还有 {count} 个对话在等',
        'question.custom': '自己填…',
        'question.submit': '提交',
        'question.later': '稍后',
        'question.openSession': '打开会话',
        'question.multiHint': '可多选',
        'question.close': '关闭',
        'question.auto': '自动选择',
        'question.auto.off': '永不',
        'question.auto.minutes': '{count} 分钟',
        'question.auto.hint': '若 {count} 分钟无操作，自动提交推荐项',
        'question.auto.offHint': '不会自动选择',
        'question.auto.submitted': '超时未操作，已自动提交推荐项。',
        'question.auto.toast': '已自动提交 · {title}',
        'question.auto.picked': '已选：{answer}',
        'question.auto.ack': '知道了',
        'question.auto.empty': '（未选）',
        'question.auto.seenOnly': '只对弹窗里真正显示过的问题生效。',
        'pill.countdown': '⏳{count}分',
        'question.submitting': '提交中…',
        'question.plan': '有份计划待审',
      },
    }

    function readForeground() {
      try {
        return document.visibilityState === 'visible' && document.hasFocus()
      } catch {
        return true
      }
    }

    function loadMuted() {
      try {
        return localStorage.getItem(MUTE_KEY) === '1'
      } catch {
        return false
      }
    }

    function loadAutoAnswer() {
      try {
        const value = localStorage.getItem(AUTO_KEY)
        return value === 'off' || AUTO_OPTIONS.includes(value) ? value : DEFAULT_AUTO
      } catch {
        return DEFAULT_AUTO
      }
    }

    function loadDismissed() {
      try {
        const value = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}')
        const cutoff = Date.now() - 7 * 24 * 3600 * 1000
        const kept = {}
        for (const [key, at] of Object.entries(value || {})) {
          if (typeof at === 'number' && at >= cutoff) kept[key] = at
        }
        return kept
      } catch {
        return {}
      }
    }

    function saveDismissed(value) {
      try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify(value))
      } catch {
        /* storage may be unavailable */
      }
    }

    let audio
    function beep() {
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext
        if (!Ctor) return
        audio = audio || new Ctor()
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.value = 740
        gain.gain.value = 0.04
        oscillator.connect(gain)
        gain.connect(audio.destination)
        oscillator.start()
        oscillator.stop(audio.currentTime + 0.12)
      } catch {
        /* autoplay may be blocked; alerting still works visually */
      }
    }

    function entryList(statuses) {
      if (!statuses) return []
      if (typeof statuses.forEach === 'function' && typeof statuses.get === 'function') {
        const entries = []
        statuses.forEach((value, key) => entries.push([key, value]))
        return entries
      }
      if (Array.isArray(statuses)) return statuses
      if (typeof statuses === 'object') return Object.entries(statuses)
      return []
    }

    function collectItems(list, statuses, dismissed, since) {
      const items = []
      const questions = []
      const byId = list?.byId || {}
      for (const id of list?.ids || []) {
        const summary = byId[id]
        if (!summary || summary.origin === 'subagent') continue
        const projection = list?.projectionsBySession?.[id]?.values?.attention
        const errors = projection && Array.isArray(projection.errors) ? projection.errors : []
        const latest = errors[errors.length - 1]
        if (latest && latest.at >= since) {
          const key = `err:${id}:${latest.turn}:${latest.at}`
          if (!dismissed[key]) items.push({ kind: 'error', key, sessionId: id, title: summary.displayTitle || id, at: latest.at, error: latest })
        }
      }
      for (const [id, status] of entryList(statuses)) {
        const summary = byId[id]
        if (summary && summary.origin === 'subagent') continue
        const pending = status && status.pendingInteraction
        if (pending && (pending.kind === 'question' || pending.kind === 'plan-review')) {
          questions.push({
            kind: 'question',
            key: `q:${pending.key}`,
            sessionId: id,
            title: summary?.displayTitle || id,
            at: summary?.updatedAt || 0,
            pending,
          })
        }
        if (status && status.completionUnread === true && summary && summary.updatedAt) {
          const key = `done:${id}:${summary.updatedAt}`
          if (!dismissed[key]) {
            items.push({ kind: 'done', key, sessionId: id, title: summary.displayTitle || id, at: summary.updatedAt })
          }
        }
      }
      return { items, questions }
    }

    function countRunning(list, statuses) {
      let running = 0
      const byStatus = new Map(entryList(statuses))
      for (const id of list?.ids || []) {
        const summary = list?.byId?.[id]
        if (!summary || summary.origin === 'subagent') continue
        if (summary.running === true || byStatus.get(id)?.running === true) running += 1
      }
      return running
    }

    const styles = {
      layer: { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 },
      /* One corner column: toasts on top, the running list under them, the
         pill at the bottom. Everything is a flex child (no fixed offsets),
         so the pieces can never land on top of each other. */
      corner: {
        position: 'fixed',
        right: 16,
        bottom: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
        maxWidth: 'calc(100vw - 32px)',
        pointerEvents: 'none',
      },
      bubble: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 12px',
        borderRadius: 999,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-overlay)',
        color: 'var(--dsw-alias-label-primary)',
        boxShadow: '0 6px 18px rgba(0,0,0,.18)',
        fontSize: 12,
        pointerEvents: 'auto',
        userSelect: 'none',
        cursor: 'pointer',
      },
      bubbleButton: { border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 12, padding: 0 },
      badgeWaiting: { color: 'var(--dsw-alias-state-warn-primary)', fontWeight: 600 },
      badgeError: { color: 'var(--dsw-alias-state-error-primary)', fontWeight: 600 },
      badgeDone: { color: 'var(--dsw-alias-state-success-primary)', fontWeight: 600 },
      badgeCountdown: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11, fontVariantNumeric: 'tabular-nums' },
      pick: { marginBottom: 4, wordBreak: 'break-word' },
      runningList: {
        width: 300,
        maxWidth: 'calc(100vw - 32px)',
        boxSizing: 'border-box',
        minWidth: 220,
        maxHeight: 240,
        overflowY: 'auto',
        padding: 8,
        borderRadius: 12,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-overlay)',
        color: 'var(--dsw-alias-label-primary)',
        boxShadow: '0 10px 28px rgba(0,0,0,.18)',
        fontSize: 12,
        pointerEvents: 'auto',
        animation: 'attn-fade 120ms ease-out',
      },
      row: {
        display: 'block',
        width: '100%',
        textAlign: 'left',
        border: 0,
        background: 'transparent',
        color: 'inherit',
        padding: '6px 8px',
        borderRadius: 8,
        cursor: 'pointer',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 12,
      },
      toastStack: {
        width: 340,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: '46vh',
        minHeight: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      },
      card: {
        position: 'relative',
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid var(--dsw-alias-border-l1)',
        borderLeft: '3px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-overlay)',
        color: 'var(--dsw-alias-label-primary)',
        boxShadow: '0 10px 28px rgba(0,0,0,.18)',
        pointerEvents: 'auto',
        fontSize: 13,
        lineHeight: 1.6,
      },
      cardError: { borderLeftColor: 'var(--dsw-alias-state-error-primary)' },
      cardDone: { borderLeftColor: 'var(--dsw-alias-state-success-primary)' },
      cardAuto: { borderLeftColor: 'var(--dsw-alias-state-warn-primary)' },
      cardIcon: { fontSize: 13, marginRight: 2 },
      titleRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
      title: { fontWeight: 600, fontSize: 14, letterSpacing: 0 },
      muted: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11 },
      sessionPill: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        maxWidth: '100%',
        padding: '1px 8px',
        borderRadius: 999,
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      errorText: {
        color: 'var(--dsw-alias-state-error-primary)',
        wordBreak: 'break-word',
        marginBottom: 8,
        maxHeight: 132,
        overflowY: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        lineHeight: 1.5,
      },
      actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 },
      button: {
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: 9,
        padding: '6px 12px',
        cursor: 'pointer',
        fontSize: 12,
        lineHeight: 1.2,
      },
      ghost: {
        border: '1px solid transparent',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        borderRadius: 9,
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: 12,
        lineHeight: 1.2,
      },
      primary: {
        border: '1px solid var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-brand-primary)',
        color: '#fff',
        borderRadius: 9,
        padding: '6px 14px',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.2,
      },
      modalBackdrop: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        /* Bottom padding keeps the modal clear of the corner column
           (pill + toasts), which is where the earlier overlap came from. */
        padding: '40px 16px 132px',
        boxSizing: 'border-box',
        pointerEvents: 'auto',
        zIndex: 9998,
        animation: 'attn-fade 120ms ease-out',
      },
      modalBackdropNarrow: { alignItems: 'flex-end', padding: '0' },
      modal: {
        width: 'min(620px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 180px)',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        borderRadius: 16,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-overlay)',
        color: 'var(--dsw-alias-label-primary)',
        boxShadow: '0 24px 60px rgba(0,0,0,.45)',
        fontSize: 13,
        outline: 'none',
      },
      modalSheet: { width: '100%', maxWidth: '100vw', maxHeight: '88vh', borderRadius: '16px 16px 0 0' },
      modalHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px 10px' },
      headerMain: { display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' },
      headerTools: { display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' },
      countdownTrack: {
        height: 3,
        margin: '0 18px',
        borderRadius: 3,
        background: 'var(--dsw-alias-bg-layer-2)',
        overflow: 'hidden',
      },
      countdownFill: {
        height: '100%',
        borderRadius: 3,
        background: 'var(--dsw-alias-state-warn-primary)',
        transition: 'width 400ms linear',
      },
      modalBody: { overflowY: 'auto', minHeight: 0, padding: '12px 18px 14px' },
      question: { marginBottom: 16 },
      questionHead: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 2 },
      qIndex: {
        flex: '0 0 auto',
        width: 20,
        height: 20,
        marginTop: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 10,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      },
      questionText: { fontWeight: 600, fontSize: 14, lineHeight: 1.5, margin: 0 },
      optionsList: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, marginLeft: 28 },
      option: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        textAlign: 'left',
        padding: '8px 12px',
        minHeight: 36,
        boxSizing: 'border-box',
        borderRadius: 10,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        fontSize: 13,
        lineHeight: 1.4,
      },
      optionSelected: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        textAlign: 'left',
        padding: '8px 12px',
        minHeight: 36,
        boxSizing: 'border-box',
        borderRadius: 10,
        border: '1px solid var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        fontSize: 13,
        lineHeight: 1.4,
      },
      tick: {
        flex: '0 0 auto',
        width: 16,
        height: 16,
        borderRadius: 999,
        boxSizing: 'border-box',
        border: '1.5px solid var(--dsw-alias-border-l1)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
      tickSquare: { borderRadius: 4 },
      tickOn: { borderColor: 'var(--dsw-alias-brand-primary)', background: 'var(--dsw-alias-brand-primary)' },
      tickDot: { width: 6, height: 6, borderRadius: 999, background: '#fff' },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px 12px',
        borderRadius: 10,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 13,
        marginTop: 8,
        marginLeft: 28,
      },
      footer: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        paddingTop: 10,
        borderTop: '1px solid var(--dsw-alias-border-l1)',
      },
      stepper: { display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' },
      notice: { color: 'var(--dsw-alias-state-warn-primary)', marginTop: 6 },
      selectWrap: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
      select: {
        appearance: 'none',
        WebkitAppearance: 'none',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: 8,
        padding: '4px 22px 4px 10px',
        fontSize: 11,
        cursor: 'pointer',
      },
      selectCaret: {
        position: 'absolute',
        right: 8,
        fontSize: 9,
        color: 'var(--dsw-alias-label-secondary)',
        pointerEvents: 'none',
      },
      cardHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, minWidth: 0 },
      cardHeadPill: { marginBottom: 0 },
      cardSession: {
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11,
        marginBottom: 8,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
    }
    const ANIMATION_CSS = [
      '@keyframes attn-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
      '@keyframes attn-fade{from{opacity:0}to{opacity:1}}',
      '@media (prefers-reduced-motion: reduce){.attn-anim{animation:none!important}}',
    ].join('')

    function readNarrow() {
      try {
        return Boolean(window.matchMedia && window.matchMedia('(max-width: 640px)').matches)
      } catch {
        return false
      }
    }

    function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          void navigator.clipboard.writeText(text)
          return
        }
      } catch {
        /* fall through to the textarea path */
      }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        document.body.removeChild(area)
      } catch {
        /* clipboard is best effort */
      }
    }

    class AttentionBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      componentDidCatch(error) {
        try {
          console.error('[attention-center]', error)
        } catch {
          /* ignore */
        }
      }
      render() {
        if (this.state.failed) {
          return h(
            'div',
            {
              style: {
                position: 'fixed',
                top: 12,
                right: 12,
                padding: '4px 9px',
                borderRadius: 999,
                background: 'var(--dsw-alias-state-error-primary, #b91c1c)',
                color: '#fff',
                fontSize: 11,
                zIndex: 10000,
                pointerEvents: 'none',
              },
            },
            'attention',
          )
        }
        return this.props.children
      }
    }

    function recommendedOf(question) {
      const options = question.options || []
      return options.find((option) => /\(Recommended\)/i.test(option.label || '')) || options[0]
    }

    function answersFor(item, drafts, auto) {
      return (item.pending.questions || []).map((question) => {
        const draft = drafts[item.key]?.[question.id]
        const entry = { id: question.id, selected: draft?.selected || [] }
        const custom = (draft?.custom || '').trim()
        if (custom) entry.custom = custom
        if (entry.selected.length > 0 || custom) return entry
        if (!auto) return entry
        const pick = recommendedOf(question)
        return { id: question.id, selected: pick ? [pick.label] : [] }
      })
    }

    function Overlay(props) {
      const { listStore, statusStore, tr: translate, openSession, retrySession } = props
      const tr = (key, params) => {
        try {
          return typeof translate === 'function' ? translate(key, params) : key
        } catch {
          return key
        }
      }
      const emptyList = React.useMemo(() => ({ ids: [], byId: {}, projectionsBySession: {} }), [])
      const emptyStatuses = React.useMemo(() => new Map(), [])
      const fallbackListStore = React.useMemo(() => ({ getSnapshot: () => emptyList, subscribe: () => () => {} }), [emptyList])
      const fallbackStatusStore = React.useMemo(() => ({ getSnapshot: () => emptyStatuses, subscribe: () => () => {} }), [emptyStatuses])
      const activeListStore = listStore && typeof listStore.getSnapshot === 'function' ? listStore : fallbackListStore
      const activeStatusStore = statusStore && typeof statusStore.getSnapshot === 'function' ? statusStore : fallbackStatusStore
      const subscribeList = React.useCallback((callback) => activeListStore.subscribe(callback), [activeListStore])
      const readList = React.useCallback(() => activeListStore.getSnapshot(), [activeListStore])
      const subscribeStatus = React.useCallback((callback) => activeStatusStore.subscribe(callback), [activeStatusStore])
      const readStatus = React.useCallback(() => activeStatusStore.getSnapshot(), [activeStatusStore])
      const list = React.useSyncExternalStore(subscribeList, readList, readList)
      const statuses = React.useSyncExternalStore(subscribeStatus, readStatus, readStatus)

      const mountedAt = React.useRef(Date.now())
      const [dismissed, setDismissed] = React.useState(loadDismissed)
      const [foreground, setForeground] = React.useState(readForeground)
      const [muted, setMuted] = React.useState(loadMuted)
      const [autoAnswer, setAutoAnswer] = React.useState(loadAutoAnswer)
      const [expanded, setExpanded] = React.useState(false)
      const [drafts, setDrafts] = React.useState({})
      const [busy, setBusy] = React.useState({})
      const [notice, setNotice] = React.useState(null)
      const [panelDismissed, setPanelDismissed] = React.useState(false)
      const [autoLog, setAutoLog] = React.useState([])
      const [tick, setTick] = React.useState(0)
      const lastActivity = React.useRef(Date.now())
      const autoSubmitted = React.useRef(new Set())
      /* A question key enters this set only once the popup has actually been on
         screen (foreground + panel open). Auto-pick refuses anything unseen, so
         "it answered a conversation I never saw" can no longer happen. */
      const seen = React.useRef(new Set())
      const sounded = React.useRef(new Set())
      const draftsRef = React.useRef(drafts)
      draftsRef.current = drafts

      React.useEffect(() => {
        const update = () => setForeground(readForeground())
        document.addEventListener('visibilitychange', update)
        window.addEventListener('focus', update)
        window.addEventListener('blur', update)
        return () => {
          document.removeEventListener('visibilitychange', update)
          window.removeEventListener('focus', update)
          window.removeEventListener('blur', update)
        }
      }, [])

      React.useEffect(() => {
        saveDismissed(dismissed)
      }, [dismissed])

      React.useEffect(() => {
        try {
          localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
        } catch {
          /* ignore */
        }
      }, [muted])

      React.useEffect(() => {
        try {
          localStorage.setItem(AUTO_KEY, autoAnswer)
        } catch {
          /* ignore */
        }
      }, [autoAnswer])

      React.useEffect(() => {
        if (autoAnswer === 'off') return undefined
        const timer = setInterval(() => setTick((value) => value + 1), 5000)
        return () => clearInterval(timer)
      }, [autoAnswer])

      const collected = collectItems(list, statuses, dismissed, mountedAt.current)
      const items = collected.items
      const questions = collected.questions
      const questionKeys = questions.map((item) => item.key).join('|')
      const showModal = questions.length > 0 && !panelDismissed

      React.useEffect(() => {
        if (!foreground || !showModal) return
        let fresh = false
        for (const item of questions) {
          if (seen.current.has(item.key)) continue
          seen.current.add(item.key)
          fresh = true
        }
        /* The idle clock starts when the question is first put in front of the
           user, not when it was created — otherwise a question that waited in a
           background window would be auto-picked the instant they come back. */
        if (fresh) lastActivity.current = Date.now()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [foreground, showModal, questionKeys])

      React.useEffect(() => {
        if (questions.length === 0) return
        setPanelDismissed(false)
        lastActivity.current = Date.now()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [questionKeys])

      React.useEffect(() => {
        if (!foreground) return
        for (const item of items) {
          if (sounded.current.has(item.key)) continue
          sounded.current.add(item.key)
          if (!muted) beep()
        }
      }, [items, foreground, muted])

      React.useEffect(() => {
        if (autoAnswer === 'off' || questions.length === 0) return
        const timeout = Number(autoAnswer) * 60000
        if (Date.now() - lastActivity.current < timeout) return
        /* Seen-only: an unanswered question the user was never shown keeps
           waiting instead of being answered behind their back. */
        const due = questions.filter(
          (item) => seen.current.has(item.key) && !autoSubmitted.current.has(item.key) && !busy[item.key],
        )
        if (due.length === 0) return
        for (const item of due) {
          autoSubmitted.current.add(item.key)
          void submitQuestion(item, true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [tick, questionKeys, autoAnswer])

      const running = countRunning(list, statuses)
      const waiting = questions.length
      const failed = items.filter((item) => item.kind === 'error').length
      const done = items.filter((item) => item.kind === 'done').length
      const runningSessions = (list?.ids || [])
        .map((id) => list?.byId?.[id])
        .filter((summary) => summary && summary.origin !== 'subagent' && summary.running === true)

      function answerFor(key, questionId) {
        return draftsRef.current[key]?.[questionId] || { selected: [], custom: '' }
      }

      function updateAnswer(key, questionId, patch) {
        setDrafts((previous) => {
          const card = previous[key] || {}
          const current = card[questionId] || { selected: [], custom: '' }
          return { ...previous, [key]: { ...card, [questionId]: { ...current, ...patch } } }
        })
      }

      function touch() {
        lastActivity.current = Date.now()
      }

      function choose(item, question, label) {
        touch()
        const current = answerFor(item.key, question.id)
        if (question.multiSelect) {
          const selected = current.selected.includes(label)
            ? current.selected.filter((value) => value !== label)
            : [...current.selected, label]
          updateAnswer(item.key, question.id, { selected })
          return
        }
        const selected = current.selected[0] === label ? [] : [label]
        updateAnswer(item.key, question.id, { selected, custom: '' })
      }

      function typeCustom(item, question, value) {
        touch()
        if (question.multiSelect) {
          updateAnswer(item.key, question.id, { custom: value })
          return
        }
        updateAnswer(item.key, question.id, { custom: value, selected: value ? [] : answerFor(item.key, question.id).selected })
      }

      function dismissItem(key) {
        setDismissed((previous) => ({ ...previous, [key]: Date.now() }))
      }

      async function submitQuestion(item, auto = false) {
        setBusy((previous) => ({ ...previous, [item.key]: true }))
        setNotice(null)
        const answers = answersFor(item, draftsRef.current, auto)
        /* Auto-pick leaves a record naming the conversation and every pick;
           a bare "something was chosen" toast is what made it feel haunted. */
        if (auto) {
          const asked = item.pending.questions || []
          const picks = answers.map((answer) => {
            const question = asked.find((entry) => entry.id === answer.id)
            const chosen = answer.custom || (answer.selected || []).join(' / ')
            return {
              q: (question && (question.question || question.header)) || answer.id,
              a: chosen || tr('question.auto.empty'),
            }
          })
          setAutoLog((previous) =>
            [{ key: item.key, sessionId: item.sessionId, title: item.title, at: Date.now(), picks }, ...previous].slice(0, 3),
          )
        }
        try {
          await item.pending.answer({ answers })
        } catch (error) {
          setNotice(String((error && error.message) || error))
        } finally {
          setBusy((previous) => ({ ...previous, [item.key]: false }))
        }
      }

      async function retry(item) {
        setBusy((previous) => ({ ...previous, [item.key]: true }))
        setNotice(null)
        try {
          const sent = await retrySession(item.sessionId)
          if (sent) dismissItem(item.key)
          else openSession(item.sessionId)
        } catch (error) {
          setNotice(String((error && error.message) || error))
        } finally {
          setBusy((previous) => ({ ...previous, [item.key]: false }))
        }
      }

      const timeoutMinutes = autoAnswer === 'off' ? 0 : Number(autoAnswer)
      const remainingMinutes =
        timeoutMinutes > 0
          ? Math.max(0, Math.ceil((lastActivity.current + timeoutMinutes * 60000 - Date.now()) / 60000))
          : 0

      const [narrow, setNarrow] = React.useState(readNarrow)
      const [pageByKey, setPageByKey] = React.useState({})
      const modalRef = React.useRef(null)

      React.useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return undefined
        const mq = window.matchMedia('(max-width: 640px)')
        const sync = () => setNarrow(mq.matches)
        if (mq.addEventListener) mq.addEventListener('change', sync)
        else if (mq.addListener) mq.addListener(sync)
        return () => {
          if (mq.removeEventListener) mq.removeEventListener('change', sync)
          else if (mq.removeListener) mq.removeListener(sync)
        }
      }, [])

      React.useEffect(() => {
        if (!showModal || !foreground) return
        const node = modalRef.current
        if (node && typeof node.focus === 'function') {
          try {
            node.focus({ preventScroll: true })
          } catch {
            /* focus is best effort */
          }
        }
      }, [showModal, foreground])

      React.useEffect(() => {
        if (!showModal) return undefined
        const onKey = (event) => {
          try {
            const tag = (event.target && event.target.tagName) || ''
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
            if (event.key === 'Escape') {
              event.preventDefault()
              setPanelDismissed(true)
              return
            }
            const first = questions[0]
            if (!first) return
            if (event.key === 'Enter') {
              event.preventDefault()
              void submitQuestion(first, false)
              return
            }
            const slot = Number(event.key)
            if (!Number.isInteger(slot) || slot < 1 || slot > 9) return
            const asked = first.pending.questions || []
            const page = Math.min(pageByKey[first.key] || 0, Math.max(0, Math.ceil(asked.length / 3) - 1))
            const question = asked[page * 3 + (slot - 1)]
            const option = question && (question.options || [])[slot - 1]
            if (!option) return
            event.preventDefault()
            choose(first, question, option.label)
          } catch {
            /* keyboard shortcuts must never break the overlay */
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [showModal, questionKeys, pageByKey])

      const toastItems = [...items].sort((left, right) => (right.at || 0) - (left.at || 0)).slice(0, 4)
      const toasts = toastItems.map((item) => {
        if (item.kind === 'error') {
          const detail = item.error.code + ': ' + item.error.message
          return h(
            'div',
            { key: item.key, style: { ...styles.card, ...styles.cardError } },
            h(
              'div',
              { style: styles.titleRow },
              h('span', { style: styles.cardIcon }, '⛔'),
              h('span', { style: styles.title }, tr('error.title')),
              h('span', { style: { ...styles.muted, marginLeft: 'auto' } }, new Date(item.at).toLocaleTimeString()),
            ),
            h('div', { style: styles.cardSession }, item.title),
            h('div', { style: styles.errorText }, detail),
            h(
              'div',
              { style: styles.actions },
              h('button', { style: styles.primary, onClick: () => { openSession(item.sessionId); dismissItem(item.key) } }, tr('error.open')),
              h('button', { style: styles.button, disabled: busy[item.key], onClick: () => retry(item) }, tr('error.retry')),
              h('button', { style: styles.ghost, onClick: () => copyText(detail) }, tr('error.copy')),
              h('button', { style: styles.ghost, onClick: () => dismissItem(item.key) }, tr('error.dismiss')),
            ),
          )
        }
        return h(
          'div',
          { key: item.key, style: { ...styles.card, ...styles.cardDone } },
          h(
            'div',
            { style: styles.titleRow },
            h('span', { style: styles.cardIcon }, '✓'),
            h('span', { style: styles.title }, tr('done.title')),
            h('span', { style: { ...styles.muted, marginLeft: 'auto' } }, new Date(item.at).toLocaleTimeString()),
          ),
          h('div', { style: styles.cardSession }, item.title),
          h(
            'div',
            { style: styles.actions },
            h('button', { style: styles.primary, onClick: () => { openSession(item.sessionId); dismissItem(item.key) } }, tr('done.open')),
            h('button', { style: styles.ghost, onClick: () => dismissItem(item.key) }, tr('done.dismiss')),
          ),
        )
      })

      /* While the answer panel is up it owns the screen; only failures (and the
         auto-pick record) keep their cards, so nothing stacks on the modal. */
      const visibleToasts = showModal ? toasts.filter((node, index) => toastItems[index].kind === 'error') : toasts

      /* One card per auto-submit, naming the conversation and what was picked.
         It stays until acknowledged, so the pick can never be anonymous again. */
      const autoCards = autoLog.map((entry) =>
        h(
          'div',
          { key: 'autolog:' + entry.key + ':' + entry.at, style: { ...styles.card, ...styles.cardAuto } },
          h(
            'div',
            { style: styles.titleRow },
            h('span', { style: styles.cardIcon }, '⏱'),
            h('span', { style: styles.title }, tr('question.auto.toast', { title: entry.title })),
            h('span', { style: { ...styles.muted, marginLeft: 'auto' } }, new Date(entry.at).toLocaleTimeString()),
          ),
          entry.picks.map((pick, index) =>
            h('div', { key: index, style: styles.pick }, tr('question.auto.picked', { answer: pick.a }) + '　' + pick.q),
          ),
          h(
            'div',
            { style: styles.actions },
            h(
              'button',
              {
                style: styles.primary,
                onClick: () => {
                  openSession(entry.sessionId)
                  setAutoLog((previous) => previous.filter((item) => item.key !== entry.key))
                },
              },
              tr('question.openSession'),
            ),
            h(
              'button',
              { style: styles.ghost, onClick: () => setAutoLog((previous) => previous.filter((item) => item.key !== entry.key)) },
              tr('question.auto.ack'),
            ),
          ),
        ),
      )

      const countdownRatio =
        timeoutMinutes > 0
          ? Math.max(0, Math.min(1, (lastActivity.current + timeoutMinutes * 60000 - Date.now()) / (timeoutMinutes * 60000)))
          : 0

      function questionCard(item) {
        const pending = item.pending
        if (pending.kind === 'plan-review') {
          return h(
            'div',
            { key: item.key, style: styles.card },
            h(
              'div',
              { style: styles.cardHead },
              h('span', { style: { ...styles.sessionPill, ...styles.cardHeadPill } }, item.title),
            ),
            h('div', { style: styles.questionText }, tr('question.plan')),
            h(
              'div',
              { style: styles.actions },
              h('button', { style: styles.primary, onClick: () => { openSession(item.sessionId); setPanelDismissed(true) } }, tr('question.openSession')),
              h('button', { style: styles.ghost, onClick: () => setPanelDismissed(true) }, tr('question.later')),
            ),
          )
        }
        const asked = pending.questions || []
        const perPage = 3
        const pages = Math.max(1, Math.ceil(asked.length / perPage))
        const page = Math.min(pageByKey[item.key] || 0, pages - 1)
        const shown = asked.slice(page * perPage, page * perPage + perPage)
        const goto = (next) => setPageByKey((previous) => ({ ...previous, [item.key]: Math.max(0, Math.min(pages - 1, next)) }))
        return h(
          'div',
          { key: item.key, style: styles.card },
          h(
            'div',
            { style: styles.cardHead },
            h('span', { style: { ...styles.sessionPill, ...styles.cardHeadPill } }, item.title),
            h('span', { style: styles.muted }, asked.length + ' 题'),
            pages > 1
              ? h(
                  'div',
                  { style: styles.stepper },
                  h('button', { style: styles.ghost, disabled: page === 0, onClick: () => goto(page - 1) }, '‹'),
                  h('span', { style: styles.muted }, page + 1 + ' / ' + pages),
                  h('button', { style: styles.ghost, disabled: page >= pages - 1, onClick: () => goto(page + 1) }, '›'),
                )
              : null,
          ),
          shown.map((question, offset) => {
            const answer = answerFor(item.key, question.id)
            const index = page * perPage + offset + 1
            return h(
              'div',
              { key: question.id, style: styles.question },
              h(
                'div',
                { style: styles.questionHead },
                h('span', { style: styles.qIndex }, 'q' + index),
                h(
                  'div',
                  { style: styles.questionText },
                  question.question + (question.multiSelect ? '（' + tr('question.multiHint') + '）' : ''),
                ),
              ),
              question.header ? h('div', { style: { ...styles.muted, marginBottom: 2, marginLeft: 28 } }, question.header) : null,
              h(
                'div',
                { style: styles.optionsList },
                (question.options || []).map((option) => {
                  const active = answer.selected.includes(option.label)
                  return h(
                    'button',
                    {
                      key: option.label,
                      type: 'button',
                      role: question.multiSelect ? 'checkbox' : 'radio',
                      'aria-checked': active ? 'true' : 'false',
                      title: option.description || '',
                      style: active ? styles.optionSelected : styles.option,
                      onClick: () => choose(item, question, option.label),
                    },
                    h(
                      'span',
                      { style: { ...styles.tick, ...(question.multiSelect ? styles.tickSquare : null), ...(active ? styles.tickOn : null) } },
                      active ? h('span', { style: styles.tickDot }) : null,
                    ),
                    h('span', null, option.label),
                  )
                }),
              ),
              h('input', {
                style: styles.input,
                value: answer.custom,
                placeholder: tr('question.custom'),
                'aria-label': tr('question.custom'),
                onChange: (event) => typeCustom(item, question, event.target.value),
              }),
            )
          }),
          h(
            'div',
            { style: styles.footer },
            h(
              'button',
              { style: styles.primary, disabled: busy[item.key], onClick: () => submitQuestion(item, false) },
              busy[item.key] ? tr('question.submitting') : tr('question.submit'),
            ),
            h('button', { style: styles.ghost, onClick: () => { openSession(item.sessionId); setPanelDismissed(true) } }, tr('question.openSession')),
          ),
        )
      }

      const notifications = []
        .concat(autoCards)
        .concat(notice ? [h('div', { key: 'notice', style: styles.card }, h('div', { style: styles.notice }, notice))] : [])
        .concat(visibleToasts)

      const modal = showModal && foreground
        ? h(
            'div',
            {
              style: { ...styles.modalBackdrop, ...(narrow ? styles.modalBackdropNarrow : null) },
              onPointerDown: (event) => { if (event.target === event.currentTarget) setPanelDismissed(true) },
            },
            h(
              'div',
              {
                style: { ...styles.modal, ...(narrow ? styles.modalSheet : null) },
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': tr('question.title'),
                tabIndex: -1,
                ref: modalRef,
              },
              h(
                'div',
                { style: styles.modalHeader },
                h(
                  'div',
                  { style: styles.headerMain },
                  h('span', { style: styles.title }, tr('question.title')),
                  h('span', { style: styles.muted }, tr('question.waitingCount', { count: questions.length })),
                ),
                h(
                  'div',
                  { style: styles.headerTools },
                  h(
                    'span',
                    { style: styles.selectWrap, title: timeoutMinutes > 0 ? tr('question.auto.hint', { count: timeoutMinutes }) : tr('question.auto.offHint') },
                    h(
                      'select',
                      { style: styles.select, value: autoAnswer, onChange: (event) => setAutoAnswer(event.target.value) },
                      h('option', { value: 'off' }, tr('question.auto.off')),
                      AUTO_OPTIONS.map((minutes) =>
                        h('option', { key: minutes, value: minutes }, tr('question.auto.minutes', { count: Number(minutes) })),
                      ),
                    ),
                    h('span', { style: styles.selectCaret }, '▾'),
                  ),
                  h('button', { style: styles.ghost, 'aria-label': tr('question.close'), title: tr('question.close'), onClick: () => setPanelDismissed(true) }, '✕'),
                ),
              ),
              timeoutMinutes > 0
                ? h(
                    'div',
                    { style: styles.countdownTrack, 'aria-hidden': 'true' },
                    h('div', { style: { ...styles.countdownFill, width: countdownRatio * 100 + '%' } }),
                  )
                : null,
              h('div', { style: styles.modalBody }, questions.map((item) => questionCard(item))),
            ),
          )
        : null

      return h(
        'div',
        { style: styles.layer, 'aria-live': 'polite' },
        h('style', { key: 'attn-css' }, ANIMATION_CSS),
        h(
          'div',
          { style: styles.corner },
          notifications.length > 0 ? h('div', { style: styles.toastStack }, notifications) : null,
          expanded && questions.length === 0
            ? h(
                'div',
                { style: styles.runningList },
                runningSessions.length === 0
                  ? h('div', { style: styles.muted }, tr('pill.empty'))
                  : runningSessions.slice(0, 8).map((summary) =>
                      h(
                        'button',
                        { key: summary.id, style: styles.row, title: summary.displayTitle, onClick: () => openSession(summary.id) },
                        '● ' + summary.displayTitle,
                      ),
                    ),
              )
            : null,
          h(
            'div',
            { style: styles.bubble, title: tr('pill.title') },
            h(
              'button',
              {
                style: styles.bubbleButton,
                onClick: () => {
                  if (questions.length > 0) setPanelDismissed(false)
                  else setExpanded((value) => !value)
                },
              },
              running > 0 ? tr('pill.running', { count: running }) : tr('pill.idle'),
            ),
            waiting > 0 ? h('span', { style: styles.badgeWaiting }, tr('pill.waiting', { count: waiting })) : null,
            waiting > 0 && timeoutMinutes > 0
              ? h('span', { style: styles.badgeCountdown }, tr('pill.countdown', { count: remainingMinutes }))
              : null,
            failed > 0 ? h('span', { style: styles.badgeError }, tr('pill.failed', { count: failed })) : null,
            done > 0 ? h('span', { style: styles.badgeDone }, tr('pill.done', { count: done })) : null,
            h(
              'button',
              {
                style: styles.bubbleButton,
                title: muted ? tr('pill.unmute') : tr('pill.mute'),
                onClick: () => setMuted((value) => !value),
              },
              muted ? '🔇' : '🔔',
            ),
          ),
        ),
        modal,
      )
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en: DICT.en, zh: DICT.zh }), 'attention copy')
      const translate = ctx.locale.bind(NS)
      const tr = (key, params) => translate(key, params)
      const listStore = ctx.sessions.list
      const statusStore = ctx.uiSession.sessionStatus

      function retrySession(sessionId) {
        return (async () => {
          const reference = ctx.sessions.retain(sessionId, { source: 'gateway' })
          try {
            const binding = await reference.ready
            const window = binding.eventSource.getSnapshot()
            let lastUser = null
            for (const entry of window.entries || []) {
              if (entry.type !== 'event') continue
              const event = entry.event
              if (event.type === 'user/message' && event.data && event.data.source && event.data.source.kind === 'user') lastUser = event
            }
            if (!lastUser) return false
            const content = (lastUser.data.content || [])
              .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
              .map((block) => ({ type: 'text', text: block.text }))
            if (content.length === 0) return false
            const result = await binding.session.prompt(content, 'queue')
            return Boolean(result && result.ok)
          } finally {
            reference.release()
          }
        })()
      }

      const Component = (props) =>
        h(
          AttentionBoundary,
          null,
          h(Overlay, {
            ...props,
            listStore: props.listStore || listStore,
            statusStore: props.statusStore || statusStore,
            tr,
            openSession: (sessionId) => ctx.uiWorkspace.openSession(sessionId),
            retrySession,
          }),
        )

      ctx.effect(
        () => ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'attention-center', order: 90 }, Component)),
        'attention overlay',
      )
    }

    return {
      inject: ['slots', 'locale', 'sessions', 'uiSession', 'uiWorkspace'],
      apply,
    }
  },
})
