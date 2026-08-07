import { Project } from 'ts-morph'
import { bench, describe } from 'vitest'
import { maybeBoxNode } from '../src/maybe-box-node'

/**
 * Extraction across a project of many files, which is the shape the existing benchmarks
 * cannot measure.
 *
 * `extract-speed` runs one inlined sample through a project holding nothing else. That is a
 * fine measure of the extractor's own work, and it is why a change that made extraction cost
 * grow with the *size of the project* went out with a green benchmark: giving the evaluator a
 * TypeScript type checker made it bind and check the whole program, which is free when the
 * program is one file. On a real codebase it cost +38% CPU and +30% peak RSS, and a large
 * project reported 5.4x and an OOM in CI.
 *
 * So the unit here is deliberately a project rather than an expression, and the two cases
 * differ only in whether the style objects reach across a module boundary.
 *
 * How the regression actually presents, measured by reintroducing it: **both** cases slow
 * down — the inline control by 44%, which cannot be doing any import resolution at all — and
 * `rme` goes from ±0.75% to ±11.9%. A type checker is built once and then charged to
 * everything in the process, so it shows up as GC pressure rather than as one case pulling
 * away from the other. Read the control and the `rme` column, not the gap.
 *
 * That makes this a tripwire rather than a measurement. The reliable signal for this class is
 * peak RSS over a real project — `/usr/bin/time -l` around a `bamboo cssgen`, which moved
 * 386 MB to 504 MB on 400 files and back again when the checker was removed. A microbenchmark
 * cannot see a cost whose unit is the whole program.
 */
const FILES = 60

const createProject = (crossFile: boolean) => {
  const project = new Project({ useInMemoryFileSystem: true })

  project.createSourceFile(
    '/helpers.ts',
    `const defaults = { color: 'gray.90', width: '2px' }
     export const focusRing = (options: any = {}) => {
       const { color, width } = { ...defaults, ...options }
       return { _focusVisible: { outlineColor: color, outlineWidth: width } }
     }`,
  )

  const files = []
  for (let index = 0; index < FILES; index++) {
    files.push(
      project.createSourceFile(
        `/component-${index}.ts`,
        crossFile
          ? `import { focusRing } from './helpers'
             export const a = { ...focusRing({ color: 'red.${index}' }), padding: '${index % 9}' }`
          : `export const a = { _focusVisible: { outlineColor: 'red.${index}' }, padding: '${index % 9}' }`,
      ),
    )
  }

  return files
}

const local = createProject(false)
const crossFile = createProject(true)

const boxEvery = (files: ReturnType<typeof createProject>) => {
  for (const file of files) {
    for (const declaration of file.getVariableDeclarations()) {
      const initializer = declaration.getInitializer()
      if (initializer) maybeBoxNode(initializer, [], { flags: { skipTraverseFiles: false } } as never)
    }
  }
}

describe('extraction across a project', () => {
  // The control: the same style objects, written out rather than imported. Nothing here can
  // reach another module, so nothing here can want a type checker.
  bench(`${FILES} files, styles written inline`, () => void boxEvery(local))

  // The same work, with each object composed from a helper in another file.
  bench(`${FILES} files, styles from an imported helper`, () => void boxEvery(crossFile))
})
