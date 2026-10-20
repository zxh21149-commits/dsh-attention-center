export const DEFAULT_CONFIG = Object.freeze({
  rounds: 4,
  questionsPerRound: 6,
  language: 'zh',
  questionBankPath: '',
  briefDir: '~/.dsh/inquiry',
  autoLoadSkill: true,
})

export const LIMITS = Object.freeze({
  rounds: Object.freeze({ min: 1, max: 8 }),
  questionsPerRound: Object.freeze({ min: 1, max: 10 }),
})

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Normalize raw plugin config into a complete, bounded config object.
 * Unknown keys are dropped; invalid values fall back to defaults.
 * @param {unknown} raw
 * @returns {typeof DEFAULT_CONFIG}
 */
export function normalizeConfig(raw = {}) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const config = { ...DEFAULT_CONFIG }

  if (Number.isFinite(input.rounds)) {
    config.rounds = clamp(Math.trunc(input.rounds), LIMITS.rounds.min, LIMITS.rounds.max)
  }
  if (Number.isFinite(input.questionsPerRound)) {
    config.questionsPerRound = clamp(
      Math.trunc(input.questionsPerRound),
      LIMITS.questionsPerRound.min,
      LIMITS.questionsPerRound.max,
    )
  }
  if (input.language === 'zh' || input.language === 'en') config.language = input.language
  if (typeof input.questionBankPath === 'string') config.questionBankPath = input.questionBankPath.trim()
  if (typeof input.briefDir === 'string' && input.briefDir.trim()) config.briefDir = input.briefDir.trim()
  if (typeof input.autoLoadSkill === 'boolean') config.autoLoadSkill = input.autoLoadSkill

  return config
}

export function totalQuestions(config) {
  return config.rounds * config.questionsPerRound
}
