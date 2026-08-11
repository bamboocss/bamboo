import { flex, center } from 'styled-system/patterns'

export const column = "d_flex ai_center gap_4"
export const row = "d_flex ai_center jc_center gap_2"

export function spaced(gap: string) {
  return flex({ gap })
}
