import outdent from 'outdent'

/**
 * `cx` joins class names. It does not resolve conflicts between them, in any build.
 *
 * It used to, when the class names happened to carry a property to compare — atomic mode
 * with `hash.className` off. That made it a correctness tool in development and a plain
 * join in a hashed production build, from the same source, with no error either way. An
 * override that worked locally silently stopped working when it shipped.
 *
 * The two could not be reconciled by teaching the matcher to read hashed names.
 * `cssMode: 'grouped'` names a *whole call* with one class — `toHash(['grouped', groupId])`
 * — so there is no single property behind it to compare, whatever the naming scheme. As
 * long as grouped exists, some builds can never merge, and a `cx` that merges in the rest
 * is a behavioural difference keyed on a config flag.
 *
 * So precedence is decided where it can be decided the same way everywhere: by
 * {@link https://bamboocss.com/docs/concepts/cascade-layers cascade layers}. A component
 * whose styles a consumer will override belongs in `recipes` — write it with `cva`/`sva`,
 * not bare `css()` — and the consumer's `css()` in `utilities` wins by layer, in every
 * build. Two `css()` outputs joined with `cx` are in the same layer and resolve by source
 * order; when you own both, merge the style objects with `css(a, b)` instead.
 */
const declaration = outdent`
   type Argument = string | boolean | null | undefined | Argument[]

   /**
    * Join classNames into a single string.
    *
    * This does **not** resolve conflicts between them: \`cx('px_4', 'px_2')\` keeps both, and
    * the browser picks by their order in the stylesheet rather than by the order you passed
    * them. That is true of every build — atomic, hashed and grouped alike.
    *
    * To override a style rather than append to it, let the cascade decide: styles from
    * \`cva\`/\`sva\` sit in the \`recipes\` layer and \`css()\` in \`utilities\`, so a consumer's
    * \`css()\` always wins. Between two \`css()\` calls you own, merge the objects instead —
    * \`css(base, override)\` resolves per property before any class name exists.
    */
   export declare function cx(...args: Argument[]): string
  `

export function generateCx() {
  return {
    js: outdent`
  function cx(...args) {
    let str = ''

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (!arg) continue
      // Arrays are part of the declared type, so this branch has to handle them.
      // Returning '' for \`cx(['a', 'b'])\` would be a lie.
      const part = Array.isArray(arg) ? cx(...arg) : typeof arg === 'string' ? arg : ''
      if (!part) continue
      str && (str += ' ')
      str += part
    }
    return str
  }

  export { cx }
`,
    dts: declaration,
  }
}
