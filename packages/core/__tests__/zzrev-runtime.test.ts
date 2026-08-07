import { createGeneratorContext, createRuleProcessor } from '@bamboocss/fixture'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, test } from 'vitest'

const OUT = '/private/tmp/claude-501/-Users-x-Developer-gajus-bamboo/1aa067f6-47a4-4738-8170-a4ea40d17f22/scratchpad/ss'

function emit(tag: string, userConfig: any) {
  const outRoot = join(OUT, tag)
  rmSync(outRoot, { recursive: true, force: true })
  const gen = createGeneratorContext(userConfig)
  const artifacts = gen.getArtifacts()
  for (const artifact of artifacts) {
    if (!artifact) continue
    const dir = (artifact.dir ?? []).filter((f: string) => f !== 'styled-system')
    for (const f of artifact.files ?? []) {
      if (!f.code) continue
      const p = join(outRoot, ...dir, f.file)
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, f.code)
    }
  }
  writeFileSync(join(outRoot, 'package.json'), JSON.stringify({ type: 'module' }))
  return outRoot
}

const CMP = {
  className: 'cmp',
  slots: ['root', 'item'],
  scopeRoots: ['root'],
  base: { root: { color: 'red' }, item: { color: 'blue' } },
  variants: {
    size: { sm: { item: { padding: '2' } }, lg: { item: { padding: '4' } } },
    tone: { a: { item: { margin: '2' } }, b: { item: { margin: '4' } } },
  },
  compoundVariants: [{ size: 'sm', tone: 'a', css: { item: { fontWeight: 'bold' } } }],
}

const SVA_INLINE = {
  className: 'inl',
  slots: ['root', 'item'],
  base: { root: { color: 'red' }, item: { color: 'blue' } },
  variants: { size: { sm: { item: { padding: '2' } }, lg: { item: { padding: '4' } } } },
}

// No className, no slots: build infers slots, runtime does not.
const SVA_ANON_INFERRED = {
  base: { root: { color: 'red' }, item: { color: 'blue' } },
  variants: { size: { sm: { item: { padding: '2' } }, lg: { item: { padding: '4' } } } },
}

// No className, slots declared, scopeRoots declared.
const SVA_ANON_SCOPED = {
  slots: ['root', 'item'],
  scopeRoots: ['root'],
  base: { root: { color: 'red' }, item: { color: 'blue' } },
  variants: { size: { sm: { item: { padding: '2' } }, lg: { item: { padding: '4' } } } },
}

const cfgs: Array<[string, any]> = [
  ['default', {}],
  ['prefix', { prefix: 'bam' }],
  ['hash', { hash: true }],
  ['hashprefix', { hash: true, prefix: 'bam' }],
  ['sep', { separator: '=' }],
]

describe('emit artifacts + build side', () => {
  test.each(cfgs)('%s', (tag, config) => {
    const full = { ...config, theme: { extend: { slotRecipes: { cmp: CMP } } } }
    const outRoot = emit(tag, full)

    const buildCmp = createRuleProcessor(full).recipe('cmp', { size: 'sm', tone: 'a' })!
    const buildSva = createRuleProcessor(full).sva(SVA_INLINE as never)
    const buildAnonInf = createRuleProcessor(full).sva(SVA_ANON_INFERRED as never)
    const buildAnonScoped = createRuleProcessor(full).sva(SVA_ANON_SCOPED as never)

    writeFileSync(
      join(outRoot, 'build.json'),
      JSON.stringify(
        {
          tag,
          cmp: { classes: buildCmp.getClassNames(), css: buildCmp.toCss() },
          sva: { classes: buildSva.getClassNames(), css: buildSva.toCss() },
          anonInferred: { classes: buildAnonInf.getClassNames(), css: buildAnonInf.toCss() },
          anonScoped: { classes: buildAnonScoped.getClassNames(), css: buildAnonScoped.toCss() },
        },
        null,
        2,
      ),
    )
    expect(true).toBe(true)
  })
})
