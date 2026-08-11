import { createContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'

/**
 * Calls of a recipe the file bound itself: `const badge = cva(...)`, then `badge({ tone })`.
 *
 * Every other style surface is recognised by the name it was *imported* as, and a local
 * binding has no import — so these calls were invisible. Not folded, which is a limitation,
 * but also not *reported*, which is worse: a build could not tell an unfoldable recipe
 * invocation from one nothing had looked at, and `strict` passed on both.
 *
 * Recorded, not encoded. The rules come from the `cva(...)` config, which `setCva` already
 * handled; what this adds is a call site the fold can see.
 */
const parse = (code: string, config?: Config) => {
  const ctx: any = createContext(config ?? {})
  ctx.project.addSourceFile('app/src/test.tsx', code)
  const result = ctx.project.parseSourceFile('app/src/test.tsx')
  return {
    calls: [...(result?.cvaCall ?? [])] as Array<{ name?: string; data: unknown[] }>,
    definitions: result?.cva?.size ?? 0,
  }
}

const RECIPE = `cva({ base: { color: 'red.300' }, variants: { tone: { a: { color: 'blue.300' }, b: { color: 'green.300' } } } })`

describe('calls of a locally-bound recipe', () => {
  test('records the call and the variants it selects', () => {
    const { calls, definitions } = parse(
      `import { cva } from 'styled-system/css'\nconst badge = ${RECIPE}\nexport const x = badge({ tone: 'a' })`,
    )

    expect(definitions).toBe(1)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.name).toBe('badge')
    expect(calls[0]!.data).toEqual([{ tone: 'a' }])
  })

  test('records a call that selects nothing', () => {
    const { calls } = parse(
      `import { cva } from 'styled-system/css'\nconst badge = ${RECIPE}\nexport const x = badge({})`,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]!.data).toEqual([{}])
  })

  test('follows the import alias, not the name', () => {
    const { calls } = parse(
      `import { cva as recipe } from 'styled-system/css'\nconst badge = recipe({ base: { color: 'red.300' } })\nexport const x = badge({})`,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]!.name).toBe('badge')
  })

  test('records sva the same way', () => {
    const { calls } = parse(
      `import { sva } from 'styled-system/css'\nconst parts = sva({ slots: ['root'], base: { root: { color: 'red.300' } } })\nexport const x = parts({})`,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]!.name).toBe('parts')
  })

  test('records every call site, not just the first', () => {
    const { calls } = parse(
      `import { cva } from 'styled-system/css'\nconst badge = ${RECIPE}\nexport const a = badge({ tone: 'a' })\nexport const b = badge({ tone: 'b' })`,
    )

    expect(calls).toHaveLength(2)
    expect(calls.map((c) => c.data)).toEqual([[{ tone: 'a' }], [{ tone: 'b' }]])
  })

  // --- what must NOT be picked up ---

  /**
   * The binding is matched through the *imported* name, so a project's own `cva` helper is
   * not mistaken for this one — which is the failure that would silently record, and later
   * fold, calls bamboo has no rules for.
   */
  test('ignores a local function that merely looks like one', () => {
    const { calls } = parse(`const badge = (options: any) => options\nexport const x = badge({ tone: 'a' })`)

    expect(calls).toHaveLength(0)
  })

  test("ignores a project's own cva that is not the bamboo import", () => {
    const { calls } = parse(
      `const cva = (o: any) => () => o\nconst badge = cva({ base: { color: 'red.300' } })\nexport const x = badge({})`,
    )

    expect(calls).toHaveLength(0)
  })

  test('a definition with no call records nothing', () => {
    const { calls, definitions } = parse(`import { cva } from 'styled-system/css'\nexport const badge = ${RECIPE}`)

    expect(definitions).toBe(1)
    expect(calls).toHaveLength(0)
  })

  /**
   * A local binding whose name collides with a surface matched by bare name.
   *
   * The two branches below this one in the parser's dispatch chain match on a name regex —
   * `/^(css|cva|sva)$/` and `/^(token)$/` — and never consult the file's imports. Recording a
   * local binding makes `matchFn` answer for it, so ordering this branch after either of them
   * routed a recipe into `setSva` (which read its config as slots and warned
   * `missing-property` against a recipe that does not exist) or into `setToken` (which
   * surfaced as a `dynamic` skip, enough to fail a `strict` build).
   */
  describe('names that collide with a bare-name surface', () => {
    test.each(['sva', 'token', 'css'])('a local recipe named %s is a recipe call', (name) => {
      const ctx: any = createContext({})
      ctx.project.addSourceFile(
        'app/src/test.tsx',
        `import { cva } from 'styled-system/css'\nconst ${name} = ${RECIPE}\nexport const x = ${name}({ tone: 'a' })`,
      )
      const result = ctx.project.parseSourceFile('app/src/test.tsx')

      expect([...result.cvaCall]).toHaveLength(1)
      expect(result.sva.size).toBe(0)
      expect(result.token.size).toBe(0)
      expect(result.unresolved).toEqual([])
    })

    /**
     * `cva` itself, which only a rename makes reachable — `const cva = cva(...)` redeclares
     * the import and is not valid JS. The definition must still be a definition: its callee
     * is the alias, which is not the bound name, so it does not take the local-recipe branch.
     */
    test('a local recipe named cva, bound through an alias', () => {
      const ctx: any = createContext({})
      ctx.project.addSourceFile(
        'app/src/test.tsx',
        `import { cva as make } from 'styled-system/css'\nconst cva = make({ base: { color: 'red.300' } })\nexport const x = cva({})`,
      )
      const result = ctx.project.parseSourceFile('app/src/test.tsx')

      expect(result.cva.size).toBe(1)
      expect(result.cvaCall.size).toBe(1)
    })

    test('a genuine sva import is still a slot recipe', () => {
      const ctx: any = createContext({})
      ctx.project.addSourceFile(
        'app/src/test.tsx',
        `import { sva } from 'styled-system/css'\nexport const parts = sva({ slots: ['root'], base: { root: { color: 'red.300' } } })`,
      )
      const result = ctx.project.parseSourceFile('app/src/test.tsx')

      expect(result.sva.size).toBe(1)
      expect(result.cvaCall.size).toBe(0)
    })

    test('a genuine token import is still a token', () => {
      const ctx: any = createContext({})
      ctx.project.addSourceFile(
        'app/src/test.tsx',
        `import { token } from 'styled-system/tokens'\nexport const c = token('colors.red.300')`,
      )
      const result = ctx.project.parseSourceFile('app/src/test.tsx')

      expect(result.token.size).toBe(1)
      expect(result.cvaCall.size).toBe(0)
    })
  })

  /**
   * A nested binding that shadows an import must not cost that import its rules.
   *
   * This is the direction that loses CSS rather than merely misreporting it. A name is
   * registered for the whole file and the extractor buckets every call of a name under one
   * key, so a `const css = cva(...)` inside a component made the module's real `css()` calls
   * look like recipe calls — and they emitted nothing at all. Silently.
   *
   * Asserted against the encoder, not against the parser result: the shape assertions above
   * all passed while this was broken.
   */
  describe('an import shadowed by a nested binding', () => {
    const encodeAtomic = (code: string) => {
      const ctx: any = createContext({})
      ctx.project.addSourceFile('app/src/test.tsx', code)
      ctx.project.parseSourceFile('app/src/test.tsx')
      return [...ctx.encoder.atomic].join('\n')
    }

    test('a real css() call still emits its rule', () => {
      const atomic = encodeAtomic(
        `import { css, cva } from 'styled-system/css'\n` +
          `export function Card() {\n  const css = ${RECIPE}\n  return css({ tone: 'a' })\n}\n` +
          `export const x = css({ color: 'blue.300' })`,
      )

      expect(atomic).toContain('blue.300')
    })

    test('a real pattern call still emits its rules', () => {
      const ctx: any = createContext({})
      ctx.project.addSourceFile(
        'app/src/test.tsx',
        `import { cva } from 'styled-system/css'\n` +
          `import { flex } from 'styled-system/patterns'\n` +
          `export function Card() {\n  const flex = cva({ base: { color: 'red.300' } })\n  return flex({})\n}\n` +
          `export const y = flex({ gap: '4' })`,
      )
      const result = ctx.project.parseSourceFile('app/src/test.tsx')

      expect(result.pattern.size).toBe(1)
      expect([...ctx.encoder.atomic].join('\n')).toContain('gap')
    })

    test('a real token() call is still recorded', () => {
      const ctx: any = createContext({})
      ctx.project.addSourceFile(
        'app/src/test.tsx',
        `import { cva } from 'styled-system/css'\n` +
          `import { token } from 'styled-system/tokens'\n` +
          `export function Card() {\n  const token = cva({ base: { color: 'red.300' } })\n  return token({})\n}\n` +
          `export const z = token('colors.red.300')`,
      )
      const result = ctx.project.parseSourceFile('app/src/test.tsx')

      expect(result.token.size).toBeGreaterThan(0)
    })

    test('a recipe declared inside a function is not registered', () => {
      const ctx: any = createContext({})
      ctx.project.addSourceFile(
        'app/src/test.tsx',
        `import { cva } from 'styled-system/css'\nexport function f() {\n  const badge = ${RECIPE}\n  return badge({ tone: 'a' })\n}`,
      )
      const result = ctx.project.parseSourceFile('app/src/test.tsx')

      expect(result.cvaCall.size).toBe(0)
    })
  })

  /**
   * A recipe whose name collides with another surface the file already matched.
   *
   * These are the only inputs whose CSS output differs from before inline recipes were
   * recognised: the call used to be routed to that other surface, which read `{ tone: 'a' }`
   * as pattern props or style props and emitted rules for classes nothing rendered — a recipe
   * names its own classes from its config. Rules are only ever dropped here, never added or
   * changed, and no snapshot covered any of it. Pinned so that stays true.
   */
  describe('a recipe whose name collides with another surface', () => {
    const encode = (code: string) => {
      const ctx: any = createContext({})
      ctx.project.addSourceFile('app/src/test.tsx', code)
      ctx.project.parseSourceFile('app/src/test.tsx')
      return {
        atomic: [...ctx.encoder.atomic],
        recipes: [...ctx.encoder.recipes.keys()],
        base: [...ctx.encoder.recipes_base.keys()],
      }
    }

    test('a pattern name emits none of that pattern rules', () => {
      const out = encode(
        `import { cva } from 'styled-system/css'\n` +
          `import * as p from 'styled-system/patterns'\n` +
          `const flex = ${RECIPE}\nexport const a = flex({ tone: 'a' })`,
      )

      expect(out.atomic).toEqual([])
    })

    test('a config recipe name does not emit that recipe', () => {
      const out = encode(
        `import { cva } from 'styled-system/css'\n` +
          `import * as r from 'styled-system/recipes'\n` +
          `const buttonStyle = ${RECIPE}\nexport const a = buttonStyle({ tone: 'a' })`,
      )

      expect(out.recipes).not.toContain('buttonStyle')
      expect(out.base).not.toContain('buttonStyle')
    })

    /**
     * The reachable one: it needs no namespace import. `isRawFn` answers true for the literal
     * name `css` whatever the file imports, so the dispatch's `/^(css|cva|sva)$/` branch used
     * to claim these — and unlike the two above, what it emitted looks entirely legitimate.
     * `.c_blue\\.300` is a real rule; it was simply never on any element, because the call
     * invokes a recipe and a recipe names its classes from its config.
     */
    test('the name css emits nothing, even for a well-formed argument', () => {
      const out = encode(
        `import { cva } from 'styled-system/css'\nconst css = ${RECIPE}\nexport const a = css({ color: 'blue.300' })`,
      )

      expect(out.atomic).toEqual([])
    })

    test('a pattern imported under an alias is unaffected', () => {
      const out = encode(
        `import { cva } from 'styled-system/css'\n` +
          `import { flex as s } from 'styled-system/patterns'\n` +
          `const myRecipe = ${RECIPE}\nexport const a = myRecipe({ tone: 'a' })\nexport const b = s({ gap: '4' })`,
      )

      expect(out.atomic.join('\n')).toContain('gap')
    })
  })

  /**
   * A binding that duplicates an import, which valid source cannot produce — redeclaring an
   * import is an error — but a concatenated SFC script block could hand to the parser.
   *
   * ts-morph does not type-check, so the shape reaches the dispatch. The guard there declines
   * to treat it as a local recipe, and the call falls through to the surface it names. That is
   * the only safe direction for an ambiguous binding: it can restore rules, never drop them.
   */
  test('a name that is both an import and a local binding keeps its import behaviour', () => {
    const ctx: any = createContext({})
    ctx.project.addSourceFile(
      'app/src/test.tsx',
      `import { css, cva } from 'styled-system/css'\nconst css = ${RECIPE}\nexport const a = css({ color: 'blue.300' })`,
    )
    ctx.project.parseSourceFile('app/src/test.tsx')

    expect([...ctx.encoder.atomic].join('\n')).toContain('blue.300')
  })

  /**
   * `merge` carries it, because the class's own contract says every field is carried and the
   * next field added should have a precedent to copy.
   */
  test('merge carries recorded calls', () => {
    const build = (code: string) => {
      const ctx: any = createContext({})
      ctx.project.addSourceFile('app/src/test.tsx', code)
      return ctx.project.parseSourceFile('app/src/test.tsx')
    }

    const source = build(
      `import { cva } from 'styled-system/css'\nconst badge = ${RECIPE}\nexport const x = badge({ tone: 'a' })`,
    )
    const target = build(`export const nothing = 1`)

    target.merge(source)

    expect(target.cvaCall.size).toBe(1)
  })

  /** Same contract as `merge`: `debug.ts` writes this to `ast.json`, so a dropped field is a hole in it. */
  test('toJSON carries recorded calls', () => {
    const ctx: any = createContext({})
    ctx.project.addSourceFile(
      'app/src/test.tsx',
      `import { cva } from 'styled-system/css'\nconst badge = ${RECIPE}\nexport const x = badge({ tone: 'a' })`,
    )
    const result = ctx.project.parseSourceFile('app/src/test.tsx')

    expect(result.toJSON().cvaCall).toHaveLength(1)
  })

  /**
   * The css layer is unchanged: recording a call must not emit rules of its own.
   *
   * Every bucket, not just `atomic`. The collision above left `atomic` identical in both arms
   * while running `processAtomicSlotRecipe` over a config that was not a slot recipe — so an
   * `atomic`-only assertion passed through the whole bug.
   */
  test('adds no css beyond what the definition emits', () => {
    const encode = (code: string) => {
      const ctx: any = createContext({})
      ctx.project.addSourceFile('app/src/test.tsx', code)
      ctx.project.parseSourceFile('app/src/test.tsx')

      const { atomic, compound_variants, recipes, recipes_base, view_transitions } = ctx.encoder
      const spread = (map: Map<string, Set<string> | unknown>) =>
        Object.fromEntries([...map].map(([key, value]) => [key, value instanceof Set ? [...value] : value]))

      return {
        atomic: [...atomic],
        compound_variants: [...compound_variants],
        recipes: spread(recipes),
        recipes_base: spread(recipes_base),
        view_transitions: spread(view_transitions),
      }
    }

    const IMPORT = `import { cva } from 'styled-system/css'`

    const withCall = encode(`${IMPORT}\nconst badge = ${RECIPE}\nexport const x = badge({ tone: 'a' })`)
    const withoutCall = encode(`${IMPORT}\nexport const badge = ${RECIPE}`)

    expect(withCall).toEqual(withoutCall)
  })
})
