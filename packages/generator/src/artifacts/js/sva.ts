import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'

export function generateSvaFn(ctx: Context) {
  return {
    js: outdent`
    ${ctx.file.import('compact, getRecipeIdentity, getSlotRecipes, memo, splitProps', '../helpers')}
    ${ctx.file.import('cva, formatRecipeClass', './cva')}
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

      // Populated whether or not the author set a \`className\`. Every slot recipe is given
      // one before the split — the identity when the config declares none — so the guard
      // that used to sit here left an anonymous \`sva\` reporting no slot classes despite
      // emitting them.
      const classNameMap = slots.reduce((acc, [slot, cvaFn]) => {
        acc[slot] = cvaFn.config.className
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
          anchors.length && !anchors.includes(slot) ? formatRecipeClass(cvaFn.config.className) : cvaFn(props),
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
        /** The slots that enclose other slots, and so anchor their variant rules. */
        scopeRoots: anchors,
        slotsAffectedBy,
        splitVariantProps,
        getVariantProps,
      })
    }

    /**
     * Report slots whose variant styles can never reach them.
     *
     * A scoped slot is styled through an \`@scope\` rule opened at an anchor, so it has to be
     * rendered inside one. A slot moved out of every anchor's subtree — through a portal,
     * with no second anchor named in \`scopeRoots\` — keeps its base styles and silently
     * loses its variant styles. That renders *nearly* right, which is harder to notice than
     * a total failure, and no build step can catch it: whether one element is inside another
     * is a fact about the DOM.
     *
     * Checks for the anchor's *base* class rather than its variant class. An anchor always
     * carries the base one; the variant class is absent whenever no variant is selected, and
     * matching on it would report a slot that is correctly placed and simply unstyled.
     *
     * Development only — call it behind \`process.env.NODE_ENV !== 'production'\` so bundlers
     * drop it, along with this function, from your production build.
     *
     * \`\`\`js
     * import { auditSlotScopes, select } from '../styled-system/css'
     *
     * if (process.env.NODE_ENV !== 'production') auditSlotScopes([select], { observe: true })
     * \`\`\`
     */
    export function auditSlotScopes(recipes, options = {}) {
      const { root = typeof document === 'undefined' ? undefined : document, observe = false, onReport } = options
      if (!root) return () => {}

      const escape = (value) =>
        typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/[^\\w-]/g, '\\\\$&')

      const audit = () => {
        const found = []

        for (const recipe of recipes) {
          const anchors = recipe?.scopeRoots ?? []
          // Nothing is scoped, so every slot carries its own variant class and none of them
          // depends on where it is rendered.
          if (!anchors.length) continue

          const classNameMap = recipe.classNameMap ?? {}
          const anchorSelector = anchors
            .map((slot) => classNameMap[slot])
            .filter(Boolean)
            .map((className) => '.' + escape(className))
            .join(', ')
          if (!anchorSelector) continue

          const scoped = new Set(Object.values(recipe.slotsAffectedBy ?? {}).flat())

          for (const slot of scoped) {
            if (anchors.includes(slot)) continue

            const className = classNameMap[slot]
            if (!className) continue

            for (const element of root.querySelectorAll('.' + escape(className))) {
              if (element.closest(anchorSelector)) continue
              found.push({ recipe: recipe.__name__, slot, className, element, anchors })
            }
          }
        }

        if (!found.length) return found

        if (onReport) {
          onReport(found)
        } else {
          for (const problem of found) {
            console.warn(
              \`[bamboo] \${problem.recipe ?? 'slot recipe'}: the \\\`\${problem.slot}\\\` slot is rendered outside every \` +
                \`anchor (\${problem.anchors.join(', ')}), so its variant styles cannot reach it. \` +
                \`Add the enclosing slot to \\\`scopeRoots\\\`, or deliver the variant to this slot by hand.\`,
              problem.element,
            )
          }
        }

        return found
      }

      audit()

      if (!observe || typeof MutationObserver === 'undefined') return () => {}

      // Portaled content mounts after the first sweep, which is exactly the case this
      // exists to catch, so a one-shot pass would miss it.
      let queued = false
      const observer = new MutationObserver(() => {
        if (queued) return
        queued = true
        queueMicrotask(() => {
          queued = false
          audit()
        })
      })
      observer.observe(root === document ? document.documentElement : root, { childList: true, subtree: true })

      return () => observer.disconnect()
    }
    `,
    dts: outdent`
    ${ctx.file.importType('SlotRecipeCreatorFn', '../types/recipe')}

    export declare const sva: SlotRecipeCreatorFn

    export interface SlotScopeProblem {
      /** The recipe the slot belongs to, when it has a name. */
      recipe?: string
      /** The slot whose variant styles cannot reach it. */
      slot: string
      /** The constant class that slot carries. */
      className: string
      /** The element found outside every anchor. */
      element: Element
      /** The anchors that were looked for. */
      anchors: string[]
    }

    export interface AuditSlotScopesOptions {
      /** Where to look. Defaults to \`document\`. */
      root?: ParentNode
      /** Re-check as the DOM changes, for content that mounts through a portal. */
      observe?: boolean
      /** Handle the findings yourself instead of warning to the console. */
      onReport?: (problems: SlotScopeProblem[]) => void
    }

    /**
     * Report slots whose variant styles can never reach them, in development.
     *
     * A scoped slot is styled through an \`@scope\` rule opened at an anchor, so it has to be
     * rendered inside one. A slot moved out of every anchor's subtree keeps its base styles
     * and silently loses its variant styles — which no build step can catch, because whether
     * one element is inside another is a fact about the DOM.
     *
     * Returns a function that stops observing.
     */
    export declare function auditSlotScopes(
      recipes: ReadonlyArray<unknown>,
      options?: AuditSlotScopesOptions,
    ): () => void
    `,
  }
}
