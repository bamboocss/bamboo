import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'

export function generateCvaFn(ctx: Context) {
  const { utility, hash, prefix } = ctx

  const withPrefix = prefix.className
    ? `(className) => className ? ${JSON.stringify(prefix.className)} + '-' + className : ${JSON.stringify(prefix.className)}`
    : `(className) => className`

  return {
    js: outdent`
    ${ctx.file.import('cloneStyles, compact, getRecipeClassNames, getRecipeIdentity, mergeProps, memo, splitProps, toHash, uniq', '../helpers')}
    ${ctx.file.import('mergeCss', './css')}
    ${ctx.file.import('cx', './cx')}

    // What \`createCss\` does to a class name, for the recipe path: prefix it, and hash it
    // when \`hash.className\` is set. The build applies the same two steps to the rules it
    // emits — see \`checkNamingAgreement\`, which compares the results.
    const withPrefix = ${withPrefix}
    export const formatRecipeClass = ${
      hash.className ? `(className) => withPrefix((${utility.toHash})([className], toHash))` : `withPrefix`
    }

    const defaults = (conf) => ({
      base: {},
      variants: {},
      defaultVariants: {},
      compoundVariants: [],
      ...conf,
    })

    export function cva(config) {
      const { base, variants, defaultVariants, compoundVariants } = defaults(config)
      const getVariantProps = (variants) => ({ ...defaultVariants, ...compact(variants) })

      // Derived from the config, because the build derives it from the same config while
      // emitting the stylesheet and the two never meet. \`className\` when the author set
      // one, a hash of the styles otherwise.
      const name = getRecipeIdentity(config)

      function resolve(props = {}) {
        const computedVariants = getVariantProps(props)
        let variantCss = { ...base }
        for (const [key, value] of Object.entries(computedVariants)) {
          if (variants[key]?.[value]) {
            variantCss = mergeCss(variantCss, variants[key][value])
          }
        }
        // A recipe with no compound variants has nothing left to merge, and the merge is
        // not free just because its second operand is empty: \`mergeCss\` is memoized on its
        // arguments, so the call hashes the whole accumulated style object before finding
        // there is nothing to do. Most recipes declare no compound variants at all, so
        // this is the common shape rather than a special case.
        if (compoundVariants.length === 0) return variantCss

        const compoundVariantCss = getCompoundVariantCss(compoundVariants, computedVariants)
        return mergeCss(variantCss, compoundVariantCss)
      }

      // \`raw\` runs per element per render — the JSX factory calls it to build the styles it
      // merges with style props — and \`resolve\` is not cheap: a \`mergeCss\` per active variant
      // plus a scan of every compound variant. Memoizing it keys that work on the variant
      // props rather than repeating it for every element that shares them.
      //
      // \`raw\` still clones what it returns. The memoized object is shared, so handing it to a
      // caller that mutated it would poison every later call.
      //
      // A recipe whose variants are all boolean could index an array instead of hashing, and
      // that was built and measured: +25% to +35% on \`raw()\`. It is not here because the
      // trade is bad. Correctness needs the selection read from own enumerable keys only, and
      // every variant to carry a boolean default so the merge order is pinned — and once that
      // gate is honest, no \`cva\`/\`sva\` call site in this repo passes it, because real recipes
      // mix a string variant in. The cost is unconditional: +289 B gzipped on that module for
      // every consumer, qualifying or not.
      const resolveVariants = memo(resolve)

      // The class names the build emitted rules for: the recipe's own class, plus one per
      // selected variant. Not \`css(resolve(props))\` — that would name classes by property,
      // and the stylesheet names this recipe's rules semantically, in the \`recipes\` layer.
      //
      // Compound variants are absent on purpose. Their rule selects on the variant classes
      // already in this list — \`.btn--size_sm.btn--tone_a\` — so it applies without anything
      // being added here, and adding a class for it would name a rule that does not exist.
      function cvaFn(props) {
        return getRecipeClassNames(name, variants, getVariantProps(props), '${utility.separator}', formatRecipeClass)
      }

      const variantKeys = Object.keys(variants)

      function splitVariantProps(props) {
        return splitProps(props, variantKeys)
      }

      const variantMap = Object.fromEntries(Object.entries(variants).map(([key, value]) => [key, Object.keys(value)]))

      const self = Object.assign(memo(cvaFn), {
        __cva__: true,
        variantMap,
        variantKeys,
        raw: (...args) => cloneStyles(resolveVariants(...args)),
        config,
        // Composed against \`self\`, not against this closure, so \`a.merge(b).merge(c)\`
        // composes the *result* with \`c\` rather than recomposing \`a\` with \`c\` and
        // dropping \`b\`.
        merge: (other) => composeRecipes(self, other),
        splitVariantProps,
        getVariantProps
      })

      return self
    }

    /**
     * Compose two recipes into one.
     *
     * The class names come from both parents joined, not from a merged config. A recipe's
     * classes are named from the config the *build* saw, and the build only ever sees the
     * literal \`cva(...)\` call sites — a config synthesised here at runtime has no rules
     * behind it, so naming classes off it returned classes that styled nothing. This is the
     * shape \`mergeRecipes\` already uses for config recipes.
     *
     * The selection is resolved once and handed to both parents. Passing the raw props
     * instead let each parent apply *its own* defaults, so \`m()\` and
     * \`m(m.getVariantProps())\` disagreed and \`raw()\` contradicted the \`config\` the same
     * object publishes.
     *
     * \`raw\` still deep-merges, so per-property override survives where it can be expressed:
     * \`css(a.merge(b).raw(props))\` resolves before any class name exists. Through the class
     * path both parents land in the \`recipes\` layer, so a collision there is decided by
     * stylesheet order rather than by which parent came second.
     */
    function composeRecipes(left, right) {
      const leftConfig = defaults(left.config)
      const rightConfig = defaults(right.config)
      const variantKeys = uniq(left.variantKeys, right.variantKeys)

      const config = {
        base: mergeCss(leftConfig.base, rightConfig.base),
        variants: Object.fromEntries(
          variantKeys.map((key) => [key, mergeCss(leftConfig.variants[key], rightConfig.variants[key])]),
        ),
        defaultVariants: mergeProps(leftConfig.defaultVariants, rightConfig.defaultVariants),
        compoundVariants: [...leftConfig.compoundVariants, ...rightConfig.compoundVariants],
      }

      const select = (props) => ({ ...config.defaultVariants, ...compact(props) })

      const composed = Object.assign(
        memo((props) => {
          const selection = select(props)
          return cx(left(selection), right(selection))
        }),
        {
          __cva__: true,
          variantMap: Object.fromEntries(variantKeys.map((key) => [key, Object.keys(config.variants[key] ?? {})])),
          variantKeys,
          raw: (props) => {
            const selection = select(props)
            return cloneStyles(mergeCss(left.raw(selection), right.raw(selection)))
          },
          config,
          merge: (other) => composeRecipes(composed, other),
          splitVariantProps: (props) => splitProps(props, variantKeys),
          getVariantProps: select,
        },
      )

      return composed
    }

    export function getCompoundVariantCss(compoundVariants, variantMap) {
      let result = {}
      compoundVariants.forEach((compoundVariant) => {
        const isMatching = Object.entries(compoundVariant).every(([key, value]) => {
          if (key === 'css') return true

          const values = Array.isArray(value) ? value : [value]
          return values.some((value) => variantMap[key] === value)
        })

        if (isMatching) {
          result = mergeCss(result, compoundVariant.css)
        }
      })

      return result
    }

    export function assertCompoundVariant(name, compoundVariants, variants, prop) {
      if (compoundVariants.length > 0 && typeof variants?.[prop] === 'object') {
        throw new Error(\`[recipe:\${name}:\${prop}] Conditions are not supported when using compound variants.\`)
      }
    }

    `,
    dts: outdent`
    ${ctx.file.importType('RecipeCreatorFn', '../types/recipe')}

    export declare const cva: RecipeCreatorFn

    ${ctx.file.exportType('RecipeVariant, RecipeVariantProps', '../types/recipe')}
    `,
  }
}
