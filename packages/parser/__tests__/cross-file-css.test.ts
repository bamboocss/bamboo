import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

const CSS_IMPORT = `import { css } from '../../styled-system/css'`

/**
 * End-to-end: real CSS, not extracted style objects. Proves an imported style
 * actually reaches the stylesheet, which is what a consumer of this feature sees.
 */
function createProject(files: Record<string, string>) {
  const ctx = createContext({})
  for (const [path, code] of Object.entries(files)) ctx.project.addSourceFile(path, code)
  return ctx
}

/** Generates the stylesheet for `entry`, the way a build does. */
function cssFor(ctx: any, entry: string) {
  const encoder = ctx.encoder.clone()
  ctx.project.parseSourceFile(entry, encoder)
  const styles = ctx.decoder.clone().collect(encoder)
  return ctx.getParserCss(styles) as string
}

describe('cross-file composition emits CSS', () => {
  test('an imported style reaches the stylesheet alongside the inline one', () => {
    const ctx = createProject({
      'app/src/styles.ts': `${CSS_IMPORT}
       export const button = css.raw({ display: 'inline-flex', paddingInline: '4' })`,
      'app/src/app.tsx': `${CSS_IMPORT}
       import { button } from './styles'
       export const App = () => <div className={css(button, { background: 'red.500' })} />`,
    })

    const css = cssFor(ctx, 'app/src/app.tsx')

    // from the imported file
    expect(css).toContain('display: inline-flex')
    expect(css).toContain('padding-inline')
    // from the call site
    expect(css).toContain('background')
  })

  test('editing the shared file changes the CSS its consumer emits', () => {
    const ctx = createProject({
      'app/src/styles.ts': `${CSS_IMPORT}
       export const button = css.raw({ display: 'inline-flex' })`,
      'app/src/app.tsx': `${CSS_IMPORT}
       import { button } from './styles'
       export const App = () => <div className={css(button)} />`,
    })

    const before = cssFor(ctx, 'app/src/app.tsx')
    expect(before).toContain('display: inline-flex')

    // what watch does on a `change` event
    ctx.project.addSourceFile(
      'app/src/styles.ts',
      `${CSS_IMPORT}
       export const button = css.raw({ display: 'grid' })`,
    )

    const after = cssFor(ctx, 'app/src/app.tsx')
    expect(after).toContain('display: grid')
    expect(after).not.toContain('display: inline-flex')
  })

  test('conditions inside an imported style survive the fold', () => {
    const ctx = createProject({
      'app/src/styles.ts': `${CSS_IMPORT}
       export const button = css.raw({ color: 'red.500', _hover: { color: 'blue.700' } })`,
      'app/src/app.tsx': `${CSS_IMPORT}
       import { button } from './styles'
       export const App = () => <div className={css(button)} />`,
    })

    const css = cssFor(ctx, 'app/src/app.tsx')
    expect(css).toContain(':is(:hover, [data-hover])')
  })

  test('the JSX css prop folds an imported style', () => {
    const ctx = createProject({
      'app/src/styles.ts': `${CSS_IMPORT}
       export const button = css.raw({ borderWidth: '2px' })`,
      'app/src/app.tsx': `import { styled } from '../../styled-system/jsx'
       import { button } from './styles'
       export const App = () => <styled.div css={button} />`,
    })

    const css = cssFor(ctx, 'app/src/app.tsx')
    expect(css).toContain('border-width: 2px')
  })

  test('a plain exported object reaches the stylesheet', () => {
    const ctx = createProject({
      'app/src/tokens.ts': `export const surface = { color: 'red.500', borderWidth: '2px' }`,
      'app/src/app.tsx': `${CSS_IMPORT}
       import { surface } from './tokens'
       export const App = () => <div className={css(surface)} />`,
    })

    const css = cssFor(ctx, 'app/src/app.tsx')
    expect(css).toContain('border-width: 2px')
  })

  test('an unsupported import emits only the inline half, without failing the build', () => {
    const ctx = createProject({
      'app/src/styles.ts': `export default { display: 'inline-flex' }`,
      'app/src/app.tsx': `${CSS_IMPORT}
       import styles from './styles'
       export const App = () => <div className={css(styles, { borderWidth: '2px' })} />`,
    })

    let css = ''
    expect(() => (css = cssFor(ctx, 'app/src/app.tsx'))).not.toThrow()
    expect(css).toContain('border-width: 2px')
    expect(css).not.toContain('display: inline-flex')
  })
})
