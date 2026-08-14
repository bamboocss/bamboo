import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'

export function generatePropTypes(ctx: Context) {
  const { utility } = ctx

  const result = [
    outdent`
    ${ctx.file.importType('ConditionalValue', './conditions')}
    ${ctx.file.importType('CssProperties', './system-types')}
    ${ctx.file.importType('Tokens', '../tokens/index')}
    `,
    // Declared before `UtilityValues`, which references it under `strictTokens:
    // 'unknown-tokens'` for a custom utility that maps to a CSS property.
    outdent`
    /**
     * A property's own keywords, without the open \`string\` csstype ends every property with.
     *
     * That trailing \`(string & {})\` is what makes \`color: 'mutedd'\` type-check: it is a
     * string, so it is a colour. Removing it leaves what the property actually enumerates —
     * \`transparent\`, \`currentColor\`, every named colour — which is what
     * \`strictTokens: 'unknown-tokens'\` keeps.
     *
     * \`string extends T\` is the test, so the wide member goes and the literal ones stay. The
     * second branch is for the *boxed* \`String\`, which \`Properties<String | Number>\` puts on
     * every length-taking property and which is not assignable to \`string\` — so it survives the
     * first test and admits every string on its own. \`Number\` is deliberately kept: a number
     * cannot be a misspelled token path.
     */
    export type KnownKeywords<T> =
      T extends string ? (string extends T ? never : T)
      : T extends String ? never
      : T
    `,
    'export interface UtilityValues {',
  ]

  const types = utility.getTypes()

  for (const [prop, values] of types.entries()) {
    result.push(`\t${prop}: ${values.join(' | ')};`)
  }

  result.push('}', '\n')

  return outdent`
  ${result.join('\n')}

  /**
   * Values whose *shape* says they are CSS rather than a token path.
   *
   * A token path is a bare identifier, possibly dotted. Anything that starts with a digit, a
   * dot-digit, \`#\` or \`-\`, or that contains a space, a comma or a call, cannot be one — so
   * these stay allowed under \`strictTokens: 'unknown-tokens'\` while \`'mutedd'\` does not.
   *
   * Constant, and not parameterised by the token union: a template literal distributes over a
   * union in any placeholder, so a shape built from \`\${Token}\` would multiply the property's
   * union by the size of the palette. These add seven members whatever the theme contains — see
   * \`WithModifier\` below for what the other arrangement costs.
   *
   * The ambiguity this cannot resolve is a typo that is also a plausible value: \`'2xll'\` starts
   * with a digit exactly as \`'2rem'\` does, and passes.
   */
  export type CssValueShape =
    | \`\${number}\${string}\`
    | \`.\${number}\${string}\`
    | \`#\${string}\`
    | \`-\${string}\`
    | \`\${string} \${string}\`
    | \`\${string},\${string}\`
    | \`\${string}(\${string})\`

  type ImportantMark = "!" | "!important"
  type WhitespaceImportant = \` \${ImportantMark}\`
  type Important = ImportantMark | WhitespaceImportant
  type WithImportant<T> = [T] extends [string] ? \`\${T}\${Important}\` & { __important?: true } : never

  /**
   * The modifiers a token path may carry, as one open-ended tail rather than one closed
   * template per form.
   *
   * ⚠️ The \`& { __modifier?: true }\` is load-bearing, and nothing reads it. Deleting it as
   * dead weight costs **12.8x** on \`tsc\` — measured at 87.2s against 6.8s over 4,000 call
   * sites — because it is what stops TypeScript attempting subtype reduction across the
   * union these expand into. The same applies to \`__important\` above.
   *
   * A template literal distributes over a union in any placeholder, so \`\${T}\` against a
   * 258-token colour palette is 258 members, and the old \`\${T}\${Important}\` was four times
   * that. Between them the two modifier forms were 5N of a ~1,560-member union for \`color\`
   * alone, and half the cost of type-checking a \`css()\` call under \`strictTokens\`. Folding
   * them into one 3N tail is 14.5% off that — 7.09s against 8.29s over the same 4,000 call
   * sites, with a control repeat agreeing to 3.5%.
   *
   * What it gives up is the tail: \`red.300!nonsense\` type-checks now, where five exact
   * templates would have rejected it. \`unresolvedToken\` strips the mark and resolves the
   * path underneath, so the build still reports it — warning by default, failing under
   * \`'error'\`. The diagnostic moves rather than disappears, and only for a value nobody
   * writes on purpose.
   */
  type Modifier = "/" | "!" | " !"
  /**
   * \`Extract\`, not a \`[T] extends [string]\` test, which was the same thing until a utility
   * carried keywords beside its tokens: \`KnownKeywords\` keeps \`Number\` deliberately, and that
   * one non-string member turned every modifier form off for the whole property. It rejected
   * \`roundedBottom: 'lg!'\` while \`rounded: 'lg!'\` passed, purely because the two utilities are
   * declared differently — both emit \`var(--radii-lg) !important\`.
   *
   * Filtering costs nothing the test did not: the same string members distribute either way,
   * and \`Extract\` of no strings is \`never\`, exactly what the false branch returned.
   */
  type WithModifier<T> = \`\${Extract<T, string>}\${Modifier}\${string}\` & { __modifier?: true }

  /**
   * A list of candidate values, most-preferred first, emitted as repeated declarations so the
   * browser keeps the last one it understands.
   *
   * @example
   * css({ height: 'fallback(100dvh, 100vh)' })
   */
  type FallbackValue = \`fallback(\${string})\`

  /**
   * Only relevant when using \`strictTokens\` or \`strictPropertyValues\` in your config.
   * - Allows you to use an escape hatch (e.g. \`[123px]\`) to use any string as a value.
   * - Allows you to use a color opacity modifier (e.g. \`red/300\`) with known color values.
   * - Allows you to use an important mark (e.g. \`!\` or \`!important\`) in the value.
   * - Allows you to use a fallback list (e.g. \`fallback(100dvh, 100vh)\`).
   *
   * This is useful when you want to use a value that is not defined in the config or want to opt-out of the defaults.
   *
   * @example
   * css({
   *   fontSize: '[123px]', // ⚠️ will not throw even if you haven't defined 123px as a token
   * })
   *
   * @see https://bamboocss.com/docs/concepts/writing-styles#stricttokens
   * @see https://bamboocss.com/docs/concepts/writing-styles#strictpropertyvalues
   */
  export type WithEscapeHatch<T> =
    | T
    | \`[\${string}]\`
    | FallbackValue
    | WithImportant<FallbackValue>
    | WithModifier<T>

  /**
   * Will restrict the value of properties that have predefined values to those values only.
   *
   * @example
   * css({
   *   display: 'abc', // ❌ will throw
   * })
   *
   * @see https://bamboocss.com/docs/concepts/writing-styles#strictpropertyvalues
   */
  export type OnlyKnown<Key, Value> = Value extends boolean
    ? Value
    : Value extends \`\${infer _}\` ? Value : never
  `
}
