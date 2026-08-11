import { createContext } from '@bamboocss/fixture'
import { getRecipeIdentity } from '@bamboocss/shared'
import { describe, expect, test } from 'vitest'

/**
 * The two derivations of an inline recipe's name, compared directly.
 *
 * The build hashes the config it *extracted*; the browser hashes the config as *authored*.
 * They only meet in the DOM, and when they disagree the element carries a class the
 * stylesheet has no rule for and renders with none of the recipe's styles — silently, and
 * invisibly to any check that reads the stylesheet, because the orphaned name leaves no
 * unused rule behind.
 *
 * `checkNamingAgreement` cannot cover this. It compares the two derivations for one fixed
 * canary, so it catches a divergence in the shared naming logic and nothing about how a
 * particular call site was written. Every case below was invisible to it.
 *
 * Two shipped:
 *
 * - Extraction reads string literals through `trimWhitespace`, so `'12px  16px'` became
 *   `'12px 16px'` before hashing and the browser's copy did not.
 * - Extraction drops a nullish declaration, so `{ color: undefined, padding: '4' }` was
 *   recorded as `{ padding: '4' }` and the browser hashed the longer object.
 *
 * Both are the same shape: a transformation applied on the way in and not on the way out. The
 * point of this file is the *class*, so new value shapes belong here rather than a second
 * assertion about whitespace.
 */
const CASES: Array<{ authored: () => unknown; name: string; source: string }> = [
  { authored: () => ({ base: { color: 'red' } }), name: 'a plain string', source: `{ base: { color: 'red' } }` },
  {
    authored: () => ({ base: { padding: '12px  16px' } }),
    name: 'repeated whitespace',
    source: `{ base: { padding: '12px  16px' } }`,
  },
  {
    authored: () => ({ base: { minHeight: 'calc(100vh -  16px)' } }),
    name: 'whitespace inside calc',
    source: `{ base: { minHeight: 'calc(100vh -  16px)' } }`,
  },
  { authored: () => ({ base: { padding: 4 } }), name: 'a number', source: `{ base: { padding: 4 } }` },
  { authored: () => ({ base: { padding: '4' } }), name: 'a numeric string', source: `{ base: { padding: '4' } }` },
  {
    authored: () => ({ base: { opacity: 1.0 } }),
    name: 'a float that is an integer',
    source: `{ base: { opacity: 1.0 } }`,
  },
  { authored: () => ({ base: { marginTop: -4 } }), name: 'a negative number', source: `{ base: { marginTop: -4 } }` },
  { authored: () => ({ base: { color: `red` } }), name: 'a template literal', source: '{ base: { color: `red` } }' },
  {
    authored: () => ({ base: { content: 'a\tb' } }),
    name: 'an escape sequence',
    source: `{ base: { content: 'a\\tb' } }`,
  },
  {
    authored: () => ({ base: { content: 'A' } }),
    name: 'a unicode escape',
    source: `{ base: { content: '\\u0041' } }`,
  },
  { authored: () => ({ base: { content: '' } }), name: 'an empty string', source: `{ base: { content: '' } }` },
  { authored: () => ({ base: { srOnly: true } }), name: 'a boolean', source: `{ base: { srOnly: true } }` },
  {
    authored: () => ({ base: { color: undefined, padding: '4' } }),
    name: 'an explicit undefined',
    source: `{ base: { color: undefined, padding: '4' } }`,
  },
  {
    authored: () => ({ base: { color: null, padding: '4' } }),
    name: 'an explicit null',
    source: `{ base: { color: null, padding: '4' } }`,
  },
  {
    authored: () => ({ base: { color: undefined } }),
    name: 'a base that is entirely nullish',
    source: `{ base: { color: undefined } }`,
  },
  {
    authored: () => ({ variants: { size: { sm: { color: undefined, padding: '2' } } } }),
    name: 'a nullish declaration inside a variant',
    source: `{ variants: { size: { sm: { color: undefined, padding: '2' } } } }`,
  },
  {
    authored: () => ({
      compoundVariants: [{ css: { color: null, padding: '2' }, size: 'sm' }],
      variants: { size: { sm: { padding: '1' } } },
    }),
    name: 'a nullish declaration inside a compound variant',
    source: `{ compoundVariants: [{ css: { color: null, padding: '2' }, size: 'sm' }], variants: { size: { sm: { padding: '1' } } } }`,
  },
  {
    authored: () => ({ base: { padding: { base: '1', sm: '2' } } }),
    name: 'a conditional value',
    source: `{ base: { padding: { base: '1', sm: '2' } } }`,
  },
  {
    authored: () => ({ base: { _hover: { _focus: { md: { color: 'red' } } } } }),
    name: 'deeply nested conditions',
    source: `{ base: { _hover: { _focus: { md: { color: 'red' } } } } }`,
  },
  { authored: () => ({ base: {} }), name: 'an empty base', source: `{ base: {} }` },
  {
    authored: () => ({
      base: { color: 'red' },
      defaultVariants: { size: 'sm' },
      variants: { size: { sm: { padding: '2' } } },
    }),
    name: 'default variants',
    source: `{ base: { color: 'red' }, defaultVariants: { size: 'sm' }, variants: { size: { sm: { padding: '2' } } } }`,
  },
  {
    authored: () => ({ variants: { cols: { 2: { padding: '2' } } } }),
    name: 'a numeric variant key',
    source: `{ variants: { cols: { 2: { padding: '2' } } } }`,
  },
]

describe('an inline recipe is named the same by the build and by the browser', () => {
  /** Every case extracted in one pass, so the parser sees them as a real file would. */
  const extracted = (() => {
    const ctx = createContext() as never as {
      encoder: { clone: () => unknown }
      project: { addSourceFile: (p: string, c: string) => void; parseSourceFile: (p: string, e?: unknown) => never }
    }
    const source = `import { cva } from 'styled-system/css'\n${CASES.map(
      ({ source }, index) => `export const r${index} = cva(${source})`,
    ).join('\n')}`

    ctx.project.addSourceFile('app/src/recipes.tsx', source)
    const result = ctx.project.parseSourceFile('app/src/recipes.tsx', ctx.encoder.clone()) as never as {
      toArray: () => Array<{ data: unknown[] }>
    }
    return result.toArray().flatMap((item) => item.data)
  })()

  test('every case was extracted', () => {
    // Guards the assertions below from passing on a config the parser never saw: comparing
    // `undefined` against `undefined` would agree about nothing.
    expect(extracted).toHaveLength(CASES.length)
  })

  test.each(CASES.map((entry, index) => ({ ...entry, index })))('$name', ({ authored, index }) => {
    expect(getRecipeIdentity(extracted[index] as never)).toBe(getRecipeIdentity(authored() as never))
  })
})
