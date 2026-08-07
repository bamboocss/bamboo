import { createContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { bench, describe } from 'vitest'

/**
 * What extraction costs per `cssMode`.
 *
 * `ts-eval` beside this measures the extractor's evaluation of a hard source; this measures
 * the encoding that follows it, which is where the two modes differ. Grouped does strictly
 * more work than atomic — it reconstructs the call the runtime will make, and asks whether
 * the group it encoded is exact — and that gap is the thing worth watching, since it is
 * paid on every file of every grouped build.
 *
 * `cva only` is the control. Nothing about grouping touches `setCva`, so the two modes have
 * to report the same number for it. If they do not, the machine moved between the readings
 * and the comparison beside it means nothing.
 *
 * The context and the source file are built once, outside the measured region: a fresh
 * `createContext` costs more than everything under test put together, and the AST is what
 * `ts-morph` caches anyway.
 *
 * pnpm bench extract-modes
 */

const filePath = 'app/src/bench.tsx'

/** A file shaped like application code: static calls, ternaries, patterns. */
const source = `
import { css } from "styled-system/css"
import { stack, hstack } from "styled-system/patterns"

export const Card = ({ active, tone }) => (
  <div className={css({ padding: '4', borderRadius: 'md', backgroundColor: 'white' })}>
    <span className={css({ fontSize: 'xl', fontWeight: 'bold', color: active ? 'red.300' : 'blue.300' })} />
    <span className={css({ color: tone, marginTop: '2' })} />
    <div className={css({ color: 'red.300', padding: '4', fontSize: 'xl' })} />
    <div className={css({ color: active ? 'red.300' : 'blue.300', padding: '2' })} />
    <div className={stack({ gap: '4', padding: '2' })} />
    <div className={hstack({ gap: active ? '2' : '4', padding: '4' })} />
    <div className={css({ _hover: { color: 'red.300' }, md: { padding: '8' }, fontSize: 'md' })} />
  </div>
)

export const Row = ({ on }) => (
  <div className={css({ display: 'flex', gap: '2', alignItems: 'center' })}>
    <button className={css({ paddingX: '4', paddingY: '2', borderRadius: 'sm', backgroundColor: 'blue.500' })} />
    <div className={css({ color: on ? 'white' : 'black', fontSize: 'sm' })} />
    <div className={stack({ gap: '2' })} />
  </div>
)
`

/**
 * The control: a recipe's classes are named from its config — `button--size_sm` — rather
 * than per property, so `cssMode` has no per-property naming to group and does not reach
 * this path at all.
 */
const cvaSource = `
import { cva } from "styled-system/css"

export const button = cva({
  base: { display: 'inline-flex', alignItems: 'center', borderRadius: 'md' },
  variants: {
    size: { sm: { padding: '2', fontSize: 'sm' }, md: { padding: '4', fontSize: 'md' } },
    tone: { primary: { backgroundColor: 'blue.500', color: 'white' }, danger: { backgroundColor: 'red.500' } },
  },
  compoundVariants: [{ size: 'sm', tone: 'danger', css: { fontWeight: 'bold' } }],
})
`

const prepare = (code: string, cssMode: 'atomic' | 'grouped') => {
  const ctx = createContext({ cssMode } as Config)
  ctx.project.addSourceFile(filePath, code)
  return () => ctx.project.parseSourceFile(filePath, ctx.encoder.clone())
}

describe('extract', () => {
  const atomic = prepare(source, 'atomic')
  const grouped = prepare(source, 'grouped')
  const atomicCva = prepare(cvaSource, 'atomic')
  const groupedCva = prepare(cvaSource, 'grouped')

  bench('atomic', () => void atomic(), { time: 1000 })
  bench('grouped', () => void grouped(), { time: 1000 })
  bench('cva only, atomic (control)', () => void atomicCva(), { time: 1000 })
  bench('cva only, grouped (control)', () => void groupedCva(), { time: 1000 })
})
