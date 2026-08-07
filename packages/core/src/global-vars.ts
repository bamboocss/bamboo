import type { CssPropertyDefinition, GlobalVarsDefinition } from '@bamboocss/types'
import { stringify } from './stringify'

interface GlobalVarsOptions {
  globalVars?: GlobalVarsDefinition
  cssVarRoot: string
}

export class GlobalVars {
  keys: Set<string>
  vars: string[]
  names: string[]

  constructor(private options: GlobalVarsOptions) {
    const { globalVars = {} } = options

    this.keys = new Set(Object.keys(globalVars))
    const arr = Array.from(this.keys)

    this.names = arr.map((v) => `${v.slice(2)}`)
    this.vars = arr.map((v) => `var(${v})`)
  }

  isEmpty() {
    return this.keys.size === 0
  }

  toString() {
    const { globalVars = {}, cssVarRoot } = this.options
    return stringifyGlobalVars(globalVars, cssVarRoot)
  }
}

/**
 * `@property` rules for a set of registrations, in declaration order.
 *
 * Shared with the utility registry, which registers the custom properties its utilities
 * compose. Both write the same at-rule, and a second spelling of it would be free to drift.
 */
export const stringifyCustomProperties = (properties: Map<string, CssPropertyDefinition>) => {
  if (!properties.size) return ''
  return Array.from(properties, ([key, config]) => stringifyProperty(key, config)).join('\n\n')
}

const stringifyGlobalVars = (globalVars: GlobalVarsDefinition, cssVarRoot: string) => {
  if (!globalVars) return ''

  const decls = [] as string[]

  const vars = { [cssVarRoot]: {} as Record<string, string> }
  const base = vars[cssVarRoot]

  Object.entries(globalVars).forEach(([key, value]) => {
    if (typeof value === 'string') {
      base[key] = value
      return
    }
    const css = stringifyProperty(key, value)
    decls.push(css)
  })

  const lines: string[] = []
  lines.push(stringify(vars))
  lines.push(...decls)

  return lines.join('\n\n')
}

/**
 * `initial-value` is omitted rather than defaulted when none is given.
 *
 * It used to fall back to the keyword `initial`, which is not the "no initial value" it
 * reads as. Under the universal syntax that keyword is just a token, so it becomes the
 * property's value and is substituted into whatever composes it — turning
 * `filter: var(--blur, ) var(--brightness, )` into `filter: initial brightness(…)`, which
 * is invalid, so the whole filter is dropped.
 *
 * Omitting the descriptor gives the property the guaranteed-invalid value instead, which is
 * what a `var(--x, )` reference is written to expect: the reference falls back to its own
 * empty value and composes to nothing.
 *
 * A non-universal syntax must still declare one — the spec makes the rule invalid without it
 * — but emitting a knowingly-invalid `initial-value` in its place fixed nothing and hid the
 * omission behind a rule the browser dropped for a different reason.
 */
function stringifyProperty(key: string, config: CssPropertyDefinition) {
  // Built rather than templated so a descriptor can be left out. The indentation is the
  // template's, kept byte for byte: `outdent` strips nothing here — its first line sits
  // flush against the backtick, so it reads the base indent as zero — and normalizing it
  // would reformat every `@property` rule already in users' stylesheets for no reason.
  const lines = [`    syntax: '${config.syntax}';`, `    inherits: ${config.inherits};`]
  if (config.initialValue !== undefined) lines.push(`    initial-value: ${config.initialValue};`)

  return `@property ${key} {\n${lines.join('\n')}\n  }`
}
