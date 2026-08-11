import {
  Context,
  pruneKeyframes,
  prunePreflight,
  prunesPreflight,
  pruneTokenVars,
  type StyleDecoder,
  type Stylesheet,
} from '@bamboocss/core'
import { logger } from '@bamboocss/logger'
import { cssVarRefs, dashCase, isObject, truncateList, BambooError } from '@bamboocss/shared'
import type { ArtifactId, CssArtifactType, LoadConfigResult, SpecFile, SpecType, SpecTypeMap } from '@bamboocss/types'
import { match } from 'ts-pattern'
import { generateArtifacts } from './artifacts'
import { generateGlobalCss } from './artifacts/css/global-css'
import { generateKeyframeCss } from './artifacts/css/keyframe-css'
import { generateParserCss } from './artifacts/css/parser-css'
import { generateResetCss } from './artifacts/css/reset-css'
import { generateStaticCss } from './artifacts/css/static-css'
import { generateTokenCss } from './artifacts/css/token-css'
import { getThemeCss } from './artifacts/js/themes'
import { generateColorPaletteSpec } from './spec/color-palette'
import { generateConditionsSpec } from './spec/conditions'
import { generateKeyframesSpec } from './spec/keyframes'
import { generateMixinsSpec } from './spec/mixins'
import { generatePatternsSpec } from './spec/patterns'
import { generateRecipesSpec } from './spec/recipes'
import { generateThemesSpec } from './spec/themes'
import { generateSemanticTokensSpec, generateTokensSpec } from './spec/tokens'

export interface SplitCssArtifact {
  type: 'layer' | 'recipe' | 'theme'
  name: string
  file: string
  code: string
  /** Directory relative to styles/ */
  dir?: string
}

export interface SplitCssResult {
  /** Layer CSS files (reset, global, tokens, utilities) */
  layers: SplitCssArtifact[]
  /** Recipe CSS files */
  recipes: SplitCssArtifact[]
  /** Theme CSS files (not auto-imported) */
  themes: SplitCssArtifact[]
  /** Content for recipes.css */
  recipesIndex: string
  /** Content for main styles.css */
  index: string
}

export class Generator extends Context {
  constructor(conf: LoadConfigResult) {
    super(conf)
  }

  getArtifacts = (ids?: ArtifactId[] | undefined) => {
    return generateArtifacts(this, ids)
  }

  appendCssOfType = (type: CssArtifactType, sheet: Stylesheet) => {
    match(type)
      .with('preflight', () => generateResetCss(this, sheet))
      .with('tokens', () => generateTokenCss(this, sheet))
      .with('static', () => generateStaticCss(this, sheet))
      .with('global', () => generateGlobalCss(this, sheet))
      .with('keyframes', () => generateKeyframeCss(this, sheet))
      .otherwise(() => {
        throw new BambooError(
          'UNKNOWN_ARTIFACT',
          `Unknown CSS artifact type: "${type}". Expected one of: preflight, tokens, static, global, keyframes`,
        )
      })
  }

  appendLayerParams = (sheet: Stylesheet) => {
    sheet.layers.root.prepend(sheet.layers.params)
  }

  appendBaselineCss = (sheet: Stylesheet) => {
    if (this.config.preflight) this.appendCssOfType('preflight', sheet)
    if (!this.tokens.isEmpty) this.appendCssOfType('tokens', sheet)
    this.appendCssOfType('static', sheet)
    this.appendCssOfType('global', sheet)
    if (this.config.theme?.keyframes) this.appendCssOfType('keyframes', sheet)
  }

  appendParserCss = (sheet: Stylesheet) => {
    const decoder = this.decoder.collect(this.encoder)
    sheet.processDecoder(decoder)
  }

  /**
   * Drop token css variables nothing can reach. Call this only once the sheet holds the
   * whole stylesheet — a baseline-only sheet has no utilities to reference anything, so
   * every token would look unused.
   *
   * `keep` carries references this cannot see for itself; see `collectTokenReferences`.
   */
  pruneTokens = (sheet: Stylesheet, keep?: Set<string>, tokensReachableFromJs = true) => {
    // `prune.tokens` governs the token declarations; `prune.propertyRegistrations` governs
    // the `@property` rules a utility registers. Two flags because they answer to different
    // evidence: a token can be reached by a name this pass never sees -- `token()` with a
    // path assembled at runtime -- and a registration has no such surface. Nothing hands one
    // to javascript, and it is not part of the token api, so "does the finished stylesheet
    // mention it" is the whole question.
    //
    // They were one flag, and the registrations were dropped even when it was off -- so an
    // option documented as keeping every token declaration quietly removed something else,
    // and there was no way at all to keep them.
    const pruneVars = (this.config.prune?.tokens ?? 'reachable') !== 'off'
    const pruneRegistrations = this.config.prune?.propertyRegistrations ?? true

    const layers = sheet.layers

    const result = pruneTokenVars({
      scan: [
        layers.reset,
        layers.base,
        layers.tokens,
        layers.recipes,
        layers.recipes_base,
        layers.recipes_slots,
        layers.recipes_slots_base,
        layers.utilities,
        layers.compositions,
      ],
      target: layers.tokens,
      // An empty set offers nothing for removal, so the same walk prunes registrations
      // alone. `pruneTokenVars` already handles this — it is the shape a theme declaring
      // no tokens at all arrives in.
      tokenVars: pruneVars ? this.getTokenVarNames() : new Set<string>(),
      keep: new Set([
        ...this.getAlwaysKeptTokenVars(tokensReachableFromJs),
        ...this.getThemeTokenVars(),
        ...(keep ?? []),
      ]),
      // `@property` rules land in `base`, alongside `global.css`. Only the ones a utility
      // registered are offered — a user's own, written through `global.vars`, are not.
      registeredProperties: pruneRegistrations ? new Set(this.utility.customProperties.keys()) : new Set<string>(),
      propertyTarget: layers.base,
    })

    logger.debug(
      'prune:tokens',
      `Removed ${result.removed} unused token css variable(s) and ${result.removedProperties} unused @property rule(s)`,
    )

    return result
  }

  /**
   * Drop the parts of the reset that style elements the source never renders.
   *
   * Off unless asked for. Unlike the token and keyframe passes there is no way to prove this
   * from the build: an element rendered by a dependency, by `dangerouslySetInnerHTML` or by
   * markdown is invisible to a scan of your own source, and the failure is an element quietly
   * losing its reset rather than anything that reports itself.
   */
  prunePreflight = (sheet: Stylesheet, rendered: Set<string>) => {
    const { preflight } = this.config
    if (!prunesPreflight(preflight)) return

    // A scoped reset writes the scope onto every selector, so the pass has to be told what
    // to strip. Without it nothing reports an element and the whole pass is a silent no-op.
    const scope = isObject(preflight) ? preflight.scope : undefined

    const result = prunePreflight({ target: sheet.layers.reset, rendered, scope })

    logger.debug(
      'prune:preflight',
      `Removed ${result.removedRules} reset rule(s) and ${result.removedParts} selector part(s) for unrendered elements`,
    )

    return result
  }

  /**
   * Drop `@keyframes` nothing can reach. Same completeness requirement as
   * `pruneTokens`: the sheet has to hold the whole stylesheet, or every keyframe looks
   * unused for want of a utility to reference it.
   *
   * `keep` carries names this cannot see for itself; see `collectKeyframeReferences`.
   *
   * `reachableVars` is `pruneTokens`' answer about custom properties, which has to be handed
   * over rather than re-derived here. A token kept by a reader outside the stylesheet — a
   * `token()` call, a `prune.keepTokens` pattern, a theme, a `globalCss` export — is
   * reachable to that pass and invisible to this one, so deriving it again from the css
   * deletes the `@keyframes` out from under a declaration that ships. Every caller that
   * prunes both hands it over.
   *
   * Omitting it falls back to what `prune.tokens` implies. Under `off` that is `'all'`: no
   * token declaration is removable, so each one ships and keeps the keyframe it names —
   * and `off` is precisely the setting chosen because something outside the stylesheet
   * reads them. Otherwise it is the css alone, which is what a caller running this pass
   * without the other one is asking for.
   */
  pruneKeyframes = (sheet: Stylesheet, keep?: Set<string>, reachableVars?: Set<string> | 'all') => {
    if (!this.config.prune?.keyframes) return

    const layers = sheet.layers
    const keyframeNames = new Set(Object.keys(this.config.theme?.keyframes ?? {}))

    const result = pruneKeyframes({
      scan: [
        layers.reset,
        layers.base,
        layers.tokens,
        layers.recipes,
        layers.recipes_base,
        layers.recipes_slots,
        layers.recipes_slots_base,
        layers.utilities,
        layers.compositions,
      ],
      // `generateKeyframeCss` appends into the token layer.
      target: layers.tokens,
      keyframeNames,
      keep: new Set([...this.getThemeKeyframeNames(keyframeNames), ...(keep ?? [])]),
      reachableVars: reachableVars ?? ((this.config.prune?.tokens ?? 'reachable') === 'off' ? 'all' : undefined),
    })

    logger.debug('prune:keyframes', `Removed ${result.removed} unused keyframe(s)`)

    return result
  }

  /**
   * Keyframes the themes name.
   *
   * A theme is emitted as its own artifact and injected at runtime, so its css is not in
   * the sheet being pruned. A theme that points an animation token at a different
   * keyframe than the base does — `--animations-enter: fade-in` in the base and
   * `slide-up` under `dark` — would otherwise have that keyframe removed, because
   * nothing in the pruned sheet ever names it.
   */
  private getThemeKeyframeNames = (keyframeNames: Set<string>) => {
    const names = new Set<string>()
    const themes = this.config.theme?.variants
    if (!themes || !keyframeNames.size) return names

    for (const themeName of Object.keys(themes)) {
      // Raw css text rather than declaration values, so the separator has to be
      // everything a name cannot contain.
      for (const token of getThemeCss(this, themeName).split(/[^\w-]+/)) {
        if (keyframeNames.has(token)) names.add(token)
      }
    }

    return names
  }

  /**
   * Every custom property the token system declares. Used as the allow-list of what may
   * be removed, so custom properties from `globalCss` are never touched.
   */
  private getTokenVarNames = () => {
    const names = new Set<string>()
    for (const values of this.tokens.view.vars.values()) {
      for (const name of values.keys()) names.add(name)
    }
    return names
  }

  /**
   * Everything the themes refer to.
   *
   * A theme is emitted as its own artifact and injected at runtime, so its css is not in
   * the sheet being pruned and nothing there points at what it needs. A theme that maps a
   * token onto a base colour would otherwise be left referring to a declaration that has
   * been removed.
   */
  private getThemeTokenVars = () => {
    const names = new Set<string>()
    const themes = this.config.theme?.variants
    if (!themes) return names

    for (const themeName of Object.keys(themes)) {
      for (const name of cssVarRefs(getThemeCss(this, themeName))) {
        names.add(name)
      }
    }

    return names
  }

  /**
   * The token declarations held open so a runtime `token()` can answer for any path.
   *
   * `token()` hands javascript the *variable reference* for every token, so a path the build
   * cannot resolve could name any of them and every declaration has to survive. That is a
   * blunt instrument, and deliberately so: the alternative failure is a `var()` with no
   * declaration behind it, which resolves to the guaranteed-invalid value and inherits
   * rather than falling back — silently wrong, which is worse than visibly large.
   *
   * It used to be narrower, because `token()` used to return a *literal* for a plain token
   * and only a `var()` for virtual, conditional and negative ones. That split is gone, and
   * narrowing this to match it would now strand exactly the base tokens the old split made
   * safe.
   *
   * So the gate below carries the whole saving. `styled-system/tokens` is generated into the
   * project, so nothing outside it can import them -- if no file under `include` reaches for
   * a token from javascript, no caller exists to serve and the declarations are as prunable
   * as any other.
   *
   * That gate is all-or-nothing per project, which is the coarse part worth fixing next: a
   * project whose token calls all resolve to string literals needs none of this, because
   * `collectTokenReferences` already kept those paths by name. Deciding that needs the
   * reference accounting the gate does not do yet -- see `tokensReachableFromJs`.
   */
  private getAlwaysKeptTokenVars = (tokensReachableFromJs: boolean) => {
    const names = new Set<string>()

    if (!tokensReachableFromJs) return names

    // Mirrors what `generateTokenJs` puts in the map, which is the only thing a runtime
    // caller can receive: `variable` is `varRef` for every token, and `value` is that same
    // `varRef` for a virtual or conditional token and the literal otherwise.
    this.tokens.allTokens.forEach((token) => {
      const { var: varName } = token.extensions

      if (varName) names.add(varName.startsWith('--') ? varName : `--${varName}`)

      // The literal side, which matters for one shape: a negative token is never declared
      // itself -- its value is `calc(var(--spacing-4) * -1)`, so what has to survive is its
      // positive counterpart's declaration. Guarded because a token's value need not be a
      // string; a `fontWeights` entry stays a number through the dictionary.
      if (typeof token.value === 'string') {
        for (const name of cssVarRefs(token.value)) {
          names.add(name)
        }
      }
    })

    return names
  }

  getParserCss = (decoder: StyleDecoder) => {
    return generateParserCss(this, decoder)
  }

  getCss = (stylesheet?: Stylesheet) => {
    const sheet = stylesheet ?? this.createSheet()
    let css = sheet.toCss({ minify: this.config.minify })

    if (this.hooks['cssgen:done']) {
      css = this.hooks['cssgen:done']({ artifact: 'styles.css', content: css }) ?? css
    }

    this.assertNoUnresolvedTokens()

    return css
  }

  /**
   * Fail on a style value shaped like a token path that names no token.
   *
   * Only under `unresolvedToken: 'error'` — see that option for why this one is graded and a
   * dead binding is not.
   *
   * Read off the decoded sheet rather than accumulated as `transform` runs, and that is the
   * load-bearing part. A `Context` outlives rebuilds while the decoder memoizes each atom by
   * hash, so on the second build of the same source `transform` is never re-entered: an
   * accumulating record either keeps a finding past the edit that fixed it — wedging a dev
   * server — or is cleared and then never refilled, which passes a build whose source is
   * still broken. That second one is the worse failure and is what an earlier version of this
   * did.
   *
   * `decoder.atomic` has neither problem, because it is not a record of what happened — it is
   * what the sheet is built from, and each result keeps the `prop` and `value` it was written
   * with. So the question asked is the one that matters: does the stylesheet *being emitted*
   * contain a declaration the browser will drop.
   *
   * Within a watch process that set is cumulative, and so is the css: extraction is additive,
   * so the rule for a style deleted from source is still in the sheet until the process
   * restarts. This reports the same way for the same reason — the declaration really is still
   * in the file being written, and saying otherwise would be a check that disagreed with its
   * own output. A production build is a fresh process and sees only what its source asked
   * for.
   *
   * Here rather than beside the asserts in `BambooContext` because this is where the sheet
   * exists: those all run during extraction, before anything has been decoded. Every path
   * that emits css comes through `getCss`.
   */
  assertNoUnresolvedTokens = () => {
    if (this.config.unresolvedToken !== 'error') return

    const found = new Map<string, { prop: string; value: string; category?: string }>()

    for (const atom of this.decoder.atomic) {
      const { prop, value } = atom.entry
      if (typeof value !== 'string' || typeof prop !== 'string') continue

      if (!this.utility.isUnresolvedTokenValue(prop, value)) continue

      // The path the value names, with `!important` and a `/opacity` modifier stripped. The
      // predicate above normalizes the same way — this asks for the result of it, rather than
      // repeating the rule and letting the two drift.
      const bare = this.utility.bareTokenPath(prop, value)

      // One finding per mistake: the same typo under `base`, `_hover` and two breakpoints is
      // four atoms and one thing to fix.
      found.set(`${prop}:${bare}`, { prop, value: bare, category: this.utility.getTokenCategory(prop) })
    }

    if (!found.size) return

    // One line each, so the cap is generous relative to the block-shaped lists elsewhere: a
    // theme rename can leave a few dozen of these and seeing the shape of them is the point.
    const detail = truncateList(
      Array.from(found.values(), ({ prop, value, category }) => {
        const where = category ? ` Check the path against your \`${category}\` tokens.` : ''
        return `- \`${prop}: ${value}\`.${where}`
      }),
      { limit: 25, unit: 'value', separator: '\n' },
    )

    throw new BambooError(
      'UNRESOLVED_TOKEN',
      `${found.size} style value(s) name a token that does not exist:\n\n${detail}\n\n` +
        `Each is emitted as written, which parses — so the stylesheet is valid and nothing ` +
        `downstream objects. The browser drops the declaration at compute time and the style is ` +
        `simply absent from the element, which surfaces as "this never applied" a long way from ` +
        `the typo that caused it. Write \`[value]\` to mark one as a literal, or set ` +
        `\`unresolvedToken: 'warn'\` to report these without failing.`,
    )
  }

  /**
   * Get CSS for a specific layer from the stylesheet
   */
  getLayerCss = (sheet: Stylesheet, layer: 'reset' | 'base' | 'tokens' | 'recipes' | 'utilities') => {
    return sheet.getLayerCss(layer)
  }

  /**
   * Get CSS for a specific recipe
   */
  getRecipeCss = (recipeName: string) => {
    const sheet = this.createSheet()
    const decoder = this.decoder.collect(this.encoder)
    sheet.processDecoderForRecipe(decoder, recipeName)
    return sheet.getLayerCss('recipes')
  }

  /**
   * Get all recipe names from the decoder
   */
  getRecipeNames = () => {
    const decoder = this.decoder.collect(this.encoder)
    return Array.from(decoder.recipes.keys())
  }

  /**
   * Get all split CSS artifacts for the stylesheet
   * Used when --splitting flag is enabled
   */
  getSplitCssArtifacts = (sheet: Stylesheet): SplitCssResult => {
    const layerNames = this.config.layers as Record<string, string>
    const decoder = this.decoder.collect(this.encoder)

    // Layer artifacts
    const layerDefs = [
      { name: 'reset', file: 'reset.css', css: sheet.getLayerCss('reset') },
      { name: 'global', file: 'global.css', css: sheet.getLayerCss('base') },
      { name: 'tokens', file: 'tokens.css', css: sheet.getLayerCss('tokens') },
      { name: 'utilities', file: 'utilities.css', css: sheet.getLayerCss('utilities') },
    ]

    const layers: SplitCssArtifact[] = layerDefs
      .filter((l) => l.css.trim())
      .map((l) => ({
        type: 'layer' as const,
        name: l.name,
        file: l.file,
        code: l.css,
      }))

    // Recipe artifacts
    const recipes: SplitCssArtifact[] = []
    for (const recipeName of this.recipes.keys) {
      const recipeSheet = this.createSheet()
      recipeSheet.processDecoderForRecipe(decoder, recipeName)
      const code = recipeSheet.getLayerCss('recipes')
      if (code.trim()) {
        recipes.push({
          type: 'recipe',
          name: recipeName,
          file: `${dashCase(recipeName)}.css`,
          code,
          dir: 'recipes',
        })
      }
    }

    // Theme artifacts (not auto-imported in styles.css)
    const themes: SplitCssArtifact[] = []
    if (this.config.theme?.variants) {
      for (const themeName of Object.keys(this.config.theme?.variants)) {
        const css = getThemeCss(this, themeName)
        if (css.trim()) {
          themes.push({
            type: 'theme',
            name: themeName,
            file: `${dashCase(themeName)}.css`,
            code: `@layer ${layerNames.tokens} {\n${css}\n}`,
            dir: 'themes',
          })
        }
      }
    }

    // Build recipes.css content
    const recipesIndex = recipes.map((r) => `@import './recipes/${r.file}';`).join('\n')

    // Build main styles.css content
    const layerOrder = [layerNames.reset, layerNames.base, layerNames.tokens, layerNames.recipes, layerNames.utilities]
    const imports = [`@layer ${layerOrder.join(', ')};`, '']

    for (const layer of layers) {
      imports.push(`@import './styles/${layer.file}';`)
    }
    if (recipes.length) {
      imports.push(`@import './styles/recipes.css';`)
    }

    return {
      layers,
      recipes,
      themes,
      recipesIndex,
      index: imports.join('\n'),
    }
  }

  getSpec = (): SpecFile[] => {
    const specs: SpecFile[] = [
      generateTokensSpec(this),
      generateRecipesSpec(this),
      generatePatternsSpec(this),
      generateConditionsSpec(this),
      generateKeyframesSpec(this),
      generateSemanticTokensSpec(this),
      generateMixinsSpec(this),
    ]

    const colorPaletteSpec = generateColorPaletteSpec(this)
    if (colorPaletteSpec) {
      specs.push(colorPaletteSpec)
    }

    const themesSpec = generateThemesSpec(this)
    if (themesSpec) {
      specs.push(themesSpec)
    }

    return specs
  }

  getSpecOfType = <T extends SpecType>(
    type: T,
  ): T extends 'color-palette' | 'themes' ? SpecTypeMap[T] | undefined : SpecTypeMap[T] => {
    const spec = (() => {
      switch (type) {
        case 'tokens':
          return generateTokensSpec(this)
        case 'semantic-tokens':
          return generateSemanticTokensSpec(this)
        case 'recipes':
          return generateRecipesSpec(this)
        case 'patterns':
          return generatePatternsSpec(this)
        case 'conditions':
          return generateConditionsSpec(this)
        case 'keyframes':
          return generateKeyframesSpec(this)
        case 'mixins':
          return generateMixinsSpec(this)
        case 'color-palette':
          return generateColorPaletteSpec(this) ?? undefined
        case 'themes':
          return generateThemesSpec(this) ?? undefined
      }
    })()
    return spec as T extends 'color-palette' | 'themes' ? SpecTypeMap[T] | undefined : SpecTypeMap[T]
  }
}
