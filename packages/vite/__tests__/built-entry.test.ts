import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, test } from 'vitest'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = join(packageRoot, '../..')
const graphChild = join(packageRoot, '__tests__/built-entry-child.mjs')
const transformCwd = join(repositoryRoot, 'sandbox/codegen')

const loadedFiles = (entry: string) => {
  const directory = mkdtempSync(join(tmpdir(), 'bamboo-vite-built-entry-'))
  const graphPath = join(directory, 'graph.json')
  try {
    execFileSync(process.execPath, [graphChild, pathToFileURL(entry).href, graphPath, transformCwd], {
      cwd: packageRoot,
      encoding: 'utf8',
      timeout: 120_000,
    })
    return JSON.parse(readFileSync(graphPath, 'utf8')) as {
      factoryFiles: string[]
      outputFiles: string[]
      transformFiles: string[]
    }
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
}

describe('built Vite entry boundaries', () => {
  test.each([
    ['ESM', 'index.mjs', 'node-module.mjs', 'config-module.mjs', 'static-compiler.mjs'],
    ['CommonJS', 'index.cjs', 'node-module.cjs', 'config-module.cjs', 'static-compiler.cjs'],
  ])(
    '%s import stays outside the Node and config roots until a hook runs',
    (_, filename, nodeChunk, configChunk, staticCompiler) => {
      const entry = join(packageRoot, 'dist', filename)
      const source = readFileSync(entry, 'utf8')
      const nodeAdapter = readFileSync(join(packageRoot, 'dist', nodeChunk), 'utf8')
      const configAdapter = readFileSync(join(packageRoot, 'dist', configChunk), 'utf8')

      // Internal dynamic boundaries let each output format select the matching external
      // condition without making either root eager in the public entry.
      expect(source).toContain(`./${nodeChunk}`)
      expect(source).toContain(`./${configChunk}`)
      expect(source).not.toContain('import("@bamboocss/node")')
      expect(source).not.toContain('import("@bamboocss/config")')
      expect(source).not.toContain('require("@bamboocss/node")')
      expect(source).not.toContain('require("@bamboocss/config")')
      expect(source).not.toMatch(/^import .* from ["']@bamboocss\/(?:node|config)["'];?$/m)
      if (filename.endsWith('.cjs')) {
        expect(nodeAdapter).toContain('require("@bamboocss/node")')
        expect(configAdapter).toContain('require("@bamboocss/config")')
      } else {
        expect(nodeAdapter).toContain('export * from "@bamboocss/node"')
        expect(configAdapter).toContain('export * from "@bamboocss/config"')
      }

      const graph = loadedFiles(entry).factoryFiles.map((file) => fileURLToPath(file))
      expect(graph.some((file) => file.endsWith(`/packages/node/dist/${staticCompiler}`))).toBe(true)
      expect(graph.some((file) => file.endsWith(`/packages/vite/dist/${nodeChunk}`))).toBe(false)
      expect(graph.some((file) => file.endsWith(`/packages/vite/dist/${configChunk}`))).toBe(false)
      expect(graph.some((file) => /\/packages\/node\/dist\/index\.(?:cjs|mjs)$/.test(file))).toBe(false)
      expect(graph.some((file) => /\/packages\/config\/dist\/index\.(?:cjs|mjs)$/.test(file))).toBe(false)
    },
  )

  test.each([
    ['ESM', 'index.mjs', 'fold-module.mjs'],
    ['CommonJS', 'index.cjs', 'fold-module.cjs'],
  ])('%s emits and loads one real fold chunk only on the first transform', (_, filename, foldChunk) => {
    const entry = join(packageRoot, 'dist', filename)
    const source = readFileSync(entry, 'utf8')
    const chunkPath = join(packageRoot, 'dist', foldChunk)
    const chunk = readFileSync(chunkPath, 'utf8')

    expect(source).toContain(`./${foldChunk}`)
    expect(source).not.toContain('//#region src/fold.ts')
    expect(source).not.toMatch(/(?:from|require\()\s*["']ts-morph["']/)
    expect(source).not.toMatch(/(?:from|require\()\s*["']@bamboocss\/extractor["']/)
    expect(source).not.toMatch(/(?:from|require\()\s*["']@bamboocss\/config\/ts-path["']/)
    expect(chunk).toContain('//#region src/fold.ts')
    expect(chunk).toMatch(/(?:from|require\()\s*["']ts-morph["']/)
    expect(chunk).toMatch(/(?:from|require\()\s*["']@bamboocss\/extractor["']/)
    expect(chunk).toMatch(/(?:from|require\()\s*["']@bamboocss\/config\/ts-path["']/)

    const { factoryFiles, transformFiles } = loadedFiles(entry)
    const factoryGraph = factoryFiles.map((file) => fileURLToPath(file))
    const transformGraph = transformFiles.map((file) => fileURLToPath(file))
    const foldExclusive = (file: string) =>
      file.endsWith(`/packages/vite/dist/${foldChunk}`) ||
      /\/node_modules\/\.pnpm\/(?:ts-morph|@ts-morph\+common)@/.test(file) ||
      /\/packages\/extractor\/dist\/index\.(?:cjs|mjs)$/.test(file) ||
      /\/packages\/config\/dist\/resolve-ts-path-pattern\.(?:cjs|mjs)$/.test(file)

    expect(factoryGraph.filter(foldExclusive)).toEqual([])
    expect(transformGraph.some((file) => file.endsWith(`/packages/vite/dist/${foldChunk}`))).toBe(true)
    expect(transformGraph.some((file) => /\/node_modules\/\.pnpm\/ts-morph@/.test(file))).toBe(true)
    expect(transformGraph.some((file) => /\/node_modules\/\.pnpm\/@ts-morph\+common@/.test(file))).toBe(true)
    expect(transformGraph.some((file) => /\/packages\/extractor\/dist\/index\.(?:cjs|mjs)$/.test(file))).toBe(true)
    expect(
      transformGraph.some((file) => /\/packages\/config\/dist\/resolve-ts-path-pattern\.(?:cjs|mjs)$/.test(file)),
    ).toBe(true)
  })

  test.each([
    ['ESM', 'index.mjs', 'css-output-module.mjs'],
    ['CommonJS', 'index.cjs', 'css-output-module.cjs'],
  ])('%s emits and loads one real CSS-output chunk only when output is processed', (_, filename, outputChunk) => {
    const entry = join(packageRoot, 'dist', filename)
    const source = readFileSync(entry, 'utf8')
    const chunkPath = join(packageRoot, 'dist', outputChunk)
    const chunk = readFileSync(chunkPath, 'utf8')

    expect(source).toContain(`./${outputChunk}`)
    expect(source).not.toContain('//#region src/prune-static-css.ts')
    expect(source).not.toMatch(
      /(?:from|require\()\s*["'](?:postcss|postcss-selector-parser|magic-string|@ampproject\/remapping)["']/,
    )
    expect(chunk).toContain('//#region src/prune-static-css.ts')
    expect(chunk).toMatch(/(?:from|require\()\s*["']postcss["']/)
    expect(chunk).toMatch(/(?:from|require\()\s*["']postcss-selector-parser["']/)
    expect(chunk).toMatch(/(?:from|require\()\s*["']magic-string["']/)
    expect(chunk).toMatch(/(?:from|require\()\s*["']@ampproject\/remapping["']/)

    const { factoryFiles, outputFiles } = loadedFiles(entry)
    const factoryGraph = factoryFiles.map((file) => fileURLToPath(file))
    const outputGraph = outputFiles.map((file) => fileURLToPath(file))
    const outputExclusive = (file: string) =>
      file.endsWith(`/packages/vite/dist/${outputChunk}`) ||
      /\/node_modules\/\.pnpm\/(?:postcss|postcss-selector-parser|source-map-js|magic-string)@/.test(file) ||
      /\/node_modules\/\.pnpm\/(?:@ampproject\+remapping|@jridgewell\+(?:gen-mapping|trace-mapping|sourcemap-codec|resolve-uri))@/.test(
        file,
      )

    expect(factoryGraph.filter(outputExclusive)).toEqual([])
    expect(outputGraph.some((file) => file.endsWith(`/packages/vite/dist/${outputChunk}`))).toBe(true)
    expect(outputGraph.some((file) => /\/node_modules\/\.pnpm\/postcss@/.test(file))).toBe(true)
    expect(outputGraph.some((file) => /\/node_modules\/\.pnpm\/postcss-selector-parser@/.test(file))).toBe(true)
    expect(outputGraph.some((file) => /\/node_modules\/\.pnpm\/source-map-js@/.test(file))).toBe(true)
    expect(outputGraph.some((file) => /\/node_modules\/\.pnpm\/magic-string@/.test(file))).toBe(true)
    expect(outputGraph.some((file) => /\/node_modules\/\.pnpm\/@ampproject\+remapping@/.test(file))).toBe(true)
    expect(outputGraph.some((file) => /\/node_modules\/\.pnpm\/@jridgewell\+trace-mapping@/.test(file))).toBe(true)
  })
})
