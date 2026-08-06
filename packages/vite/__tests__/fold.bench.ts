import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext } from '@bamboocss/fixture'
import { bench, describe } from 'vitest'
import { foldSource } from '../src/fold'
import { createRuntimeCss } from '../src/runtime-css'

/**
 * What a build pays per module to fold it.
 *
 * This is the number that decides whether the transform can run in dev. In a CLI pass
 * the ts-morph parse amortizes across a whole build; in a bundler `transform` hook it
 * lands on every module, and again on every HMR update. `Project.addSourceFile` also
 * clears the box-node cache, because a changed file invalidates resolutions memoized
 * against it — so the per-module cost is a cold parse, not a warm one.
 *
 * Reported, not asserted, like the rest of the benches here: wall-clock is
 * machine-dependent, and a threshold would fail on a busy runner rather than on a
 * regression.
 */
const here = dirname(fileURLToPath(import.meta.url))
const sandbox = join(here, '../../../sandbox/vite-ts/src')

const readSandbox = (file: string) => {
  try {
    return readFileSync(join(sandbox, file), 'utf8')
  } catch {
    return null
  }
}

const SANDBOX_FILES = ['App.tsx', 'Card.tsx', 'Badge.tsx', 'Button.tsx']
  .map((file) => ({ file, code: readSandbox(file) }))
  .filter((entry): entry is { file: string; code: string } => entry.code != null)

const SYNTHETIC = `
import { css } from 'styled-system/css'
import { stack } from 'styled-system/patterns'

export const a = css({ color: 'red.300', padding: '4' })
export const b = css({ display: 'flex', _hover: { color: 'blue.500' } })
export const c = css({ fontSize: { base: 'sm', md: 'lg' } })
export const d = stack({ gap: '4', align: 'center' })
export function dynamic(tone: string) {
  return css({ color: tone })
}
`

/**
 * A module saturated with choices, which nothing else here is — between the synthetic
 * module and the four sandbox files there are two lines holding a `?` or a `||`.
 *
 * Auditing a choice means re-boxing both of its arms, which is the one place this
 * transform does work proportional to something other than the number of call sites. A
 * module of nothing but conditionals is not realistic; it is the upper bound, which is
 * what makes a regression visible here before it is visible anywhere else.
 */
const CONDITIONAL_MODULE = `
import { css } from 'styled-system/css'

const on = true
const tint = 'red.300'

${Array.from(
  { length: 8 },
  (_, index) => `
export const lowered${index} = (e: boolean) => css({ margin: '${index % 8}', color: e ? 'red.300' : 'blue.500' })
export const decided${index} = css({ padding: '${index % 8}', color: on ? tint : 'blue.500' })
export const guessed${index} = (e: boolean) => css({ padding: '${index % 8}', color: e ? 'red.300' : fn() })
`,
).join('')}
`

/**
 * A JSX-heavy module, which the sandbox files above barely are — between them they hold
 * two factory elements, so nothing there exercises the element surface.
 *
 * That surface is per-element work rather than per-call work, and a component file is
 * where elements come in bulk, so this is the shape that shows what it costs.
 */
const JSX_MODULE = `
import { styled } from 'styled-system/jsx'
import { box, hstack, stack } from 'styled-system/patterns'

export const View = ({ tone, rest }) => (
  <styled.div padding="4" backgroundColor="gray.100">
    ${Array.from(
      { length: 12 },
      (_, i) => `<styled.span color="blue.500" fontWeight="bold" id="s${i}">plain ${i}</styled.span>`,
    ).join('\n    ')}
    <styled.div color="gray.800" _hover={{ color: 'red.300' }} fontSize={{ base: 'sm', md: 'lg' }}>conditions</styled.div>
    <styled.div as="section" color="red.300">as</styled.div>
    <styled.div color={tone}>dynamic</styled.div>
    <styled.div color="green.300" {...rest}>spread</styled.div>
    <div className={stack({ gap: '4' })}>
      <div className={box({ padding: '2', backgroundColor: 'white' })}>box</div>
      <div className={hstack({ gap: '1', color: 'gray.700' })}>hstack</div>
    </div>
  </styled.div>
)
`

const ctx = createContext()
const runtimeCss = createRuntimeCss(ctx)

let counter = 0
/** A fresh path per iteration, so nothing is served from a per-file cache. */
const nextPath = () => `app/src/bench-${counter++}.tsx`

const parseOnly = (code: string) => {
  const filePath = nextPath()
  ctx.project.addSourceFile(filePath, code)
  return ctx.project.parseSourceFile(filePath)
}

const parseAndFold = (code: string) => {
  const filePath = nextPath()
  ctx.project.addSourceFile(filePath, code)
  const parserResult = ctx.project.parseSourceFile(filePath)
  if (!parserResult) return null
  return foldSource({ ctx, code, parserResult, filePath, runtimeCss })
}

describe('per-module transform cost', () => {
  bench('parse only (synthetic module)', () => {
    parseOnly(SYNTHETIC)
  })

  bench('parse + fold (synthetic module)', () => {
    parseAndFold(SYNTHETIC)
  })

  // `time` raised past the 500ms default: at the default this reports a dozen samples,
  // and a dozen samples cannot resolve the effect sizes it exists to catch — two runs of
  // an unchanged tree disagreed by 7%.
  bench(
    'parse + fold (conditional module)',
    () => {
      parseAndFold(CONDITIONAL_MODULE)
    },
    { warmupIterations: 3, time: 3000 },
  )

  bench('parse only (jsx module)', () => {
    parseOnly(JSX_MODULE)
  })

  bench('parse + fold (jsx module)', () => {
    parseAndFold(JSX_MODULE)
  })

  for (const { file, code } of SANDBOX_FILES) {
    bench(`parse + fold (sandbox/vite-ts ${file})`, () => {
      parseAndFold(code)
    })
  }
})
