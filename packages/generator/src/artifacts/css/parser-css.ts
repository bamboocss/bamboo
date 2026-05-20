import type { StyleDecoder } from '@bamboocss/core'
import { logger } from '@bamboocss/logger'
import type { Context } from '@bamboocss/core'

export const generateParserCss = (ctx: Context, decoder: StyleDecoder) => {
  if (!decoder) return ''

  const sheet = ctx.createSheet()
  const { minify } = ctx.config

  sheet.processDecoder(decoder)

  try {
    const css = sheet.toCss({ minify })
    return css
  } catch (error) {
    logger.caughtError('serializer:css', 'Failed to serialize CSS', error)
    return ''
  }
}
