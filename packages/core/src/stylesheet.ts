import layersPolyfill from '@csstools/postcss-cascade-layers'
import merge from 'lodash.merge'
import { logger } from '@bamboocss/logger'
import type { CascadeLayer, Dict, SystemStyleObject, ViewTransitionResult } from '@bamboocss/types'
import postcss, { CssSyntaxError } from 'postcss'
import { stringifyCustomProperties } from './global-vars'
import { optimizeCss, optimizeCssRoot } from './optimize'
import sortMediaQueries from './plugins/sort-mq'
import { serializeStyles } from './serialize'
import { sortStyleRules } from './sort-style-rules'
import { stringify } from './stringify'
import type { StyleDecoder } from './style-decoder'
import type { CssOptions, LayerName, ProcessOptions, StylesheetContext } from './types'

export class Stylesheet {
  constructor(private context: StylesheetContext) {}

  get layers() {
    return this.context.layers
  }

  getLayer(layer: LayerName) {
    return this.context.layers[layer] as postcss.AtRule | undefined
  }

  process(options: ProcessOptions) {
    const layer = this.getLayer(options.layer)
    if (!layer) return

    const { styles } = options

    // shouldn't happen, but just in case
    if (typeof styles !== 'object') return

    try {
      layer.append(stringify(styles))
    } catch (error) {
      if (error instanceof CssSyntaxError) {
        logger.error('sheet:process', error.showSourceCode(true))
      } else {
        logger.caughtError('sheet:process', 'Failed to process styles', error)
      }
    }
    return
  }

  serialize = (styles: Dict) => {
    return serializeStyles(this.context, styles)
  }

  processResetCss = (styles: Dict) => {
    const result = this.serialize(styles)

    let css = stringify(result)

    if (this.context.hooks['cssgen:done']) {
      css = this.context.hooks['cssgen:done']({ artifact: 'reset', content: css }) ?? css
    }

    this.context.layers.reset.append(css)
  }

  processGlobalCss = (styles: Dict) => {
    const result = this.serialize(styles)

    let css = stringify(result)
    // Registered before the user's own global vars: a utility's registration is part of the
    // framework's own plumbing, and a user naming the same variable should be the one whose
    // declaration reads last.
    css += stringifyCustomProperties(this.context.utility.customProperties)
    css += this.context.globalVars.toString()
    css += this.context.globalFontface.toString()
    css += this.context.globalPositionTry.toString()

    if (this.context.hooks['cssgen:done']) {
      css = this.context.hooks['cssgen:done']({ artifact: 'global', content: css }) ?? css
    }

    this.context.layers.base.append(css)
  }

  processCss = (styles: SystemStyleObject | undefined, layer: LayerName) => {
    if (!styles) return
    this.process({ styles, layer })
  }

  processDecoder = (decoder: StyleDecoder) => {
    sortStyleRules([...decoder.atomic]).forEach((css) => {
      this.processCss(css.result, (css.layer as LayerName) ?? 'utilities')
    })

    decoder.recipes.forEach((recipeSet) => {
      // Merged per layer before processing, rather than one `processCss` per result.
      //
      // A scoped slot rule is keyed by its `@scope` prelude, and a recipe with more than
      // one anchor emits every non-anchor slot under each of them — so the same prelude
      // recurs across results with a different anchor's block in between, and identical
      // at-rules only collapse when they are adjacent. Merging first makes the prelude an
      // object key, which deduplicates it by construction. On a 15-slot two-anchor recipe
      // that is 130 `@scope` blocks against 10.
      //
      // Order is preserved: `merge` keeps the target's existing keys in place and appends
      // new ones, so results still emit in the order they were collected.
      const scopedByLayer = new Map<LayerName, Dict>()

      recipeSet.forEach((recipe) => {
        const layer: LayerName = recipe.entry.slot ? 'recipes_slots' : 'recipes'

        // Only the scoped ones are merged. Merging everything also collapses a variant's
        // declarations — which arrive as one result per declaration — into a single rule,
        // and that moves later declarations up to where the variant first appeared,
        // reordering the layer. Unscoped results keep emitting exactly as they did.
        if (!recipe.scoped) {
          this.processCss(recipe.result, layer)
          return
        }

        const target = scopedByLayer.get(layer) ?? {}
        merge(target, recipe.result)
        scopedByLayer.set(layer, target)
      })

      // After the unscoped rules. The two never select the same thing — an anchor's own
      // variant class against a slot's constant class inside a scope — so nothing collides
      // on the way past.
      scopedByLayer.forEach((result, layer) => this.processCss(result, layer))
    })

    decoder.recipes_base.forEach((recipeSet) => {
      recipeSet.forEach((recipe) => {
        this.processCss(recipe.result, recipe.slot ? 'recipes_slots_base' : 'recipes_base')
      })
    })

    decoder.view_transitions.forEach((viewTransition) => {
      this.processViewTransition(viewTransition)
    })
  }

  /**
   * `utilities` for the same reason atomic styles land there — last in the cascade, so a
   * transition overrides the theme rather than the other way round.
   *
   * What matters is that it is one of the *existing* layers: both pruning passes scan a
   * hardcoded list of them, so a layer of its own would make every keyframe and token a
   * transition names look unreachable and get pruned away.
   */
  processViewTransition = (viewTransition: ViewTransitionResult) => {
    // Serialized rather than appended raw: the slot bodies are authored style objects, so
    // tokens, shorthands and conditions inside them resolve the same as anywhere else.
    this.process({ styles: this.serialize(viewTransition.styles), layer: 'utilities' })
  }

  /**
   * Process only the styles for a specific recipe from the decoder
   */
  processDecoderForRecipe = (decoder: StyleDecoder, recipeName: string) => {
    const recipeSet = decoder.recipes.get(recipeName)
    if (recipeSet) {
      recipeSet.forEach((recipe) => {
        this.processCss(recipe.result, recipe.entry.slot ? 'recipes_slots' : 'recipes')
      })
    }

    // Process recipe base styles (may include slot-specific keys like "button__root")
    decoder.recipes_base.forEach((baseSet, recipeKey) => {
      // recipeKey could be "button" or "button__root" for slot recipes
      const [baseRecipeName] = recipeKey.split('__')
      if (baseRecipeName === recipeName) {
        baseSet.forEach((recipe) => {
          this.processCss(recipe.result, recipe.slot ? 'recipes_slots_base' : 'recipes_base')
        })
      }
    })
  }

  getLayerCss = (...layers: CascadeLayer[]) => {
    const breakpoints = this.context.conditions.breakpoints
    return optimizeCss(
      layers
        .map((layer: CascadeLayer) => {
          const root = this.context.layers.getLayerRoot(layer)
          breakpoints.expandScreenAtRule(root as postcss.Root)
          return root.toString()
        })
        .join('\n'),
      {
        minify: false,
        browserslist: this.context.browserslist,
        hooks: this.context.hooks,
      },
    )
  }

  toCss = ({ minify }: CssOptions = {}) => {
    try {
      const breakpoints = this.context.conditions.breakpoints

      /**
       * Cloned, because `insert()` hands back the `Layers` instance's own root and everything
       * below rewrites what it is given -- `expandScreenAtRule` and the two plugins here, and
       * then the whole optimize pipeline, which merges rules and drops nodes.
       *
       * Serializing the tree and letting `optimizeCss` parse it back was doing this by
       * accident: a string cannot be mutated, so the round trip was the only thing keeping the
       * context's layers intact across two `toCss` calls. Doing it deliberately is both safer
       * and much cheaper -- 3.7ms against 15.2ms on a 663 kB sheet -- and it extends the
       * protection to `sortMediaQueries` and the layer polyfill, which ran against the shared
       * tree even under the old spelling.
       */
      const root = this.context.layers.insert().clone()

      breakpoints.expandScreenAtRule(root)

      const plugins: postcss.AcceptedPlugin[] = [sortMediaQueries()]
      if (this.context.polyfill) {
        plugins.push(layersPolyfill())
      }

      // The tree, not its text: `optimizeCssRoot` consumes what it is handed, and the clone
      // above exists to be consumed. Serializing it for `optimizeCss` to parse straight back
      // cost 13.0ms against the clone's 6.8ms on a 432 kB sheet.
      const result = postcss(plugins).process(root)

      return optimizeCssRoot(result.root, {
        minify,
        browserslist: this.context.browserslist,
        hooks: this.context.hooks,
      })
    } catch (error) {
      if (error instanceof CssSyntaxError) {
        logger.error('sheet:toCss', error.showSourceCode(true))
      }

      throw error
    }
  }
}
