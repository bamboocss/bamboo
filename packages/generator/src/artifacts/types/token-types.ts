import type { Context } from '@bamboocss/core'
import { capitalize, unionType } from '@bamboocss/shared'
import { outdent } from 'outdent'
import pluralize from 'pluralize'

/** A css function whose result only the browser can produce, so it is never a literal. */
export const COMPUTED_BY_CSS = /\b(?:var|env|attr)\s*\(/i

const categories = [
  'aspectRatios',
  'zIndex',
  'opacity',
  'colors',
  'fonts',
  'fontSizes',
  'fontWeights',
  'lineHeights',
  'letterSpacings',
  'sizes',
  'cursor',
  'shadows',
  'spacing',
  'radii',
  'borders',
  'borderWidths',
  'durations',
  'easings',
  'animations',
  'blurs',
  'gradients',
  'breakpoints',
  'assets',
]

export function generateTokenTypes(ctx: Context) {
  const { tokens } = ctx

  const set = new Set<string>()

  const tokenSet = new Set<string>()
  const literalTokenSet = new Set<string>()

  const result = new Set<string>(['export type Tokens = {'])

  if (tokens.isEmpty) {
    result.add('[token: string]: string')
  } else {
    const colorPaletteKeys = Array.from(tokens.view.colorPalettes.keys())
    if (colorPaletteKeys.length) {
      set.add(`export type ColorPalette = ${unionType(colorPaletteKeys)}`)
    }

    for (const [key, value] of tokens.view.categoryMap.entries()) {
      const typeName = capitalize(pluralize.singular(key))
      const categoryName = `${typeName}Token`
      set.add(`export type ${categoryName} = ${unionType(value.keys())}`)
      tokenSet.add(`${key}.$\{${categoryName}}`)
      result.add(`\t\t${key}: ${categoryName}`)
    }

    // Which tokens `token.value()` can answer with an actual literal.
    //
    // Not every token has one. A virtual or conditional token resolves to its `var()` because
    // there is no single value to hand back, and a negative token to
    // `calc(var(--spacing-4) * -1)` because it has no declaration of its own. `token.value`
    // returns those references, which is truthful and useless to the caller who asked for a
    // literal precisely because a css variable will not resolve where they are — a canvas
    // fill, a charting library, arithmetic on the number.
    //
    // Read off the emitted value rather than re-deriving the conditions that produce it, so
    // this cannot drift from what the runtime returns: whatever the browser still has to
    // compute is not a literal. A non-string value is one — a `fontWeights` entry written as
    // `{ value: 700 }` stays the number.
    //
    // `env()` and `attr()` join `var()` because the promise is a value usable *outside* css,
    // and those are no more resolvable in a canvas than a variable is. Case-insensitive and
    // whitespace-tolerant, since css function names are ascii case-insensitive: `VAR(--x)` is
    // a variable reference and was admitted as a literal.
    //
    // Two spellings are in play and both are needed. The *type* names a token
    // `category.prop`, which is how `Token` above is built; the *dictionary* keys it on
    // `token.name`. Those differ for a negative, whose prop carries the sign on the last
    // segment — `spacing.test.-test` is named that way and typed `spacing.-test.test`. Looking
    // the value up by the type's spelling therefore finds nothing, and reading "nothing" as
    // "no variable in it" would have offered every negative token as a literal. So the
    // spelling comes from the prop and the value from the name.
    for (const token of tokens.allTokens) {
      const { category, prop } = token.extensions
      if (!category || prop == null) continue

      const resolved = tokens.view.get(token.name)
      if (resolved === undefined) continue
      if (typeof resolved === 'string' && COMPUTED_BY_CSS.test(resolved)) continue

      literalTokenSet.add(`${category}.${prop}`)
    }
  }

  result.add('} & { [token: string]: never }')

  set.add(Array.from(result).join('\n'))

  set.add(`export type TokenCategory = ${unionType(categories)}`)

  const arr = Array.from(set)
  arr.unshift(
    `export type Token = ${unionType(tokenSet, {
      stringify: (t) => `\`${t}\``,
      fallback: 'string',
    })}`,
    // The subset `token.value()` accepts. Spelled out one token at a time rather than as a
    // `category.${CategoryToken}` template, because the split runs *within* a category — most
    // colours have a literal and the semantic ones beside them do not.
    //
    // `never` when a theme declares tokens but none of them resolve to a literal — an
    // all-conditional shadow scale does this. That makes `token.value()` uncallable, which is
    // the honest answer: reach for `token()` instead. `string` only when there are no tokens
    // at all, on the same condition `Token` uses, since a theme that declares none constrains
    // nothing.
    `export type LiteralToken = ${unionType(literalTokenSet, { fallback: tokenSet.size ? 'never' : 'string' })}`,
  )

  return outdent.string(arr.join('\n\n'))
}
