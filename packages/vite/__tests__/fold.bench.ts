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
 * A call-heavy module, which the sandbox files above barely are — between them they hold
 * only a handful of call sites.
 *
 * A component file is where `css()` calls come in bulk, so this is the shape that shows
 * what folding one costs when there are many.
 */
const JSX_MODULE = `
import { css } from 'styled-system/css'
import { box, hstack, stack } from 'styled-system/patterns'

export const View = ({ tone, rest }) => (
  <div className={css({ padding: '4', backgroundColor: 'gray.100' })}>
    ${Array.from(
      { length: 12 },
      (_, i) => `<span className={css({ color: 'blue.500', fontWeight: 'bold' })} id="s${i}">plain ${i}</span>`,
    ).join('\n    ')}
    <div className={css({ color: 'gray.800', _hover: { color: 'red.300' }, fontSize: { base: 'sm', md: 'lg' } })}>conditions</div>
    <section className={css({ color: 'red.300' })}>as</section>
    <div className={css({ color: tone })}>dynamic</div>
    <div className={css({ color: 'green.300', ...rest })}>spread</div>
    <div className={stack({ gap: '4' })}>
      <div className={box({ padding: '2', backgroundColor: 'white' })}>box</div>
      <div className={hstack({ gap: '1', color: 'gray.700' })}>hstack</div>
    </div>
  </div>
)
`

/**
 * A module of inline recipes, which nothing else here has.
 *
 * This is the one shape whose cost is not proportional to call sites alone: the fold builds a
 * binding→config map once per module, then derives class names per call — hashing the recipe's
 * identity once per recipe and walking its variants once per dynamic axis. A component file
 * that declares a recipe and calls it a few times is the realistic shape; the definitions are
 * what make it different from `JSX_MODULE`.
 */
const RECIPE_MODULE = `
import { cva } from 'styled-system/css'

${Array.from(
  { length: 6 },
  (_, index) => `
const recipe${index} = cva({
  base: { display: 'flex', padding: '${index % 4}' },
  variants: {
    tone: { info: { color: 'blue.500' }, warn: { color: 'red.300' }, muted: { color: 'gray.500' } },
    size: { sm: { fontSize: 'sm' }, md: { fontSize: 'md' }, lg: { fontSize: 'lg' } },
  },
  defaultVariants: { size: 'md' },
})
export const static${index} = recipe${index}({ tone: 'info', size: 'sm' })
export const dynamic${index} = (tone) => recipe${index}({ tone })
export const mixed${index} = (tone) => recipe${index}({ tone, size: 'lg' })
`,
).join('')}
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

  // The control for the pair below: parsing dominates, so a change to the recipe path shows
  // up as the gap between these two rather than in either alone.
  bench('parse only (recipe module)', () => {
    parseOnly(RECIPE_MODULE)
  })

  bench('parse + fold (recipe module)', () => {
    parseAndFold(RECIPE_MODULE)
  })

  for (const { file, code } of SANDBOX_FILES) {
    bench(`parse + fold (sandbox/vite-ts ${file})`, () => {
      parseAndFold(code)
    })
  }
})
