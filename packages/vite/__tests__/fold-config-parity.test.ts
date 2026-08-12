import { describe, expect, test } from 'vitest'
import type { Config } from '@bamboocss/types'
import { createFoldFixture, selectorsFor } from './fixture'

/**
 * A folded class has to be a class the stylesheet carries, under every option that changes
 * how a class is named.
 *
 * Three things derive these names independently: the decoder that writes the stylesheet, the
 * generated runtime, and `runtime-css.ts`, which rebuilds `createCss` in-process for the fold.
 * They agree by construction only as long as each reads the same options — and that has failed
 * twice already, both times because a naming option reached one derivation and not another:
 * compound selectors ignored `hash` and `prefix`, and `groupClassName` re-hashed on the build
 * side alone. Both produced elements carrying a class with no rule behind it, which renders as
 * nothing and shows up in no test that only reads the emitted JavaScript.
 *
 * Before this file, `hash` appeared in one test and `prefix` in two, while `separator` appeared
 * in none. None covered the whole compiler-to-stylesheet naming agreement.
 *
 * ## What is actually independent here
 *
 * `foldSource` *uses* `runtimeCss` to name the class, so comparing its output back to
 * `runtimeCss` is close to circular: it catches the fold handing over the wrong style object,
 * which is worth catching, but it cannot tell you the name is right. The load-bearing assertion
 * is that the class appears as a rule in the stylesheet, because the stylesheet comes from the
 * decoder — a path the fold does not touch.
 */
const SHAPES: Array<{ name: string; styles: Record<string, unknown> }> = [
  { name: 'dotted token', styles: { color: 'red.300' } },
  { name: 'two declarations', styles: { color: 'red.300', padding: '4' } },
  { name: 'condition', styles: { _hover: { color: 'blue.500' } } },
  { name: 'breakpoint', styles: { md: { padding: '4' } } },
  { name: 'nested conditions', styles: { _hover: { _focus: { color: 'red.300' } } } },
  { name: 'important', styles: { color: 'red.300!' } },
  { name: 'negative value', styles: { marginTop: '-4' } },
  { name: 'arbitrary calc', styles: { width: '[calc(100%-2px)]' } },
  { name: 'arbitrary url', styles: { bg: '[url(/a/b.png)]' } },
  { name: 'arbitrary gradient', styles: { bg: '[linear-gradient(a,b)]' } },
  // Leads with a digit, so the selector needs a hex escape rather than a backslash before
  // the character — a different branch of `esc` from every other shape here.
  { name: 'numeric-leading arbitrary', styles: { gridArea: '[2col]' } },
]

/**
 * Every option that changes a class name, and the combinations where one could mask another.
 *
 * `separator` is included because it had no test at all, and it is the option most likely to
 * be added to a project late — a rename of every utility class in the codebase at once.
 */
const CONFIGS: Array<{ label: string; config: Config | undefined }> = [
  { label: 'default', config: undefined },
  { label: 'hash', config: { hash: true } },
  { label: 'prefix', config: { prefix: 'pfx' } },
  { label: 'separator =', config: { separator: '=' } },
  { label: 'separator -', config: { separator: '-' } },
  { label: 'hash + prefix', config: { hash: true, prefix: 'pfx' } },
  { label: 'prefix + separator', config: { prefix: 'pfx', separator: '=' } },
]

const sourceFor = (styles: Record<string, unknown>) =>
  `import { css } from 'styled-system/css'\nexport const x = css(${JSON.stringify(styles)})\n`

describe.each(CONFIGS)('fold parity under $label', ({ config }) => {
  test.each(SHAPES)('$name folds to a class the stylesheet carries', ({ styles }) => {
    const { fold, getCss, runtimeCss } = createFoldFixture(config as never)
    const result = fold(sourceFor(styles))

    // Not a soft check. Every shape here is a fully static call that folds under every option
    // today, so a decline is a real change in coverage and should be read rather than
    // absorbed: update this file deliberately if one becomes unfoldable on purpose.
    expect(result.folded, `declined: ${result.skipped.map((s) => s.reason).join(', ') || 'none'}`).toHaveLength(1)

    const [call] = result.folded
    const className = call!.className

    // The independent one: the stylesheet is written by the decoder, which the fold does not
    // go through. A naming option that reached the fold but not the decoder shows up here and
    // nowhere else.
    const css = getCss()
    for (const selector of selectorsFor(className)) {
      expect(css, `${selector} has no rule (class="${className}")`).toContain(selector)
    }

    // Weaker, and worth keeping anyway: it pins that the fold handed the runtime the style
    // object as written, rather than one it reassembled differently.
    expect(className).toBe(runtimeCss(styles))

    // The literal has to survive into the emitted module, not merely be computed.
    expect(result.code).toContain(JSON.stringify(className))
  })
})

/**
 * The same parity, for recipes. Vite resolves their selected declarations into the ordinary
 * utility atom pool, so this checks every naming option against those independently decoded
 * atom selectors. Recipe and slot identities must not appear in the result.
 *
 * Each of these folds under every config in the matrix; a decline is a coverage change to read
 * rather than absorb, exactly as above.
 */
const RECIPE_SHAPES: Array<{ name: string; expr: string }> = [
  { name: 'anchor slot, static variant', expr: `checkbox({ size: 'sm' }).root` },
  { name: 'constant slot of an anchored recipe', expr: `checkbox({ size: 'sm' }).control` },
  // The shape that broke: sibling slots, no `root`, so nothing anchors and every slot class
  // is built by the branch that used to format twice.
  { name: 'slot of an anchorless recipe', expr: `badge({ size: 'sm' }).title` },
  { name: 'plain recipe', expr: `buttonStyle({ size: 'sm' })` },
]

const recipeSourceFor = (expr: string) =>
  `import { checkbox, badge, buttonStyle } from '../styled-system/recipes'\nexport const x = ${expr}\n`

describe.each(CONFIGS)('recipe fold parity under $label', ({ config }) => {
  test.each(RECIPE_SHAPES)('$name folds to a class the stylesheet carries', ({ expr }) => {
    const { fold, getStyleSetCss } = createFoldFixture(config as never)
    const result = fold(recipeSourceFor(expr))

    expect(result.folded, `declined: ${result.skipped.map((s) => s.reason).join(', ') || 'none'}`).toHaveLength(1)

    const className = result.folded[0]!.className
    const css = getStyleSetCss()
    for (const selector of selectorsFor(className)) {
      // Bounded so one atom name cannot pass by being a prefix of another atom name.
      const hasRule = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(css)
      expect(hasRule, `${selector} has no rule (class="${className}")`).toBe(true)
    }

    expect(result.code).toContain(JSON.stringify(className))
  })
})

describe('naming options actually change the names', () => {
  /**
   * The matrix above compares each option against the stylesheet built under that same option,
   * so an option silently ignored by *both* sides would pass every case in it. This is the
   * guard for that: the names have to differ from the default.
   */
  const styles = { color: 'red.300', padding: '4' }

  test.each([
    { label: 'hash', config: { hash: true } as Config },
    { label: 'prefix', config: { prefix: 'pfx' } as Config },
    { label: 'separator =', config: { separator: '=' } as Config },
  ])('$label names classes differently from the default', ({ config }) => {
    const base = createFoldFixture().fold(sourceFor(styles))
    const varied = createFoldFixture(config as never).fold(sourceFor(styles))

    expect(base.folded).toHaveLength(1)
    expect(varied.folded).toHaveLength(1)
    expect(varied.folded[0]!.className).not.toBe(base.folded[0]!.className)
  })
})
