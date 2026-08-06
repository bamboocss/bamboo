import { createCss, createMergeCss } from '@bamboocss/shared'
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

export interface NamingDisagreement {
  mode: 'atomic' | 'grouped'
  /** What the stylesheet emitted a rule for. */
  build: string[]
  /** What `css()` returns in the browser. */
  runtime: string[]
}

type NamingContext = Pick<Context, 'config' | 'conditions' | 'utility' | 'hash' | 'encoder' | 'decoder'>

/**
 * Whether the stylesheet names a class the runtime will actually ask for.
 *
 * A class name is derived twice — once by `StyleDecoder` on the way into the stylesheet,
 * once by `createCss` in the browser — and the two only ever meet in the DOM. When they
 * disagree there is no error and no warning: the rule is emitted, the class is returned,
 * and every element carrying it renders with no styles at all. That is how
 * `cssMode: 'grouped'` combined with `hash: true` shipped broken.
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
  // Template-literal syntax builds its runtime from a different generator, which never
  // passes `grouped` through. Comparing against the object-syntax runtime would report a
  // disagreement that does not exist in the artifact that ships.
  if (ctx.config.syntax === 'template-literal') return

  const grouped = ctx.config.cssMode === 'grouped'

  const cssContext = {
    grouped,
    hash: Boolean(ctx.hash.className),
    conditions: {
      shift: ctx.conditions.shift,
      finalize: ctx.conditions.finalize,
      breakpoints: { keys: ctx.conditions.breakpoints.keys },
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
  const scope = encoder.withScope(() => (grouped ? encoder.processGrouped(canary) : encoder.processAtomic(canary)))
  decoder.collect(encoder)

  // The decoder escapes for a CSS selector (`hover\:c_blue`); the runtime emits what
  // belongs in a `class` attribute (`hover:c_blue`). That asymmetry is intended — see
  // `@bamboocss/vite`'s `runtime-css` — so it is undone here rather than reported.
  const build = decoder
    .filterClassNames(scope)
    .map((className) => className.replaceAll('\\', ''))
    .sort()

  if (build.length === runtime.length && build.every((name, index) => name === runtime[index])) {
    return
  }

  return { mode: grouped ? 'grouped' : 'atomic', build, runtime }
}

/** A message naming what disagreed, for a caller that wants to fail the build. */
export function formatNamingDisagreement(result: NamingDisagreement) {
  return [
    `The stylesheet and the runtime disagree on class names under \`cssMode: '${result.mode}'\`.`,
    `Every element styled this way would render with no styles at all.`,
    ``,
    `  stylesheet emits rules for: ${result.build.join(' ') || '(none)'}`,
    `  css() returns:              ${result.runtime.join(' ') || '(none)'}`,
    ``,
    `This is a bug in bamboo, not in your config. Please report it with the`,
    `\`cssMode\`, \`hash\`, \`prefix\`, \`separator\` and \`utility:created\` values you use.`,
  ].join('\n')
}
