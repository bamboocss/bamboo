import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { bamboocssCss, VIRTUAL_CSS_ID } from '../src/css'

/**
 * The css plugin is the integration: without it nothing emits a stylesheet and every class
 * the generated runtime returns names a rule that does not exist. So these assert that a
 * real config produces real css through the virtual module, not merely that the hooks are
 * shaped correctly.
 *
 * `sandbox/codegen` is used because it carries a real bamboo config and real source.
 */
const cwd = join(dirname(fileURLToPath(import.meta.url)), '../../../sandbox/codegen')

const hookOf = <T>(hook: T | { handler: T } | undefined): T | undefined =>
  typeof hook === 'function' ? hook : (hook as { handler: T } | undefined)?.handler

const load = async (id: string) => {
  const plugin = bamboocssCss({ cwd })
  const resolved = hookOf(plugin.resolveId)!.call({} as never, id, undefined, {} as never)
  if (typeof resolved !== 'string') return null

  const watched: string[] = []
  const ctx = { addWatchFile: (file: string) => watched.push(file) }
  const css = await hookOf(plugin.load)!.call(ctx as never, resolved, undefined as never)

  return { css: typeof css === 'string' ? css : (css as { code: string })?.code, watched }
}

describe('the virtual stylesheet', () => {
  test('resolves only its own id', () => {
    const plugin = bamboocssCss({ cwd })
    const resolve = hookOf(plugin.resolveId)!

    expect(resolve.call({} as never, VIRTUAL_CSS_ID, undefined, {} as never)).toBe(`\0${VIRTUAL_CSS_ID}`)
    // Anything else belongs to another plugin, including a real file that happens to be css.
    expect(resolve.call({} as never, './app.css', undefined, {} as never)).toBeNull()
    expect(resolve.call({} as never, 'styled-system/styles.css', undefined, {} as never)).toBeNull()
  })

  test('emits a stylesheet the runtime can match against', async () => {
    const result = await load(VIRTUAL_CSS_ID)

    expect(result).not.toBeNull()
    const css = result!.css

    // The layer statement is what orders bamboo against a project's own css, and the
    // sentinel is what every other integration uses to recognise a generated sheet.
    expect(css).toContain('@layer reset, base, tokens, recipes, utilities')
    expect(css).toContain('--made-with-bamboo')
    // Real utilities, from the sandbox's real source rather than from a fixture.
    expect(css).toMatch(/@layer utilities\{/)
    expect(css.length).toBeGreaterThan(1000)
  }, 60_000)

  test('registers the extracted files, so an edit invalidates the sheet', async () => {
    const result = await load(VIRTUAL_CSS_ID)

    // `vite build --watch` rebuilds a module only when something it declared as a
    // dependency changes. Without this the stylesheet would be generated once and then
    // stay stale for the rest of the session.
    expect(result!.watched.length).toBeGreaterThan(0)
    expect(result!.watched.some((file) => file.endsWith('.tsx'))).toBe(true)
  }, 60_000)
})
