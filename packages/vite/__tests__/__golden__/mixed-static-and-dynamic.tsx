import { css } from 'styled-system/css'

export const fixed = "d_flex"

export function tinted(tone: string) {
  return css({ color: tone, padding: '2' })
}

export function merged(extra: Record<string, unknown>) {
  return css({ display: 'block' }, extra)
}
