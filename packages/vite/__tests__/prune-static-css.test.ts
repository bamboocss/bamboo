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

/**
 * A merged rule is judged per selector, not as a whole.
 *
 * The optimizer collapses rules sharing a body into one selector list, so an atom nothing can
 * reach routinely ends up beside a reachable one — `content: ""` is written by every `_before`
 * and `_after` in a project, and they merge into a single rule. Judging the rule as a whole
 * kept all of them, which is dead CSS that pruning exists to remove and which grows with
 * exactly the declarations that repeat most.
 */
describe('a rule merged from several atoms', () => {
  const sheet = (body: string) =>
    `@layer reset, base, tokens, utilities;@layer utilities{${body}}:root{--made-with-bamboo:🌱}`

  const session = () => {
    const s = createStaticCompilationSession()
    for (const name of ['before\\:content_a', 'after\\:content_a', 'd_flex']) s.prunableClasses.add(name)
    return s
  }

  test('keeps the reachable selectors and drops the rest', () => {
    const s = session()
    s.markClassUsed('before:content_a')

    const result = pruneStaticCss(sheet('.before\\:content_a::before,.after\\:content_a::after{content:"a"}'), s)

    expect(result).toContain('content:"a"')
    expect(result).toContain('before\\:content_a')
    expect(result).not.toContain('after\\:content_a')
  })

  test('removes the rule when no selector survives', () => {
    const result = pruneStaticCss(
      sheet('.before\\:content_a::before,.after\\:content_a::after{content:"a"}'),
      session(),
    )

    expect(result).not.toContain('content:"a"')
  })

  test('leaves a rule alone when every selector is reachable', () => {
    const s = session()
    s.markClassUsed('before:content_a')
    s.markClassUsed('after:content_a')

    const result = pruneStaticCss(sheet('.before\\:content_a::before,.after\\:content_a::after{content:"a"}'), s)

    expect(result).toContain('before\\:content_a')
    expect(result).toContain('after\\:content_a')
  })

  // A compound variant selects on classes the element already carries, so no single atom owns
  // the rule and dropping it would take a style the element still needs.
  test('never touches a selector naming more than one class', () => {
    const s = createStaticCompilationSession()
    s.prunableClasses.add('btn--size_sm')
    s.prunableClasses.add('btn--tone_a')

    const result = pruneStaticCss(sheet('.btn--size_sm.btn--tone_a{color:red}'), s)

    expect(result).toContain('color:red')
  })
})
