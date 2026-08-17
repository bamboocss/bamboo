import postcss, { type Root } from 'postcss'
import { describe, expect, test } from 'vitest'
import { Builder } from '../src/builder'

/**
 * `isValidRoot` reads only the `@layer` statement, and that statement is ordinary css —
 * listing every layer in order is what a project has to write once it has layers of its own
 * beside bamboo's. So a file that both imports `styles.css` and declares the order satisfies
 * the guard while already holding the sheet, and `write` appending gave it a second copy on
 * every build.
 *
 * It hid well. Vite puts `postcss-import` at the front of the chain, so the artifact is
 * inlined before any plugin runs; then a minifier merges the two `@layer X{}` blocks and
 * dedupes most of the collision, leaving a fraction behind — 11% of one production
 * stylesheet, which reads as a rounding error rather than as the whole sheet twice.
 */

const LAYER_STATEMENT = '@layer reset, base, tokens, recipes, utilities, overrides, syntaxHighlighter;'

/** Whatever `write` emits carries the sentinel, so a generated copy is recognisable. */
const GENERATED = `@layer base{:root{--made-with-bamboo:'🎋'}}@layer utilities{.fromArtifact{color:red}}`

let generation = 0

/** Stand in for a resolved context, so this exercises `write` rather than a whole build. */
const stubContext = () => ({
  createSheet: () => ({}),
  appendBaselineCss: () => {},
  pruneTokens: () => {},
  pruneKeyframes: () => {},
  // Pruning off explicitly: this exercises `write`, and the token pass would want a real
  // source tree. It used to be skipped because an absent `prune` read as falsy here, which
  // was an accident of the old boolean rather than the documented default.
  config: { prune: { tokens: false } },
  isValidLayerParams: (params: string) => {
    const names = new Set(params.split(',').map((n) => n.trim()))
    return names.size >= 5 && ['reset', 'base', 'tokens', 'recipes', 'utilities'].every((n) => names.has(n))
  },
  // Distinguishable per call, so a second copy is visible rather than merely doubling a count.
  getCss: () => `@layer base{:root{--made-with-bamboo:'🎋'}}@layer utilities{.gen${generation++}{color:blue}}`,
})

const write = (root: Root) => {
  const builder = new Builder()
  builder.context = stubContext() as any
  builder.write(root)
}

const sentinels = (css: string) => (css.match(/--made-with-bamboo/g) ?? []).length

describe('builder.write', () => {
  /** The reported shape: `postcss-import` inlined the artifact, then the order is declared. */
  test('injects nothing when the artifact is already imported', () => {
    const root = postcss.parse(`${GENERATED}\n${LAYER_STATEMENT}`)

    write(root)

    expect(sentinels(root.toString())).toBe(1)
    expect(root.toString()).not.toContain('.gen')
    expect(root.toString()).toContain('.fromArtifact')
  })

  test('still injects into a file that only declares the layers', () => {
    const root = postcss.parse(`${LAYER_STATEMENT}\n.app{color:red}`)

    write(root)

    expect(sentinels(root.toString())).toBe(1)
    expect(root.toString()).toContain('.gen')
    expect(root.toString()).toContain('.app{color:red}')
  })

  /**
   * The sentinel is a declaration rather than a comment for this reason: the copy already in
   * the root may have been minified before this runs, and comments do not survive that.
   */
  test('recognises a generated copy that has been minified', () => {
    const root = postcss.parse(`${GENERATED.replace(/\s+/g, '')}${LAYER_STATEMENT}`)

    write(root)

    expect(root.toString()).not.toContain('.gen')
  })

  /** A second pass over one root — a plugin registered twice — is the same problem. */
  test('does not accumulate when the same root is written twice', () => {
    const root = postcss.parse(`${LAYER_STATEMENT}\n.app{color:red}`)

    write(root)
    const once = root.toString()
    write(root)

    expect(root.toString()).toBe(once)
    expect(sentinels(root.toString())).toBe(1)
  })
})
