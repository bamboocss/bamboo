import type { Token } from '@bamboocss/token-dictionary'
import { COMPUTED_BY_CSS } from '../artifacts/types/token-types'

const CATEGORY_PROPERTY_MAP: Record<string, string> = {
  colors: 'color',
  spacing: 'padding',
  sizes: 'width',
  fonts: 'fontFamily',
  fontSizes: 'fontSize',
  fontWeights: 'fontWeight',
  letterSpacings: 'letterSpacing',
  lineHeights: 'lineHeight',
  shadows: 'boxShadow',
  radii: 'borderRadius',
  durations: 'transitionDuration',
  easings: 'transitionTimingFunction',
  gradients: 'backgroundImage',
  aspectRatios: 'aspectRatio',
  cursor: 'cursor',
  borderWidths: 'borderWidth',
  borders: 'border',
  zIndex: 'zIndex',
  opacity: 'opacity',
  blurs: 'filter',
}

const getCategoryProperty = (category?: string): string => {
  return category ? (CATEGORY_PROPERTY_MAP[category] ?? 'color') : 'color'
}

/**
 * Whether `token.value()` would answer with an actual literal.
 *
 * Takes the *resolved* value rather than the token, because the token alone cannot answer.
 * A semantic token appears once per condition under one name, and `view.get` is last-write —
 * so `colors.button.thick` carries `value: '#fff'` on its base variant while the view returns
 * `var(--colors-button-thick)`, because a `_dark` sibling wrote after it. Asking the token's
 * own fields said "literal" and the `.d.ts` said otherwise; only the view knows.
 */
const hasLiteralValue = (resolved: unknown) => {
  if (resolved === undefined) return false
  return typeof resolved !== 'string' || !COMPUTED_BY_CSS.test(resolved)
}

export const generateTokenExamples = (token: Token, resolved: unknown) => {
  const prop = getCategoryProperty(token.extensions?.category)

  const tokenName = token.extensions.prop
  // The spelling `Token` accepts, which is `category.prop` — not `token.name`. The two agree
  // for most tokens and diverge for a negative, whose prop carries the sign on a different
  // segment, and under a `formatTokenName` hook, which rewrites the name and not the prop.
  const fullTokenName = token.extensions.category ? `${token.extensions.category}.${tokenName}` : token.name

  const functionExamples: string[] = [`css({ ${prop}: '${tokenName}' })`]
  const tokenFunctionExamples: string[] = [`token('${fullTokenName}')`]

  // `token()` already hands back the reference, so the second example is the other half of
  // the api — the resolved literal — rather than the `token.var()` alias of the first.
  //
  // Offered only where there is a literal to show. `token.value` is typed to `LiteralToken`,
  // so a virtual, conditional or negative token is a *type error* there — and this ran
  // unconditionally, which had the generated spec recommending the one call the generated
  // `.d.ts` rejects.
  if (hasLiteralValue(resolved)) {
    tokenFunctionExamples.push(`token.value('${fullTokenName}')`)
  }

  return { functionExamples, tokenFunctionExamples }
}
