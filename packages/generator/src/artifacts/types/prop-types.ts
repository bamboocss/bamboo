import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'

export function generatePropTypes(ctx: Context) {
  const { utility } = ctx

  const result = [
    outdent`
    ${ctx.file.importType('ConditionalValue', './conditions')}
    ${ctx.file.importType('CssProperties', './system-types')}
    ${ctx.file.importType('Tokens', '../tokens/index')}

    export interface UtilityValues {`,
  ]

  const types = utility.getTypes()

  for (const [prop, values] of types.entries()) {
    result.push(`\t${prop}: ${values.join(' | ')};`)
  }

  result.push('}', '\n')

  return outdent`
  ${result.join('\n')}

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
  type WithModifier<T> = [T] extends [string] ? \`\${T}\${Modifier}\${string}\` & { __modifier?: true } : never

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
