import { createGeneratorContext } from '@bamboocss/fixture'
import { logger } from '@bamboocss/logger'
import { describe, expect, test, vi } from 'vitest'

/**
 * `preflight.prune` against the reset the generator actually emits, rather than against a
 * hand-written stylesheet.
 *
 * The unit tests in `core` feed it selector strings, so all of them keep passing if
 * `generateResetCss` changes what it writes — which is how the scoped case came to be broken
 * in the first place. `preflight: { scope }` puts the scope on every selector, and nothing
 * that carries a scope names an element until the scope comes off, so the pass matched
 * nothing and removed nothing while reporting success.
 *
 * The assertion is parity on rules: a scope changes which selectors the reset is written
 * with, never which elements it is about, so every shape has to remove the same rules the
 * unscoped reset removes. That covers the shapes nobody thought to enumerate — a trimmed
 * scope, a selector list, an id, an attribute — without a case per shape.
 *
 * Parts are counted per scope alternative rather than per rule, because a scope that is a
 * list is distributed across the selector: `.a, .b` writes `.a table, .b table`, which really
 * is two parts to remove rather than one. Stating the multiplier keeps that visible instead
 * of letting a list quietly assert half as much.
 */
const prune = (preflight: object) => {
  const ctx: any = createGeneratorContext({ preflight: { ...preflight, prune: true } } as any)
  const sheet = ctx.createSheet()

  ctx.appendCssOfType('preflight', sheet)

  return ctx.prunePreflight(sheet, new Set(['div', 'span', 'table']))
}

describe('prunePreflight against the emitted reset', () => {
  const baseline = prune({})

  test('removes something to begin with, or the parity below proves nothing', () => {
    expect(baseline.removedRules).toBeGreaterThan(0)
    expect(baseline.removedParts).toBeGreaterThan(0)
  })

  test.each([
    ['class scope', { scope: '.app' }, 1],
    ['class scope, element level', { scope: '.app', level: 'element' }, 1],
    ['id scope', { scope: '#app' }, 1],
    ['id scope, element level', { scope: '#app', level: 'element' }, 1],
    ['attribute scope', { scope: '[data-app]' }, 1],
    ['compound scope', { scope: '.a.b' }, 1],
    // The config carries the string verbatim, so both of these reached `unscope` as written.
    ['scope with stray whitespace', { scope: ' .app ' }, 1],
    ['scope that is a selector list', { scope: '.a, .b' }, 2],
  ])('%s removes exactly what the unscoped reset removes', (_label, preflight, alternatives) => {
    const scoped = prune(preflight)

    expect(scoped.removedRules).toBe(baseline.removedRules)
    expect(scoped.removedParts).toBe(baseline.removedParts * alternatives)
  })
})

/**
 * The line the reader is meant to check.
 *
 * This pass is opt-in because being wrong is silent: an element rendered by a dependency, by
 * markdown or through `dangerouslySetInnerHTML` is invisible to the scan, loses its reset, and
 * reports nothing. The list is the whole mitigation, so it has to be complete — the first
 * version of it went through `truncateList`, whose default cap is ten, and quietly hid half the
 * names on the real reset.
 *
 * Once per context, too. A watch rebuild, a dev-server invalidation and each environment of a
 * build all reach this with the same static answer.
 */
describe('what the build says it removed', () => {
  const report = (rendered: string[]) => {
    const ctx: any = createGeneratorContext({ preflight: { prune: true } } as any)
    const lines: string[] = []
    const info = vi.spyOn(logger, 'info').mockImplementation((_type: string, message: any) => {
      lines.push(String(message))
    })

    try {
      for (const _ of [1, 2, 3]) {
        const sheet = ctx.createSheet()
        ctx.appendCssOfType('preflight', sheet)
        ctx.prunePreflight(sheet, new Set(rendered))
      }
    } finally {
      info.mockRestore()
    }

    return lines.filter((line) => line.includes('Reset rules removed'))
  }

  test('names every element it removed, and says it once', () => {
    const lines = report(['div'])

    expect(lines, 'once per context, not once per rebuild').toHaveLength(1)

    const line = lines[0]!
    const count = Number(line.match(/removed for (\d+) element/)![1])
    const names = line.match(/never renders: ([^.]+)\./)![1]!.split(', ')

    expect(names).toHaveLength(count)
    expect(line, 'the list is the feature; truncating it removes the point').not.toContain('and ')
    // A few of the long tail, to catch a cap that only bites past the first handful.
    for (const element of ['table', 'kbd', 'optgroup', 'textarea', 'progress']) {
      expect(names, element).toContain(element)
    }
  })

  test('says nothing when the source renders everything the reset styles', () => {
    // `html` and `body` are never pruned, so a rendered set covering the rest leaves nothing.
    const ctx: any = createGeneratorContext({ preflight: { prune: true } } as any)
    const sheet = ctx.createSheet()
    ctx.appendCssOfType('preflight', sheet)
    const { removedElements } = ctx.prunePreflight(sheet, new Set(everyElementIn(ctx)))

    expect(removedElements.size).toBe(0)
  })
})

/** Every element the emitted reset binds a rule to, read off the reset itself. */
const everyElementIn = (ctx: any) => {
  const sheet = ctx.createSheet()
  ctx.appendCssOfType('preflight', sheet)
  const found = new Set<string>()
  sheet.layers.reset.walkRules((rule: any) => {
    for (const part of rule.selectors) {
      const bare = part
        .replace(/:{1,2}[\w-]+(\([^()]*\))?/g, '')
        .replace(/\[[^\]]*\]/g, '')
        .trim()
      if (/^[a-zA-Z][\w-]*$/.test(bare)) found.add(bare.toLowerCase())
    }
  })
  return found
}
