import { createContext as createFixtureContext } from '@bamboocss/fixture'
import type { PruneOptions } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import type { BambooContext } from '../src/create-context'
import { collectKeyframeReferences, keyframeNames, pruneTokensForBuild } from '../src/token-references'

/**
 * The two prune passes have to agree about which custom properties survive.
 *
 * They did not. `pruneTokenVars` roots reachability at what the css references *plus* what
 * reaches a token from outside it — a `token()` call, a `prune.keepTokens` pattern, a theme
 * artifact, a `globalCss` export. `pruneKeyframes` re-derived the same question from the css
 * alone, which cannot see any of those, so a token kept by one pass had its `@keyframes`
 * deleted by the other:
 *
 * ```css
 * --animations-drawer: slide-in-right 400ms ease-out;   ← ships
 * ```
 *
 * with no `@keyframes slide-in-right` behind it. Valid css, a green build, and the animation
 * simply never plays — the failure only a diff of the output finds.
 *
 * It was reported as depending on whether `include` covers `outdir`, and that is a second
 * route to it rather than the cause: `collectKeyframeReferences` scans source text for the
 * name, the generated token artifact contains `slide-in-right 400ms` verbatim, and a project
 * whose `include` reaches its own output was keeping its keyframes by accident. Excluding
 * `outdir` — which looks obviously correct, and which the permanent `css.mjs` warning invites
 * — took that accident away. Nothing here relies on it: the source below never spells a
 * keyframe name.
 */
const FILE = 'app/src/app.tsx'

/** No keyframe name appears in it, so the textual fallback cannot be what keeps one alive. */
const SOURCE = `
  import { css } from '../../styled-system/css'
  export const App = () => <div className={css({ color: 'red.300' })} />
`

const KEYFRAMES = {
  'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
  'slide-in-right': { from: { translate: '100% 0' }, to: { translate: '0 0' } },
}

const buildCss = (prune: PruneOptions) => {
  const ctx = createFixtureContext({
    prune,
    theme: {
      extend: {
        keyframes: KEYFRAMES,
        tokens: {
          // Points at one keyframe and not the other, so a pass that keeps everything and a
          // pass that keeps the right thing give different answers.
          animations: { drawer: { value: 'slide-in-right 400ms ease-out' } },
        },
      },
    },
    // Stands in for what extraction would contribute, so the sheet has a utility layer.
    staticCss: { css: [{ properties: { color: ['red.300'] } }] },
  }) as unknown as BambooContext

  ctx.getFiles = () => [FILE]
  ctx.runtime = { ...ctx.runtime, fs: { ...ctx.runtime.fs, readFileSync: () => SOURCE } } as BambooContext['runtime']

  const sheet = ctx.createSheet()
  ctx.appendLayerParams(sheet)
  ctx.appendBaselineCss(sheet)

  const reachableVars = pruneTokensForBuild(ctx, sheet, [])
  ctx.pruneKeyframes(sheet, collectKeyframeReferences(ctx, keyframeNames(ctx)), reachableVars)

  return ctx.getCss(sheet)
}

const declaresKeyframe = (css: string, name: string) => new RegExp(`@keyframes\\s+${name}\\b`).test(css)
const declaresToken = (css: string) => css.includes('--animations-drawer:')

describe('a token that survives keeps its keyframe', () => {
  test('`keepTokens` keeps both, or neither', () => {
    const css = buildCss({ tokens: true, keepTokens: ['animations.*'], keyframes: true })

    // The reported shape, asserted as a pair rather than as two facts. Either is fine alone;
    // it is the combination — a declaration shipping over a definition that does not — that
    // is the bug, and only asserting both can fail on it.
    expect(declaresToken(css)).toBe(true)
    expect(declaresKeyframe(css, 'slide-in-right')).toBe(true)
  })

  test('and only that one', () => {
    // The control. Keeping every keyframe is also a way to pass the test above, and it is
    // not a fix — `fade-in` has nothing pointing at it and still has to go.
    const css = buildCss({ tokens: true, keepTokens: ['animations.*'], keyframes: true })

    expect(declaresKeyframe(css, 'fade-in')).toBe(false)
  })

  test('a token nothing keeps takes its keyframe with it', () => {
    // Without the keep there is no external reader, so the declaration goes and the keyframe
    // goes with it. This is the case that makes the pass worth having, and the one a fix that
    // simply rooted every custom property would have broken.
    const css = buildCss({ tokens: true, keyframes: true })

    expect(declaresToken(css)).toBe(false)
    expect(declaresKeyframe(css, 'slide-in-right')).toBe(false)
  })

  test('`tokens: false` keeps every keyframe its declarations name', () => {
    // Nothing is removable, so every animation token ships — and `off` is the setting chosen
    // precisely because something outside the stylesheet reads them.
    const css = buildCss({ tokens: false, keyframes: true })

    expect(declaresToken(css)).toBe(true)
    expect(declaresKeyframe(css, 'slide-in-right')).toBe(true)
    expect(declaresKeyframe(css, 'fade-in')).toBe(false)
  })
})
