import { writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { join } from 'node:path'

const [target, graphPath, transformCwd] = process.argv.slice(2)
if (!target || !graphPath) throw new Error('Expected a built entry URL and graph output path')

const files = new Set()
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context)
    if (result.url.startsWith('file:')) files.add(result.url)
    return result
  },
})

let factoryFiles
let outputFiles
let transformFiles
try {
  const exports = await import(target)
  const factory =
    typeof exports.default === 'function'
      ? exports.default
      : typeof exports.default?.default === 'function'
        ? exports.default.default
        : undefined
  if (!factory) throw new Error('Built Vite entry has no callable default export')

  const flag = Symbol.for('bamboocss.static-compiler')
  globalThis[flag] = false
  const plugins = factory(transformCwd ? { cwd: transformCwd, reportSummary: false } : undefined)
  if (!globalThis[flag]) throw new Error('Plugin factory did not synchronously announce the static compiler')
  if (plugins.map((plugin) => plugin.name).join(',') !== 'bamboocss:css,bamboocss:compiler') {
    throw new Error('Plugin factory did not synchronously return the public plugin pair')
  }

  factoryFiles = [...files]

  if (transformCwd) {
    const cssPlugin = plugins.find((plugin) => plugin.name === 'bamboocss:css')
    const generateBundle =
      typeof cssPlugin?.generateBundle === 'function' ? cssPlugin.generateBundle : cssPlugin?.generateBundle?.handler
    if (!generateBundle) throw new Error('Built Vite CSS plugin has no generateBundle hook')

    const stylesheet =
      '@layer reset, base, tokens, utilities;@layer utilities{.d_flex{display:flex}}:root{--made-with-bamboo:🌱}'
    const bundle = {
      'assets/bamboo.css': {
        type: 'asset',
        fileName: 'assets/bamboo.css',
        names: [],
        originalFileNames: [],
        source: stylesheet,
      },
    }
    await generateBundle.call(
      { environment: { name: 'client', config: { build: { sourcemap: false } } } },
      {},
      bundle,
      false,
    )
    if (bundle['assets/bamboo.css'].source !== stylesheet) {
      throw new Error('Built Vite CSS-output path changed an unowned rule')
    }
    outputFiles = [...files]

    const compiler = plugins.find((plugin) => plugin.name === 'bamboocss:compiler')
    const transform = typeof compiler?.transform === 'function' ? compiler.transform : compiler?.transform?.handler
    if (!transform) throw new Error('Built Vite compiler has no transform hook')

    const source = `import { css } from 'styled-system/css'\nexport const className = css({ color: 'red.300' })\n`
    const result = await transform.call(
      { addWatchFile() {}, environment: { name: 'client' } },
      source,
      join(transformCwd, 'src/__built-lazy-fold-probe.tsx'),
      {},
    )
    const code = typeof result === 'string' ? result : result?.code
    if (typeof code !== 'string' || !code.includes('c_red.300')) {
      throw new Error('Built Vite compiler did not cross the lazy boundary and fold the probe')
    }
    transformFiles = [...files]
  }
} finally {
  hooks.deregister()
}

writeFileSync(graphPath, JSON.stringify({ factoryFiles, outputFiles, transformFiles }))
// Factory construction must not inherit handles opened by a dependency by accident.
process.exit(0)
