import type { Context, Stylesheet } from '@bamboocss/core'

export const generateGlobalCss = (ctx: Context, sheet: Stylesheet) => {
  const { globalCss = {} } = ctx.config

  sheet.processGlobalCss({
    ':root': { '--made-with-bamboo': `'🎋'` },
  })

  sheet.processGlobalCss(globalCss)
}
