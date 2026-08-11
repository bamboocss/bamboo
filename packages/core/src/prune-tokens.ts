import { cssVarRefs } from '@bamboocss/shared'
import type { Container } from 'postcss'

interface PruneOptions {
  /**
   * Everything that can reference a token: the utility, recipe, reset, base and
   * composition layers, and the token layer itself.
   *
   * These are the layer containers rather than the assembled root, because assembling it
   * is not idempotent — `Layers.insert` appends each layer to the root and
   * `getLayerRoot('recipes')` prepends the recipe base — and serialization runs after us.
   */
  scan: Container[]
  /** The token layer, the only place declarations are removed from. */
  target: Container
  /**
   * Every custom property the token system declares. Nothing outside this set is ever
   * removed, so custom properties emitted by `globalCss` — the filter and gradient
   * composition defaults in `preset-base`, for instance — are left alone. Those are
   * declared on the universal selector to stop values inheriting into descendants, so
   * dropping them changes rendering even though nothing appears to reference them.
   */
  tokenVars: Set<string>
  /**
   * Custom properties to keep regardless of what the css references, covering what this
   * pass cannot see: `token()` and `token.value()` calls, hand-written `var()` in source
   * files, and tokens whose own value is a var reference.
   */
  keep?: Set<string>
  /**
   * Every custom property a configured utility registers with `@property`, and the layer
   * those registrations are emitted into.
   *
   * Registrations are derived from the config rather than from what a project uses, so a
   * preset's whole set ships whether or not the app draws a gradient — on the projects in
   * this repo that is 93-100% of them. They are removed by the same reachability the token
   * declarations use, and for the same reason: a registration exists to stop a value
   * inheriting, so one for a property nothing declares or reads has nothing to contain.
   *
   * Deliberately not gated on which utility a project uses. A var is often registered by
   * one utility and composed by several others — `--gradient-stops` is declared on
   * `backgroundGradient` and read by `bgLinear`, `bgRadial`, `bgConic` and `textGradient` —
   * so usage of the declaring utility is the wrong question. What appears in the finished
   * stylesheet is the right one.
   */
  registeredProperties?: Set<string>
  /** The layer holding the `@property` rules, the only place registrations are removed from. */
  propertyTarget?: Container
}

/**
 * Remove token custom properties that nothing can reach.
 *
 * Only ever run this over a complete stylesheet. A partial one — `cssgen tokens`, or the
 * baseline the PostCSS plugin emits — carries no utilities to reference anything, so
 * every token would look unused.
 */
export function pruneTokenVars(options: PruneOptions) {
  const { scan, target, tokenVars, keep, registeredProperties, propertyTarget } = options
  // Registrations are pruned by the same walk, so a theme declaring no tokens at all still
  // gets them considered rather than falling out here.
  //
  // `reachable` is undefined rather than empty on this path, so a caller can tell "nothing
  // was reachable" from "no walk ran". `pruneKeyframes` has to: an empty set reads as
  // "every custom property is unreachable" and would strand a keyframe behind a declaration
  // that ships.
  if (!tokenVars.size && !registeredProperties?.size) {
    return { reachable: undefined, removed: 0, removedProperties: 0, kept: 0 }
  }

  // References found in a normal declaration reach their token directly. References found
  // in the value of a custom property only reach it if that property is itself reachable,
  // so they are held back for the closure below — counting them up front would make every
  // chained token look used.
  const direct = new Set<string>()
  const byDeclaration = new Map<string, Set<string>>()
  /**
   * Custom properties this pass will never remove, because they are not the token system's
   * to remove — so whatever they reference has to survive alongside them.
   *
   * The rule is simply that a declaration which ships must not be left pointing at a
   * definition that does not. `globalCss`/`globalVars` declaring `--brand: token(colors.blue.500)`
   * is the shape that stranded one: nothing inside the stylesheet references `--brand` —
   * exporting a value for something outside it to read is the whole point of declaring it —
   * so the colour behind it looked unreachable and was removed.
   *
   * That left a `var()` with no declaration behind it, which resolves to the
   * guaranteed-invalid value, so a colour falls back to *inherited* rather than to nothing.
   * Silently wrong, which is worse than visibly missing.
   *
   * A `colorPalette` rule is the other shape that reaches here — its properties are virtual
   * and so absent from `tokenVars` — but it was already safe, because the palette's targets
   * are pinned by `getAlwaysKeptTokenVars`. Rooting it here is the same guarantee arrived at
   * without depending on that.
   */
  const surviving = new Set<string>()

  for (const container of scan) {
    container.walkDecls((decl) => {
      const isCustomProperty = decl.prop.startsWith('--')
      if (isCustomProperty && !tokenVars.has(decl.prop)) surviving.add(decl.prop)

      for (const name of cssVarRefs(decl.value)) {
        if (!isCustomProperty) {
          direct.add(name)
          continue
        }

        let refs = byDeclaration.get(decl.prop)
        if (!refs) byDeclaration.set(decl.prop, (refs = new Set()))
        refs.add(name)
      }
    })
  }

  const reachable = new Set<string>()
  const queue: string[] = []

  // Traversal follows any custom property, not only the ones eligible for removal. A
  // colour palette is the case that forces this: `colorPalette: 'red'` emits
  // `--colors-color-palette-300: var(--colors-red-300)`, and those palette properties are
  // virtual, so they are absent from `tokenVars`. Stopping at them would leave the real
  // colours looking unreferenced while the rule pointing at them survives.
  const visit = (name: string) => {
    if (reachable.has(name)) return
    reachable.add(name)
    queue.push(name)
  }

  direct.forEach(visit)
  keep?.forEach(visit)
  surviving.forEach(visit)

  while (queue.length) {
    byDeclaration.get(queue.pop()!)?.forEach(visit)
  }

  let removed = 0
  let removedProperties = 0

  target.walkDecls((decl) => {
    if (!tokenVars.has(decl.prop) || reachable.has(decl.prop)) return
    // A keyframe step can declare a custom property in order to animate it. Removing one
    // there changes the animation rather than dropping a definition.
    if (isInsideKeyframes(decl)) return

    decl.remove()
    removed++
  })

  // An `@property` for a name the sheet neither declares nor reads. Its params are not a
  // declaration, so a registration never roots itself — which is what makes this decidable
  // at all. Only the ones a utility registered are eligible: a user's own, declared through
  // `globalVars`, is theirs to keep, exactly as `tokenVars` bounds the removals above.
  if (registeredProperties?.size) {
    propertyTarget?.walkAtRules('property', (rule) => {
      const name = rule.params.trim()
      if (!registeredProperties.has(name) || reachable.has(name)) return

      rule.remove()
      removedProperties++
    })
  }

  // Rules and conditional at-rules left holding nothing after the removals. Keyframes are
  // exempt: an empty one is still a valid, referenceable animation.
  target.walkRules((rule) => {
    if (!rule.nodes?.length && !isInsideKeyframes(rule)) rule.remove()
  })

  target.walkAtRules((rule) => {
    if (rule.name.endsWith('keyframes')) return
    if (!rule.nodes?.length) rule.remove()
  })

  // `reachable` itself, not just its size. It is the answer to "which custom properties
  // survive into the shipped stylesheet", and `pruneKeyframes` asks the same question of the
  // same sheet a moment later — recomputing it there from the css alone gives a *weaker*
  // answer, because the roots that live outside the css (`keep`, `surviving`) are not
  // visible in it. That disagreement is what shipped `--animations-x: slide-in 400ms` with
  // its `@keyframes` deleted.
  return { reachable: reachable as Set<string> | undefined, removed, removedProperties, kept: reachable.size }
}

function isInsideKeyframes(node: { parent?: unknown } | undefined): boolean {
  let current = node?.parent as any
  while (current) {
    if (current.type === 'atrule' && String(current.name).endsWith('keyframes')) return true
    current = current.parent
  }
  return false
}
