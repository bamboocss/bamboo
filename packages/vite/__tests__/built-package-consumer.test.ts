import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = join(packageRoot, '../..')
const tsc = join(repositoryRoot, 'node_modules/.bin/tsc')

interface PackResult {
  filename: string
  files: Array<{ path: string }>
}

let consumerRoot: string
let consumerFixture: string
const packs = new Map<string, PackResult>()
const packageDirectories = new Map<string, string>()
const declarationEntries = new Map<string, string | undefined>()

const pack = (name: string) => {
  const result = JSON.parse(
    execFileSync('pnpm', ['--filter', name, 'pack', '--pack-destination', consumerRoot, '--json'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    }),
  ) as PackResult
  packs.set(name, result)
  return result
}

beforeAll(() => {
  consumerRoot = mkdtempSync(join(tmpdir(), 'bamboo-packed-consumer-'))
  const internalDependencies = new Map<string, string[]>()
  for (const entry of readdirSync(join(repositoryRoot, 'packages'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const directory = join(repositoryRoot, 'packages', entry.name)
    const manifestPath = join(directory, 'package.json')
    if (!existsSync(manifestPath)) continue
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      dependencies?: Record<string, string>
      exports?: { '.'?: { import?: { types?: string } } }
      name?: string
      types?: string
    }
    if (!manifest.name?.startsWith('@bamboocss/')) continue
    internalDependencies.set(
      manifest.name,
      Object.keys(manifest.dependencies ?? {}).filter((name) => name.startsWith('@bamboocss/')),
    )
    packageDirectories.set(manifest.name, directory)
    declarationEntries.set(manifest.name, manifest.exports?.['.']?.import?.types ?? manifest.types)
  }

  // Pack the complete internal runtime closure. A link to one unchanged workspace package is
  // enough to hide a mixed-format graph: its dependencies resolve from the monorepo instead of
  // the consumer install, which is not the package topology users run.
  const runtimeClosure = new Set<string>()
  const pending = ['@bamboocss/vite', '@bamboocss/node']
  for (const name of pending) {
    if (runtimeClosure.has(name)) continue
    runtimeClosure.add(name)
    pending.push(...(internalDependencies.get(name) ?? []))
  }
  // This packs `dist`, so it needs a build that emitted declarations. `pnpm check` provides one,
  // but CI shards unit tests into their own jobs where the only build is the `prepare` hook's
  // `build-fast`, which is `--dts=false`: the pack then carries runtime chunks and no `.d.mts`,
  // and every resolution assertion below fails on a package that is fine. Build what is missing
  // rather than assume, so this is a no-op after `pnpm check` and self-sufficient anywhere else.
  const unbuilt = [...runtimeClosure].filter((name) => {
    const types = declarationEntries.get(name)
    const directory = packageDirectories.get(name)
    return typeof types === 'string' && directory !== undefined && !existsSync(join(directory, types))
  })
  if (unbuilt.length > 0) {
    execFileSync('pnpm', [...unbuilt.flatMap((name) => ['--filter', name]), 'build'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      timeout: 600_000,
    })
  }

  const packedClosure = new Map([...runtimeClosure].sort().map((name) => [name, pack(name)]))
  const vitePack = packedClosure.get('@bamboocss/vite')!
  const nodePack = packedClosure.get('@bamboocss/node')!
  const overrides = Object.fromEntries(
    [...packedClosure].map(([name, result]) => [name, `file:${result.filename}`]),
  ) as Record<string, string>

  writeFileSync(
    join(consumerRoot, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        packageManager: 'pnpm@11.0.8',
        dependencies: {
          '@bamboocss/node': `file:${nodePack.filename}`,
          '@bamboocss/vite': `file:${vitePack.filename}`,
          vite: `link:${realpathSync(join(packageRoot, 'node_modules/vite'))}`,
        },
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(
    join(consumerRoot, 'pnpm-workspace.yaml'),
    `packages: []\noverrides:\n${Object.entries(overrides)
      .map(([name, target]) => `  ${JSON.stringify(name)}: ${JSON.stringify(target)}`)
      .join('\n')}\n`,
  )

  // `--prefer-offline`, not `--offline`. The consumer has no lockfile, so pnpm resolves this
  // graph fresh, and a transitive range can pick a version the repo's own install never put in
  // the store — `browserslist` reaching for a newer `electron-to-chromium` is what failed here.
  // Preferring the store keeps this fast and network-independent in the normal case, without
  // failing the build over a version the store was never going to have.
  execFileSync('pnpm', ['install', '--prefer-offline', '--ignore-scripts', '--no-frozen-lockfile'], {
    cwd: consumerRoot,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
    maxBuffer: 20 * 1024 * 1024,
    timeout: 120_000,
  })

  consumerFixture = join(consumerRoot, 'fixture')
  mkdirSync(join(consumerFixture, 'src'), { recursive: true })
  writeFileSync(
    join(consumerFixture, 'bamboo.config.mjs'),
    `export default { include: ['./src/**/*.{js,jsx,ts,tsx}'], outdir: 'styled-system' }\n`,
  )
}, 120_000)

afterAll(() => {
  if (consumerRoot) rmSync(consumerRoot, { force: true, recursive: true })
})

const typeConsumer = `
import bamboocss from '@bamboocss/vite'
import { isStaticCompilerActive as isStaticCompilerActiveFromRoot } from '@bamboocss/node'
import { isStaticCompilerActive, markStaticCompilerActive } from '@bamboocss/node/static-compiler'

const plugins = bamboocss()
const names: string[] = plugins.map((plugin) => plugin.name)
markStaticCompilerActive()
const active: boolean[] = [isStaticCompilerActive(), isStaticCompilerActiveFromRoot()]
void names
void active
`

type RuntimeAction = 'factory' | 'output' | 'transform'

const runtimeAction = (action: RuntimeAction, fixture: string) => {
  if (action === 'factory') return ''
  if (action === 'output') {
    return `
const cssPlugin = plugins.find((plugin) => plugin.name === 'bamboocss:css')
const generateBundle = typeof cssPlugin.generateBundle === 'function' ? cssPlugin.generateBundle : cssPlugin.generateBundle.handler
const stylesheet = ':root{--made-with-bamboo:🌱}'
const bundle = {
  'bamboo.css': { type: 'asset', fileName: 'bamboo.css', names: [], originalFileNames: [], source: stylesheet },
}
await generateBundle.call(
  { environment: { name: 'packed-consumer', config: { build: { sourcemap: false } } } },
  {},
  bundle,
  false,
)
if (bundle['bamboo.css'].source !== stylesheet) throw new Error('packed CSS-output path changed an unowned rule')
`
  }

  const source = `import { css } from 'styled-system/css'\nexport const className = css({ width: '[71.909px]' })\n`
  return `
const compiler = plugins.find((plugin) => plugin.name === 'bamboocss:compiler')
const transform = typeof compiler.transform === 'function' ? compiler.transform : compiler.transform.handler
const result = await transform.call(
  { addWatchFile() {}, environment: { name: 'packed-consumer' } },
  ${JSON.stringify(source)},
  ${JSON.stringify(fixture)} + '/src/__packed-package-consumer.tsx',
  {},
)
const code = typeof result === 'string' ? result : result && result.code
if (typeof code !== 'string' || !code.includes('w_[71.909px]')) throw new Error('packed transform did not fold')
`
}

const runtimeConsumer = (format: 'cjs' | 'mjs', action: RuntimeAction) => {
  const fixture = JSON.stringify(consumerFixture)
  const assertFactory = `
const plugins = bamboocss({ cwd: ${fixture}, reportSummary: false })
if (plugins.map((plugin) => plugin.name).join(',') !== 'bamboocss:css,bamboocss:compiler') throw new Error('bad packed plugins')
if (!globalThis[Symbol.for('bamboocss.static-compiler')]) throw new Error('packed factory did not announce the compiler')
`
  const actionSource = runtimeAction(action, consumerFixture)

  return format === 'mjs'
    ? `
import { registerHooks } from 'node:module'

const files = new Set()
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context)
    if (result.url.startsWith('file:')) files.add(result.url)
    return result
  },
})

try {
  const { default: bamboocss } = await import('@bamboocss/vite')
  ${assertFactory}
  ${actionSource}
} finally {
  hooks.deregister()
}
process.stdout.write(JSON.stringify([...files]))
`
    : `
const { registerHooks } = require('node:module')

const files = new Set()
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context)
    if (result.url.startsWith('file:')) files.add(result.url)
    return result
  },
})
const vite = require('@bamboocss/vite')
const bamboocss = vite.default

void (async () => {
  try {
    ${assertFactory}
    ${actionSource}
  } finally {
    hooks.deregister()
  }
  process.stdout.write(JSON.stringify([...files]))
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
`
}

const runRuntimeConsumer = (format: 'cjs' | 'mjs', action: RuntimeAction) => {
  const consumer = join(consumerRoot, `runtime-${action}.${format}`)
  writeFileSync(consumer, runtimeConsumer(format, action))
  return JSON.parse(
    execFileSync(process.execPath, [consumer], { cwd: consumerRoot, encoding: 'utf8', timeout: 120_000 }),
  ) as string[]
}

describe('packed and installed NodeNext consumers', () => {
  test('uses installed tarballs for the complete Bamboo runtime closure', () => {
    for (const name of ['vite', 'node']) {
      const installed = realpathSync(join(consumerRoot, 'node_modules/@bamboocss', name))
      expect(installed).toContain(`${consumerRoot}/node_modules/.pnpm/`)
      expect(installed).not.toContain(`${repositoryRoot}/packages/`)
      expect(existsSync(join(installed, 'src'))).toBe(false)
    }
  })

  test.each([
    ['ESM', 'mts', 'd.mts'],
    ['CommonJS', 'cts', 'd.cts'],
  ] as const)(
    '%s selects its matching declarations and the Vite default stays callable',
    (_, extension, declaration) => {
      const consumer = join(consumerRoot, `consumer.${extension}`)
      writeFileSync(consumer, typeConsumer)

      expect(execFileSync(tsc, ['--version'], { encoding: 'utf8' })).toMatch(/^Version 7\./)
      const trace = execFileSync(
        tsc,
        [
          '--ignoreConfig',
          '--noEmit',
          '--module',
          'NodeNext',
          '--moduleResolution',
          'NodeNext',
          '--target',
          'ES2022',
          '--esModuleInterop',
          '--skipLibCheck',
          '--traceResolution',
          consumer,
        ],
        { cwd: consumerRoot, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
      )

      expect(trace).toContain(`/node_modules/@bamboocss/vite/dist/index.${declaration}`)
      expect(trace).toContain(`/node_modules/@bamboocss/node/dist/index.${declaration}`)
      expect(trace).toContain(`/node_modules/@bamboocss/node/dist/static-compiler.${declaration}`)
    },
  )

  test.each([
    ['ESM', 'mjs', 'factory'],
    ['ESM', 'mjs', 'transform'],
    ['ESM', 'mjs', 'output'],
    ['CommonJS', 'cjs', 'factory'],
    ['CommonJS', 'cjs', 'transform'],
    ['CommonJS', 'cjs', 'output'],
  ] as const)('%s %s installed consumer runs a format-pure %s path in isolation', (_, format, action) => {
    const graph = runRuntimeConsumer(format, action).map((file) => fileURLToPath(file))
    const bambooFiles = graph.filter((file) =>
      /\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?@bamboocss\//.test(file),
    )
    const expectedExtension = format === 'mjs' ? '.mjs' : '.cjs'
    const oppositeExtension = format === 'mjs' ? '.cjs' : '.mjs'

    expect(graph.filter((file) => file.startsWith(repositoryRoot))).toEqual([])
    expect(bambooFiles.some((file) => file.endsWith(`/@bamboocss/vite/dist/index${expectedExtension}`))).toBe(true)
    expect(bambooFiles.filter((file) => file.endsWith(oppositeExtension))).toEqual([])

    if (action === 'factory') {
      expect(
        bambooFiles.some((file) => file.endsWith(`/@bamboocss/node/dist/static-compiler${expectedExtension}`)),
      ).toBe(true)
      expect(bambooFiles.some((file) => file.endsWith(`/@bamboocss/node/dist/index${expectedExtension}`))).toBe(false)
      expect(bambooFiles.some((file) => file.endsWith(`/@bamboocss/config/dist/index${expectedExtension}`))).toBe(false)
      expect(bambooFiles.some((file) => file.endsWith(`/@bamboocss/vite/dist/fold-module${expectedExtension}`))).toBe(
        false,
      )
      expect(
        bambooFiles.some((file) => file.endsWith(`/@bamboocss/vite/dist/css-output-module${expectedExtension}`)),
      ).toBe(false)
    } else if (action === 'transform') {
      expect(bambooFiles.some((file) => file.endsWith(`/@bamboocss/vite/dist/fold-module${expectedExtension}`))).toBe(
        true,
      )
      expect(bambooFiles.some((file) => file.endsWith(`/@bamboocss/node/dist/index${expectedExtension}`))).toBe(true)
      expect(bambooFiles.some((file) => file.endsWith(`/@bamboocss/config/dist/index${expectedExtension}`))).toBe(true)
      expect(bambooFiles.some((file) => file.endsWith(`/@bamboocss/extractor/dist/index${expectedExtension}`))).toBe(
        true,
      )
      expect(
        bambooFiles.some((file) =>
          file.endsWith(`/@bamboocss/config/dist/resolve-ts-path-pattern${expectedExtension}`),
        ),
      ).toBe(true)
      expect(
        bambooFiles.some((file) => file.endsWith(`/@bamboocss/vite/dist/css-output-module${expectedExtension}`)),
      ).toBe(false)
    } else {
      expect(
        bambooFiles.some((file) => file.endsWith(`/@bamboocss/vite/dist/css-output-module${expectedExtension}`)),
      ).toBe(true)
      expect(bambooFiles.some((file) => file.endsWith(`/@bamboocss/node/dist/index${expectedExtension}`))).toBe(false)
      expect(bambooFiles.some((file) => file.endsWith(`/@bamboocss/config/dist/index${expectedExtension}`))).toBe(false)
      expect(bambooFiles.some((file) => file.endsWith(`/@bamboocss/vite/dist/fold-module${expectedExtension}`))).toBe(
        false,
      )
    }
  })

  test('packs every declaration and runtime chunk targeted by the package graphs', () => {
    const packedFiles = (name: string) => packs.get(name)!.files.map((file) => file.path)
    const viteManifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
      exports: Record<string, unknown>
    }

    expect(viteManifest.exports['./node-module']).toBeUndefined()
    expect(viteManifest.exports['./config-module']).toBeUndefined()

    const exportedFiles = (directory: string) => {
      const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as { exports: unknown }
      const files: string[] = []
      const visit = (value: unknown): void => {
        if (typeof value === 'string') {
          if (value.startsWith('./')) files.push(value.slice(2))
          return
        }
        if (value && typeof value === 'object') {
          for (const [condition, target] of Object.entries(value)) {
            // `source` is the repository-wide workspace development condition. This assertion
            // covers the built runtime and type targets selected by installed consumers.
            if (condition !== 'source') visit(target)
          }
        }
      }
      visit(manifest.exports)
      return files
    }

    const assertPackIsComplete = (name: string, directory: string) => {
      const packed = packedFiles(name)
      const exported = exportedFiles(directory)
      expect(packed).toEqual(expect.arrayContaining(exported))

      for (const declaration of exported.filter((file) => /\.d\.[cm]ts$/.test(file))) {
        const source = readFileSync(join(directory, declaration), 'utf8')
        for (const match of source.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g)) {
          const specifier = match[1]
          const dependency = specifier.endsWith('.mjs')
            ? `${specifier.slice(0, -4)}.d.mts`
            : specifier.endsWith('.cjs')
              ? `${specifier.slice(0, -4)}.d.cts`
              : specifier
          expect(packed).toContain(join(dirname(declaration), dependency))
        }
      }

      // Runtime chunks are reached by relative imports rather than package exports. Walk every
      // packed JavaScript file so a missing lazy CJS or ESM chunk cannot pass the export check.
      for (const runtime of packed.filter((file) => /\.[cm]js$/.test(file))) {
        const source = readFileSync(join(directory, runtime), 'utf8')
        for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["'](\.[^"']+)["']/g)) {
          // Extensionless requires inside bundled third-party code are runtime resolution
          // branches, not emitted chunks. Tsdown's own chunks always carry the target format.
          if (!/\.[cm]js$/.test(match[1])) continue
          expect(packed).toContain(join(dirname(runtime), match[1]))
        }
      }
    }

    assertPackIsComplete('@bamboocss/vite', packageRoot)
    expect(packedFiles('@bamboocss/vite')).toEqual(
      expect.arrayContaining([
        'dist/config-module.mjs',
        'dist/config-module.cjs',
        'dist/css-output-module.mjs',
        'dist/css-output-module.cjs',
        'dist/fold-module.mjs',
        'dist/fold-module.cjs',
        'dist/node-module.mjs',
        'dist/node-module.cjs',
      ]),
    )
    assertPackIsComplete('@bamboocss/node', join(repositoryRoot, 'packages/node'))
  })
})
