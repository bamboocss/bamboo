import { createGeneratorContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import { LEAF_HELPER } from '../src/fold-partial'
import { RECIPE_PICK_HELPER, SPLIT_PROPS_HELPER } from '../src/fold-recipe'

/**
 * The names a fold can write into a `styled-system/css` import.
 *
 * The transform extends whatever import of that module the file already has rather than
 * writing its own, so the barrel is the specifier its emitted calls resolve against.
 */
const INJECTED = [LEAF_HELPER, RECIPE_PICK_HELPER, SPLIT_PROPS_HELPER]

/** The authoring API the barrel exists to expose. */
const AUTHORING = ['css', 'cx', 'cva', 'sva', 'fallback', 'viewTransition', 'auditSlotScopes']

const barrel = (extension: 'mjs' | 'd.ts') => {
  const [artifact] = createGeneratorContext().getArtifacts(['css-index'])
  const file = artifact?.files.find((entry) => entry.file === `index.${extension}`)
  if (!file?.code) throw new Error(`no index.${extension} in the css-index artifact`)
  return file.code
}

/**
 * Names re-exported by a module, read from its `export { … } from '…'` statements.
 *
 * Parsed rather than matched as substrings, so a name appearing only in a comment does not
 * count as an export.
 */
const reExportedNames = (code: string) => {
  const names = new Set<string>()

  for (const [, clause] of code.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*from/g)) {
    for (const specifier of clause.split(',')) {
      // `a as b` is exported under `b`; a bare `a` under itself.
      const exported = specifier
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (exported) names.add(exported)
    }
  }

  return names
}

describe('css barrel', () => {
  /**
   * Nothing else pins this pair. The barrel is a hand-written list in `setupCssIndex`, and
   * folded code is rewritten in memory during the bundler's transform, so it is never
   * typechecked — a name dropped from the barrel leaves Rollup warning about a missing
   * export while the emitted call silently receives `undefined`.
   */
  test('exports every helper the fold can inject', () => {
    const exported = reExportedNames(barrel('mjs'))
    for (const helper of INJECTED) {
      expect(exported, `${helper} is written by the fold and must resolve`).toContain(helper)
    }
  })

  test('exports the authoring API', () => {
    const exported = reExportedNames(barrel('mjs'))
    for (const name of AUTHORING) expect(exported).toContain(name)
  })

  /**
   * The declaration file omits the injected helpers on purpose: a declaration would buy
   * nothing — folded code is never typechecked — beyond advertising them as API, which is
   * what a blanket `export *` did before. Each stays typed in the module defining it, so
   * deep-importing one on purpose still works.
   *
   * Asserted so that "fix the types/runtime mismatch" does not quietly undo it.
   */
  test('does not declare the injected helpers as types', () => {
    const declared = reExportedNames(barrel('d.ts'))

    for (const helper of INJECTED) expect(declared).not.toContain(helper)
    for (const name of AUTHORING) expect(declared).toContain(name)
  })
})
