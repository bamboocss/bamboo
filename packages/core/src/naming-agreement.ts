import { createCss, createMergeCss, getRecipeClassNames, getRecipeIdentity, toHash } from '@bamboocss/shared'
import type { Context } from './context'

/**
 * A style object that touches every part of the naming contract at once: a plain
 * declaration, a shorthand that only collides after normalization, and — when the config
 * registers one — a conditional declaration.
 *
 * The condition has to come from the config rather than be hardcoded. An unregistered key
 * is filtered out of the hash by `getResolvedCondition` but kept by the runtime's
 * `conds.finalize`, so a config with no `_hover` would report a disagreement that is about
 * the key not existing rather than about naming. Values are otherwise free of anything
 * `esc` would touch, so the two sides compare directly.
 */
const CONDITION_CANDIDATES = ['_hover', '_focus', '_dark', '_disabled']

const buildCanary = (isCondition: (key: string) => boolean) => {
  const base: Record<string, unknown> = { color: 'red', paddingTop: '2' }
  const condition = CONDITION_CANDIDATES.find(isCondition)
  if (condition) base[condition] = { color: 'blue' }
  return base
}

/**
 * An inline recipe touching both halves of the recipe naming contract: a base, and a
 * variant whose value needs `withoutSpace` to become a class.
 *
 * `className` is deliberately absent, so this also exercises the hashed identity — the part
 * the build and the runtime each derive on their own.
 */
const RECIPE_CANARY = {
  base: { color: 'red' },
  // A compound too. Its selector is assembled from class names rather than produced by
  // `createCss`, which is exactly how it came to bypass `hash.className` and `prefix` — the
  // canary has to carry one or that half is unchecked.
  compoundVariants: [{ css: { fontWeight: 'bold' }, size: 'sm', tone: 'a' }],
  variants: {
    size: { 'x large': { paddingTop: '2' }, sm: { paddingTop: '1' } },
    tone: { a: { paddingBottom: '1' } },
  },
}

/**
 * A slot recipe with an anchor and a slot that is *not* the anchor.
 *
 * The non-anchor slot is the case that matters: its class is a constant the runtime returns
 * without ever passing it through `createCss`, while the stylesheet emits its rule through
 * `formatSelector`. Under `hash.className` or `prefix` those two disagreed, and every such
 * slot rendered unstyled with nothing reported.
 */
const SLOT_RECIPE_CANARY = {
  slots: ['root', 'control'],
  base: { root: { color: 'red' }, control: { paddingTop: '1' } },
  variants: { size: { sm: { control: { paddingTop: '2' } } } },
}

/**
 * The same recipe with `slots` left out, so the build has to infer them.
 *
 * The identity is hashed from the config, and only the build infers — so hashing anything
 * but the config as written gives the two sides different names and every slot renders
 * unstyled. This canary is the difference between that being caught and being shipped.
 */
const INFERRED_SLOT_CANARY = {
  base: { root: { color: 'red' }, control: { paddingTop: '1' } },
  variants: { size: { sm: { control: { paddingTop: '2' } } } },
}

export interface NamingDisagreement {
  /** Which derivation disagreed. */
  kind: 'css' | 'recipe' | 'slot-recipe'
  /** What the stylesheet emitted a rule for. */
  build: string[]
  /** What `css()` returns in the browser. */
  runtime: string[]
}

type NamingContext = Pick<Context, 'config' | 'conditions' | 'utility' | 'hash' | 'encoder' | 'decoder' | 'recipes'>

/** What `classFormatter` needs, which is less than a full naming check. */
export type ClassFormatterContext = Pick<Context, 'utility' | 'hash'>

/**
 * Whether the stylesheet names a class the runtime will actually ask for.
 *
 * A class name is derived twice — once by `StyleDecoder` on the way into the stylesheet,
 * once by `createCss` in the browser — and the two only ever meet in the DOM. When they
 * disagree there is no error and no warning: the rule is emitted, the class is returned,
 * and every element carrying it renders with no styles at all. That is how
 * a `hash: true` build once shipped broken.
 *
 * Tests can only pin the config matrix they enumerate, and the naming inputs are
 * open-ended — `utility:created` lets a config replace `toHash` outright, and `separator`,
 * `prefix` and custom utilities all feed the same derivation. So this runs against the
 * config actually being built, rather than trusting that some fixture resembles it.
 *
 * Runs on cloned encoder and decoder: the canary must not reach the stylesheet the caller
 * is about to emit.
 */
export function checkNamingAgreement(ctx: NamingContext): NamingDisagreement | undefined {
  const cssContext = {
    hash: Boolean(ctx.hash.className),
    conditions: {
      shift: ctx.conditions.shift,
      finalize: ctx.conditions.finalize,
    },
    utility: {
      prefix: ctx.utility.prefix,
      hasShorthand: ctx.utility.hasShorthand,
      resolveShorthand: ctx.utility.resolveShorthand.bind(ctx.utility),
      transform: ctx.utility.transform.bind(ctx.utility),
      toHash: ctx.utility.toHash.bind(ctx.utility),
    },
  }

  const canary = buildCanary(ctx.conditions.isCondition)

  const cssFn = createCss(cssContext as never)
  const { mergeCss } = createMergeCss(cssContext as never)
  const runtime = cssFn(mergeCss(canary)).split(' ').filter(Boolean).sort()

  const encoder = ctx.encoder.clone()
  const decoder = ctx.decoder.clone()
  const scope = encoder.withScope(() => encoder.processAtomic(canary))
  decoder.collect(encoder)

  // The decoder escapes for a CSS selector (`hover\:c_blue`); the runtime emits what
  // belongs in a `class` attribute (`hover:c_blue`). That asymmetry is intended — see
  // `@bamboocss/vite`'s `runtime-css` — so it is undone here rather than reported.
  const build = decoder
    .filterClassNames(scope)
    .map((className) => className.replaceAll('\\', ''))
    .sort()

  if (!(build.length === runtime.length && build.every((name, index) => name === runtime[index]))) {
    return { kind: 'css', build, runtime }
  }

  return (
    checkRecipeNamingAgreement(ctx) ??
    checkSlotRecipeNamingAgreement(ctx, SLOT_RECIPE_CANARY) ??
    checkSlotRecipeNamingAgreement(ctx, INFERRED_SLOT_CANARY)
  )
}

/**
 * The same check for an inline `sva`, whose non-anchor slots are constants rather than
 * `createCss` output — so they are the half most easily left unformatted.
 */
function checkSlotRecipeNamingAgreement(
  ctx: NamingContext,
  canary: Record<string, unknown>,
): NamingDisagreement | undefined {
  const name = getRecipeIdentity(canary, 'sva')
  const format = classFormatter(ctx)

  // What the generated `sva` returns for a non-anchor slot: the constant class, formatted.
  const runtime = [format(`${name}${ctx.recipes.slotSeparator}control`)].sort()

  const encoder = ctx.encoder.clone()
  const decoder = ctx.decoder.clone()
  const scope = encoder.withScope(() => encoder.processAtomicSlotRecipe(canary as never))
  decoder.collect(encoder)

  const wanted = new Set(runtime)
  const build = decoder
    .filterClassNames(scope)
    .map((className) => className.replaceAll('\\', ''))
    .filter((className) => wanted.has(className))
    .sort()

  if (build.length === runtime.length && build.every((className, index) => className === runtime[index])) {
    return
  }

  return { kind: 'slot-recipe', build, runtime }
}

/**
 * What `createCss` does to a recipe's class: prefix it, and hash it when `hash.className`
 * is set. Recipe selections carry no conditions — `assertCompoundVariant` rejects them —
 * so the condition half of `hashFn` is not in play.
 *
 * Exported because the fold derives the same names when it lowers a recipe call, and a
 * second implementation of prefixing and hashing is a second thing to keep in agreement.
 */
export const classFormatter = (ctx: ClassFormatterContext) => {
  const prefix = ctx.utility.prefix
  const withPrefix = (className: string) => (prefix ? (className ? `${prefix}-${className}` : prefix) : className)
  return ctx.hash.className ? (className: string) => withPrefix(ctx.utility.toHash([className], toHash)) : withPrefix
}

/**
 * The same check for an inline `cva`.
 *
 * Its classes are derived twice as well — `getRecipeIdentity` plus `getRecipeClassNames` in
 * the browser, the encoder and decoder on the way into the stylesheet — and they meet only
 * in the DOM. The failure mode is identical: rules emitted under one name, a class asked for
 * under another, and every element carrying it rendered unstyled with nothing reported.
 */
function checkRecipeNamingAgreement(ctx: NamingContext): NamingDisagreement | undefined {
  const name = getRecipeIdentity(RECIPE_CANARY)
  const selection = { size: 'x large' }

  const format = classFormatter(ctx)

  const runtime = getRecipeClassNames(name, RECIPE_CANARY.variants, selection, ctx.utility.separator, format)
    .split(' ')
    .filter(Boolean)
    .sort()

  const encoder = ctx.encoder.clone()
  const decoder = ctx.decoder.clone()
  const scope = encoder.withScope(() => encoder.processAtomicRecipe(RECIPE_CANARY))
  decoder.collect(encoder)

  // The build emits a rule for every variant value, since which one a call site selects is
  // not knowable; the runtime names only the selected one. Comparing the whole set against
  // one selection would report a disagreement that is really that difference, so this
  // narrows the build's side to the classes this selection asks for.
  const wanted = new Set(runtime)
  const build = decoder
    .filterClassNames(scope)
    .map((className) => className.replaceAll('\\', ''))
    .filter((className) => wanted.has(className))
    .sort()

  if (!(build.length === runtime.length && build.every((className, index) => className === runtime[index]))) {
    return { kind: 'recipe', build, runtime }
  }

  return checkCompoundNamingAgreement(ctx, name, format, decoder)
}

/**
 * A compound variant's rule, which selects on classes rather than carrying one.
 *
 * `.btn--size_sm.btn--tone_a` applies because the element already has both variant classes,
 * so the runtime adds nothing for it — and that is exactly why the comparison above cannot
 * see it. `filterClassNames` reads class names, a compound contributes none, and the build
 * side is then narrowed to the runtime's set, which removes any trace of one from both
 * sides. The canary has carried a `compoundVariants` entry all along, with a comment saying
 * the half it guards would otherwise go unchecked. That half was going unchecked.
 *
 * It matters because a compound's selector is assembled from class names instead of being
 * produced by `createCss`, which is how it came to skip `hash.className` and `prefix` once
 * already: rules emitted under `.btn--size_sm…` while the runtime asked for `.pfx-btn--size_sm`,
 * and every compound silently stopped applying.
 *
 * The selector is read off the rule's own result rather than from a `selector` field —
 * `getAtomic` folds it into the style object's key, so a compound is the rule whose key is
 * something other than its own class.
 */
function checkCompoundNamingAgreement(
  ctx: NamingContext,
  name: string,
  format: (className: string) => string,
  decoder: NamingContext['decoder'],
): NamingDisagreement | undefined {
  // The selection the canary's compound is declared for. Its rule exists whatever a call
  // site selects; this is what the runtime would put on an element that activates it.
  const selection = { size: 'sm', tone: 'a' }
  const runtime = getRecipeClassNames(name, RECIPE_CANARY.variants, selection, ctx.utility.separator, format)
    .split(' ')
    .filter(Boolean)

  const unescape = (value: string) => value.replaceAll('\\', '')

  for (const results of decoder.recipes.values()) {
    for (const result of results) {
      const [key] = Object.keys(result.result)
      if (!key) continue

      // Every other rule selects on its own class. A compound is the one that does not.
      const selector = unescape(key)
      if (selector === `.${unescape(result.className)}`) continue

      const parts = selector.split('.').filter(Boolean)
      const build = parts.slice().sort()
      if (parts.every((className) => runtime.includes(className))) continue

      return { kind: 'recipe', build, runtime: runtime.slice().sort() }
    }
  }

  return
}

/** A message naming what disagreed, for a caller that wants to fail the build. */
export function formatNamingDisagreement(result: NamingDisagreement) {
  const asks = result.kind === 'recipe' ? 'cva() returns:  ' : 'css() returns:  '

  return [
    `The stylesheet and the runtime disagree on ${result.kind === 'recipe' ? 'recipe ' : ''}class names.`,
    `Every element styled this way would render with no styles at all.`,
    ``,
    `  stylesheet emits: ${result.build.join(' ') || '(none)'}`,
    `  ${asks}${result.runtime.join(' ') || '(none)'}`,
    ``,
    `This is a bug in bamboo, not in your config. Please report it with the`,
    `\`hash\`, \`prefix\`, \`separator\` and \`utility:created\` values you use.`,
  ].join('\n')
}
