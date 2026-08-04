import { stack, hstack } from 'styled-system/patterns'

export const column = "d_flex flex-d_column ai_center gap_4"
export const row = "d_flex ai_center gap_2 flex-d_row"

export function spaced(gap: string) {
  return stack({ gap })
}
