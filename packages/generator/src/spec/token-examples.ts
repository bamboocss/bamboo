import type { Token } from '@bamboocss/token-dictionary'

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

export const generateTokenExamples = (token: Token) => {
  const prop = getCategoryProperty(token.extensions?.category)

  const tokenName = token.extensions.prop
  const fullTokenName = token.name

  const functionExamples: string[] = [`css({ ${prop}: '${tokenName}' })`]
  const tokenFunctionExamples: string[] = [`token('${fullTokenName}')`]

  // `token()` already hands back the reference, so the second example is the other half of
  // the api — the resolved literal — rather than the `token.var()` alias of the first.
  //
  // Unconditional, unlike the `varRef` guard this replaced. That guard offered `token.var()`
  // only for a token that had a variable to reference, which was the right question for the
  // alias and says nothing about `.value`: every token answers it, and one without a `varRef`
  // would still have a literal worth showing.
  tokenFunctionExamples.push(`token.value('${fullTokenName}')`)

  return { functionExamples, tokenFunctionExamples }
}
