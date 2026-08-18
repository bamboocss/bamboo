import { createContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { bench, describe } from 'vitest'

/**
 * What extraction costs.
 *
 * `ts-eval` beside this measures the extractor's evaluation of a hard source; this measures
 * the encoding that follows it.
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
import { flex, center } from "styled-system/patterns"

export const Card = ({ active, tone }) => (
  <div className={css({ padding: '4', borderRadius: 'md', backgroundColor: 'white' })}>
    <span className={css({ fontSize: 'xl', fontWeight: 'bold', color: active ? 'red.300' : 'blue.300' })} />
    <span className={css({ color: tone, marginTop: '2' })} />
    <div className={css({ color: 'red.300', padding: '4', fontSize: 'xl' })} />
    <div className={css({ color: active ? 'red.300' : 'blue.300', padding: '2' })} />
    <div className={flex({ gap: '4', padding: '2' })} />
    <div className={center({ gap: active ? '2' : '4', padding: '4' })} />
    <div className={css({ _hover: { color: 'red.300' }, md: { padding: '8' }, fontSize: 'md' })} />
  </div>
)

export const Row = ({ on }) => (
  <div className={css({ display: 'flex', gap: '2', alignItems: 'center' })}>
    <button className={css({ paddingX: '4', paddingY: '2', borderRadius: 'sm', backgroundColor: 'blue.500' })} />
    <div className={css({ color: on ? 'white' : 'black', fontSize: 'sm' })} />
    <div className={flex({ gap: '2' })} />
  </div>
)
`

/**
 * The control: a recipe's classes are named from its config — `button--size_sm` — rather
 * than per property, so it does not reach the per-property naming path at all.
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

const prepare = (code: string) => {
  const ctx = createContext({} as Config)
  ctx.project.addSourceFile(filePath, code)
  return () => ctx.project.parseSourceFile(filePath, ctx.encoder.clone())
}

/**
 * The same file read over and over into one encoder, which is what a watch rebuild does.
 *
 * Separate from `prepare` because the encoder is *not* cloned: attribution only costs
 * anything on the second and later readings, where the previous reading's contribution has to
 * be handed back. A clone per call measures the first reading forever and would report that
 * work as free.
 *
 * Every repeat encodes the same styles, so this is the cheap case by construction -- nothing
 * is ever actually removed, only retained and released. An edit that changed every declaration
 * would remove as many hashes as it added, which is the same order of work.
 */
const prepareRepeat = (code: string) => {
  const ctx = createContext({} as Config)
  ctx.project.addSourceFile(filePath, code)
  return () => ctx.project.parseSourceFile(filePath)
}

describe('extract', () => {
  const css = prepare(source)
  const cva = prepare(cvaSource)
  const repeat = prepareRepeat(source)

  bench('css() calls', () => void css(), { time: 1000 })
  // The control: recipes do not reach the per-property naming path.
  bench('cva only (control)', () => void cva(), { time: 1000 })
  bench('css() calls, re-read into the same encoder', () => void repeat(), { time: 1000 })
})
