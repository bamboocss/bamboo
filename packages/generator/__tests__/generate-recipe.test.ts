import type { LoadConfigResult } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { Generator } from '../src'
import { generateCreateRecipe, generateRecipes } from '../src/artifacts/js/recipe'
import { fixtureDefaults } from '@bamboocss/fixture'

const createRecipeJs = (config: LoadConfigResult) => {
  const generator = new Generator(config)
  return generateCreateRecipe(generator)
}

const recipeJs = (config: LoadConfigResult) => {
  const generator = new Generator(config)
  return generateRecipes(generator)
}

describe('generate recipes', () => {
  test('should ', () => {
    expect(createRecipeJs(fixtureDefaults)).toMatchInlineSnapshot(`
      {
        "dts": "",
        "js": "import { finalizeConditions, sortConditions } from '../css/conditions.mjs';
      import { assertCompoundVariant, getCompoundVariantCss } from '../css/cva.mjs';
      import { cx } from '../css/cx.mjs';
      import { compact, createCssUncached, getRecipeClassNames, splitProps, toHash, uniq, withoutSpace } from '../helpers.mjs';

      /**
       * What \`createCss\` does to a class name: prefix it, and hash it when \`hash.className\`
       * is set.
       *
       * A slot that takes variants gets this for free, because its classes come from
       * \`createCss\`. A *scoped* slot's class never goes through it — it is a constant — so it
       * has to be formatted here or the runtime hands back a raw name while the stylesheet
       * emits the rule under a hashed one, and the slot renders unstyled.
       */
      const withPrefix = (className) => className
      export const formatRecipeClass = withPrefix

      export const createRecipe = (name, defaultVariants, compoundVariants, variantMap) => {
       /**
        * \`variantMap\` as \`getRecipeClassNames\` wants it — value *keys* rather than a list.
        *
        * Built once per recipe at module init. The lookup needs \`Object.hasOwn\`, and an array
        * answers that for its indices rather than its contents, so a list cannot be passed
        * straight through.
        */
       const variantValues = variantMap
         ? Object.fromEntries(
             Object.entries(variantMap).map(([variant, values]) => [
               variant,
               Object.fromEntries(values.map((value) => [value, true])),
             ]),
           )
         : undefined

       /**
        * Whether every selected value is a plain scalar, and so nameable without \`createCss\`.
        *
        * \`typeof value === 'object'\` covers a conditional value like \`{ base: 'sm', md: 'lg' }\`,
        * whose classes carry condition prefixes only \`createCss\` can build. It also catches
        * \`null\`, which \`compact\` keeps — that goes to the path below and comes out as it did
        * before, since \`createCss\` names no class for a null value either.
        */
       const isScalarSelection = (declared) => {
         for (const key in declared) {
           if (typeof declared[key] === 'object') return false
         }
         return true
       }

       const getVariantProps = (variants) => {
         return {
           [name]: '__ignore__',
           ...defaultVariants,
           ...compact(variants),
         };
       };

        const recipeFn = (variants) => {
         const declaredProps = getVariantProps(variants)

         // A scalar selection names its classes by lookup: the recipe's own class plus one per
         // selected variant, which is all \`createCss\` was deriving here. Measured at 4.1x the
         // \`createCss\` path on a three-variant recipe. The gain is on a \`memo\` miss — the first
         // call for each variant combination — since a hit never reaches this at all.
         //
         // Compound variants stay absent, as they are on the path below: their rule selects on the
         // variant classes already named, so it applies without one of its own.
         if (variantValues && isScalarSelection(declaredProps)) {
           return getRecipeClassNames(name, variantValues, declaredProps, '_', formatRecipeClass)
         }

         const transform = (prop, value) => {
           assertCompoundVariant(name, compoundVariants, variants, prop)

            if (value === '__ignore__') {
              return { className: name }
            }

            value = withoutSpace(value)
            return { className: \`\${name}--\${prop}_\${value}\` }
         }

         // Uncached: this runs *inside* \`recipeFn\`, which is itself memoized, so the cache a
         // cached \`createCss\` would build here is constructed fresh per call and used once.
         const recipeCss = createCssUncached({
           
           conditions: {
             shift: sortConditions,
             finalize: finalizeConditions,
             breakpoints: { keys: ["base","sm","md","lg","xl","2xl"] }
           },
           utility: {
             
             toHash: (path, hashFn) => hashFn(path.join(":")),
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
         const declared = declaredProps
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
         __name__: \`\${recipeA.__name__} \${recipeB.__name__}\`,
         raw: (props) => props,
         variantKeys,
         variantMap,
         splitVariantProps(props) {
           return splitProps(props, variantKeys)
         },
       })
       }
      ",
        "name": "create-recipe",
      }
    `)

    expect(recipeJs(fixtureDefaults)).toMatchInlineSnapshot(`
      [
        {
          "dts": "import type { ConditionalValue } from '../types/index';
      import type { DistributiveOmit, Pretty } from '../types/system-types';

      interface TextStyleVariant {
        size: "h1" | "h2"
      }

      type TextStyleVariantMap = {
        [key in keyof TextStyleVariant]: Array<TextStyleVariant[key]>
      }



      export type TextStyleVariantProps = {
        [key in keyof TextStyleVariant]?: ConditionalValue<TextStyleVariant[key]> | undefined
      }

      export interface TextStyleRecipe {
        
        __type: TextStyleVariantProps
        (props?: TextStyleVariantProps): string
        raw: (props?: TextStyleVariantProps) => TextStyleVariantProps
        variantMap: TextStyleVariantMap
        variantKeys: Array<keyof TextStyleVariant>
        splitVariantProps<Props extends TextStyleVariantProps>(props: Props): [TextStyleVariantProps, Pretty<DistributiveOmit<Props, keyof TextStyleVariantProps>>]
        getVariantProps: (props?: TextStyleVariantProps) => TextStyleVariantProps
        
        
      }


      export declare const textStyle: TextStyleRecipe",
          "js": "import { memo, splitProps } from '../helpers.mjs';
      import { createRecipe, mergeRecipes } from './create-recipe.mjs';

      const textStyleVariantMap = {
        "size": [
          "h1",
          "h2"
        ]
      }

      const textStyleFn = /* @__PURE__ */ createRecipe('textStyle', {}, [], textStyleVariantMap)

      const textStyleVariantKeys = Object.keys(textStyleVariantMap)

      export const textStyle = /* @__PURE__ */ Object.assign(memo(textStyleFn.recipeFn), {
        __recipe__: true,
        __name__: 'textStyle',
        __getCompoundVariantCss__: textStyleFn.__getCompoundVariantCss__,
        raw: (props) => props,
        variantKeys: textStyleVariantKeys,
        variantMap: textStyleVariantMap,
        merge(recipe) {
          return mergeRecipes(this, recipe)
        },
        splitVariantProps(props) {
          return splitProps(props, textStyleVariantKeys)
        },
        getVariantProps: textStyleFn.getVariantProps,
      })",
          "name": "text-style",
        },
        {
          "dts": "import type { ConditionalValue } from '../types/index';
      import type { DistributiveOmit, Pretty } from '../types/system-types';

      interface TooltipStyleVariant {
        
      }

      type TooltipStyleVariantMap = {
        [key in keyof TooltipStyleVariant]: Array<TooltipStyleVariant[key]>
      }



      export type TooltipStyleVariantProps = {
        [key in keyof TooltipStyleVariant]?: ConditionalValue<TooltipStyleVariant[key]> | undefined
      }

      export interface TooltipStyleRecipe {
        
        __type: TooltipStyleVariantProps
        (props?: TooltipStyleVariantProps): string
        raw: (props?: TooltipStyleVariantProps) => TooltipStyleVariantProps
        variantMap: TooltipStyleVariantMap
        variantKeys: Array<keyof TooltipStyleVariant>
        splitVariantProps<Props extends TooltipStyleVariantProps>(props: Props): [TooltipStyleVariantProps, Pretty<DistributiveOmit<Props, keyof TooltipStyleVariantProps>>]
        getVariantProps: (props?: TooltipStyleVariantProps) => TooltipStyleVariantProps
        
        
      }


      export declare const tooltipStyle: TooltipStyleRecipe",
          "js": "import { memo, splitProps } from '../helpers.mjs';
      import { createRecipe, mergeRecipes } from './create-recipe.mjs';

      const tooltipStyleVariantMap = {}

      const tooltipStyleFn = /* @__PURE__ */ createRecipe('tooltipStyle', {}, [], tooltipStyleVariantMap)

      const tooltipStyleVariantKeys = Object.keys(tooltipStyleVariantMap)

      export const tooltipStyle = /* @__PURE__ */ Object.assign(memo(tooltipStyleFn.recipeFn), {
        __recipe__: true,
        __name__: 'tooltipStyle',
        __getCompoundVariantCss__: tooltipStyleFn.__getCompoundVariantCss__,
        raw: (props) => props,
        variantKeys: tooltipStyleVariantKeys,
        variantMap: tooltipStyleVariantMap,
        merge(recipe) {
          return mergeRecipes(this, recipe)
        },
        splitVariantProps(props) {
          return splitProps(props, tooltipStyleVariantKeys)
        },
        getVariantProps: tooltipStyleFn.getVariantProps,
      })",
          "name": "tooltip-style",
        },
        {
          "dts": "import type { ConditionalValue } from '../types/index';
      import type { DistributiveOmit, Pretty } from '../types/system-types';

      interface CardStyleVariant {
        rounded: boolean
      }

      type CardStyleVariantMap = {
        [key in keyof CardStyleVariant]: Array<CardStyleVariant[key]>
      }



      export type CardStyleVariantProps = {
        [key in keyof CardStyleVariant]?: ConditionalValue<CardStyleVariant[key]> | undefined
      }

      export interface CardStyleRecipe {
        
        __type: CardStyleVariantProps
        (props?: CardStyleVariantProps): string
        raw: (props?: CardStyleVariantProps) => CardStyleVariantProps
        variantMap: CardStyleVariantMap
        variantKeys: Array<keyof CardStyleVariant>
        splitVariantProps<Props extends CardStyleVariantProps>(props: Props): [CardStyleVariantProps, Pretty<DistributiveOmit<Props, keyof CardStyleVariantProps>>]
        getVariantProps: (props?: CardStyleVariantProps) => CardStyleVariantProps
        
        
      }


      export declare const cardStyle: CardStyleRecipe",
          "js": "import { memo, splitProps } from '../helpers.mjs';
      import { createRecipe, mergeRecipes } from './create-recipe.mjs';

      const cardStyleVariantMap = {
        "rounded": [
          "true"
        ]
      }

      const cardStyleFn = /* @__PURE__ */ createRecipe('card', {}, [], cardStyleVariantMap)

      const cardStyleVariantKeys = Object.keys(cardStyleVariantMap)

      export const cardStyle = /* @__PURE__ */ Object.assign(memo(cardStyleFn.recipeFn), {
        __recipe__: true,
        __name__: 'cardStyle',
        __getCompoundVariantCss__: cardStyleFn.__getCompoundVariantCss__,
        raw: (props) => props,
        variantKeys: cardStyleVariantKeys,
        variantMap: cardStyleVariantMap,
        merge(recipe) {
          return mergeRecipes(this, recipe)
        },
        splitVariantProps(props) {
          return splitProps(props, cardStyleVariantKeys)
        },
        getVariantProps: cardStyleFn.getVariantProps,
      })",
          "name": "card-style",
        },
        {
          "dts": "import type { ConditionalValue } from '../types/index';
      import type { DistributiveOmit, Pretty } from '../types/system-types';

      interface ButtonStyleVariant {
        /**
       * @default "md"
       */
      size: "sm" | "md"
      /**
       * @default "solid"
       */
      variant: "solid" | "outline"
      }

      type ButtonStyleVariantMap = {
        [key in keyof ButtonStyleVariant]: Array<ButtonStyleVariant[key]>
      }



      export type ButtonStyleVariantProps = {
        [key in keyof ButtonStyleVariant]?: ConditionalValue<ButtonStyleVariant[key]> | undefined
      }

      export interface ButtonStyleRecipe {
        
        __type: ButtonStyleVariantProps
        (props?: ButtonStyleVariantProps): string
        raw: (props?: ButtonStyleVariantProps) => ButtonStyleVariantProps
        variantMap: ButtonStyleVariantMap
        variantKeys: Array<keyof ButtonStyleVariant>
        splitVariantProps<Props extends ButtonStyleVariantProps>(props: Props): [ButtonStyleVariantProps, Pretty<DistributiveOmit<Props, keyof ButtonStyleVariantProps>>]
        getVariantProps: (props?: ButtonStyleVariantProps) => ButtonStyleVariantProps
        
        
      }


      export declare const buttonStyle: ButtonStyleRecipe",
          "js": "import { memo, splitProps } from '../helpers.mjs';
      import { createRecipe, mergeRecipes } from './create-recipe.mjs';

      const buttonStyleVariantMap = {
        "size": [
          "sm",
          "md"
        ],
        "variant": [
          "solid",
          "outline"
        ]
      }

      const buttonStyleFn = /* @__PURE__ */ createRecipe('buttonStyle', {
        "size": "md",
        "variant": "solid"
      }, [], buttonStyleVariantMap)

      const buttonStyleVariantKeys = Object.keys(buttonStyleVariantMap)

      export const buttonStyle = /* @__PURE__ */ Object.assign(memo(buttonStyleFn.recipeFn), {
        __recipe__: true,
        __name__: 'buttonStyle',
        __getCompoundVariantCss__: buttonStyleFn.__getCompoundVariantCss__,
        raw: (props) => props,
        variantKeys: buttonStyleVariantKeys,
        variantMap: buttonStyleVariantMap,
        merge(recipe) {
          return mergeRecipes(this, recipe)
        },
        splitVariantProps(props) {
          return splitProps(props, buttonStyleVariantKeys)
        },
        getVariantProps: buttonStyleFn.getVariantProps,
      })",
          "name": "button-style",
        },
        {
          "dts": "import type { ConditionalValue } from '../types/index';
      import type { DistributiveOmit, Pretty } from '../types/system-types';

      interface CheckboxVariant {
        /**
       * @default "sm"
       */
      size: "sm" | "md" | "lg"
      }

      type CheckboxVariantMap = {
        [key in keyof CheckboxVariant]: Array<CheckboxVariant[key]>
      }

      type CheckboxSlot = "root" | "control" | "label"

      export type CheckboxVariantProps = {
        [key in keyof CheckboxVariant]?: ConditionalValue<CheckboxVariant[key]> | undefined
      }

      export interface CheckboxRecipe {
        __slot: CheckboxSlot
        __type: CheckboxVariantProps
        (props?: CheckboxVariantProps): Pretty<Record<CheckboxSlot, string>>
        raw: (props?: CheckboxVariantProps) => CheckboxVariantProps
        variantMap: CheckboxVariantMap
        variantKeys: Array<keyof CheckboxVariant>
        splitVariantProps<Props extends CheckboxVariantProps>(props: Props): [CheckboxVariantProps, Pretty<DistributiveOmit<Props, keyof CheckboxVariantProps>>]
        getVariantProps: (props?: CheckboxVariantProps) => CheckboxVariantProps
        /** Which slots each variant writes styles for. */
      slotsAffectedBy: Record<keyof CheckboxVariant, CheckboxSlot[]>
        /** The slots that take variants — every other one is scoped by a class an anchor carries. */
      root: (props?: CheckboxVariantProps) => string
      control: string
      label: string
      }


      export declare const checkbox: CheckboxRecipe",
          "js": "import { compact, getSlotCompoundVariant, memo, splitProps } from '../helpers.mjs';
      import { createRecipe, formatRecipeClass } from './create-recipe.mjs';

      const checkboxDefaultVariants = {
        "size": "sm"
      }
      const checkboxCompoundVariants = []

      // Formatted, not raw. A scoped slot's class is a constant that never passes through
      // \`createCss\`, so \`hash.className\` and \`prefix\` have to be applied here to match
      // the rule the stylesheet emits.
      const checkboxSlotNames = [
        [
          "root",
          "checkbox__root"
        ],
        [
          "control",
          "checkbox__control"
        ],
        [
          "label",
          "checkbox__label"
        ]
      ].map(
        ([slotName, className]) => [slotName, formatRecipeClass(className)],
      )
      /**
       * Only the anchors take variants: \`checkbox.root\`.
       * Every other slot's variant styles are emitted as rules scoped by a class an anchor
       * carries, so that slot's class is a constant and nothing has to reach it at runtime.
       */
      const checkboxAnchors = ["root"]
      const checkboxAnchorFns = /* @__PURE__ */ checkboxAnchors.map((slotName) => [slotName, createRecipe(\`checkbox__\${slotName}\`, checkboxDefaultVariants, getSlotCompoundVariant(checkboxCompoundVariants, slotName), {
        "size": [
          "sm",
          "md",
          "lg"
        ]
      })])
      const checkboxStaticSlots = /* @__PURE__ */ Object.fromEntries(
        checkboxSlotNames.filter(([slotName]) => !checkboxAnchors.includes(slotName)),
      )

      const checkboxFn = memo((props = {}) => ({
        ...checkboxStaticSlots,
        ...Object.fromEntries(checkboxAnchorFns.map(([slotName, anchorFn]) => [slotName, anchorFn.recipeFn(props)])),
      }))

      const checkboxVariantKeys = [
        "size"
      ]
      const getVariantProps = (variants) => ({ ...checkboxDefaultVariants, ...compact(variants) })

      export const checkbox = /* @__PURE__ */ Object.assign(checkboxFn, {
        __recipe__: false,
        __name__: 'checkbox',
        raw: (props) => props,
        /** Each slot's constant class, for targeting a slot in the DOM. */
        classNameMap: /* @__PURE__ */ Object.fromEntries(checkboxSlotNames),
        /** The slots that enclose other slots, and so anchor their variant rules. */
        scopeRoots: ["root"],
        variantKeys: checkboxVariantKeys,
        variantMap: {
        "size": [
          "sm",
          "md",
          "lg"
        ]
      },
        /** Which slots each variant actually reaches, for a slot a scope cannot get to. */
        slotsAffectedBy: {
        "size": [
          "control",
          "label"
        ]
      },
        splitVariantProps(props) {
          return splitProps(props, checkboxVariantKeys)
        },
        getVariantProps,
        ...Object.fromEntries(checkboxAnchorFns.map(([slotName, anchorFn]) => [slotName, anchorFn.recipeFn])),
      ...checkboxStaticSlots,
      })",
          "name": "checkbox",
        },
        {
          "dts": "import type { ConditionalValue } from '../types/index';
      import type { DistributiveOmit, Pretty } from '../types/system-types';

      interface BadgeVariant {
        size: "sm"
      raised: boolean
      }

      type BadgeVariantMap = {
        [key in keyof BadgeVariant]: Array<BadgeVariant[key]>
      }

      type BadgeSlot = "title" | "body"

      export type BadgeVariantProps = {
        [key in keyof BadgeVariant]?: BadgeVariant[key] | undefined
      }

      export interface BadgeRecipe {
        __slot: BadgeSlot
        __type: BadgeVariantProps
        (props?: BadgeVariantProps): Pretty<Record<BadgeSlot, string>>
        raw: (props?: BadgeVariantProps) => BadgeVariantProps
        variantMap: BadgeVariantMap
        variantKeys: Array<keyof BadgeVariant>
        splitVariantProps<Props extends BadgeVariantProps>(props: Props): [BadgeVariantProps, Pretty<DistributiveOmit<Props, keyof BadgeVariantProps>>]
        getVariantProps: (props?: BadgeVariantProps) => BadgeVariantProps
        /** Which slots each variant writes styles for. */
      slotsAffectedBy: Record<keyof BadgeVariant, BadgeSlot[]>
        
      }


      export declare const badge: BadgeRecipe",
          "js": "import { compact, getSlotCompoundVariant, memo, splitProps } from '../helpers.mjs';
      import { createRecipe, formatRecipeClass } from './create-recipe.mjs';

      const badgeDefaultVariants = {}
      const badgeCompoundVariants = [
        {
          "raised": true,
          "size": "sm",
          "css": {
            "title": {
              "color": "ButtonHighlight"
            }
          }
        }
      ]

      // Formatted, not raw. A scoped slot's class is a constant that never passes through
      // \`createCss\`, so \`hash.className\` and \`prefix\` have to be applied here to match
      // the rule the stylesheet emits.
      const badgeSlotNames = [
        [
          "title",
          "badge__title"
        ],
        [
          "body",
          "badge__body"
        ]
      ].map(
        ([slotName, className]) => [slotName, formatRecipeClass(className)],
      )
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
      const badgeSlotFns = /* @__PURE__ */ badgeSlotNames.map(([slotName]) => [slotName, createRecipe(\`badge__\${slotName}\`, badgeDefaultVariants, getSlotCompoundVariant(badgeCompoundVariants, slotName), {
        "size": [
          "sm"
        ],
        "raised": [
          "true"
        ]
      })])

      const badgeFn = memo((props = {}) => {
        return Object.fromEntries(badgeSlotFns.map(([slotName, slotFn]) => [slotName, slotFn.recipeFn(props)]))
      })

      const badgeVariantKeys = [
        "size",
        "raised"
      ]
      const getVariantProps = (variants) => ({ ...badgeDefaultVariants, ...compact(variants) })

      export const badge = /* @__PURE__ */ Object.assign(badgeFn, {
        __recipe__: false,
        __name__: 'badge',
        raw: (props) => props,
        /** Each slot's constant class, for targeting a slot in the DOM. */
        classNameMap: /* @__PURE__ */ Object.fromEntries(badgeSlotNames),
        /** The slots that enclose other slots, and so anchor their variant rules. */
        scopeRoots: [],
        variantKeys: badgeVariantKeys,
        variantMap: {
        "size": [
          "sm"
        ],
        "raised": [
          "true"
        ]
      },
        /** Which slots each variant actually reaches, for a slot a scope cannot get to. */
        slotsAffectedBy: {
        "size": [
          "title",
          "body"
        ],
        "raised": [
          "title"
        ]
      },
        splitVariantProps(props) {
          return splitProps(props, badgeVariantKeys)
        },
        getVariantProps,
        
      })",
          "name": "badge",
        },
      ]
    `)
  })
})
