import type { Context } from '@bamboocss/core'
import type { AnimationStyleSpec } from '@bamboocss/types'
import { generateCompositionStyleSpec } from '../shared'

export const generateAnimationStylesSpec = (ctx: Context): AnimationStyleSpec => {
  return generateCompositionStyleSpec('animation-styles', ctx.config.theme, ctx.config.jsxStyleProps)
}
