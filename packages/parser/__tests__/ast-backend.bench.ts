import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Project, ScriptKind, ts } from 'ts-morph'
import { afterAll, bench, describe } from 'vitest'
import { API } from '@typescript/api/unstable/sync'

/**
 * What an AST costs, per backend, on source shaped like the code bamboo extracts from.
 *
 * Extraction is the largest phase of a build and roughly 40% of it is the AST layer, so the
 * question this answers is which layer to build on. Each bench does the same thing — obtain a
 * tree for every file and walk every node — because bamboo's cost is dominated by traversal,
 * not by parsing: ts-morph allocates a wrapper object per node as you walk, and that, not the
 * parse, is what it charges for.
 *
 * `@typescript/api` is TypeScript 7.1's `unstable/*` surface, where parsing happens in the Go
 * compiler and JS receives lazy views over a binary buffer. Its numbers are steady-state: the
 * sidecar process is spawned once in `beforeAll`, which is what a watching dev server sees and
 * is optimistic for a one-shot CLI, where the spawn and the first program load are also paid.
 *
 * pnpm bench ast-backend
 */
const FILES = 512
const CALLS = 6

const root = mkdtempSync(path.join(tmpdir(), 'bamboo-ast-backend-'))
mkdirSync(path.join(root, 'src'), { recursive: true })
writeFileSync(
  path.join(root, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      jsx: 'preserve',
      module: 'preserve',
      moduleResolution: 'bundler',
      noEmit: true,
      target: 'esnext',
    },
    include: ['src'],
  }),
)
const sources = Array.from({ length: FILES }, (_, index) => {
  const calls = Array.from(
    { length: CALLS },
    (_, call) =>
      `css({ color: 'rgb(${index % 256} ${call * 7} 0)', paddingLeft: '${call}px', gap, _hover: { opacity: '0.${call}' } })`,
  ).join(',\n')
  const file = path.join(root, `src/file-${String(index).padStart(4, '0')}.ts`)
  const text = `import { gap } from './tokens'\nexport const atoms${index} = [${calls}]\n`
  writeFileSync(file, text)
  return { file, text }
})
writeFileSync(path.join(root, 'src/tokens.ts'), `export const gap = '4px'\n`)

const api = new API({ cwd: root })
api.updateSnapshot({ openProjects: [path.join(root, 'tsconfig.json')] })

afterAll(() => {
  api.close()
  rmSync(root, { force: true, recursive: true })
})

describe(`${FILES} files x ${CALLS} css() calls — obtain every tree and walk every node`, () => {
  bench(
    'ts-morph (today): createSourceFile + forEachDescendant',
    () => {
      const project = new Project({
        skipAddingFilesFromTsConfig: true,
        skipFileDependencyResolution: true,
        skipLoadingLibFiles: true,
        useInMemoryFileSystem: true,
      })
      let nodes = 0
      for (const { file, text } of sources) {
        const sourceFile = project.createSourceFile(file, text, { overwrite: true, scriptKind: ScriptKind.TS })
        sourceFile.forEachDescendant(() => nodes++)
      }
      if (!nodes) throw new Error('walked nothing')
    },
    { time: 3000 },
  )

  bench(
    'TypeScript 6 compiler API: createSourceFile + forEachChild',
    () => {
      let nodes = 0
      const walk = (node: ts.Node) => {
        nodes++
        ts.forEachChild(node, walk)
      }
      for (const { file, text } of sources) {
        ts.forEachChild(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), walk)
      }
      if (!nodes) throw new Error('walked nothing')
    },
    { time: 3000 },
  )

  bench(
    'TypeScript 7.1 unstable API: getSourceFile + forEachChild',
    () => {
      const snapshot = api.updateSnapshot({ fileChanges: { invalidateAll: true } })
      const project = snapshot.getProjects()[0]!
      let nodes = 0
      const walk = (node: { forEachChild: (visit: (child: never) => void) => void }) => {
        nodes++
        node.forEachChild(walk as never)
      }
      for (const { file } of sources) project.program.getSourceFile(file)?.forEachChild(walk as never)
      if (!nodes) throw new Error('walked nothing')
    },
    { time: 3000 },
  )
})
