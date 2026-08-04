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
 * match this directory. It stays nameless so that several outputs in one workspace
 * cannot collide.
 */
export function generatePackageJson() {
  return {
    json:
      JSON.stringify(
        {
          type: 'module',
          private: true,
          sideEffects: ['*.css', '**/*.css'],
        },
        null,
        2,
      ) + '\n',
  }
}
