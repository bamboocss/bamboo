import type { Context } from '@bamboocss/core'

/**
 * The generated output is a plain directory, not an installed package, so bundlers
 * have no `sideEffects` hint for it and must assume every module mutates something.
 * That keeps every module a barrel pulls in — importing a single component from
 * `styled-system/jsx` retains all patterns.
 *
 * The CSS globs are required: `sideEffects: false` alone lets a bundler drop a bare
 * `import 'styled-system/styles.css'`. Both shapes are listed because the stylesheet
 * is emitted at the root (`styles.css`) and, under `splitting`, in `styles/`.
 *
 * `type: module` restates what the directory already is. Adding a package.json makes
 * this directory its own package boundary, so `.js` output would otherwise stop
 * inheriting the consumer's `type` and be re-read as CommonJS; the emitted code is
 * always ESM. It is a no-op for the default `.mjs` extension.
 *
 * `private` is there because the same package boundary makes a workspace glob able to
 * match this directory. It is never published.
 *
 * `name` has to be present for the same reason. This file used to be emitted without
 * one, to keep two outputs in a single workspace from colliding — but a nameless
 * package.json is not a package a workspace scanner skips, it is one it refuses:
 * pnpm, npm and changesets all abort with `missing the "name" field` and no hint as
 * to which directory produced it.
 *
 * The name is derived from `outdir` because that is the only input that is both
 * deterministic and portable — `cwd` is absolute, so putting it here would make the
 * generated output differ per machine. Two projects in one workspace that both keep
 * the default `outdir` therefore still collide, but on a duplicate-name error that
 * names both paths and is resolved by setting `outdir`, rather than on a missing
 * field that points nowhere.
 */
export function generatePackageJson(ctx: Context) {
  return {
    json:
      JSON.stringify(
        {
          name: toPackageName(ctx.config.outdir),
          type: 'module',
          private: true,
          sideEffects: ['*.css', '**/*.css'],
          exports: generatePackageExports(ctx),
        },
        null,
        2,
      ) + '\n',
  }
}

/**
 * The entry points this output offers, and — where it is resolved as a package — the only
 * paths into it.
 *
 * Two things this buys, and one it does not.
 *
 * It makes the entry points resolve under `node16`/`nodenext`. Without a map, those modes do
 * no directory-index lookup, so `styled-system/tokens` does not resolve at all and the
 * artifact has to be spelled `styled-system/tokens/index.mjs` — a workaround
 * `token-references.ts` still has to recognise because people write it. Declaring `./tokens`
 * is what makes the ordinary spelling work.
 *
 * It states the boundary. `css/merge-css`, `css/utilities`, `tokens/tokens` and `helpers`
 * exist to be imported by the modules beside them, not by an app; a relative import inside
 * the package is unaffected by this map, an external one now fails.
 *
 * What it does not do is enforce that against the common setup. The generated directory
 * usually lives in the project and is reached through a `paths` alias —
 * `"styled-system/*": ["./styled-system/*"]` — and a `paths` mapping resolves straight to the
 * filesystem, so no `exports` map is consulted. There is nothing this file can do about that;
 * the enforcement lands where the output is consumed as a real package, which is the
 * component-library layout `emit-pkg` produces.
 *
 * `./types` carries no runtime target because the directory holds only declarations. A type
 * import resolves; a value import fails, which is the truth about it.
 */
export function generatePackageExports(ctx: Context, base?: string) {
  const path = (...parts: string[]) => ['.', base, ...parts].filter(Boolean).join('/')

  const entry = (dir: string) => ({
    types: path(ctx.file.extDts(`${dir}/index`)),
    default: path(ctx.file.ext(`${dir}/index`)),
  })

  const exports: Record<string, unknown> = {}

  const add = (dir: string) => {
    const target = entry(dir)
    exports[`./${dir}`] = target
    // The spelling `node16` used to require, kept working so upgrading to a map that makes it
    // unnecessary does not also make it an error.
    exports[`./${ctx.file.ext(`${dir}/index`)}`] = target
  }

  add('css')
  add('tokens')

  if (!ctx.patterns.isEmpty()) add('patterns')
  if (!ctx.recipes.isEmpty()) add('recipes')
  if (ctx.config.theme?.variants) add('themes')

  exports['./types'] = { types: path(ctx.file.extDts('types/index')) }

  // Emitted at the root, and under `cssgen --splitting` as `styles/<layer>.css` with a
  // directory per recipe below that.
  exports['./styles.css'] = path('styles.css')
  exports['./styles/*'] = path('styles/*')

  // `bamboo spec` writes these, and they are read as data rather than imported as modules.
  exports['./specs/*'] = path('specs/*')

  exports['./package.json'] = path('package.json')

  return exports
}

/**
 * `outdir` is a path, npm names are not: it may be nested (`src/styled-system`), and
 * npm rejects uppercase, a leading dot or underscore, and anything outside its
 * url-safe set. Path segments are joined rather than dropped so that nested outputs
 * stay distinct from one another.
 */
function toPackageName(outdir: string) {
  const name = outdir
    .split(/[\\/]/)
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9\-._]/g, '-')
    .replace(/^[._]+/, '')

  return name || 'styled-system'
}
