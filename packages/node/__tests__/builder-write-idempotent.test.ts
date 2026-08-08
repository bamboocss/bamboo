import postcss, { type Root } from 'postcss'
import { describe, expect, test } from 'vitest'
import { Builder } from '../src/builder'

/**
 * `write` appends, and what it appends carries the `@layer` declaration that `isValidRoot`
 * looks for — so the guard deciding whether to inject is satisfied by the result of
 * injecting. A root that reaches `write` twice, which a duplicated plugin registration or a
 * chain that re-processes the emitted css both do, used to accumulate a full copy each time.
 * Nothing downstream took them apart: each copy is internally consistent and only duplicated
 * against the other, which is how a production stylesheet came to carry 402 identical rules.
 */

const ENTRY = `@layer reset, base, tokens, recipes, utilities;\n.app{color:red}`

let generation = 0

/** Stand in for a resolved context, so this exercises `write` rather than a whole build. */
const stubContext = () => {
  return {
    createSheet: () => ({}),
    appendBaselineCss: () => {},
    pruneTokens: () => {},
    pruneKeyframes: () => {},
    config: {},
    // Distinguishable per call, so an accumulated copy is visible rather than merely doubled.
    getCss: () => `@layer utilities{.gen${generation++}{color:blue}}`,
  }
}

const write = (root: Root) => {
  const builder = new Builder()
  builder.context = stubContext() as any
  builder.write(root)
}

const countRules = (css: string) => (css.match(/\{/g) ?? []).length

describe('builder.write', () => {
  test('replaces its previous injection rather than adding to it', () => {
    const root = postcss.parse(ENTRY)

    write(root)
    const once = root.toString()

    write(root)
    const twice = root.toString()

    expect(countRules(twice)).toBe(countRules(once))
    // The second pass's css is what survives; the first pass's is gone.
    expect(twice).toContain('.gen1')
    expect(twice).not.toContain('.gen0')
  })

  test('keeps the user css that was there before', () => {
    const root = postcss.parse(ENTRY)

    write(root)
    write(root)

    expect(root.toString()).toContain('.app{color:red}')
    expect(root.toString()).toContain('@layer reset, base, tokens, recipes, utilities;')
  })

  /**
   * The markers bound the removal, so a plugin that appended after the injection keeps its
   * nodes. Running to the end of the root instead would eat them.
   */
  test('leaves anything appended after the injection alone', () => {
    const root = postcss.parse(ENTRY)

    write(root)
    root.append('.appended{color:green}')
    write(root)

    expect(root.toString()).toContain('.appended{color:green}')
  })

  /**
   * A start marker with no end is the shape an uneven comment strip leaves behind. Removing
   * nothing is the safe direction: a duplicate costs bytes, dropping a user's css does not
   * fail loudly.
   */
  test('removes nothing when the end marker is missing', () => {
    const root = postcss.parse(ENTRY)
    write(root)
    root.walkComments((c) => {
      if (c.text === 'bamboocss:end') c.remove()
    })
    const before = root.toString()

    write(root)

    expect(root.toString()).toContain(before.replace(/\s+$/, ''))
  })
})
