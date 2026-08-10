import { describe, expect, test } from 'vitest'
import { globIgnore } from '../src/node-runtime'

/**
 * Declaration files are ignored by the source glob, always.
 *
 * They used to be ignored only when the project set no `exclude` of its own, because the
 * default was appended rather than combined — so whether `.d.ts` was scanned came down to
 * whether the project happened to use an unrelated option. `exclude: []` ignored them;
 * `exclude: ['**\/*.stories.tsx']` scanned them.
 *
 * That matters beyond tidiness: the reference scans are deliberately over-inclusive, so a
 * scanned declaration file could keep a token named in a doc comment. Half of projects got
 * that and half did not, by accident.
 */
describe('globIgnore', () => {
  test('ignores declaration files when no exclude is given', () => {
    expect(globIgnore(undefined)).toEqual(['**/*.d.ts'])
  })

  test('ignores them for an empty exclude', () => {
    expect(globIgnore([])).toEqual(['**/*.d.ts'])
  })

  test('ignores them alongside the project’s own exclude, rather than instead of it', () => {
    expect(globIgnore(['**/*.stories.tsx'])).toEqual(['**/*.d.ts', '**/*.stories.tsx'])
  })

  /** `exclude` is the resolved config's own array; appending to it edited the user's config. */
  test('does not mutate the array it is given', () => {
    const exclude: string[] = []
    globIgnore(exclude)

    expect(exclude).toEqual([])
  })
})
