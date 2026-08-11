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

  test('renames retained semantic selectors to compact stable names', () => {
    const session = createStaticCompilationSession()
    const compact = session.allocateClassString('d_flex c_red.300').split(' ')
    expect(compact).toHaveLength(2)
    session.prunableClasses.add('d_flex')
    session.prunableClasses.add(esc('c_red.300'))
    session.usedClasses.add('d_flex')
    session.usedClasses.add(esc('c_red.300'))

    const result = pruneStaticCss(stylesheet('.d_flex{display:flex}.c_red\\.300{color:red}'), session)
    expect(result).toContain(`.${compact[0]}{display:flex}`)
    expect(result).toContain(`.${compact[1]}{color:red}`)
    expect(result).not.toContain('.d_flex')
    expect(result).not.toContain('.c_red')
  })

  test('stable compact names do not depend on module discovery order', () => {
    const first = createStaticCompilationSession()
    const second = createStaticCompilationSession()
    const a = first.allocateClassString('d_flex c_red.300')
    second.allocateClassString('p_4')
    const b = second.allocateClassString('d_flex c_red.300')
    expect(a).toBe(b)
  })

  test('does not prune or rename an authored class outside the utility layer', () => {
    const session = createStaticCompilationSession()
    session.prunableClasses.add('d_flex')
    session.allocateClassString('d_flex')

    const css = `@layer reset, base, tokens, recipes, utilities;@layer base{.d_flex{color:red}}:root{--made-with-bamboo:🌱}`
    const result = pruneStaticCss(css, session)
    expect(result).toContain('.d_flex{color:red}')
  })

  test('uses the configured utility layer name', () => {
    const session = createStaticCompilationSession('local')
    session.utilityLayer = 'atomic'
    const compact = session.allocateClassString('d_flex')
    session.prunableClasses.add('d_flex')
    session.markClassUsed(compact)

    const css = `@layer utilities{.d_flex{display:grid}}@layer atomic{.d_flex{display:flex}}:root{--made-with-bamboo:🌱}`
    const result = pruneStaticCss(css, session)

    expect(result).toContain('@layer utilities{.d_flex{display:grid}}')
    expect(result).toContain(`@layer atomic{.${compact}{display:flex}}`)
  })
})
