import type { Context } from '@bamboocss/core'
import type { TextStyleSpec } from '@bamboocss/types'
import { generateCompositionStyleSpec } from '../shared'

export const generateTextStylesSpec = (ctx: Context): TextStyleSpec => {
  return generateCompositionStyleSpec('text-styles', ctx.config.theme, ctx.config.jsxStyleProps) as TextStyleSpec
}
