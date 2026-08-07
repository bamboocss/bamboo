import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'

export function generateSvaFn(ctx: Context) {
  return {
    js: outdent`
    ${ctx.file.import('compact, getRecipeIdentity, getSlotRecipes, memo, splitProps', '../helpers')}
    ${ctx.file.import('cva', './cva')}
    ${ctx.file.import('cx', './cx')}

    export function sva(config) {
      // Named before the split, so each slot's class is \`name__slot\`. Left to
      // \`getSlotRecipes\`, a config with no \`className\` gives every slot the bare slot name
      // — \`root\` — which every other anonymous recipe with a \`root\` slot would share. The
      // build injects the identity at the same point, for the same reason.
      const name = getRecipeIdentity(config, 'sva')
      const withName = { ...config, className: config.className ?? name }

      const slots = Object.entries(getSlotRecipes(withName)).map(([slot, slotCva]) => [slot, cva(slotCva)])
      const defaultVariants = config.defaultVariants ?? {}

      const classNameMap = slots.reduce((acc, [slot, cvaFn]) => {
        if (config.className) acc[slot] = cvaFn.config.className
        return acc
      }, {})

      // The slots that enclose other slots, matching \`Recipes.getScopeRoots\`. Their variant
      // styles anchor \`@scope\` rules for every other slot, so only they take variants — a
      // variant class on any other slot would name a rule that was never emitted.
      //
      // A list, because a component can span a portal and so occupy more than one subtree.
      const declaredSlots = config.slots ?? []
      const anchors = config.scopeRoots
        ? config.scopeRoots.filter((slot) => declaredSlots.includes(slot))
        : declaredSlots.includes('root') ? ['root'] : []

      // \`classNameMap[slot]\` used to be joined on here, because the slot's classes were
      // atomic and nothing else carried the name to target it in the DOM. The slot's cva is
      // now named \`name__slot\` and returns that as its base class, so joining it again
      // would just repeat it.
      function svaFn(props) {
        const result = slots.map(([slot, cvaFn]) => [
          slot,
          anchors.length && !anchors.includes(slot) ? cvaFn.config.className : cvaFn(props),
        ])
        return Object.fromEntries(result)
      }

      function raw(props) {
        const result = slots.map(([slot, cvaFn]) => [slot, cvaFn.raw(props)])
        return Object.fromEntries(result)
      }

      const variants = config.variants ?? {};
      const variantKeys = Object.keys(variants);

      function splitVariantProps(props) {
        return splitProps(props, variantKeys);
      }
      const getVariantProps = (variants) => ({ ...defaultVariants, ...compact(variants) })

      const variantMap = Object.fromEntries(
        Object.entries(variants).map(([key, value]) => [key, Object.keys(value)])
      );

      // Which slots each variant writes styles for.
      //
      // A scope reaches every slot inside an anchor's subtree. A slot under no anchor is
      // not reached, and nothing at build time can detect that — reachability is a fact
      // about the DOM. This is what says which slots a variant has to get to, so the
      // component layer can thread the ones a scope cannot. Config slot recipes have always
      // exposed it; an inline \`sva\` had no way to answer the question at all.
      const slotsAffectedBy = Object.fromEntries(
        Object.entries(variants).map(([variant, values]) => [
          variant,
          [...new Set(Object.values(values ?? {}).flatMap((slotStyles) => Object.keys(slotStyles ?? {})))],
        ])
      );

      return Object.assign(memo(svaFn), {
        __cva__: false,
        raw,
        config,
        variantMap,
        variantKeys,
        classNameMap,
        slotsAffectedBy,
        splitVariantProps,
        getVariantProps,
      })
    }
    `,
    dts: outdent`
    ${ctx.file.importType('SlotRecipeCreatorFn', '../types/recipe')}

    export declare const sva: SlotRecipeCreatorFn
    `,
  }
}
