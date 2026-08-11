import type { Context } from '@bamboocss/core'
import type { MixinSpec } from '@bamboocss/types'
import { generateMixinsSpec as generate } from '../shared'

export const generateMixinsSpec = (ctx: Context): MixinSpec => {
  return generate(ctx.config.theme)
}
