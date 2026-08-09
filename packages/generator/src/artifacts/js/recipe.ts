import type { Context } from '@bamboocss/core'
import { Recipes } from '@bamboocss/core'
import { isBoolean, unionType } from '@bamboocss/shared'
import type { ArtifactFilters } from '@bamboocss/types'
import { outdent } from 'outdent'
import { match } from 'ts-pattern'
import { isBooleanValue } from '../../shared'

const stringify = (value: any) => JSON.stringify(value, null, 2)
const hasOwn = (obj: any | undefined, key: string): obj is Record<string, any> => {
  if (!obj) return false
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export function generateCreateRecipe(ctx: Context) {
  const { conditions, recipes, prefix, hash, utility } = ctx

  if (recipes.isEmpty()) return

  return {
    name: 'create-recipe',
    dts: '',
    js: outdent`
   ${ctx.file.import('finalizeConditions, sortConditions', '../css/conditions')}
   ${ctx.file.import('assertCompoundVariant, getCompoundVariantCss', '../css/cva')}
   ${ctx.file.import('cx', '../css/cx')}
   ${ctx.file.import('compact, createCssUncached, splitProps, toHash, uniq, withoutSpace', '../helpers')}

   /**
    * What \`createCss\` does to a class name: prefix it, and hash it when \`hash.className\`
    * is set.
    *
    * A slot that takes variants gets this for free, because its classes come from
    * \`createCss\`. A *scoped* slot's class never goes through it — it is a constant — so it
    * has to be formatted here or the runtime hands back a raw name while the stylesheet
    * emits the rule under a hashed one, and the slot renders unstyled.
    */
   const withPrefix = ${
     prefix.className
       ? `(className) => className ? ${JSON.stringify(prefix.className)} + '-' + className : ${JSON.stringify(prefix.className)}`
       : `(className) => className`
   }
   export const formatRecipeClass = ${
     hash.className ? `(className) => withPrefix((${utility.toHash})([className], toHash))` : `withPrefix`
   }

   export const createRecipe = (name, defaultVariants, compoundVariants, variantMap) => {
    const getVariantProps = (variants) => {
      return {
        [name]: '__ignore__',
        ...defaultVariants,
        ...compact(variants),
      };
    };

     const recipeFn = (variants) => {
      const transform = (prop, value) => {
        assertCompoundVariant(name, compoundVariants, variants, prop)

         if (value === '__ignore__') {
           return { className: name }
         }

         value = withoutSpace(value)
         return { className: \`\${name}--\${prop}${utility.separator}\${value}\` }
      }

      // Uncached: this runs *inside* \`recipeFn\`, which is itself memoized, so the cache a
      // cached \`createCss\` would build here is constructed fresh per call and used once.
      const recipeCss = createCssUncached({
        ${hash.className ? 'hash: true,' : ''}
        conditions: {
          shift: sortConditions,
          finalize: finalizeConditions,
          breakpoints: { keys: ${JSON.stringify(conditions.breakpoints.keys)} }
        },
        utility: {
          ${prefix.className ? 'prefix: ' + JSON.stringify(prefix.className) + ',' : ''}
          toHash: ${utility.toHash},
          transform,
        }
      })

      // Only what the config declares names a class.
      //
      // Without this the transform named one for *any* prop it was handed — the build emits
      // rules only for declared values, so the element carried a class nothing backed. It also
      // disagreed with \`cva\`, which skips an undeclared value, leaving the two recipe kinds
      // with different class strings for the same call.
      //
      // Filtered here rather than in \`getVariantProps\`, which is public and is what compound
      // variants are matched against.
      const declared = getVariantProps(variants)
      const recipeStyles = variantMap
        ? Object.fromEntries(
            Object.entries(declared).filter(([prop, value]) => {
              if (prop === name) return true
              // A conditional or responsive value is an object of leaves, and the leaves are
              // what name classes: createCss walks them and calls transform per condition.
              // Only a scalar can be judged here.
              if (value === null || typeof value === 'object') return true
              return Object.hasOwn(variantMap, prop) && variantMap[prop].includes(String(value))
            }),
          )
        : declared

      // No class for the compound variants. Their rule selects on the variant classes
      // \`recipeCss\` just named — \`.btn--size_sm.btn--tone_a\` — so it applies on its own,
      // and it is in the same layer as the rest of the recipe rather than atomically in
      // \`utilities\` above it.
      return recipeCss(recipeStyles)
     }

      return {
        recipeFn,
        getVariantProps,
        __getCompoundVariantCss__: (variants) => {
          return getCompoundVariantCss(compoundVariants, getVariantProps(variants));
        },
      }
   }

   export const mergeRecipes = (recipeA, recipeB) => {
    if (recipeA && !recipeB) return recipeA
    if (!recipeA && recipeB) return recipeB

    const recipeFn = (...args) => cx(recipeA(...args), recipeB(...args))
    const variantKeys = uniq(recipeA.variantKeys, recipeB.variantKeys)
    const variantMap = variantKeys.reduce((acc, key) => {
      acc[key] = uniq(recipeA.variantMap[key], recipeB.variantMap[key])
      return acc
    }, {})

    return Object.assign(recipeFn, {
      __recipe__: true,
      __name__: \`$\{recipeA.__name__} \${recipeB.__name__}\`,
      raw: (props) => props,
      variantKeys,
      variantMap,
      splitVariantProps(props) {
        return splitProps(props, variantKeys)
      },
    })
    }
  }
  `,
  }
}

export function generateRecipes(ctx: Context, filters?: ArtifactFilters) {
  const { recipes } = ctx

  if (recipes.isEmpty()) return

  const details = ctx.recipes.filterDetails(filters)

  return details.map((recipe) => {
    const { baseName, config, upperName, variantKeyMap, dashName } = recipe
    const { description, defaultVariants, compoundVariants, deprecated } = config

    const getDefaultValueJsDoc = (key: string) => {
      if (!hasOwn(defaultVariants, key)) return
      let defaultValue = defaultVariants[key]

      if (isBoolean(defaultValue)) {
        defaultValue = defaultValue ? `true` : `false`
      } else {
        defaultValue = JSON.stringify(defaultValue)
      }

      return ctx.file.jsDocComment('', { default: defaultValue })
    }

    const slotNames = Recipes.isSlotRecipeConfig(config) ? config.slots : []
    const anchorSlotNames = Recipes.isSlotRecipeConfig(config) ? Recipes.getScopeRoots(config) : []

    const jsCode = match(config)
      .when(Recipes.isSlotRecipeConfig, (config) => {
        const anchors = Recipes.getScopeRoots(config)

        /**
         * Which slots each variant writes styles for.
         *
         * A scope reaches every slot inside an anchor's subtree. A slot under no anchor at
         * all is not reached, and nothing here can detect that — reachability is a fact
         * about the DOM. This is what says which slots a variant has to get to, so the
         * component layer can thread the ones a scope cannot.
         */
        const slotsAffectedBy = Object.fromEntries(
          Object.entries(config.variants ?? {}).map(([variant, values]) => [
            variant,
            Array.from(new Set(Object.values(values ?? {}).flatMap((slotStyles) => Object.keys(slotStyles ?? {})))),
          ]),
        )

        return outdent`
        ${ctx.file.import('compact, getSlotCompoundVariant, memo, splitProps', '../helpers')}
        ${ctx.file.import('createRecipe, formatRecipeClass', './create-recipe')}

        const ${baseName}DefaultVariants = ${stringify(defaultVariants ?? {})}
        const ${baseName}CompoundVariants = ${stringify(compoundVariants ?? [])}

        // Formatted, not raw. A scoped slot's class is a constant that never passes through
        // \`createCss\`, so \`hash.className\` and \`prefix\` have to be applied here to match
        // the rule the stylesheet emits.
        const ${baseName}SlotNames = ${stringify(config.slots.map((slot) => [slot, `${config.className}__${slot}`]))}.map(
          ([slotName, className]) => [slotName, formatRecipeClass(className)],
        )
        ${
          anchors.length
            ? outdent`
        /**
         * Only the anchors take variants: ${anchors.map((slot) => `\`${baseName}.${slot}\``).join(', ')}.
         * Every other slot's variant styles are emitted as rules scoped by a class an anchor
         * carries, so that slot's class is a constant and nothing has to reach it at runtime.
         */
        const ${baseName}Anchors = ${JSON.stringify(anchors)}
        const ${baseName}AnchorFns = /* @__PURE__ */ ${baseName}Anchors.map((slotName) => [slotName, createRecipe(\`${config.className}__\${slotName}\`, ${baseName}DefaultVariants, getSlotCompoundVariant(${baseName}CompoundVariants, slotName), ${stringify(variantKeyMap)})])
        const ${baseName}StaticSlots = /* @__PURE__ */ Object.fromEntries(
          ${baseName}SlotNames.filter(([slotName]) => !${baseName}Anchors.includes(slotName)),
        )

        const ${baseName}Fn = memo((props = {}) => ({
          ...${baseName}StaticSlots,
          ...Object.fromEntries(${baseName}AnchorFns.map(([slotName, anchorFn]) => [slotName, anchorFn.recipeFn(props)])),
        }))`
            : outdent`
        /**
         * Raw, not the formatted name. \`createRecipe\` routes what it is given through
         * \`createCss\`, which applies \`hash.className\` and \`prefix.className\` itself — so
         * passing the already formatted \`slotKey\` applied both a second time. The runtime
         * asked for \`toHash(toHash(name))\` while the stylesheet emitted \`toHash(name)\`, and
         * every slot on such a recipe rendered unstyled.
         *
         * Invisible only when neither \`hash\` nor \`prefix\` is set, where both applications
         * are identities. A prefixed build was equally broken — \`bam-bam-menu__trigger\`
         * against a stylesheet emitting \`.bam-menu__trigger\` — which is easy to miss, since
         * the obvious reading is that this is a hashing problem.
         */
        const ${baseName}SlotFns = /* @__PURE__ */ ${baseName}SlotNames.map(([slotName]) => [slotName, createRecipe(\`${config.className}__\${slotName}\`, ${baseName}DefaultVariants, getSlotCompoundVariant(${baseName}CompoundVariants, slotName), ${stringify(variantKeyMap)})])

        const ${baseName}Fn = memo((props = {}) => {
          return Object.fromEntries(${baseName}SlotFns.map(([slotName, slotFn]) => [slotName, slotFn.recipeFn(props)]))
        })`
        }

        const ${baseName}VariantKeys = ${stringify(Object.keys(variantKeyMap))}
        const getVariantProps = (variants) => ({ ...${baseName}DefaultVariants, ...compact(variants) })

        export const ${baseName} = /* @__PURE__ */ Object.assign(${baseName}Fn, {
          __recipe__: false,
          __name__: '${baseName}',
          raw: (props) => props,
          /** Each slot's constant class, for targeting a slot in the DOM. */
          classNameMap: /* @__PURE__ */ Object.fromEntries(${baseName}SlotNames),
          /** The slots that enclose other slots, and so anchor their variant rules. */
          scopeRoots: ${JSON.stringify(anchors)},
          variantKeys: ${baseName}VariantKeys,
          variantMap: ${stringify(variantKeyMap)},
          /** Which slots each variant actually reaches, for a slot a scope cannot get to. */
          slotsAffectedBy: ${stringify(slotsAffectedBy)},
          splitVariantProps(props) {
            return splitProps(props, ${baseName}VariantKeys)
          },
          getVariantProps,
          ${
            anchors.length
              ? outdent`
          ...Object.fromEntries(${baseName}AnchorFns.map(([slotName, anchorFn]) => [slotName, anchorFn.recipeFn])),
          ...${baseName}StaticSlots,
          `
              : ''
          }
        })
        `
      })
      .otherwise(
        (config) => outdent`
        ${ctx.file.import('memo, splitProps', '../helpers')}
        ${ctx.file.import('createRecipe, mergeRecipes', './create-recipe')}

        const ${baseName}VariantMap = ${stringify(variantKeyMap)}

        const ${baseName}Fn = /* @__PURE__ */ createRecipe('${config.className}', ${stringify(
          defaultVariants ?? {},
        )}, ${stringify(compoundVariants ?? [])}, ${baseName}VariantMap)

        const ${baseName}VariantKeys = Object.keys(${baseName}VariantMap)

        export const ${baseName} = /* @__PURE__ */ Object.assign(memo(${baseName}Fn.recipeFn), {
          __recipe__: true,
          __name__: '${baseName}',
          __getCompoundVariantCss__: ${baseName}Fn.__getCompoundVariantCss__,
          raw: (props) => props,
          variantKeys: ${baseName}VariantKeys,
          variantMap: ${baseName}VariantMap,
          merge(recipe) {
            return mergeRecipes(this, recipe)
          },
          splitVariantProps(props) {
            return splitProps(props, ${baseName}VariantKeys)
          },
          getVariantProps: ${baseName}Fn.getVariantProps,
        })
        `,
      )

    return {
      name: dashName,

      js: jsCode,

      dts: outdent`
        ${ctx.file.importType('ConditionalValue', '../types/index')}
        ${ctx.file.importType('DistributiveOmit, Pretty', '../types/system-types')}

        interface ${upperName}Variant {
          ${Object.keys(variantKeyMap)
            .map((key) => {
              const values = variantKeyMap[key]
              const valueStr = values.every(isBooleanValue) ? `${key}: boolean` : `${key}: ${unionType(values)}`
              return [getDefaultValueJsDoc(key), valueStr].filter(Boolean).join('\n')
            })
            .join('\n')}
        }

        type ${upperName}VariantMap = {
          [key in keyof ${upperName}Variant]: Array<${upperName}Variant[key]>
        }

        ${Recipes.isSlotRecipeConfig(config) ? `type ${upperName}Slot = ${unionType(config.slots)}` : ''}

        export type ${upperName}VariantProps = {
          [key in keyof ${upperName}Variant]?: ${
            compoundVariants?.length ? `${upperName}Variant[key]` : `ConditionalValue<${upperName}Variant[key]>`
          } | undefined
        }

        export interface ${upperName}Recipe {
          ${Recipes.isSlotRecipeConfig(config) ? `__slot: ${upperName}Slot` : ''}
          __type: ${upperName}VariantProps
          (props?: ${upperName}VariantProps): ${
            Recipes.isSlotRecipeConfig(config) ? `Pretty<Record<${upperName}Slot, string>>` : 'string'
          }
          raw: (props?: ${upperName}VariantProps) => ${upperName}VariantProps
          variantMap: ${upperName}VariantMap
          variantKeys: Array<keyof ${upperName}Variant>
          splitVariantProps<Props extends ${upperName}VariantProps>(props: Props): [${upperName}VariantProps, Pretty<DistributiveOmit<Props, keyof ${upperName}VariantProps>>]
          getVariantProps: (props?: ${upperName}VariantProps) => ${upperName}VariantProps
          ${
            Recipes.isSlotRecipeConfig(config)
              ? outdent`
          /** Which slots each variant writes styles for. */
          slotsAffectedBy: Record<keyof ${upperName}Variant, ${upperName}Slot[]>`
              : ''
          }
          ${
            anchorSlotNames.length
              ? outdent`
          /** The slots that take variants — every other one is scoped by a class an anchor carries. */
          ${anchorSlotNames.map((slot) => `${slot}: (props?: ${upperName}VariantProps) => string`).join('\n')}
          ${slotNames
            .filter((slot) => !anchorSlotNames.includes(slot))
            .map((slot) => `${slot}: string`)
            .join('\n')}`
              : ''
          }
        }

        ${ctx.file.jsDocComment(description, { deprecated })}
        export declare const ${baseName}: ${upperName}Recipe
        `,
    }
  })
}
