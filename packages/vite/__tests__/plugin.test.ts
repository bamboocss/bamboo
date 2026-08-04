import { describe, expect, test } from 'vitest'
import { bamboocss } from '../src/plugin'

/**
 * The plugin wrapper, separate from the fold itself.
 *
 * These assert the contract a user relies on before any config is even loaded: that
 * the transform is opt-in, that it is build-only, and that it does not reach for a
 * bamboo config when it has nothing to do. A regression in any of those would either
 * silently rewrite code nobody asked to rewrite, or make every Vite project pay for
 * config resolution it does not need.
 */
const callTransform = async (plugin: ReturnType<typeof bamboocss>, code: string, id: string) => {
  const hook = plugin.transform
  const handler = typeof hook === 'function' ? hook : hook?.handler
  if (!handler) throw new Error('plugin has no transform hook')
  return handler.call({} as never, code, id, {} as never)
}

const SOURCE = `import { css } from 'styled-system/css'\nexport const cls = css({ color: 'red.300' })\n`

describe('plugin contract', () => {
  test('is named and runs before other plugins', () => {
    const plugin = bamboocss()

    expect(plugin.name).toBe('bamboocss')
    // Runs `pre` so it sees module source as close as possible to what the CSS
    // extractor reads off disk.
    expect(plugin.enforce).toBe('pre')
  })

  test('applies to build only', () => {
    expect(bamboocss().apply).toBe('build')
    expect(bamboocss({ transform: true }).apply).toBe('build')
  })

  test('transform is off by default', async () => {
    const plugin = bamboocss()

    // No config is loaded and nothing is rewritten. If this ever returned a result it
    // would mean opting in was no longer required.
    await expect(callTransform(plugin, SOURCE, '/app/src/a.tsx')).resolves.toBeNull()
  })

  test('buildStart does not load config when the transform is off', async () => {
    const plugin = bamboocss()
    const hook = plugin.buildStart
    const handler = typeof hook === 'function' ? hook : hook?.handler

    // Would throw trying to resolve a bamboo config if it did any work.
    await expect(handler?.call({} as never, {} as never)).resolves.toBeUndefined()
  })
})

describe('file filtering', () => {
  const ignored = [
    '/app/node_modules/pkg/index.js',
    '/app/src/styles.css',
    '/app/src/logo.svg',
    '/app/index.html',
    '/app/src/data.json',
  ]

  test.each(ignored)('%s is not transformed even when enabled', async (id) => {
    const plugin = bamboocss({ transform: true })

    // Returns before touching the context, so no config resolution is attempted.
    await expect(callTransform(plugin, SOURCE, id)).resolves.toBeNull()
  })
})
