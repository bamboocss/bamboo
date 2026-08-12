import { esc } from '@bamboocss/shared'
import { describe, expect, test } from 'vitest'
import { pruneStaticCss } from '../src/prune-static-css'
import { createStaticCompilationSession } from '../src/static-session'

const stylesheet = (body: string) =>
  `@layer reset, base, tokens, recipes, utilities;@layer utilities{${body}}:root{--made-with-bamboo:🌱}`

describe('static stylesheet reachability', () => {
  test('removes a recipe-only atom that no transformed module selected', () => {
    const session = createStaticCompilationSession()
    session.prunableClasses.add(esc('h_[345.6789px]'))

    const result = pruneStaticCss(stylesheet(`.h_\\[345\\.6789px\\]{height:345.6789px}`), session)

    expect(result).not.toContain('345.6789px')
    expect(result).not.toContain('@layer utilities{}')
    expect(result).toContain('--made-with-bamboo')
  })

  test('keeps a selected recipe-only atom', () => {
    const session = createStaticCompilationSession()
    const className = esc('h_[234.5678px]')
    session.prunableClasses.add(className)
    session.usedClasses.add(className)

    const result = pruneStaticCss(stylesheet(`.h_\\[234\\.5678px\\]{height:234.5678px}`), session)
    expect(result).toContain('height:234.5678px')
  })

  test('never removes an ordinary utility merely because it was not observed in folded output', () => {
    const session = createStaticCompilationSession()
    const result = pruneStaticCss(stylesheet('.d_flex{display:flex}'), session)
    expect(result).toContain('display:flex')
  })

  test('removes an unused ordinary utility when extraction marked it as graph-owned', () => {
    const session = createStaticCompilationSession()
    session.prunableClasses.add('d_flex')
    const result = pruneStaticCss(stylesheet('.d_flex{display:flex}'), session)
    expect(result).not.toContain('display:flex')
  })

  test('matches escaped conditional selectors by their single owning class', () => {
    const session = createStaticCompilationSession()
    session.prunableClasses.add(esc('hover:c_red.300'))

    const result = pruneStaticCss(stylesheet('.hover\\:c_red\\.300:hover{color:red}'), session)
    expect(result).not.toContain('color:red')
  })

  test('does not prune an authored class outside the utility layer', () => {
    const session = createStaticCompilationSession()
    session.prunableClasses.add('d_flex')

    const css = `@layer reset, base, tokens, recipes, utilities;@layer base{.d_flex{color:red}}:root{--made-with-bamboo:🌱}`
    const result = pruneStaticCss(css, session)
    expect(result).toContain('.d_flex{color:red}')
  })

  test('uses the configured utility layer name', () => {
    const session = createStaticCompilationSession()
    session.utilityLayer = 'atomic'
    session.prunableClasses.add('d_flex')
    session.markClassUsed('d_flex')

    const css = `@layer utilities{.d_flex{display:grid}}@layer atomic{.d_flex{display:flex}}:root{--made-with-bamboo:🌱}`
    const result = pruneStaticCss(css, session)

    expect(result).toContain('@layer utilities{.d_flex{display:grid}}')
    expect(result).toContain('@layer atomic{.d_flex{display:flex}}')
  })
})

/**
 * A class reaches the sheet under either spelling, and both denote the same class.
 *
 * `--bottom-mask-size_16px` needs no escape to be a valid selector — a CSS ident may begin
 * with `--` — while `esc` produces the escaped `\--…` form that reachability keys are stored
 * in. Matching on one spelling therefore missed a rule written in the other, and the atom was
 * pruned with its rule sitting in the stylesheet the whole time.
 *
 * It only ever affected names needing an escape, which is why it presented as every custom
 * property and vendor-prefixed declaration losing its rule while flat ones were untouched.
 */
describe('a class spelled with or without its escape', () => {
  const sheet = (body: string) =>
    `@layer reset, base, tokens, utilities;@layer utilities{${body}}:root{--made-with-bamboo:🌱}`

  test('is kept when the rule is unescaped and the key is escaped', () => {
    const session = createStaticCompilationSession()
    session.prunableClasses.add(esc('--bottom-mask-size_16px'))
    session.markClassUsed('--bottom-mask-size_16px')

    const result = pruneStaticCss(sheet('.--bottom-mask-size_16px{--bottom-mask-size:16px}'), session)

    expect(result).toContain('--bottom-mask-size:16px')
  })

  test('is kept when both sides are escaped', () => {
    const session = createStaticCompilationSession()
    session.prunableClasses.add(esc('--bottom-mask-size_16px'))
    session.markClassUsed('--bottom-mask-size_16px')

    const result = pruneStaticCss(sheet('.\\--bottom-mask-size_16px{--bottom-mask-size:16px}'), session)

    expect(result).toContain('--bottom-mask-size:16px')
  })

  // The point of pruning still has to work for these names.
  test('is still removed when nothing uses it', () => {
    const session = createStaticCompilationSession()
    session.prunableClasses.add(esc('--unused-size_4px'))

    const result = pruneStaticCss(sheet('.--unused-size_4px{--unused-size:4px}'), session)

    expect(result).not.toContain('--unused-size:4px')
  })
})
