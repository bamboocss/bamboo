import type { Context } from '@bamboocss/core'
import outdent from 'outdent'

/**
 * `cx` joins class names. It does not resolve conflicts between them, in any build.
 *
 * It used to, when the class names happened to carry a property to compare — atomic mode
 * with `hash.className` off. That made it a correctness tool in development and a plain
 * join in a hashed production build, from the same source, with no error either way. An
 * override that worked locally silently stopped working when it shipped.
 *
 * The two could not be reconciled by teaching the matcher to read hashed names: under
 * `hash: true` a class is an opaque digest with no property to compare.
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

   /**
    * Pick a recipe variant's class for a value only known at runtime.
    *
    * Emitted by the build when it folds an inline recipe call whose selection it could not
    * fully resolve — \`badge({ tone })\` becomes \`"badge" + cvaPick(tone, { … }, " badge--tone_a")\`.
    * Written by the transform, not by hand.
    *
    * The three cases are the ones \`cva\` itself distinguishes: \`undefined\` means the property
    * was never passed, so the recipe's default applies; a value the config declares selects
    * its class; anything else — including \`null\`, which \`compact\` deliberately keeps — selects
    * nothing, exactly as \`getRecipeClassNames\` skips a value it cannot find.
    */
   export declare function cvaPick(
     value: unknown,
     classNameByValue: Record<string, string>,
     fallback?: string,
   ): string

   /**
    * Select a complete build-precompiled recipe StyleSet from a reduced decision table.
    * Written by the source transform, not by hand.
    */
   export declare function cvaMap(
     values: unknown[],
     nodes: Array<[unknown, unknown, unknown[]]>,
     leaves: unknown[],
     root: number,
   ): unknown

   /**
    * Split a props object into the listed keys and everything else.
    *
    * Re-exported here so the build has one module to reach for when it lowers a recipe: this
    * is what \`recipe.splitVariantProps\` calls, so a lowered call is the same function reached
    * directly rather than through the recipe object — which is what lets the recipe's config
    * leave the bundle.
    */
   export declare function splitProps<T extends Record<string, unknown>, K extends Array<keyof T>>(
     props: T,
     ...keys: K
   ): [Record<string, unknown>, Record<string, unknown>]
  `

export function generateCx(ctx: Context) {
  return {
    js: outdent`
  ${ctx.file.import('splitProps', '../helpers')}

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

  // \`hasOwn\`, not a plain lookup: the table is an object literal, so \`cvaPick(v, t)\` with
  // \`v\` of "toString" or "constructor" would otherwise find the prototype's method and
  // concatenate a function into the class attribute. See the declaration for the cases.
  const cvaPick = (value, classNameByValue, fallback = '') => {
    if (value === undefined) return fallback
    // \`null\` before the lookup, because \`getRecipeClassNames\` rejects it on \`value == null\`
    // and a config may genuinely declare a variant value spelled "null".
    if (value === null) return ''
    return Object.hasOwn(classNameByValue, value) ? classNameByValue[value] : ''
  }

  // Each node is [miss, undefined, [key, child, key, child, ...]]. Children are either
  // another non-negative node index or a negative leaf reference. Arrays avoid object-literal
  // \`__proto__\` semantics, while string coercion matches a recipe's property lookup.
  const cvaMap = (values, nodes, leaves, root) => {
    let current = root
    for (let i = 0; i < values.length && current >= 0; i++) {
      const node = nodes[current]
      if (!node) return ''

      const value = values[i]
      if (value === undefined) {
        current = node[1]
        continue
      }
      if (value === null) {
        current = node[0]
        continue
      }

      const key = String(value)
      const entries = node[2]
      let next = node[0]
      for (let j = 0; j < entries.length; j += 2) {
        if (entries[j] !== key) continue
        next = entries[j + 1]
        break
      }
      current = next
    }
    return current < 0 ? (leaves[~current] ?? '') : ''
  }

  export { cx, cvaMap, cvaPick, splitProps }
`,
    dts: declaration,
  }
}
