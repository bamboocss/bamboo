import { toHash } from './hash'
import { withoutSpace } from './important'

/**
 * The fields that decide what CSS a recipe produces. Anything else is metadata.
 *
 * `slots` and `scopeRoots` count. They do not change a declaration, but they change the
 * *shape* of what is emitted — which slots exist, and whether a slot's variants become
 * `@scope` rules or a class of its own. Two `sva`s differing only in `scopeRoots` hashed to
 * one name, and since an inline recipe is registered once, whichever was extracted first
 * decided the emission for both; the other's runtime then asked for classes no rule
 * existed under. "Same styles, different DOM topology" is exactly what `scopeRoots` is for,
 * so it is the collision most likely to happen.
 */
const STYLE_FIELDS = ['base', 'variants', 'compoundVariants', 'defaultVariants', 'slots', 'scopeRoots'] as const

/**
 * A serialization that depends on the config's *content* and not on how it was written.
 *
 * Object keys are sorted, so reordering two variants in the source does not rename every
 * class the recipe emits. Arrays keep their order, because `compoundVariants` is precedence
 * ordered and two orderings are two different recipes.
 *
 * A function serializes to `null` rather than to its source. `JSON.stringify` already drops
 * them, and stringifying instead would key the name on whether the bundle was minified —
 * the same build-dependent divergence that `cx` was changed to avoid. Nothing that survives
 * static extraction is a function, so there is no real config this loses information about.
 */
/**
 * Runs of whitespace inside a declaration value, collapsed to one space.
 *
 * The build never sees the value as written. `maybe-box-node` reads every string literal
 * through `trimWhitespace`, so `'calc(100vh -  16px)'` is `'calc(100vh - 16px)'` by the time
 * a recipe config reaches the encoder — the two produce identical CSS, and the stylesheet
 * emits one rule for both.
 *
 * The browser holds the config as authored. Without this, the two sides hashed different
 * objects and derived different names, so the element asked for a class the stylesheet did
 * not carry and rendered with *none* of the recipe's styles. Silent, and invisible to a
 * dead-rule check: the extra name leaves no unused rule behind, because the collapsed config
 * is byte-identical to one that was already emitted.
 *
 * The regex is `trimWhitespace`'s, deliberately. A second spelling of "the same value" is a
 * second thing to keep in agreement, which is the defect this is fixing.
 */
const collapseWhitespace = (value: string) => value.replaceAll(/\s+/g, ' ')

const stable = (value: unknown): string => {
  if (typeof value === 'string') return JSON.stringify(collapseWhitespace(value))
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const source = value as Record<string, unknown>
  return `{${Object.keys(source)
    .sort()
    // A declaration with no value is not a declaration. Extraction drops it before the
    // config reaches the encoder — `{ color: undefined, padding: '4' }` is recorded as
    // `{ padding: '4' }` — so keeping it here made the browser hash an object the build
    // never had, and the element asked for a class the stylesheet did not carry. Same
    // divergence as the whitespace above, reached by writing a placeholder or spreading an
    // object that happens to hold one.
    .filter((key) => source[key] !== undefined && source[key] !== null)
    .map((key) => `${JSON.stringify(key)}:${stable(source[key])}`)
    .join(',')}}`
}

export interface RecipeIdentityConfig {
  className?: string
  slots?: unknown
  scopeRoots?: unknown
  base?: unknown
  variants?: unknown
  compoundVariants?: unknown
  defaultVariants?: unknown
}

/**
 * The name an inline `cva`/`sva` emits its classes under — `button--size_sm`, where this
 * returns the `button`.
 *
 * A config recipe gets its name from the key it is declared under. An inline one has no
 * such key, and the two places that need the name never meet: the build derives it while
 * emitting the stylesheet, the runtime derives it again in the browser. So it has to come
 * from something both of them see, which leaves the config object itself.
 *
 * Deriving it from the *binding* — `const button = cva(...)` — was the obvious alternative
 * and does not work. Only the build can see that binding; handing it to the runtime means
 * rewriting the call, and then a pipeline without that transform names classes differently
 * from one with it. An optional `className` gets the same readable output with none of
 * that, because it travels inside the config to both sides.
 *
 * `className` is the field a config recipe already names itself with, and it means the same
 * thing here — the prefix every class the recipe emits is built from. An inline recipe that
 * declares one is indistinguishable in the stylesheet from a recipe declared in config.
 */
export const getRecipeIdentity = (config: RecipeIdentityConfig | undefined, prefix = 'cva'): string => {
  const declared = config?.className
  if (typeof declared === 'string' && declared) return declared

  const styles: Record<string, unknown> = {}
  for (const field of STYLE_FIELDS) {
    const value = config?.[field]
    if (value !== undefined) styles[field] = value
  }

  return `${prefix}_${toHash(stable(styles))}`
}

/**
 * The classes a recipe puts on an element: its own, plus one per selected variant.
 *
 * Lives here rather than in the generated `cva` because the build has to be able to check
 * it. `checkNamingAgreement` derives class names both ways and compares them, and it can
 * only do that against the code the browser actually runs — a second implementation written
 * to match would agree with itself and prove nothing.
 *
 * Compound variants are absent by design. Their rule selects on the variant classes already
 * in this list, so it applies without a class of its own.
 */
export const getRecipeClassNames = (
  name: string,
  variants: Record<string, Record<string, unknown>> | undefined,
  selection: Record<string, unknown>,
  separator = '_',
  /**
   * Prefix and hashing, as `createCss` would apply them. Passed in rather than reimplemented
   * because a recipe's classes go through the same `hash.className` and `prefix` as any
   * other, and a second implementation of that is a second thing to keep in agreement.
   */
  format: (className: string) => string = (className) => className,
): string => {
  let result = format(name)

  for (const variant of Object.keys(variants ?? {})) {
    const value = selection[variant]
    if (value == null) continue

    // Looked up raw, named with `withoutSpace`. The config declares `'x large'`, so the
    // lookup has to use that, while the class it produces cannot contain a space.
    if (variants?.[variant]?.[value as string] == null) continue

    result += ` ${format(`${name}--${variant}${separator}${withoutSpace(value as string)}`)}`
  }

  return result
}
