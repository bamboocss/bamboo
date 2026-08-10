import type { FontfaceRule, GlobalPositionTry as GlobalPositionTryDefinition } from '@bamboocss/types'
import { stringify } from './stringify'

/**
 * The name as `@position-try` requires it.
 *
 * A `@position-try` name is a `<dashed-ident>`, so a key written without the leading `--` gets
 * one. Exported because the same names are registered as values `positionTryFallbacks` accepts,
 * and a registration that disagreed with what was emitted would autocomplete a name with no rule
 * behind it.
 */
export const positionTryIdent = (key: string) => (key.startsWith('--') ? key : `--${key}`)

interface GlobalFontfaceOptions {
  globalPositionTry?: GlobalPositionTryDefinition
}

export class GlobalPositionTry {
  names: string[]

  constructor(private opts: GlobalFontfaceOptions) {
    // Normalised, so `names` says what the stylesheet actually declares.
    this.names = Object.keys(opts.globalPositionTry ?? {}).map(positionTryIdent)
  }

  isEmpty() {
    return this.names.length === 0
  }

  toString() {
    return stringifyGlobalPositionTry(this.opts.globalPositionTry ?? {})
  }
}

const stringifyGlobalPositionTry = (dfns: GlobalPositionTryDefinition) => {
  if (!dfns) return ''

  const lines: string[] = []

  Object.entries(dfns).forEach(([key, value]) => {
    const _value = Array.isArray(value) ? value : [value]
    _value.forEach((v) => {
      lines.push(stringifyPositionTry(key, v))
    })
  })

  return lines.join('\n\n')
}

function stringifyPositionTry(key: string, config: FontfaceRule) {
  return `@position-try ${positionTryIdent(key)} {
  ${stringify(config)}
}`
}
