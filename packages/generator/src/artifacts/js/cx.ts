import type { Context } from '@bamboocss/core'
import outdent from 'outdent'

const dts = outdent`
   type Argument = string | boolean | null | undefined | Argument[]

   /**
    * Join classNames into a single string, with the last conflicting utility winning.
    *
    * \`cx('px_4', 'px_2')\` is \`'px_2'\`: two classes that set the same property under the
    * same conditions cannot both apply, and which one the browser picks would otherwise
    * depend on their order in the stylesheet rather than on the order you passed them.
    * Classes bamboo did not generate are left alone, duplicates included.
    */
   export declare function cx(...args: Argument[]): string
  `

/**
 * The plain concatenating \`cx\`, for when the class names carry nothing to merge on.
 *
 * With \`hash.className\` every class is an opaque hash, so there is no property to compare
 * and no merge to do — emitting the matcher would only cost bytes on a path that runs in
 * the browser on every render.
 */
function concatOnly() {
  return outdent`
  function cx(...args) {
    let str = ''

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (!arg) continue
      // Arrays are part of the declared type, so this branch has to handle them even
      // though it does no merging — returning '' for \`cx(['a', 'b'])\` would be a lie.
      const part = Array.isArray(arg) ? cx(...arg) : typeof arg === 'string' ? arg : ''
      if (!part) continue
      str && (str += ' ')
      str += part
    }
    return str
  }

  export { cx }
`
}

export function generateCx(ctx: Context) {
  const { utility, hash, prefix } = ctx

  // Every class name bamboo generates for a utility. Nothing else may be merged: a recipe
  // class (`button--size-sm`) and a hand-written one (`custom-btn`) both contain the
  // separator under `separator: '-'`, and keying them on the text before it would collapse
  // `button--size-sm` and `button--visual-outline` into one — dropping a variant class the
  // caller asked for.
  //
  // Built from every registered property rather than from `entries()`, which only lists the
  // ones that declare a `className`. `colorPalette` does not, and neither does a user
  // utility that leaves it out — `getClassName` falls back to the hyphenated property, and a
  // name missing here can never merge.
  const separatorChar = utility.separator
  const utilityClassNames = [
    ...new Set(
      utility.keys().map((key) => {
        const withEmptyValue = utility.getClassName(utility.resolveShorthand(key), '')
        return withEmptyValue.endsWith(separatorChar) ? withEmptyValue.slice(0, -separatorChar.length) : withEmptyValue
      }),
    ),
  ].sort()

  // Recipe class names, which a recipe emits both bare and as `<name>--<variant><sep><value>`.
  // A recipe is free to be called `my_btn`, and `my` is a utility — without this the whole
  // recipe class is treated as `marginY` and dropped by any later `my` utility, leaving the
  // component with none of its recipe styles.
  const recipeClassNames = [...new Set(ctx.recipes.details.map((node) => node.className))].filter(Boolean).sort()

  // A hashed class name is an opaque `[a-zA-Z]+` with neither the separator nor a
  // condition path in it, so `mergeKey` would decline every one of them anyway. Emitting
  // the smaller function says so up front. Same when there are no utilities to match.
  if (hash.className || utilityClassNames.length === 0) {
    return { js: concatOnly(), dts }
  }

  // All three are fixed by the config, so they are baked rather than read at runtime.
  const separator = JSON.stringify(utility.separator)
  // `formatClassName` joins the prefix with `-` whatever the separator is, so with
  // `separator: '-'` the first `-` in `bam-px-4` belongs to the prefix, not the value, and
  // the property would come out as `bam-px` — absent from the set, so nothing would merge.
  const classPrefix = prefix.className ? JSON.stringify(prefix.className + '-') : "''"

  return {
    js: outdent`
    const cxSeparator = ${separator}
    const cxPrefix = ${classPrefix}
    const cxUtilities = new Set(${JSON.stringify(utilityClassNames.join(','))}.split(','))
    const cxRecipes = ${recipeClassNames.length ? `new Set(${JSON.stringify(recipeClassNames.join(','))}.split(','))` : 'null'}

    /**
     * The declaration a bamboo class sets: its condition path plus the property, without the
     * value. Two classes sharing one are alternatives, and only the last can apply.
     *
     * \`null\` for anything that is not a bamboo class, which is then never merged.
     */
    function mergeKey(className) {
      let end = className.length

      // \`c_red\` and \`c_red!\` are the same declaration. Argument order decides between them,
      // which is the point of this function — the cascade would always pick the important
      // one no matter which the caller asked for.
      if (end > 0 && className.charCodeAt(end - 1) === 33) end -= 1
      if (end === 0) return null

      // The last colon ends the condition path — but only one outside brackets, since an
      // arbitrary selector carries its own: \`[&[data-x="a:b"]]:px_4\`.
      let depth = 0
      let lastColon = -1
      for (let i = 0; i < end; i++) {
        const code = className.charCodeAt(i)
        if (code === 91) depth++
        else if (code === 93) depth--
        else if (code === 58 && depth === 0) lastColon = i
      }

      // Conditions come before the prefix — \`hover:bam-px_4\` — so the prefix is skipped
      // after the condition path, not before it. When a prefix is configured every class
      // bamboo emits carries it, so one that does not is by definition someone else's.
      let propStart = lastColon + 1
      if (cxPrefix) {
        if (!className.startsWith(cxPrefix, propStart)) return null
        propStart += cxPrefix.length
      }

      // A recipe owns its whole class, bare or with a \`--variant\` suffix, whatever it
      // looks like to the utility matcher below.
      if (cxRecipes !== null) {
        const variantIdx = className.indexOf('--', propStart)
        const base = variantIdx === -1 ? className.slice(propStart, end) : className.slice(propStart, variantIdx)
        if (cxRecipes.has(base)) return null
      }

      // The longest registered utility name wins, not the first separator. Utility names
      // contain the separator themselves under \`separator: '-'\` — \`bd-w\`, \`ov-x\`,
      // \`translate-x\` — and their leading segment is often a utility too, so stopping at the
      // first \`-\` would key \`bd-w-4px\` and \`bd-c-red\` both on \`bd\` and drop one of them.
      let property = null
      let sepIdx = className.indexOf(cxSeparator, propStart)
      while (sepIdx > propStart && sepIdx < end) {
        const candidate = className.slice(propStart, sepIdx)
        if (cxUtilities.has(candidate)) property = candidate
        sepIdx = className.indexOf(cxSeparator, sepIdx + 1)
      }

      // Only a class bamboo generated for a utility. A recipe class or a hand-written one
      // may well contain the separator, and merging on the text before it would drop a
      // class the caller meant to keep.
      if (property === null) return null

      return lastColon === -1 ? property : className.slice(0, lastColon) + ':' + property
    }

    function isClassWhitespace(code) {
      return code === 32 || code === 9 || code === 10 || code === 12 || code === 13
    }

    function flattenParts(parts, out) {
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (!part) continue
        if (Array.isArray(part)) flattenParts(part, out)
        else if (typeof part === 'string') out.push(part)
      }
    }

    function mergeClassStrings(classes) {
      const seen = new Map()
      const order = []
      let id = 0

      for (let c = 0; c < classes.length; c++) {
        const cls = classes[c]
        let tokenStart = 0

        for (let i = 0; i <= cls.length; i++) {
          // The class attribute splits on all ASCII whitespace, not just the space, and a
          // multi-line template literal is an ordinary way to write one.
          if (i !== cls.length && !isClassWhitespace(cls.charCodeAt(i))) continue
          if (i === tokenStart) {
            tokenStart = i + 1
            continue
          }

          const token = cls.slice(tokenStart, i)
          tokenStart = i + 1

          const key = mergeKey(token)
          if (key !== null) {
            // Keeps the first position and the last value, so a later override lands where
            // the class it replaces already sat.
            if (!seen.has(key)) order.push(key)
            seen.set(key, token)
          } else {
            // Not ours to reason about — kept as written, duplicates and all.
            const uniqueKey = '\\0' + id++
            order.push(uniqueKey)
            seen.set(uniqueKey, token)
          }
        }
      }

      if (order.length === 0) return ''
      let str = seen.get(order[0])
      for (let i = 1; i < order.length; i++) str += ' ' + seen.get(order[i])
      return str
    }

    function cx() {
      // Everything that produces a bamboo class string — \`css()\`, a recipe, a nested \`cx\` —
      // emits one that is already conflict-free, so a lone string has nothing to merge and
      // tokenizing it is pure cost. This is the hot path: \`cx(staticClasses, props.className)\`
      // with no \`className\` passed.
      if (arguments.length === 1) {
        const only = arguments[0]
        if (typeof only === 'string') return only
        if (!only) return ''
      }

      const flat = []
      flattenParts(arguments, flat)
      if (flat.length === 0) return ''
      if (flat.length === 1) return flat[0]
      return mergeClassStrings(flat)
    }

    export { cx }
  `,
    dts,
  }
}
