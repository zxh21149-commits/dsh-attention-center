import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'

const builtinCache = new Map()

function builtinPath(language) {
  return new URL(`../banks/${language === 'en' ? 'en' : 'zh'}.json`, import.meta.url)
}

export function expandPath(input, { home = homedir(), cwd = process.cwd() } = {}) {
  const value = String(input ?? '').trim()
  if (value === '~') return home
  if (value.startsWith('~/') || value.startsWith('~\\')) return resolve(home, value.slice(2))
  return isAbsolute(value) ? value : resolve(cwd, value)
}

function normalizeQuestion(question) {
  if (typeof question === 'string') {
    const text = question.trim()
    return text ? { text, options: [], multiSelect: false } : null
  }
  if (!question || typeof question !== 'object') return null
  const text = typeof question.text === 'string' ? question.text.trim() : ''
  if (!text) return null
  const options = Array.isArray(question.options)
    ? question.options.filter((option) => typeof option === 'string' && option.trim()).map((option) => option.trim())
    : []
  return { text, options, multiSelect: question.multiSelect === true }
}

export function normalizeBank(bank) {
  return {
    version: Number.isFinite(bank?.version) ? bank.version : 1,
    language: typeof bank?.language === 'string' ? bank.language : undefined,
    notes: typeof bank?.notes === 'string' ? bank.notes : '',
    dimensions: (bank?.dimensions ?? []).map((dimension, index) => ({
      id: typeof dimension?.id === 'string' && dimension.id ? dimension.id : `dimension-${index + 1}`,
      title: String(dimension?.title ?? '').trim(),
      questions: (dimension?.questions ?? []).map(normalizeQuestion).filter(Boolean),
    })),
  }
}

/** Validate a custom question-bank document. Returns human-readable errors. */
export function validateBank(value) {
  const errors = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['root must be a JSON object'] }
  }
  if (!Array.isArray(value.dimensions) || value.dimensions.length === 0) {
    errors.push('dimensions must be a non-empty array')
  } else {
    value.dimensions.forEach((dimension, index) => {
      if (!dimension || typeof dimension !== 'object' || Array.isArray(dimension)) {
        errors.push(`dimensions[${index}] must be an object`)
        return
      }
      if (typeof dimension.title !== 'string' || !dimension.title.trim()) {
        errors.push(`dimensions[${index}].title must be a non-empty string`)
      }
      if (!Array.isArray(dimension.questions) || dimension.questions.length === 0) {
        errors.push(`dimensions[${index}].questions must be a non-empty array`)
        return
      }
      dimension.questions.forEach((question, qIndex) => {
        const where = `dimensions[${index}].questions[${qIndex}]`
        if (typeof question === 'string') {
          if (!question.trim()) errors.push(`${where} must be a non-empty string`)
          return
        }
        if (!question || typeof question !== 'object' || Array.isArray(question)) {
          errors.push(`${where} must be a string or an object`)
          return
        }
        if (typeof question.text !== 'string' || !question.text.trim()) {
          errors.push(`${where}.text must be a non-empty string`)
        }
        if (question.options !== undefined) {
          if (!Array.isArray(question.options)) {
            errors.push(`${where}.options must be an array`)
          } else if (question.options.some((option) => typeof option !== 'string')) {
            errors.push(`${where}.options must contain strings only`)
          }
        }
      })
    })
  }
  return { ok: errors.length === 0, errors }
}

export function readBuiltinBank(language) {
  const key = language === 'en' ? 'en' : 'zh'
  if (!builtinCache.has(key)) {
    builtinCache.set(key, JSON.parse(readFileSync(builtinPath(key), 'utf8')))
  }
  return builtinCache.get(key)
}

/**
 * Load the effective question bank.
 * A custom path that cannot be read or validated falls back to the built-in bank.
 * @returns {{bank: ReturnType<typeof normalizeBank>, source: 'builtin'|'custom', path: string, warnings: string[]}}
 */
export function loadBank({
  language = 'zh',
  questionBankPath = '',
  readFile = (path) => readFileSync(path, 'utf8'),
  warn = (message) => console.warn(`[dsh-inquiry-mode] ${message}`),
} = {}) {
  const builtin = normalizeBank(readBuiltinBank(language))
  const requested = String(questionBankPath ?? '').trim()
  if (!requested) return { bank: builtin, source: 'builtin', path: '', warnings: [] }

  let resolved
  try {
    resolved = expandPath(requested)
    const parsed = JSON.parse(readFile(resolved))
    const validation = validateBank(parsed)
    if (!validation.ok) {
      const warning = `自定义题库无效（${resolved}）：${validation.errors.slice(0, 3).join('; ')}；已回退内置题库`
      warn(warning)
      return { bank: builtin, source: 'builtin', path: resolved, warnings: [warning] }
    }
    return { bank: normalizeBank(parsed), source: 'custom', path: resolved, warnings: [] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const warning = `自定义题库读取失败（${resolved ?? requested}）：${message}；已回退内置题库`
    warn(warning)
    return { bank: builtin, source: 'builtin', path: resolved ?? requested, warnings: [warning] }
  }
}
