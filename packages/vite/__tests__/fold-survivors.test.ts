import { describe, expect, test } from 'vitest'
import { createFoldFixture } from './fixture'

/**
 * What `strict` fails a build on, asked of the output rather than the ledger.
 *
 * The ledger holds only calls something recognised, so a guarantee built on it is worth
 * exactly what the recogniser is. These cover the other half: a binding still referenced once
 * every rewrite is applied, whoever left it there — and, just as importantly, the many shapes
 * that merely *look* like one. A false positive here fails a build that should have passed,
 * which is the worse failure for a gate nobody can override per-call.
 */

const reasons = (result: { skipped: Array<{ reason: string }> }) => result.skipped.map((entry) => entry.reason)
const survivors = (result: { skipped: Array<{ reason: string; name: string }> }) =>
  result.skipped.filter((entry) => entry.reason === 'runtime-binding').map((entry) => entry.name)

describe('a binding the rewrite left behind', () => {
  test('passed on rather than called', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(`import { css } from 'styled-system/css'\nexport const pass = css\n`)

    expect(survivors(result)).toEqual(['css'])
  })

  test('handed to a function the build cannot follow', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(
      `import { css } from 'styled-system/css'\nconst apply = (fn, v) => fn(v)\nexport const f = (p) => apply(css, p)\n`,
    )

    expect(survivors(result)).toEqual(['css'])
  })

  test.each([
    ['a named re-export', `export { css } from 'styled-system/css'\n`],
    ['a star re-export', `export * from 'styled-system/css'\n`],
    ['a namespace re-export', `export * as styles from 'styled-system/css'\n`],
  ])('%s keeps the module alive', (_label, code) => {
    const { foldStrict } = createFoldFixture()

    expect(reasons(foldStrict(code))).toContain('runtime-binding')
  })

  test.each([
    ['a dynamic import', `export const styles = import('styled-system/css')\n`],
    ['a CommonJS require', `export const styles = require('styled-system/css')\n`],
    ['an import-equals declaration', `import styles = require('styled-system/css')\nexport { styles }\n`],
  ])('%s keeps the runtime module alive', (_label, code) => {
    const { foldStrict } = createFoldFixture()

    expect(reasons(foldStrict(code))).toContain('runtime-binding')
  })

  /**
   * The same wrapper written in two statements, and the more common spelling — a barrel that
   * also uses the binding has to import it. The identifier walk cannot see this one, because
   * an export specifier is excluded there to keep the single-statement form above from being
   * counted twice.
   */
  test('imported and re-exported separately', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(
      `import { css } from 'styled-system/css'\nexport const base = css({ color: 'red.300' })\nexport { css as style }\n`,
    )

    expect(survivors(result)).toEqual(['css'])
  })

  /**
   * A non-failing ledger entry must not suppress a real survivor. `not-imported` — a call of a
   * *shadowed* binding — passes `strict` on its own, so seeding the report from it would hide
   * the export below and pass a build that plainly keeps the engine.
   */
  test('is still reported when an unrelated call declined for a passing reason', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(
      `import { css } from 'styled-system/css'
export const pass = css
export function local({ css }) {
  return css({ color: 'red.300' })
}
`,
    )

    expect(survivors(result)).toContain('css')
  })

  test('a dynamic call is reported once by the compiler ledger', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(
      `import { css as c } from 'styled-system/css'\nexport const f = (tone) => c({ color: 'red.300', _hover: { color: tone } })\n`,
    )

    expect(result.folded).toHaveLength(0)
    expect(reasons(result)).toContain('dynamic')
    expect(survivors(result)).toEqual([])
  })

  test('is silent when the ledger already fails on that binding', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(`import { css } from 'styled-system/css'\nexport const f = (p) => css({ ...p })\n`)

    expect(reasons(result)).toContain('dynamic')
    expect(survivors(result)).toEqual([])
  })
})

describe('what is not a surviving reference', () => {
  test('a module where every call folded', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(`import { css } from 'styled-system/css'\nexport const cls = css({ color: 'red.300' })\n`)

    expect(survivors(result)).toEqual([])
  })

  /**
   * The shape that failed real builds: `button`, `input`, `label`, `select`, `table`, `dialog`
   * and `form` are all ordinary recipe names *and* intrinsic elements, and a JSX tag name is
   * an `Identifier` like any other. A fully-folded module was reported because of its markup.
   */
  test.each([
    ['a jsx tag of the same name', `export const B = () => <button className={cls} />`],
    ['a jsx closing tag', `export const B = () => <button>{cls}</button>`],
    ['an object key', `export const theme = { button: 1, cls }`],
    ['a property read', `export const read = (o) => o.button`],
    ['a class method', `export class K {\n  button() {\n    return cls\n  }\n}`],
  ])('%s', (_label, body) => {
    // A recipe named after an intrinsic element, which is the whole point.
    const { foldStrict } = createFoldFixture({
      theme: {
        extend: {
          recipes: {
            button: {
              className: 'button',
              base: { display: 'inline-flex' },
              variants: { visual: { solid: { background: 'red.200' } } },
            },
          },
        },
      },
    } as never)

    const result = foldStrict(
      `import { button } from 'styled-system/recipes'\nconst cls = button({ visual: 'solid' })\n${body}\n`,
      'app/src/tag.tsx',
    )

    expect(survivors(result)).toEqual([])
  })

  /**
   * A type-only *use* of a value import is erased, and the import with it. The variant-props
   * type imported alongside a recipe — without the `type` modifier, which is legal — is the
   * canonical bamboo component shape, and reporting it named a binding with no runtime
   * existence at all.
   */
  test.each([
    ['typeof in a type alias', `export type CssFn = typeof css`],
    ['typeof in an interface', `export interface P {\n  fn: typeof css\n}`],
    ['typeof in a parameter type', `export function g(t: typeof css) {\n  return t\n}`],
  ])('%s', (_label, body) => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(
      `import { css } from 'styled-system/css'\nexport const cls = css({ color: 'red.300' })\n${body}\n`,
    )

    expect(survivors(result)).toEqual([])
  })

  test('a shorthand property, which does read the binding', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(`import { css } from 'styled-system/css'\nexport const bag = { css }\n`)

    expect(survivors(result)).toEqual(['css'])
  })

  /** A recipe definition is compile-time data once all of its calls are lowered. */
  test('an erased cva definition and its calls', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(
      `import { cva } from 'styled-system/css'
const badge = cva({ base: { display: 'flex' }, variants: { tone: { a: { color: 'red.300' } } } })
export const cls = badge({ tone: 'a' })
`,
    )

    expect(survivors(result)).toEqual([])
  })

  test('a helper the user imported themselves', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(
      `import { css, cx } from 'styled-system/css'\nexport const cls = cx(css({ color: 'red.300' }), 'x')\n`,
    )

    expect(survivors(result)).toEqual([])
  })

  test('a shadowed local of the same name', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(
      `import { css } from 'styled-system/css'
export const cls = css({ color: 'red.300' })
export function other() {
  const css = 1
  return css
}
`,
    )

    expect(survivors(result)).toEqual([])
  })

  test('a type-only import', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(
      `import type { SystemStyleObject } from 'styled-system/types'\nexport const x: SystemStyleObject = { color: 'red.300' }\n`,
    )

    expect(survivors(result)).toEqual([])
  })

  /**
   * A name is also an accessor, an enum member and a label. `get button()` against a recipe
   * called `button` is the same class of false positive as the JSX tag above.
   */
  test.each([
    ['a getter', `export const o = { get css() { return cls } }`],
    ['a setter in a class', `export class K {\n  set css(v) {\n    this.v = v\n  }\n}`],
    ['an enum member', `export enum E {\n  css,\n}`],
    ['a renamed binding element', `export const D = ({ css: prop }) => [cls, prop]`],
  ])('%s', (_label, body) => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(
      `import { css } from 'styled-system/css'\nconst cls = css({ color: 'red.300' })\n${body}\n`,
    )

    expect(survivors(result)).toEqual([])
  })

  /**
   * One call site, one complaint. The ledger records the name a binding was *imported* under
   * and the walk sees the name the file bound, so matching them by name reported an aliased
   * call twice — once as `dynamic`, once as a survivor.
   */
  test('an aliased binding whose call already failed is reported once', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(`import { css as c } from 'styled-system/css'\nexport const f = (p) => c({ ...p })\n`)

    expect(reasons(result)).toEqual(['dynamic'])
  })

  /**
   * The distinction JSX itself draws: `<button />` names an intrinsic element and reads
   * nothing, `<Button />` reads the binding. A recipe kept alive only as a component tag is a
   * survivor like any other.
   */
  test('a capitalized jsx tag does read its binding', () => {
    const { foldStrict } = createFoldFixture({
      theme: {
        extend: {
          recipes: {
            Button: { className: 'Button', base: { display: 'inline-flex' } },
          },
        },
      },
    } as never)

    const result = foldStrict(
      `import { Button } from 'styled-system/recipes'\nexport const C = () => <Button />\n`,
      'app/src/tag.tsx',
    )

    expect(survivors(result)).toEqual(['Button'])
  })

  test('a labelled loop is not a reference', () => {
    const { foldStrict } = createFoldFixture()
    const result = foldStrict(
      `import { css } from 'styled-system/css'
export const cls = css({ color: 'red.300' })
export function run(xs) {
  css: for (const x of xs) {
    if (x) continue css
  }
}
`,
    )

    expect(survivors(result)).toEqual([])
  })

  test('nothing at all is reported when the check is off', () => {
    const { fold } = createFoldFixture()
    const result = fold(`import { css } from 'styled-system/css'\nexport const pass = css\n`)

    expect(survivors(result)).toEqual([])
  })
})
