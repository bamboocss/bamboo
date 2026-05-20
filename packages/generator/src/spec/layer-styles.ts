import type { Context } from '@bamboocss/core'
import type { LayerStyleSpec } from '@bamboocss/types'
import { generateCompositionStyleSpec } from '../shared'

export const generateLayerStylesSpec = (ctx: Context): LayerStyleSpec => {
  return generateCompositionStyleSpec('layer-styles', ctx.config.theme, ctx.config.jsxStyleProps) as LayerStyleSpec
}
