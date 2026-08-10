import { fixtureDefaults } from '@bamboocss/fixture'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'
import { Generator } from '../src'

/**
 * Every name an artifact imports from `../helpers` has to be a name the helpers artifact exports.
 *
 * The two sides are written a package apart and neither one checks the other: the import list is
 * spelled by hand in `src/artifacts/js/*.ts`, while the export list is whatever
 * `packages/shared/src/shared.ts` re-exports, bundled into `generated/helpers.mjs.json` by a build
 * step. Moving a helper out of that re-export drops it from the artifact silently.
 *
 * That is not hypothetical. Patterns switched from importing `patternFns` to `createPatternFns`,
 * which `shared.ts` did not export, and every generated `patterns/*.mjs` imported a binding that
 * did not exist. Snapshots of the emitted text still passed — they assert what the import line
 * says, not that it resolves — so the first thing to notice was a sandbox bundle failing to build.
 *
 * The oracle here is the module itself rather than a parse of its `export {}` statement: what
 * broke is a binding a bundler could not find, so the check has to be that importing it produces
 * one.
 */

/** Named imports off any specifier ending in `helpers`, with or without the extension. */
const HELPER_IMPORT = /import\s*\{([^}]*)\}\s*from\s*'[^']*helpers(?:\.mjs)?'/g

const importedNames = (code: string) =>
  [...code.matchAll(HELPER_IMPORT)].flatMap((match) =>
    match[1]
      .split(',')
      .map((name) => name.trim().split(/\s+as\s+/)[0])
      .filter(Boolean),
  )

const written: string[] = []
afterAll(() => written.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

describe('helpers import parity', () => {
  test('every helper a generated artifact imports is one the helpers artifact exports', async () => {
    const artifacts = new Generator(fixtureDefaults).getArtifacts() ?? []

    const modules = artifacts.flatMap((artifact) =>
      (artifact?.files ?? [])
        .filter((file) => file.file.endsWith('.mjs') && file.code)
        .map((file) => ({ path: [...(artifact!.dir ?? []), file.file].join('/'), code: file.code! })),
    )

    const helpers = modules.find((module) => module.path.endsWith('helpers.mjs'))
    expect(helpers, 'no helpers artifact was generated').toBeDefined()

    // Inside the project: vitest resolves a dynamic import through vite, which will not load a
    // file outside the root however it is spelled.
    const root = mkdtempSync(join(process.cwd(), 'node_modules', '.bamboo-helpers-'))
    written.push(root)
    const path = join(root, 'helpers.mjs')
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, helpers!.code)
    // @vite-ignore: the path is a temp dir, so vitest must not try to resolve it at transform time
    const exported = new Set(Object.keys(await import(/* @vite-ignore */ pathToFileURL(path).href)))

    const missing = modules
      .filter((module) => module !== helpers)
      .flatMap((module) =>
        importedNames(module.code)
          .filter((name) => !exported.has(name))
          .map((name) => `${module.path} imports ${name}`),
      )

    expect(missing).toEqual([])

    // A regex that matched nothing would pass the assertion above without checking anything, and
    // patterns are the artifact this went wrong in.
    const scanned = modules.filter((module) => importedNames(module.code).length > 0)
    expect(scanned.length).toBeGreaterThan(5)
    expect(scanned.some((module) => module.path.includes('patterns/'))).toBe(true)
  })
})
