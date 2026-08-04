import { css, cx, cssLeaf } from 'styled-system/css'

export const fixed = "d_flex"

export function tinted(tone: string) {
  return cx("p_2", cssLeaf("c_", "color", tone))
}

export function merged(extra: Record<string, unknown>) {
  return css({ display: 'block' }, extra)
}
