import type { Context } from '@bamboocss/core'
import type { KeyframeSpec } from '@bamboocss/types'

export const generateKeyframesSpec = (ctx: Context): KeyframeSpec => {
  const keyframes = Object.keys(ctx.config.theme?.keyframes ?? {}).map((name) => ({
    name,
    functionExamples: [`css({ animationName: '${name}' })`, `css({ animation: '${name} 1s ease-in-out infinite' })`],
  }))

  return {
    type: 'keyframes',
    data: keyframes,
  }
}
