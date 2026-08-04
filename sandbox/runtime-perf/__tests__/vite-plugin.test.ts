import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import bamboocss from '@bamboocss/vite'
import { build, type Rollup } from 'vite'
import { describe, expect, test } from 'vitest'

/**
 * The plugin driven by a real Vite build, rather than by calling its hooks directly.
 *
 * The fold engine is covered thoroughly on its own, but everything between it and Vite
 * was only asserted at the contract boundary: that `transform` is opt-in, that `apply`
 * is `build`, that the id filter rejects assets. None of that shows the plugin actually
 * loads a config, reaches the fold, and puts the result in the bundle — which is the
 * part a user experiences.
 */
const here = dirname(fileURLToPath(import.meta.url))
const cwd = join(here, '..')

const bundle = async (options: Parameters<typeof bamboocss>[0]) => {
  const result = (await build({
    root: cwd,
    logLevel: 'silent',
    plugins: [bamboocss({ cwd, ...options })],
    build: {
      write: false,
      minify: false,
      lib: { entry: join(here, '../src/parity/tree.tsx'), formats: ['es'], fileName: 'tree' },
      rollupOptions: { external: [/^react/, /styled-system/] },
    },
  })) as Rollup.RollupOutput[]

  return result[0]!.output.map((chunk) => ('code' in chunk ? chunk.code : '')).join('\n')
}

describe('vite plugin, real build', () => {
  test('folds through an actual build when enabled', async () => {
    const code = await bundle({ transform: true })

    // A folded class string, produced by the fold and carried into the bundle.
    expect(code).toContain('c_blue600')
    // The factory element it replaced is gone.
    expect(code).not.toContain('styled.span')
  }, 60_000)

  test('leaves the bundle alone when the transform is off', async () => {
    const code = await bundle({})

    // Still the factory call, so nothing folded.
    expect(code).toContain('styled')
    expect(code).not.toContain('c_blue600')
  }, 60_000)

  /**
   * Each declining shape is named individually, because a fold that corrupts one of them
   * corrupts it in a way only that shape shows. Matching loosely — any `rest` anywhere in
   * the bundle — passes just as well when the element it was meant to describe has been
   * rewritten into a div.
   */
  test('declining shapes survive a real build', async () => {
    const code = await bundle({ transform: true })

    // Still routed through the factory, with the prop that made each one decline.
    expect(code).toContain('styled.div, { color: tone')
    expect(code).toContain('...rest')
    expect(code).toContain('css: { color: "gray600" }')

    // And the dynamic pattern element is still the pattern component.
    expect(code).toContain('Stack, { gap: tone')

    // The dynamic call site keeps its runtime call while the static one beside it folded.
    expect(code).toContain('css({ color: tone })')
  }, 60_000)
})
