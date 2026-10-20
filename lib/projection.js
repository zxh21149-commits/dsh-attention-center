import { z } from 'zod'

/**
 * Client-visible projection: the last few failed turns of one Session.
 * Folding only session events keeps it deterministic and replayable.
 */

const MAX_ERRORS = 5
const MAX_MESSAGE = 300

const errorSchema = z.object({
  turn: z.number(),
  code: z.string(),
  message: z.string(),
  at: z.number(),
})

const stateSchema = z.object({ errors: z.array(errorSchema) })
const viewSchema = z.object({ errors: z.array(errorSchema) })

function text(value, fallback) {
  const raw = typeof value === 'string' ? value : ''
  const trimmed = raw.trim() || fallback
  return trimmed.length > MAX_MESSAGE ? `${trimmed.slice(0, MAX_MESSAGE)}…` : trimmed
}

/** Fold one session event into the attention state. */
export function foldAttention(state, event) {
  if (event?.type !== 'turn/end') return state
  const reason = event.data?.reason
  if (reason?.kind !== 'error') return state
  const failure = reason.error ?? {}
  const entry = {
    turn: event.data.turn,
    code: text(failure.code, 'UNKNOWN'),
    message: text(failure.message, 'Request failed'),
    at: event.time,
  }
  const errors = [...state.errors, entry].slice(-MAX_ERRORS)
  return { errors }
}

/** Client-visible view; unchanged states reuse the same reference. */
export function attentionView(state) {
  return state
}

export function createAttentionProjection() {
  return {
    key: 'attention',
    stateSchema,
    stateVersion: 1,
    init: () => ({ errors: [] }),
    apply: foldAttention,
    wire: {
      viewSchema,
      view: attentionView,
    },
  }
}

export { MAX_ERRORS, MAX_MESSAGE }
