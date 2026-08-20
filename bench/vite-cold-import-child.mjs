import { writeFileSync } from 'node:fs'

const [mode, target, graphPath] = process.argv.slice(2)

if (mode === 'import') {
  if (!target) throw new Error('The import child requires a target URL')
  await import(target)
} else if (mode === 'graph') {
  if (!target || !graphPath) throw new Error('The graph child requires a target URL and output path')
  const { registerHooks } = await import('node:module')
  if (typeof registerHooks !== 'function') throw new Error('Graph identity requires Node.js 24 or newer')

  const files = new Set()
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      const result = nextResolve(specifier, context)
      if (result.url.startsWith('file:')) files.add(result.url)
      return result
    },
  })
  try {
    await import(target)
  } finally {
    hooks.deregister()
  }
  writeFileSync(graphPath, JSON.stringify([...files]))
  // Artifact discovery must not inherit handles opened as an import side effect.
  process.exit(0)
} else if (mode !== 'control') {
  throw new Error(`Unknown cold-import child mode: ${String(mode)}`)
}
