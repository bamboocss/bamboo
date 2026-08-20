import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export { isStaticCompilerActive, markStaticCompilerActive } from './static-compiler'

/**
 * Every extension Vite accepts for its config, so "is this a Vite project" is answered by the
 * same file Vite itself would load.
 *
 * A file rather than a resolvable `vite` package: Vite is a transitive dependency of plenty of
 * things — Vitest above all — and a project that has one for its tests and builds with webpack
 * is exactly the case this must not mistake for a Vite app.
 */
const VITE_CONFIG_FILES = [
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.mts',
  'vite.config.cjs',
  'vite.config.cts',
]

/** The project's Vite config, if it has one. Not resolved further than existence. */
export const findViteConfig = (cwd: string) =>
  VITE_CONFIG_FILES.map((file) => join(cwd, file)).find((file) => existsSync(file))

/**
 * Frameworks that author styles in a file the Vite compiler does not transform.
 *
 * It compiles JavaScript and TypeScript. A `.svelte`, `.vue` or `.astro` file is a template
 * with a script in it, and the compiler leaves those alone — which for a Svelte or Vue project
 * makes the PostCSS integration the right one, not a downgrade. Worse than that: switching one
 * to `@bamboocss/vite` would prune every rule only its components reach, since reachability is
 * computed from modules the compiler saw, so the pages would render unstyled.
 *
 * So this is the exception to the advice, and it has to be checked before giving it.
 */
const TEMPLATE_EXTENSIONS = /\b(?:svelte|vue|astro|html|hbs|mdx?)\b/
const TEMPLATE_PACKAGES = ['svelte', '@sveltejs/kit', 'vue', 'nuxt', 'astro']

/**
 * Does this project author styles somewhere the Vite compiler cannot reach?
 *
 * Two signals because the two callers know different things. A resolved config names the file
 * types directly, and is authoritative when it does; `bamboo init` runs before there is one,
 * so the dependency list stands in. Either one is enough — both directions of a wrong answer
 * here only decide whether advice is offered, and the advice is worth less than a Svelte
 * project being told to break itself.
 */
export const hasUncompilableSources = (options: { cwd: string; include?: readonly string[] }) => {
  if (options.include?.some((glob) => TEMPLATE_EXTENSIONS.test(glob))) return true

  try {
    const manifest = JSON.parse(readFileSync(join(options.cwd, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const dependencies = { ...manifest.dependencies, ...manifest.devDependencies }
    return TEMPLATE_PACKAGES.some((name) => name in dependencies)
  } catch {
    // No package.json, or one that is not readable JSON. Neither is a reason to say anything
    // about it, and both are a reason not to throw from a diagnostic.
    return false
  }
}
