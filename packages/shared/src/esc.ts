/* eslint-disable no-control-regex */
const rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|^-|[^\x80-\uFFFF\w-]/g
/**
 * Escape one match, following `CSS.escape` and the `jQuery.escapeSelector` it came from.
 *
 * The trailing space on the code-point branch is a terminator, not formatting. A CSS escape
 * consumes up to *six* hex digits, so without it the characters after the escape are read as
 * part of it whenever they are hex digits themselves:
 *
 *     "640:p_4"  ->  "\3640\:p_4"   U+3640 followed by ":p_4"
 *     "3d:p_4"   ->  "\33d\:p_4"    U+033D followed by ":p_4"
 *
 * The class attribute still says `640:p_4`, so the selector matches nothing and the element
 * renders unstyled — with no error anywhere, and invisible to any test that escapes both
 * sides through this same function.
 *
 * Stock breakpoints escape their leading digit too, and were unaffected only by luck:
 * `2xl:bg_red` becomes `\32xl\:bg_red`, and `x` is not a hex digit, so the escape ends where
 * it should. Naming a breakpoint or condition numerically (`640`, `12`), or as a digit
 * followed by `a`-`f` (`3d`), is all it takes to lose the rule.
 *
 * The parser consumes the space as part of the escape, so it never reads as a descendant
 * combinator, and escapes that already worked keep their meaning: `\30\.5` becomes
 * `\30 \.5`, and both are `0.5`.
 */
const fcssescape = function (ch: string, asCodePoint: string) {
  if (!asCodePoint) return '\\' + ch
  if (ch === '\0') return '\uFFFD'
  if (ch === '-' && ch.length === 1) return '\\-'
  return ch.slice(0, -1) + '\\' + ch.charCodeAt(ch.length - 1).toString(16) + ' '
}
export const esc = (sel: string) => {
  return (sel + '').replace(rcssescape, fcssescape)
}
