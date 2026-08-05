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
        },
        null,
        2,
      ) + '\n',
  }
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
