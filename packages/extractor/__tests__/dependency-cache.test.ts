import { afterEach, describe, expect, test } from 'vitest'
import { Project, type Expression } from 'ts-morph'
import { clearBoxNodeCache, maybeBoxNode } from '../src/maybe-box-node'
import { safeEvaluateNode } from '../src/evaluate-node'
import { unbox } from '../src/unbox'
import type { BoxContext, ResolveModule } from '../src/types'

const fixture = () => {
  const project = new Project({ useInMemoryFileSystem: true })
  const entry = project.createSourceFile(
    '/entry.ts',
    `import { decorate } from './helper'\nexport const value = decorate()`,
  )
  for (const [scope, color] of [
    ['a', 'red.300'],
    ['b', 'blue.500'],
  ] as const) {
    project.createSourceFile(
      `/${scope}/helper.ts`,
      `import { tone } from './leaf'\nexport const decorate = () => ({ ...tone, padding: '2' })`,
    )
    project.createSourceFile(`/${scope}/leaf.ts`, `export const tone = { color: '${color}' }`)
  }

  const resolver =
    (scope: 'a' | 'b'): ResolveModule =>
    (specifier, from) => {
      if (from === entry && specifier === './helper') return project.getSourceFile(`/${scope}/helper.ts`)
      if (from.getFilePath() === `/${scope}/helper.ts` && specifier === './leaf') {
        return project.getSourceFile(`/${scope}/leaf.ts`)
      }
    }
  const expression = entry.getVariableDeclarationOrThrow('value').getInitializerOrThrow() as Expression
  return { entry, expression, project, resolver }
}

const context = (resolveModule: ResolveModule) => {
  const dependencies: string[] = []
  const ctx: BoxContext = {
    flags: { skipTraverseFiles: false },
    recordDependency: (filePath) => dependencies.push(filePath),
    resolveModule,
  }
  return { ctx, dependencies }
}

afterEach(clearBoxNodeCache)

describe('semantic dependency cache replay', () => {
  test('maybeBoxNode scopes values and paths to a resolver, then replays a hit deterministically', () => {
    const { expression, resolver } = fixture()
    const first = context(resolver('a'))
    const second = context(resolver('b'))

    expect(unbox(maybeBoxNode(expression, [], first.ctx)!).raw).toEqual({ color: 'red.300', padding: '2' })
    expect(first.dependencies.sort()).toEqual(['/a/helper.ts', '/a/leaf.ts'])

    expect(unbox(maybeBoxNode(expression, [], second.ctx)!).raw).toEqual({ color: 'blue.500', padding: '2' })
    expect(second.dependencies.sort()).toEqual(['/b/helper.ts', '/b/leaf.ts'])

    const replay = context(second.ctx.resolveModule!)
    expect(unbox(maybeBoxNode(expression, [], replay.ctx)!).raw).toEqual({ color: 'blue.500', padding: '2' })
    expect(replay.dependencies).toEqual(['/b/helper.ts', '/b/leaf.ts'])
  })

  test('the evaluator cache replays paths without retaining another resolver context', () => {
    const { expression, resolver } = fixture()
    const first = context(resolver('a'))
    const second = context(resolver('b'))

    expect(safeEvaluateNode(expression, [], first.ctx)).toEqual({ color: 'red.300', padding: '2' })
    expect(first.dependencies.sort()).toEqual(['/a/helper.ts', '/a/leaf.ts'])
    expect(safeEvaluateNode(expression, [], second.ctx)).toEqual({ color: 'blue.500', padding: '2' })
    expect(second.dependencies.sort()).toEqual(['/b/helper.ts', '/b/leaf.ts'])

    const replay = context(second.ctx.resolveModule!)
    expect(safeEvaluateNode(expression, [], replay.ctx)).toEqual({ color: 'blue.500', padding: '2' })
    expect(replay.dependencies).toEqual(['/b/helper.ts', '/b/leaf.ts'])
  })

  test('clearing after source replacement records paths from fresh nodes', () => {
    const { expression, project, resolver } = fixture()
    const resolveModule = resolver('b')
    expect(safeEvaluateNode(expression, [], context(resolveModule).ctx)).toEqual({ color: 'blue.500', padding: '2' })

    project.createSourceFile('/b/leaf.ts', `export const tone = { color: 'green.400' }`, { overwrite: true })
    clearBoxNodeCache()
    const refreshed = context(resolveModule)
    expect(safeEvaluateNode(expression, [], refreshed.ctx)).toEqual({ color: 'green.400', padding: '2' })
    expect(refreshed.dependencies.sort()).toEqual(['/b/helper.ts', '/b/leaf.ts'])
  })
})
