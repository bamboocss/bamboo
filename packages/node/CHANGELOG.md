# @bamboocss/node

## 1.13.1

### Patch Changes

- @bamboocss/config@1.13.1
- @bamboocss/core@1.13.1
- @bamboocss/generator@1.13.1
- @bamboocss/logger@1.13.1
- @bamboocss/parser@1.13.1
- @bamboocss/plugin-lightningcss@1.13.1
- @bamboocss/plugin-svelte@1.13.1
- @bamboocss/plugin-vue@1.13.1
- @bamboocss/reporter@1.13.1
- @bamboocss/shared@1.13.1
- @bamboocss/token-dictionary@1.13.1
- @bamboocss/types@1.13.1

## 1.13.0

### Minor Changes

- a07286f: Add `pruneUnusedKeyframes`, dropping `@keyframes` rules nothing can reach.

  A preset declares every animation it offers and an app uses a handful. The rest sit in the one stylesheet that blocks
  first paint. On the fixture preset this drops all four unused keyframes and 436 bytes; it scales with the size of the
  design system rather than the app, the same way `pruneUnusedTokens` does.

  It is **off by default** and changes nothing until switched on.

  Only keyframes the theme declares are ever removed, so one emitted by `globalCss` is left alone. A name is kept when
  an animation property in the generated css names it, when it appears anywhere under `include`, or when it is named in
  a custom property that is itself reachable.

  That last clause is what makes the pass worth having. `preset-bamboo` declares
  `--animations-spin: spin 1s linear infinite` whether or not anything uses that token, so counting every custom
  property as a reference would keep every keyframe the preset ships. References from a custom property are held back
  and only credited once the property is reached through `var()`, following the chain — the same reachability model
  `pruneTokenVars` uses.

  Names are recovered by tokenizing values and testing each token against the declared set, rather than by parsing the
  `animation` shorthand, which interleaves durations, easings and directions in any order. A keyframe named after a
  keyword therefore always looks referenced. That is the intended bias: keeping an unused keyframe costs bytes, dropping
  a used one silently stops an animation.

  The textual scan over `include` covers what the css cannot show — an animation name assembled at runtime, or applied
  through an inline `style` rather than through bamboo.

- a5cb5a8: Add `pruneUnusedTokens`, dropping token css variables nothing can reach.

  The token layer declares every token in the theme. An app uses a fraction of them, so most of what it declares is dead
  weight in the one stylesheet that blocks first paint. On the `vite-ts` sandbox, with the default preset, this takes
  `styles.css` from 24,433 to 12,293 bytes — 6,398 to 3,504 gzipped. It scales with the size of the design system rather
  than the app: `preset-bamboo` declares 432 variables, `preset-atlaskit` 837, `preset-open-props` 898.

  It is **off by default** and changes nothing until switched on.

  A variable is kept when the generated css references it, when a kept variable's own value references it, or when it is
  named by `token()` or `token.var()` or a literal `var(--x)` anywhere under `include`. Tokens that javascript receives
  as a reference rather than a literal are always kept, because `token('colors.text')` hands the caller a `var()`
  whether or not the css mentions it. That covers virtual tokens, any token carrying a condition, and negative tokens —
  `spacing.-4` resolves to `calc(var(--spacing-4) * -1)`, so what has to survive is the _positive_ token's declaration,
  not its own. So is anything a theme refers to: a theme is a separate artifact injected at runtime, so nothing in the
  sheet points at what it needs.

  The negative-token rule is the one with a visible price, and there is no opt-out. A spacing scale generates one
  negative per entry, so the whole scale is pinned whether or not the app uses it: on the default preset an app
  referencing a single colour keeps 37 spacing variables, about a third of everything that survives. Presets with large
  spacing scales therefore see less than the numbers above.

  The walk follows any custom property, not only the removable ones. A colour palette is what forces that:
  `colorPalette: 'red'` emits `--colors-color-palette-300: var(--colors-red-300)`, and those palette properties are
  virtual, so stopping at them would leave the rule pointing at colours that had been removed.

  Two limits are deliberate:
  - Only custom properties the token system declares are eligible. `globalCss` output is never touched. `preset-base`
    declares the filter and gradient composition properties on the universal selector precisely so a parent's value
    cannot inherit into a descendant; they look unreferenced, and removing them would change rendering. The `styles.css`
    post-processing this option replaces does remove them.
  - Reachability cannot be proven for every reference. A token named by a path the source does not spell out as a string
    literal — `token.var(key)` — one used only from a stylesheet outside `include`, or one consumed by a separate
    package treating the output as design tokens, is invisible. Keep those with `staticCss`.

  Pruning runs wherever a complete stylesheet is assembled — `bamboo`, `bamboo cssgen`, watch mode and the PostCSS
  plugin — and never on a partial one such as `cssgen tokens`, where nothing would be left to reference the tokens.
  Collecting the references reads every source file, so that work stays behind the flag.

### Patch Changes

- 5b16a67: Emit a `package.json` into the generated output so bundlers can tree-shake the barrels.

  The output is a plain directory rather than an installed package, so it carried no `sideEffects` hint and bundlers had
  to assume every module mutates something. Nothing a barrel reached could be dropped:
  `import { Box } from 'styled-system/jsx'` retained all twenty pattern modules, and a deep import at
  `styled-system/jsx/box.mjs` — which nobody writes — produced a materially smaller bundle than the documented one.

  Declaring `sideEffects` closes that gap. A barrel import now costs what the deep import costs: 41.2 KB to 34.1 KB
  minified, 12.6 KB to 10.7 KB gzipped, with nineteen unused pattern modules dropped. The patterns barrel improves by
  about 26%; recipes scale with how many are defined. In a real Vite build of `sandbox/vite-ts` — an app that does use
  several patterns, so it sees less than the ceiling — JS goes from 242.22 KB to 236.95 KB with the CSS byte-identical.

  Two details in the emitted file are load-bearing:
  - `sideEffects` lists CSS globs rather than being a bare `false`. A bare `false` permits a bundler to drop
    `import 'styled-system/styles.css'`, which is how the stylesheet reaches CLI-flow apps. Vite happens to retain CSS
    imports regardless, but webpack historically does not. Both `*.css` and `**/*.css` are listed because the stylesheet
    is emitted at the root and, under `splitting`, in `styles/`.
  - `type` is set to `module`. Adding a `package.json` makes the output its own package boundary, so `.js` output would
    stop inheriting the consumer's `type` and be re-read as CommonJS. The emitted code is always ESM. This is a no-op
    under the default `mjs` extension and only matters for `outExtension: 'js'`.
  - `private` is set, and the file stays nameless. That same package boundary lets a workspace glob match the output
    directory — this repo's own `packages/**` now does — so it is marked unpublishable, and left unnamed so that several
    outputs in one workspace cannot collide.

  Unlike the rest of the output, `package.json` is not exclusively ours — `emit-pkg` writes entrypoints to the same path
  and consumers hand-edit it — so it is merged rather than overwritten. Only absent keys are filled in: an existing
  `exports` map survives, and a deliberate `sideEffects` or `type` is left as it stands. A file that cannot be parsed as
  JSON is reported and skipped rather than replaced. The merged file keeps its trailing newline, so a consumer who
  tracks it in source control does not see a diff on every codegen.

  `emit-pkg` had to learn the other half of that arrangement. It used to write a whole package only when the directory
  had none, and codegen now always leaves one there, so it would have contributed an entrypoint map to a nameless
  `private` file and stopped — no `name`, no `version`, no `license`, nothing publishable or resolvable. It now reads a
  file without a `name` as ours: it supplies the identity that file lacks and lifts the `private` flag that kept a
  nameless directory unpublishable, which is the whole point of running it. A file that already carries a `name` belongs
  to the consumer and is still left alone but for `exports`.

  This only affects what bundlers may discard, so no CSS output or class name changes.

- 5b881ee: Re-parse importers when a shared style file changes in watch mode.

  Cross-file extraction folds an imported value into the importing file's output, so editing `styles.ts` had to re-parse
  everyone importing it — watch only re-parsed and rebundled the changed file, leaving consumers emitting the previous
  styles until the process restarted.

  The parser now records a reverse dependency graph while parsing, covering both imports and re-exports, and exposes
  `project.getDependents(filePath)` for the transitive set. Watch rebundles those alongside the changed file. Edges are
  rebuilt on each parse, so removing an import stops forcing a rebuild of the file it no longer depends on.

- 5b881ee: Use absolute paths consistently in the file watchers.

  The watch handlers removed files by absolute path but reloaded and created them by the path the watcher reported,
  which is relative to the working directory. A reload that fails to match the file the project holds does nothing and
  returns quietly, leaving the edit unread — and with cross-file extraction, an unread edit also leaves every importer
  emitting the previous styles.

  A newly added file now also rebuilds the files importing it, since it can satisfy an import that previously resolved
  to nothing.

- 5b881ee: Build the stylesheet once per edit, not once per affected file.

  The stylesheet is built from the whole parser result, so rebuilding it per file meant one edit to a shared style file
  ran the full optimize pipeline and wrote to disk once for every file importing it — 61 builds and 61 writes for a file
  with 60 importers. Affected files are now re-parsed first and the sheet is built and written a single time.

  A file appearing also reaches the files that were importing it before it existed. Those importers have no dependency
  edge to follow, since the specifier resolved to nothing when they were parsed, so they are tracked separately and
  rebuilt when a new file arrives.

- 5b881ee: Serve fresh values to importers after a shared style file is edited or deleted.

  Resolved values are memoized against the AST node that produced them, but a node's value can come from another file —
  `css(button)` folds whatever `./styles` exports. Editing that file replaces only its own nodes, so an importer's nodes
  stayed identical and kept serving the value read before the edit. Re-parsing the importer was not enough to clear it.

  The memo is now dropped whenever a file's contents are replaced or reloaded, which is the point at which another
  file's resolutions can have gone out of date. Deleting a shared file also rebuilds its importers, resolving them
  before the file leaves the project rather than after, when its path can no longer be matched.

- Updated dependencies [9ffb84f]
- Updated dependencies [e482ab3]
- Updated dependencies [5b881ee]
- Updated dependencies [7bf6798]
- Updated dependencies [8a6c23e]
- Updated dependencies [17de3d0]
- Updated dependencies [cd76ba7]
- Updated dependencies [11c9409]
- Updated dependencies [9ffb84f]
- Updated dependencies [fd03a10]
- Updated dependencies [a07286f]
- Updated dependencies [a5cb5a8]
- Updated dependencies [9ffb84f]
- Updated dependencies [172fec0]
- Updated dependencies [a966bae]
- Updated dependencies [5b16a67]
- Updated dependencies [a24d37a]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
  - @bamboocss/generator@1.13.0
  - @bamboocss/shared@1.13.0
  - @bamboocss/parser@1.13.0
  - @bamboocss/types@1.13.0
  - @bamboocss/core@1.13.0
  - @bamboocss/reporter@1.13.0
  - @bamboocss/config@1.13.0
  - @bamboocss/token-dictionary@1.13.0
  - @bamboocss/logger@1.13.0
  - @bamboocss/plugin-lightningcss@1.13.0
  - @bamboocss/plugin-svelte@1.13.0
  - @bamboocss/plugin-vue@1.13.0

## 1.12.3

### Patch Changes

- Updated dependencies
  - @bamboocss/core@1.12.3
  - @bamboocss/generator@1.12.3
  - @bamboocss/reporter@1.12.3
  - @bamboocss/parser@1.12.3
  - @bamboocss/config@1.12.3
  - @bamboocss/logger@1.12.3
  - @bamboocss/plugin-lightningcss@1.12.3
  - @bamboocss/plugin-svelte@1.12.3
  - @bamboocss/plugin-vue@1.12.3
  - @bamboocss/shared@1.12.3
  - @bamboocss/token-dictionary@1.12.3
  - @bamboocss/types@1.12.3

## 1.12.2

### Patch Changes

- @bamboocss/config@1.12.2
- @bamboocss/core@1.12.2
- @bamboocss/generator@1.12.2
- @bamboocss/logger@1.12.2
- @bamboocss/parser@1.12.2
- @bamboocss/plugin-lightningcss@1.12.2
- @bamboocss/plugin-svelte@1.12.2
- @bamboocss/plugin-vue@1.12.2
- @bamboocss/reporter@1.12.2
- @bamboocss/shared@1.12.2
- @bamboocss/token-dictionary@1.12.2
- @bamboocss/types@1.12.2

## 1.12.1

### Patch Changes

- @bamboocss/config@1.12.1
- @bamboocss/core@1.12.1
- @bamboocss/generator@1.12.1
- @bamboocss/logger@1.12.1
- @bamboocss/parser@1.12.1
- @bamboocss/plugin-lightningcss@1.12.1
- @bamboocss/plugin-svelte@1.12.1
- @bamboocss/plugin-vue@1.12.1
- @bamboocss/reporter@1.12.1
- @bamboocss/shared@1.12.1
- @bamboocss/token-dictionary@1.12.1
- @bamboocss/types@1.12.1

## 1.12.0

### Patch Changes

- @bamboocss/config@1.12.0
- @bamboocss/core@1.12.0
- @bamboocss/generator@1.12.0
- @bamboocss/logger@1.12.0
- @bamboocss/parser@1.12.0
- @bamboocss/plugin-lightningcss@1.12.0
- @bamboocss/plugin-svelte@1.12.0
- @bamboocss/plugin-vue@1.12.0
- @bamboocss/reporter@1.12.0
- @bamboocss/shared@1.12.0
- @bamboocss/token-dictionary@1.12.0
- @bamboocss/types@1.12.0

## 1.11.5

### Patch Changes

- Updated dependencies [f3591d8]
  - @bamboocss/config@1.11.5
  - @bamboocss/core@1.11.5
  - @bamboocss/generator@1.11.5
  - @bamboocss/reporter@1.11.5
  - @bamboocss/parser@1.11.5
  - @bamboocss/logger@1.11.5
  - @bamboocss/plugin-lightningcss@1.11.5
  - @bamboocss/plugin-svelte@1.11.5
  - @bamboocss/plugin-vue@1.11.5
  - @bamboocss/shared@1.11.5
  - @bamboocss/token-dictionary@1.11.5
  - @bamboocss/types@1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit
- Updated dependencies
  - @bamboocss/config@1.11.4
  - @bamboocss/core@1.11.4
  - @bamboocss/generator@1.11.4
  - @bamboocss/logger@1.11.4
  - @bamboocss/parser@1.11.4
  - @bamboocss/plugin-lightningcss@1.11.4
  - @bamboocss/plugin-svelte@1.11.4
  - @bamboocss/plugin-vue@1.11.4
  - @bamboocss/reporter@1.11.4
  - @bamboocss/shared@1.11.4
  - @bamboocss/token-dictionary@1.11.4
  - @bamboocss/types@1.11.4

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output
- Updated dependencies
  - @bamboocss/config@1.11.3
  - @bamboocss/core@1.11.3
  - @bamboocss/generator@1.11.3
  - @bamboocss/logger@1.11.3
  - @bamboocss/parser@1.11.3
  - @bamboocss/plugin-lightningcss@1.11.3
  - @bamboocss/plugin-svelte@1.11.3
  - @bamboocss/plugin-vue@1.11.3
  - @bamboocss/reporter@1.11.3
  - @bamboocss/shared@1.11.3
  - @bamboocss/token-dictionary@1.11.3
  - @bamboocss/types@1.11.3

## 1.11.2

### Patch Changes

- 0f49103: migrate build to tsdown
- migrate to tsdown
- Updated dependencies [0f49103]
- Updated dependencies
  - @bamboocss/plugin-lightningcss@1.11.2
  - @bamboocss/token-dictionary@1.11.2
  - @bamboocss/plugin-svelte@1.11.2
  - @bamboocss/plugin-vue@1.11.2
  - @bamboocss/generator@1.11.2
  - @bamboocss/reporter@1.11.2
  - @bamboocss/config@1.11.2
  - @bamboocss/logger@1.11.2
  - @bamboocss/parser@1.11.2
  - @bamboocss/shared@1.11.2
  - @bamboocss/types@1.11.2
  - @bamboocss/core@1.11.2

## 1.11.1

### Patch Changes

- 2f29aa6: Bump `postcss` from `8.5.6` to `8.5.14` to address
  [CVE-2026-41305](https://www.cve.org/CVERecord?id=CVE-2026-41305).
- Updated dependencies [2f29aa6]
- Updated dependencies [1d781ff]
- Updated dependencies [2ea9205]
  - @bamboocss/core@1.11.1
  - @bamboocss/generator@1.11.1
  - @bamboocss/parser@1.11.1
  - @bamboocss/types@1.11.1
  - @bamboocss/reporter@1.11.1
  - @bamboocss/config@1.11.1
  - @bamboocss/logger@1.11.1
  - @bamboocss/plugin-lightningcss@1.11.1
  - @bamboocss/plugin-svelte@1.11.1
  - @bamboocss/plugin-vue@1.11.1
  - @bamboocss/token-dictionary@1.11.1
  - @bamboocss/shared@1.11.1

## 1.11.0

### Patch Changes

- Updated dependencies [b567ae6]
- Updated dependencies [0608e92]
- Updated dependencies [055e69c]
- Updated dependencies [78869ae]
  - @bamboocss/parser@1.11.0
  - @bamboocss/core@1.11.0
  - @bamboocss/types@1.11.0
  - @bamboocss/config@1.11.0
  - @bamboocss/generator@1.11.0
  - @bamboocss/reporter@1.11.0
  - @bamboocss/logger@1.11.0
  - @bamboocss/plugin-lightningcss@1.11.0
  - @bamboocss/plugin-svelte@1.11.0
  - @bamboocss/plugin-vue@1.11.0
  - @bamboocss/token-dictionary@1.11.0
  - @bamboocss/shared@1.11.0

## 1.10.0

### Minor Changes

- bbaa8b3: - Extract Vue, Svelte, and LightningCSS support into standalone plugins.
  - Fix double CSS optimization in PostCSS plugin.

### Patch Changes

- c31f3a2: Improve error handling architecture across all packages.
- 22b444d: Replace discontinued `tsconfck` with [`get-tsconfig`](https://github.com/privatenumber/get-tsconfig) for
  resolving and parsing `tsconfig.json` (including `extends`).
- bc2b8d7: Dependency updates for reported security advisories.
  - **@bamboocss/node** / **@bamboocss/token-dictionary**: bump `picomatch` to 4.0.4
    ([GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p),
    [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj)).
  - **@bamboocss/mcp**: bump `@modelcontextprotocol/sdk` to ^1.25.2.
  - **@bamboocss/astro-plugin-studio**: bump `astro` (dev) to 5.18.1.

- 44457bb: Use TypeScript 6.0 or later with Bamboo. This release updates static analysis and codegen to ts-morph v28 and
  TypeScript 6.0.2.
- Updated dependencies [c31f3a2]
- Updated dependencies [bbaa8b3]
- Updated dependencies [bc2b8d7]
- Updated dependencies [8d3b6f8]
- Updated dependencies [44457bb]
  - @bamboocss/types@1.10.0
  - @bamboocss/logger@1.10.0
  - @bamboocss/shared@1.10.0
  - @bamboocss/core@1.10.0
  - @bamboocss/config@1.10.0
  - @bamboocss/generator@1.10.0
  - @bamboocss/plugin-vue@1.10.0
  - @bamboocss/plugin-svelte@1.10.0
  - @bamboocss/plugin-lightningcss@1.10.0
  - @bamboocss/parser@1.10.0
  - @bamboocss/token-dictionary@1.10.0
  - @bamboocss/reporter@1.10.0

## 1.9.1

### Patch Changes

- Updated dependencies [d02fcf6]
- Updated dependencies [8fda1a5]
  - @bamboocss/token-dictionary@1.9.1
  - @bamboocss/core@1.9.1
  - @bamboocss/generator@1.9.1
  - @bamboocss/reporter@1.9.1
  - @bamboocss/config@1.9.1
  - @bamboocss/parser@1.9.1
  - @bamboocss/logger@1.9.1
  - @bamboocss/shared@1.9.1
  - @bamboocss/types@1.9.1

## 1.9.0

### Patch Changes

- Updated dependencies [3ca1f24]
- Updated dependencies [7d66c0b]
  - @bamboocss/core@1.9.0
  - @bamboocss/parser@1.9.0
  - @bamboocss/generator@1.9.0
  - @bamboocss/reporter@1.9.0
  - @bamboocss/config@1.9.0
  - @bamboocss/logger@1.9.0
  - @bamboocss/shared@1.9.0
  - @bamboocss/token-dictionary@1.9.0
  - @bamboocss/types@1.9.0

## 1.8.2

### Patch Changes

- Updated dependencies [331d1a5]
- Updated dependencies [82d23ab]
  - @bamboocss/types@1.8.2
  - @bamboocss/core@1.8.2
  - @bamboocss/config@1.8.2
  - @bamboocss/generator@1.8.2
  - @bamboocss/logger@1.8.2
  - @bamboocss/parser@1.8.2
  - @bamboocss/reporter@1.8.2
  - @bamboocss/token-dictionary@1.8.2
  - @bamboocss/shared@1.8.2

## 1.8.1

### Patch Changes

- Updated dependencies [3c86c29]
  - @bamboocss/types@1.8.1
  - @bamboocss/config@1.8.1
  - @bamboocss/core@1.8.1
  - @bamboocss/generator@1.8.1
  - @bamboocss/logger@1.8.1
  - @bamboocss/parser@1.8.1
  - @bamboocss/reporter@1.8.1
  - @bamboocss/token-dictionary@1.8.1
  - @bamboocss/shared@1.8.1

## 1.8.0

### Patch Changes

- @bamboocss/config@1.8.0
- @bamboocss/core@1.8.0
- @bamboocss/generator@1.8.0
- @bamboocss/logger@1.8.0
- @bamboocss/parser@1.8.0
- @bamboocss/reporter@1.8.0
- @bamboocss/shared@1.8.0
- @bamboocss/token-dictionary@1.8.0
- @bamboocss/types@1.8.0

## 1.7.3

### Patch Changes

- @bamboocss/config@1.7.3
- @bamboocss/core@1.7.3
- @bamboocss/generator@1.7.3
- @bamboocss/logger@1.7.3
- @bamboocss/parser@1.7.3
- @bamboocss/reporter@1.7.3
- @bamboocss/shared@1.7.3
- @bamboocss/token-dictionary@1.7.3
- @bamboocss/types@1.7.3

## 1.7.2

### Patch Changes

- af2d06b: Fix ESM compatibility by converting `p-limit` and `package-manager-detector` to use dynamic import
  - @bamboocss/config@1.7.2
  - @bamboocss/core@1.7.2
  - @bamboocss/generator@1.7.2
  - @bamboocss/logger@1.7.2
  - @bamboocss/parser@1.7.2
  - @bamboocss/reporter@1.7.2
  - @bamboocss/shared@1.7.2
  - @bamboocss/token-dictionary@1.7.2
  - @bamboocss/types@1.7.2

## 1.7.1

### Patch Changes

- Updated dependencies [cc04ebf]
- Updated dependencies [3f5fea2]
  - @bamboocss/config@1.7.1
  - @bamboocss/generator@1.7.1
  - @bamboocss/parser@1.7.1
  - @bamboocss/reporter@1.7.1
  - @bamboocss/core@1.7.1
  - @bamboocss/logger@1.7.1
  - @bamboocss/shared@1.7.1
  - @bamboocss/token-dictionary@1.7.1
  - @bamboocss/types@1.7.1

## 1.7.0

### Minor Changes

- 86b30b1: Add `bamboo spec` command to generate specification files for your theme (useful for documentation). This
  command generates JSON specification files containing metadata, examples, and usage information.

  ```bash
  # Generate all spec files
  bamboo spec

  # Custom output directory
  bamboo spec --outdir custom/specs
  ```

  **Token Spec Structure:**

  ```json
  {
    "type": "tokens",
    "data": [
      {
        "type": "aspectRatios",
        "values": [
          {
            "name": "square",
            "value": "1 / 1",
            "cssVar": "var(--aspect-ratios-square)"
          }
        ],
        "tokenFunctionExamples": ["token('aspectRatios.square')"],
        "functionExamples": ["css({ aspectRatio: 'square' })"],
        "jsxExamples": ["<Box aspectRatio=\"square\" />"]
      }
    ]
  }
  ```

  **Spec Usage:**

  ```javascript
  import tokens from 'styled-system/specs/tokens'
  import recipes from 'styled-system/specs/recipes'
  ```

### Patch Changes

- Updated dependencies [86b30b1]
- Updated dependencies [f37fd8d]
  - @bamboocss/generator@1.7.0
  - @bamboocss/types@1.7.0
  - @bamboocss/core@1.7.0
  - @bamboocss/parser@1.7.0
  - @bamboocss/reporter@1.7.0
  - @bamboocss/config@1.7.0
  - @bamboocss/logger@1.7.0
  - @bamboocss/token-dictionary@1.7.0
  - @bamboocss/shared@1.7.0

## 1.6.1

### Patch Changes

- Updated dependencies [8f43369]
  - @bamboocss/core@1.6.1
  - @bamboocss/parser@1.6.1
  - @bamboocss/generator@1.6.1
  - @bamboocss/reporter@1.6.1
  - @bamboocss/config@1.6.1
  - @bamboocss/logger@1.6.1
  - @bamboocss/shared@1.6.1
  - @bamboocss/token-dictionary@1.6.1
  - @bamboocss/types@1.6.1

## 1.6.0

### Minor Changes

- 8aa3c64: Add `--splitting` flag to `cssgen` command for per-layer CSS output.

  When enabled, CSS is emitted as separate files instead of a single `styles.css`:

  ```
  styled-system/
  ├── styles.css              # @layer declaration + @imports
  └── styles/
      ├── reset.css           # Preflight/reset CSS
      ├── global.css          # Global CSS
      ├── tokens.css          # Design tokens
      ├── utilities.css       # Utility classes
      ├── recipes/
      │   ├── index.css       # @imports all recipe files
      │   └── {recipe}.css    # Individual recipe styles
      └── themes/
          └── {theme}.css     # Theme tokens (not auto-imported)
  ```

  Usage:

  ```bash
  bamboo cssgen --splitting
  ```

### Patch Changes

- Updated dependencies [8aa3c64]
  - @bamboocss/generator@1.6.0
  - @bamboocss/parser@1.6.0
  - @bamboocss/reporter@1.6.0
  - @bamboocss/config@1.6.0
  - @bamboocss/core@1.6.0
  - @bamboocss/logger@1.6.0
  - @bamboocss/shared@1.6.0
  - @bamboocss/token-dictionary@1.6.0
  - @bamboocss/types@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies [bd2f8c9]
- Updated dependencies [827566b]
  - @bamboocss/generator@1.5.1
  - @bamboocss/parser@1.5.1
  - @bamboocss/reporter@1.5.1
  - @bamboocss/config@1.5.1
  - @bamboocss/core@1.5.1
  - @bamboocss/logger@1.5.1
  - @bamboocss/shared@1.5.1
  - @bamboocss/token-dictionary@1.5.1
  - @bamboocss/types@1.5.1

## 1.5.0

### Patch Changes

- Updated dependencies [91c65ff]
- Updated dependencies [52e2399]
  - @bamboocss/types@1.5.0
  - @bamboocss/token-dictionary@1.5.0
  - @bamboocss/core@1.5.0
  - @bamboocss/config@1.5.0
  - @bamboocss/generator@1.5.0
  - @bamboocss/parser@1.5.0
  - @bamboocss/logger@1.5.0
  - @bamboocss/reporter@1.5.0
  - @bamboocss/shared@1.5.0

## 1.4.3

### Patch Changes

- bb32028: Fix "Browserslist: caniuse-lite is outdated" warning by updating `browserslist` and PostCSS-related packages:
  - Update `browserslist` from 4.23.3 to 4.24.4
  - Update `postcss` from 8.4.49 to 8.5.6
  - Update `postcss-nested` from 6.0.1 to 7.0.2
  - Update `postcss-merge-rules` from 7.0.4 to 7.0.6
  - Update other PostCSS plugins to latest patch versions

  This resolves the outdated `caniuse-lite` warning that appeared when using lightningcss without affecting CSS output
  or requiring snapshot updates.

- Updated dependencies [bb32028]
- Updated dependencies [58f492a]
- Updated dependencies [84a0de9]
  - @bamboocss/core@1.4.3
  - @bamboocss/generator@1.4.3
  - @bamboocss/config@1.4.3
  - @bamboocss/reporter@1.4.3
  - @bamboocss/parser@1.4.3
  - @bamboocss/logger@1.4.3
  - @bamboocss/shared@1.4.3
  - @bamboocss/token-dictionary@1.4.3
  - @bamboocss/types@1.4.3

## 1.4.2

### Patch Changes

- Updated dependencies [0679f6f]
- Updated dependencies [1290a27]
- Updated dependencies [70420dd]
  - @bamboocss/config@1.4.2
  - @bamboocss/generator@1.4.2
  - @bamboocss/shared@1.4.2
  - @bamboocss/parser@1.4.2
  - @bamboocss/token-dictionary@1.4.2
  - @bamboocss/core@1.4.2
  - @bamboocss/reporter@1.4.2
  - @bamboocss/types@1.4.2
  - @bamboocss/logger@1.4.2

## 1.4.1

### Patch Changes

- Updated dependencies [db237b6]
  - @bamboocss/core@1.4.1
  - @bamboocss/generator@1.4.1
  - @bamboocss/reporter@1.4.1
  - @bamboocss/parser@1.4.1
  - @bamboocss/config@1.4.1
  - @bamboocss/logger@1.4.1
  - @bamboocss/shared@1.4.1
  - @bamboocss/token-dictionary@1.4.1
  - @bamboocss/types@1.4.1

## 1.4.0

### Patch Changes

- Updated dependencies [4c291ca]
- Updated dependencies [ce12373]
  - @bamboocss/core@1.4.0
  - @bamboocss/generator@1.4.0
  - @bamboocss/reporter@1.4.0
  - @bamboocss/parser@1.4.0
  - @bamboocss/config@1.4.0
  - @bamboocss/logger@1.4.0
  - @bamboocss/shared@1.4.0
  - @bamboocss/token-dictionary@1.4.0
  - @bamboocss/types@1.4.0

## 1.3.1

### Patch Changes

- Updated dependencies [e0fca65]
- Updated dependencies [ff9afbc]
- Updated dependencies [7fcd100]
- Updated dependencies [5bfaef3]
  - @bamboocss/generator@1.3.1
  - @bamboocss/core@1.3.1
  - @bamboocss/parser@1.3.1
  - @bamboocss/reporter@1.3.1
  - @bamboocss/config@1.3.1
  - @bamboocss/logger@1.3.1
  - @bamboocss/shared@1.3.1
  - @bamboocss/token-dictionary@1.3.1
  - @bamboocss/types@1.3.1

## 1.3.0

### Patch Changes

- Updated dependencies [7eaeb3c]
- Updated dependencies [70efd73]
- Updated dependencies [2e683fa]
- Updated dependencies [43be051]
  - @bamboocss/generator@1.3.0
  - @bamboocss/types@1.3.0
  - @bamboocss/parser@1.3.0
  - @bamboocss/reporter@1.3.0
  - @bamboocss/config@1.3.0
  - @bamboocss/core@1.3.0
  - @bamboocss/logger@1.3.0
  - @bamboocss/token-dictionary@1.3.0
  - @bamboocss/shared@1.3.0

## 1.2.0

### Patch Changes

- Updated dependencies [a1f5c64]
  - @bamboocss/generator@1.2.0
  - @bamboocss/config@1.2.0
  - @bamboocss/parser@1.2.0
  - @bamboocss/reporter@1.2.0
  - @bamboocss/core@1.2.0
  - @bamboocss/logger@1.2.0
  - @bamboocss/shared@1.2.0
  - @bamboocss/token-dictionary@1.2.0
  - @bamboocss/types@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [47a0011]
- Updated dependencies [e8ec0aa]
  - @bamboocss/types@1.1.0
  - @bamboocss/config@1.1.0
  - @bamboocss/shared@1.1.0
  - @bamboocss/core@1.1.0
  - @bamboocss/generator@1.1.0
  - @bamboocss/logger@1.1.0
  - @bamboocss/parser@1.1.0
  - @bamboocss/reporter@1.1.0
  - @bamboocss/token-dictionary@1.1.0

## 1.0.1

### Patch Changes

- Updated dependencies [d236e21]
  - @bamboocss/generator@1.0.1
  - @bamboocss/parser@1.0.1
  - @bamboocss/reporter@1.0.1
  - @bamboocss/config@1.0.1
  - @bamboocss/core@1.0.1
  - @bamboocss/logger@1.0.1
  - @bamboocss/shared@1.0.1
  - @bamboocss/token-dictionary@1.0.1
  - @bamboocss/types@1.0.1

## 1.0.0

### Major Changes

- a3bcbea: Stable release of BambooCSS

  ### Style Context

  Add `createStyleContext` function to framework artifacts for React, Preact, Solid, and Vue frameworks

  ```tsx
  import { sva } from 'styled-system/css'
  import { createStyleContext } from 'styled-system/jsx'

  const card = sva({
    slots: ['root', 'label'],
    base: {
      root: {
        color: 'red',
        bg: 'red.300',
      },
      label: {
        fontWeight: 'medium',
      },
    },
    variants: {
      size: {
        sm: {
          root: {
            padding: '10px',
          },
        },
        md: {
          root: {
            padding: '20px',
          },
        },
      },
    },
    defaultVariants: {
      size: 'sm',
    },
  })

  const { withProvider, withContext } = createStyleContext(card)

  const CardRoot = withProvider('div', 'root')
  const CardLabel = withContext('label', 'label')
  ```

  Then, use like this:

  ```tsx
  <CardRoot size="sm">
    <CardLabel>Hello</CardLabel>
  </CardRoot>
  ```

### Patch Changes

- Updated dependencies [a3bcbea]
- Updated dependencies [a20811c]
  - @bamboocss/config@1.0.0
  - @bamboocss/core@1.0.0
  - @bamboocss/generator@1.0.0
  - @bamboocss/logger@1.0.0
  - @bamboocss/parser@1.0.0
  - @bamboocss/reporter@1.0.0
  - @bamboocss/shared@1.0.0
  - @bamboocss/token-dictionary@1.0.0
  - @bamboocss/types@1.0.0

## 0.54.0

### Patch Changes

- 76c4e61: Revert `tinyglobally` to `fast-glob` change to fix issues with glob matching
- Updated dependencies [efa060d]
- Updated dependencies [941a208]
- Updated dependencies [d2aede5]
- Updated dependencies [fdf5142]
  - @bamboocss/shared@0.54.0
  - @bamboocss/generator@0.54.0
  - @bamboocss/token-dictionary@0.54.0
  - @bamboocss/config@0.54.0
  - @bamboocss/core@0.54.0
  - @bamboocss/parser@0.54.0
  - @bamboocss/reporter@0.54.0
  - @bamboocss/types@0.54.0
  - @bamboocss/logger@0.54.0

## 0.53.7

### Patch Changes

- Updated dependencies [5e5af6b]
- Updated dependencies [9453c9b]
- Updated dependencies [a67f920]
  - @bamboocss/core@0.53.7
  - @bamboocss/generator@0.53.7
  - @bamboocss/parser@0.53.7
  - @bamboocss/reporter@0.53.7
  - @bamboocss/config@0.53.7
  - @bamboocss/logger@0.53.7
  - @bamboocss/shared@0.53.7
  - @bamboocss/token-dictionary@0.53.7
  - @bamboocss/types@0.53.7

## 0.53.6

### Patch Changes

- Updated dependencies [a292e9a]
  - @bamboocss/generator@0.53.6
  - @bamboocss/parser@0.53.6
  - @bamboocss/reporter@0.53.6
  - @bamboocss/config@0.53.6
  - @bamboocss/core@0.53.6
  - @bamboocss/logger@0.53.6
  - @bamboocss/shared@0.53.6
  - @bamboocss/token-dictionary@0.53.6
  - @bamboocss/types@0.53.6

## 0.53.5

### Patch Changes

- Updated dependencies [fe3e943]
  - @bamboocss/generator@0.53.5
  - @bamboocss/parser@0.53.5
  - @bamboocss/reporter@0.53.5
  - @bamboocss/config@0.53.5
  - @bamboocss/core@0.53.5
  - @bamboocss/logger@0.53.5
  - @bamboocss/shared@0.53.5
  - @bamboocss/token-dictionary@0.53.5
  - @bamboocss/types@0.53.5

## 0.53.4

### Patch Changes

- Updated dependencies [57343c1]
- Updated dependencies [a2bc49d]
  - @bamboocss/core@0.53.4
  - @bamboocss/generator@0.53.4
  - @bamboocss/parser@0.53.4
  - @bamboocss/reporter@0.53.4
  - @bamboocss/config@0.53.4
  - @bamboocss/logger@0.53.4
  - @bamboocss/shared@0.53.4
  - @bamboocss/token-dictionary@0.53.4
  - @bamboocss/types@0.53.4

## 0.53.3

### Patch Changes

- Updated dependencies [00aa868]
  - @bamboocss/generator@0.53.3
  - @bamboocss/config@0.53.3
  - @bamboocss/parser@0.53.3
  - @bamboocss/reporter@0.53.3
  - @bamboocss/core@0.53.3
  - @bamboocss/logger@0.53.3
  - @bamboocss/shared@0.53.3
  - @bamboocss/token-dictionary@0.53.3
  - @bamboocss/types@0.53.3

## 0.53.2

### Patch Changes

- Updated dependencies [cde9a0b]
  - @bamboocss/config@0.53.2
  - @bamboocss/parser@0.53.2
  - @bamboocss/core@0.53.2
  - @bamboocss/generator@0.53.2
  - @bamboocss/logger@0.53.2
  - @bamboocss/reporter@0.53.2
  - @bamboocss/shared@0.53.2
  - @bamboocss/token-dictionary@0.53.2
  - @bamboocss/types@0.53.2

## 0.53.1

### Patch Changes

- b67a2a5: Fix issue where file watching doesn't work due the recent security upgrade of the `chokidar` package.
  - @bamboocss/config@0.53.1
  - @bamboocss/core@0.53.1
  - @bamboocss/generator@0.53.1
  - @bamboocss/logger@0.53.1
  - @bamboocss/parser@0.53.1
  - @bamboocss/reporter@0.53.1
  - @bamboocss/shared@0.53.1
  - @bamboocss/token-dictionary@0.53.1
  - @bamboocss/types@0.53.1

## 0.53.0

### Patch Changes

- Updated dependencies [5286731]
  - @bamboocss/generator@0.53.0
  - @bamboocss/types@0.53.0
  - @bamboocss/core@0.53.0
  - @bamboocss/parser@0.53.0
  - @bamboocss/reporter@0.53.0
  - @bamboocss/config@0.53.0
  - @bamboocss/logger@0.53.0
  - @bamboocss/token-dictionary@0.53.0
  - @bamboocss/shared@0.53.0

## 0.52.0

### Patch Changes

- 2f1165c: Security: Update chokidar to remove vulnerability
  - @bamboocss/config@0.52.0
  - @bamboocss/parser@0.52.0
  - @bamboocss/core@0.52.0
  - @bamboocss/generator@0.52.0
  - @bamboocss/logger@0.52.0
  - @bamboocss/reporter@0.52.0
  - @bamboocss/shared@0.52.0
  - @bamboocss/token-dictionary@0.52.0
  - @bamboocss/types@0.52.0

## 0.51.1

### Patch Changes

- Updated dependencies [9c1327e]
  - @bamboocss/reporter@0.51.1
  - @bamboocss/config@0.51.1
  - @bamboocss/core@0.51.1
  - @bamboocss/generator@0.51.1
  - @bamboocss/logger@0.51.1
  - @bamboocss/parser@0.51.1
  - @bamboocss/shared@0.51.1
  - @bamboocss/token-dictionary@0.51.1
  - @bamboocss/types@0.51.1

## 0.51.0

### Minor Changes

- d68ad1f: **[BREAKING]**: Fix issue where Next.js build might fail intermittently due to version mismatch between
  internal `ts-morph` and userland `typescript`.

  > The current version of TS supported is `5.6.2`

### Patch Changes

- Updated dependencies [d68ad1f]
  - @bamboocss/config@0.51.0
  - @bamboocss/parser@0.51.0
  - @bamboocss/types@0.51.0
  - @bamboocss/core@0.51.0
  - @bamboocss/generator@0.51.0
  - @bamboocss/logger@0.51.0
  - @bamboocss/reporter@0.51.0
  - @bamboocss/token-dictionary@0.51.0
  - @bamboocss/shared@0.51.0

## 0.50.0

### Minor Changes

- fea78c7: Adds support for static analysis of used tokens and recipe variants. It helps to get a birds-eye view of how
  your design system is used and answers the following questions:
  - What tokens are most used?
  - What recipe variants are most used?
  - How many hardcoded values vs tokens do we have?

  ```sh
  bamboo analyze --scope=<token|recipe>
  ```

  > Still work in progress but we're excited to get your feedback!

### Patch Changes

- Updated dependencies [fea78c7]
- Updated dependencies [ad89b90]
- Updated dependencies [7c85ac7]
  - @bamboocss/types@0.50.0
  - @bamboocss/reporter@0.50.0
  - @bamboocss/token-dictionary@0.50.0
  - @bamboocss/generator@0.50.0
  - @bamboocss/parser@0.50.0
  - @bamboocss/core@0.50.0
  - @bamboocss/config@0.50.0
  - @bamboocss/logger@0.50.0
  - @bamboocss/shared@0.50.0

## 0.49.0

### Patch Changes

- Updated dependencies [97a0e4d]
  - @bamboocss/generator@0.49.0
  - @bamboocss/types@0.49.0
  - @bamboocss/core@0.49.0
  - @bamboocss/config@0.49.0
  - @bamboocss/parser@0.49.0
  - @bamboocss/logger@0.49.0
  - @bamboocss/token-dictionary@0.49.0
  - @bamboocss/extractor@0.49.0
  - @bamboocss/shared@0.49.0

## 0.48.1

### Patch Changes

- fd87f3a: Fix issue where `staticCss` artifacts were not included in the build info json.
- Updated dependencies [af9715a]
  - @bamboocss/generator@0.48.1
  - @bamboocss/config@0.48.1
  - @bamboocss/parser@0.48.1
  - @bamboocss/core@0.48.1
  - @bamboocss/extractor@0.48.1
  - @bamboocss/logger@0.48.1
  - @bamboocss/shared@0.48.1
  - @bamboocss/token-dictionary@0.48.1
  - @bamboocss/types@0.48.1

## 0.48.0

### Patch Changes

- Updated dependencies [2bc12d2]
  - @bamboocss/generator@0.48.0
  - @bamboocss/config@0.48.0
  - @bamboocss/parser@0.48.0
  - @bamboocss/core@0.48.0
  - @bamboocss/extractor@0.48.0
  - @bamboocss/logger@0.48.0
  - @bamboocss/shared@0.48.0
  - @bamboocss/token-dictionary@0.48.0
  - @bamboocss/types@0.48.0

## 0.47.1

### Patch Changes

- Updated dependencies [144113f]
  - @bamboocss/token-dictionary@0.47.1
  - @bamboocss/core@0.47.1
  - @bamboocss/generator@0.47.1
  - @bamboocss/parser@0.47.1
  - @bamboocss/config@0.47.1
  - @bamboocss/extractor@0.47.1
  - @bamboocss/logger@0.47.1
  - @bamboocss/shared@0.47.1
  - @bamboocss/types@0.47.1

## 0.47.0

### Patch Changes

- Updated dependencies [ff8602f]
- Updated dependencies [5e683ee]
  - @bamboocss/generator@0.47.0
  - @bamboocss/token-dictionary@0.47.0
  - @bamboocss/types@0.47.0
  - @bamboocss/parser@0.47.0
  - @bamboocss/core@0.47.0
  - @bamboocss/config@0.47.0
  - @bamboocss/logger@0.47.0
  - @bamboocss/extractor@0.47.0
  - @bamboocss/shared@0.47.0

## 0.46.1

### Patch Changes

- Updated dependencies [9fbd2d8]
  - @bamboocss/core@0.46.1
  - @bamboocss/generator@0.46.1
  - @bamboocss/parser@0.46.1
  - @bamboocss/config@0.46.1
  - @bamboocss/extractor@0.46.1
  - @bamboocss/logger@0.46.1
  - @bamboocss/shared@0.46.1
  - @bamboocss/token-dictionary@0.46.1
  - @bamboocss/types@0.46.1

## 0.46.0

### Patch Changes

- Updated dependencies [b7ed157]
- Updated dependencies [54426a2]
- Updated dependencies [54426a2]
  - @bamboocss/generator@0.46.0
  - @bamboocss/core@0.46.0
  - @bamboocss/shared@0.46.0
  - @bamboocss/config@0.46.0
  - @bamboocss/parser@0.46.0
  - @bamboocss/extractor@0.46.0
  - @bamboocss/token-dictionary@0.46.0
  - @bamboocss/types@0.46.0
  - @bamboocss/logger@0.46.0

## 0.45.2

### Patch Changes

- Updated dependencies [8c276ff]
  - @bamboocss/generator@0.45.2
  - @bamboocss/parser@0.45.2
  - @bamboocss/config@0.45.2
  - @bamboocss/core@0.45.2
  - @bamboocss/extractor@0.45.2
  - @bamboocss/logger@0.45.2
  - @bamboocss/shared@0.45.2
  - @bamboocss/token-dictionary@0.45.2
  - @bamboocss/types@0.45.2

## 0.45.1

### Patch Changes

- 26924c7: chore: switch to package-manager-detector to reduce dependencies
- Updated dependencies [3439ecf]
  - @bamboocss/token-dictionary@0.45.1
  - @bamboocss/core@0.45.1
  - @bamboocss/generator@0.45.1
  - @bamboocss/parser@0.45.1
  - @bamboocss/config@0.45.1
  - @bamboocss/extractor@0.45.1
  - @bamboocss/logger@0.45.1
  - @bamboocss/shared@0.45.1
  - @bamboocss/types@0.45.1

## 0.45.0

### Patch Changes

- Updated dependencies [dcc9053]
- Updated dependencies [a21fcfe]
- Updated dependencies [1e4da63]
- Updated dependencies [552dd4b]
  - @bamboocss/generator@0.45.0
  - @bamboocss/types@0.45.0
  - @bamboocss/token-dictionary@0.45.0
  - @bamboocss/core@0.45.0
  - @bamboocss/shared@0.45.0
  - @bamboocss/parser@0.45.0
  - @bamboocss/config@0.45.0
  - @bamboocss/logger@0.45.0
  - @bamboocss/extractor@0.45.0

## 0.44.0

### Patch Changes

- Updated dependencies [d7f5cab]
- Updated dependencies [a8c0cde]
- Updated dependencies [c99cb75]
  - @bamboocss/config@0.44.0
  - @bamboocss/generator@0.44.0
  - @bamboocss/types@0.44.0
  - @bamboocss/parser@0.44.0
  - @bamboocss/core@0.44.0
  - @bamboocss/logger@0.44.0
  - @bamboocss/token-dictionary@0.44.0
  - @bamboocss/extractor@0.44.0
  - @bamboocss/shared@0.44.0

## 0.43.0

### Patch Changes

- Updated dependencies [e952f82]
  - @bamboocss/generator@0.43.0
  - @bamboocss/types@0.43.0
  - @bamboocss/core@0.43.0
  - @bamboocss/parser@0.43.0
  - @bamboocss/config@0.43.0
  - @bamboocss/logger@0.43.0
  - @bamboocss/token-dictionary@0.43.0
  - @bamboocss/extractor@0.43.0
  - @bamboocss/shared@0.43.0

## 0.42.0

### Patch Changes

- 19c3a2c: Minor changes to the format of the `bamboo analyze --output coverage.json` file
- ec64819: Change recipes `className` to be optional, both for `recipes` and `slotRecipes`, with a fallback to its name.

  ```ts
  import { defineConfig } from '@bamboocss/core'

  export default defineConfig({
    recipes: {
      button: {
        className: 'button', // 👈 was mandatory, is now optional
        variants: {
          size: {
            sm: { padding: '2', borderRadius: 'sm' },
            md: { padding: '4', borderRadius: 'md' },
          },
        },
      },
    },
  })
  ```

- 17a1932: [BREAKING] Removed the legacy `config.optimize` option because it was redundant. Now, we always optimize the
  generated CSS where possible.
- Updated dependencies [e157dd1]
- Updated dependencies [19c3a2c]
- Updated dependencies [f00ff88]
- Updated dependencies [ec64819]
- Updated dependencies [17a1932]
  - @bamboocss/generator@0.42.0
  - @bamboocss/parser@0.42.0
  - @bamboocss/types@0.42.0
  - @bamboocss/core@0.42.0
  - @bamboocss/extractor@0.42.0
  - @bamboocss/config@0.42.0
  - @bamboocss/logger@0.42.0
  - @bamboocss/token-dictionary@0.42.0
  - @bamboocss/shared@0.42.0

## 0.41.0

### Patch Changes

- Updated dependencies [af8a29a]
- Updated dependencies [2750261]
  - @bamboocss/generator@0.41.0
  - @bamboocss/extractor@0.41.0
  - @bamboocss/parser@0.41.0
  - @bamboocss/core@0.41.0
  - @bamboocss/types@0.41.0
  - @bamboocss/config@0.41.0
  - @bamboocss/logger@0.41.0
  - @bamboocss/shared@0.41.0
  - @bamboocss/token-dictionary@0.41.0

## 0.40.1

### Patch Changes

- 48ff2b8: Improve `bamboo init --outdir=<x>` command to reflect `outdir` in generated bamboo config file.
- Updated dependencies [d2cc156]
  - @bamboocss/generator@0.40.1
  - @bamboocss/core@0.40.1
  - @bamboocss/parser@0.40.1
  - @bamboocss/config@0.40.1
  - @bamboocss/extractor@0.40.1
  - @bamboocss/logger@0.40.1
  - @bamboocss/shared@0.40.1
  - @bamboocss/token-dictionary@0.40.1
  - @bamboocss/types@0.40.1

## 0.40.0

### Minor Changes

- 5dcdae4: Improve monorepo setup DX by exposing some cli flags

  ### `bamboo init`
  - Added new flag `--no-codegen` to skip codegen during initialization
  - Added new flag `--outdir` to specify the output directory for generated files

  ### `bamboo emit-pkg`
  - Added new `--base` flag to specify the base directory for the entrypoints in the generated `package.json#exports`
    field

### Patch Changes

- Updated dependencies [5dcdae4]
  - @bamboocss/core@0.40.0
  - @bamboocss/generator@0.40.0
  - @bamboocss/parser@0.40.0
  - @bamboocss/config@0.40.0
  - @bamboocss/extractor@0.40.0
  - @bamboocss/logger@0.40.0
  - @bamboocss/shared@0.40.0
  - @bamboocss/token-dictionary@0.40.0
  - @bamboocss/types@0.40.0

## 0.39.2

### Patch Changes

- 1f636eb: Fix a cache issue that leads to HMR growing slower in some cases
- af15ae9: Fix `bamboo analyze` JSON output serialization
- Updated dependencies [39c305f]
- Updated dependencies [2f63a4c]
- Updated dependencies [1f636eb]
- Updated dependencies [8b07cdf]
  - @bamboocss/generator@0.39.2
  - @bamboocss/config@0.39.2
  - @bamboocss/shared@0.39.2
  - @bamboocss/core@0.39.2
  - @bamboocss/token-dictionary@0.39.2
  - @bamboocss/parser@0.39.2
  - @bamboocss/extractor@0.39.2
  - @bamboocss/types@0.39.2
  - @bamboocss/logger@0.39.2

## 0.39.1

### Patch Changes

- Updated dependencies [99be6f1]
  - @bamboocss/generator@0.39.1
  - @bamboocss/parser@0.39.1
  - @bamboocss/config@0.39.1
  - @bamboocss/core@0.39.1
  - @bamboocss/extractor@0.39.1
  - @bamboocss/logger@0.39.1
  - @bamboocss/shared@0.39.1
  - @bamboocss/token-dictionary@0.39.1
  - @bamboocss/types@0.39.1

## 0.39.0

### Patch Changes

- Updated dependencies [df2546a]
- Updated dependencies [221c9a2]
- Updated dependencies [0714f31]
- Updated dependencies [2116abe]
- Updated dependencies [c3e797e]
- Updated dependencies [935ec86]
  - @bamboocss/generator@0.39.0
  - @bamboocss/parser@0.39.0
  - @bamboocss/types@0.39.0
  - @bamboocss/core@0.39.0
  - @bamboocss/shared@0.39.0
  - @bamboocss/config@0.39.0
  - @bamboocss/logger@0.39.0
  - @bamboocss/token-dictionary@0.39.0
  - @bamboocss/extractor@0.39.0

## 0.38.0

### Minor Changes

- 2c8b933: Add least resource used (LRU) cache in the hot parts to prevent memory from growing infinitely

### Patch Changes

- Updated dependencies [96b47b3]
- Updated dependencies [bc09d89]
- Updated dependencies [7a96298]
- Updated dependencies [1e50336]
- Updated dependencies [2c8b933]
- Updated dependencies [b1e9e36]
  - @bamboocss/generator@0.38.0
  - @bamboocss/parser@0.38.0
  - @bamboocss/types@0.38.0
  - @bamboocss/core@0.38.0
  - @bamboocss/token-dictionary@0.38.0
  - @bamboocss/shared@0.38.0
  - @bamboocss/config@0.38.0
  - @bamboocss/logger@0.38.0
  - @bamboocss/extractor@0.38.0

## 0.37.2

### Patch Changes

- 84edd38: fix: build correct path for debug files on windows
- Updated dependencies [74dfb3e]
- Updated dependencies [b3beef4]
  - @bamboocss/generator@0.37.2
  - @bamboocss/types@0.37.2
  - @bamboocss/parser@0.37.2
  - @bamboocss/config@0.37.2
  - @bamboocss/core@0.37.2
  - @bamboocss/logger@0.37.2
  - @bamboocss/token-dictionary@0.37.2
  - @bamboocss/extractor@0.37.2
  - @bamboocss/shared@0.37.2

## 0.37.1

### Patch Changes

- Updated dependencies [93dc9f5]
- Updated dependencies [88049c5]
- Updated dependencies [885963c]
- Updated dependencies [99870bb]
  - @bamboocss/token-dictionary@0.37.1
  - @bamboocss/config@0.37.1
  - @bamboocss/generator@0.37.1
  - @bamboocss/types@0.37.1
  - @bamboocss/parser@0.37.1
  - @bamboocss/shared@0.37.1
  - @bamboocss/core@0.37.1
  - @bamboocss/logger@0.37.1
  - @bamboocss/extractor@0.37.1

## 0.37.0

### Patch Changes

- Updated dependencies [4e6cf85]
- Updated dependencies [7daf159]
- Updated dependencies [bcfb5c5]
- Updated dependencies [6247dfb]
  - @bamboocss/generator@0.37.0
  - @bamboocss/parser@0.37.0
  - @bamboocss/shared@0.37.0
  - @bamboocss/types@0.37.0
  - @bamboocss/core@0.37.0
  - @bamboocss/config@0.37.0
  - @bamboocss/extractor@0.37.0
  - @bamboocss/token-dictionary@0.37.0
  - @bamboocss/logger@0.37.0

## 0.36.1

### Patch Changes

- Updated dependencies [35bd134]
- Updated dependencies [bd0cb07]
  - @bamboocss/parser@0.36.1
  - @bamboocss/generator@0.36.1
  - @bamboocss/types@0.36.1
  - @bamboocss/config@0.36.1
  - @bamboocss/core@0.36.1
  - @bamboocss/logger@0.36.1
  - @bamboocss/token-dictionary@0.36.1
  - @bamboocss/extractor@0.36.1
  - @bamboocss/shared@0.36.1

## 0.36.0

### Patch Changes

- Updated dependencies [445c7b6]
- Updated dependencies [3af3940]
- Updated dependencies [861a280]
- Updated dependencies [656ff02]
- Updated dependencies [2691f16]
- Updated dependencies [340f4f1]
- Updated dependencies [fabdabe]
  - @bamboocss/config@0.36.0
  - @bamboocss/token-dictionary@0.36.0
  - @bamboocss/generator@0.36.0
  - @bamboocss/types@0.36.0
  - @bamboocss/core@0.36.0
  - @bamboocss/parser@0.36.0
  - @bamboocss/logger@0.36.0
  - @bamboocss/extractor@0.36.0
  - @bamboocss/shared@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [f2fdc48]
- Updated dependencies [5585696]
- Updated dependencies [50db354]
- Updated dependencies [c459b43]
- Updated dependencies [44589ec]
- Updated dependencies [f6befbf]
- Updated dependencies [a0c4d27]
  - @bamboocss/token-dictionary@0.35.0
  - @bamboocss/generator@0.35.0
  - @bamboocss/config@0.35.0
  - @bamboocss/parser@0.35.0
  - @bamboocss/types@0.35.0
  - @bamboocss/core@0.35.0
  - @bamboocss/logger@0.35.0
  - @bamboocss/extractor@0.35.0
  - @bamboocss/shared@0.35.0

## 0.34.3

### Patch Changes

- Updated dependencies [39f529e]
- Updated dependencies [4576a60]
  - @bamboocss/generator@0.34.3
  - @bamboocss/parser@0.34.3
  - @bamboocss/config@0.34.3
  - @bamboocss/core@0.34.3
  - @bamboocss/extractor@0.34.3
  - @bamboocss/logger@0.34.3
  - @bamboocss/shared@0.34.3
  - @bamboocss/token-dictionary@0.34.3
  - @bamboocss/types@0.34.3

## 0.34.2

### Patch Changes

- Updated dependencies [a48f963]
- Updated dependencies [0bf09f2]
- Updated dependencies [58388de]
  - @bamboocss/generator@0.34.2
  - @bamboocss/extractor@0.34.2
  - @bamboocss/parser@0.34.2
  - @bamboocss/core@0.34.2
  - @bamboocss/config@0.34.2
  - @bamboocss/types@0.34.2
  - @bamboocss/logger@0.34.2
  - @bamboocss/shared@0.34.2
  - @bamboocss/token-dictionary@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [d4942e0]
  - @bamboocss/token-dictionary@0.34.1
  - @bamboocss/generator@0.34.1
  - @bamboocss/core@0.34.1
  - @bamboocss/parser@0.34.1
  - @bamboocss/config@0.34.1
  - @bamboocss/extractor@0.34.1
  - @bamboocss/logger@0.34.1
  - @bamboocss/shared@0.34.1
  - @bamboocss/types@0.34.1

## 0.34.0

### Patch Changes

- Updated dependencies [1c63216]
- Updated dependencies [64d5144]
- Updated dependencies [d1516c8]
- Updated dependencies [7e348ae]
- Updated dependencies [9f04427]
  - @bamboocss/generator@0.34.0
  - @bamboocss/config@0.34.0
  - @bamboocss/token-dictionary@0.34.0
  - @bamboocss/core@0.34.0
  - @bamboocss/types@0.34.0
  - @bamboocss/parser@0.34.0
  - @bamboocss/logger@0.34.0
  - @bamboocss/extractor@0.34.0
  - @bamboocss/shared@0.34.0

## 0.33.0

### Patch Changes

- 1968da5: Allow dynamically recording profiling session by pressing the `p` key in your terminal when using the
  `--cpu-prof` flag for long-running sessions (with `-w` or `--watch` for `bamboo` / `bamboo cssgen` /
  `bamboo codegen`).
- Updated dependencies [34d94cf]
- Updated dependencies [4736057]
- Updated dependencies [e855c64]
- Updated dependencies [8feeb95]
- Updated dependencies [5a205e7]
- Updated dependencies [cca50d5]
- Updated dependencies [fde37d8]
  - @bamboocss/token-dictionary@0.33.0
  - @bamboocss/generator@0.33.0
  - @bamboocss/core@0.33.0
  - @bamboocss/config@0.33.0
  - @bamboocss/types@0.33.0
  - @bamboocss/parser@0.33.0
  - @bamboocss/logger@0.33.0
  - @bamboocss/extractor@0.33.0
  - @bamboocss/shared@0.33.0

## 0.32.1

### Patch Changes

- 89ffb6b: Add missing config dependencies for some `styled-system/types` files
- Updated dependencies [a032375]
- Updated dependencies [31071ba]
- Updated dependencies [5184771]
- Updated dependencies [f419993]
- Updated dependencies [6d8c884]
- Updated dependencies [89ffb6b]
  - @bamboocss/generator@0.32.1
  - @bamboocss/config@0.32.1
  - @bamboocss/types@0.32.1
  - @bamboocss/core@0.32.1
  - @bamboocss/parser@0.32.1
  - @bamboocss/token-dictionary@0.32.1
  - @bamboocss/logger@0.32.1
  - @bamboocss/extractor@0.32.1
  - @bamboocss/shared@0.32.1

## 0.32.0

### Minor Changes

- de4d9ef: Allow `config.hooks` to be shared in `plugins`

  For hooks that can transform Bamboo's internal state by returning something (like `cssgen:done` and
  `codegen:prepare`), each hook instance will be called sequentially and the return result (if any) of the previous hook
  call is passed to the next hook so that they can be chained together.

### Patch Changes

- Updated dependencies [433a364]
- Updated dependencies [7e70b6b]
- Updated dependencies [8cd8c19]
- Updated dependencies [60cace3]
- Updated dependencies [de4d9ef]
- Updated dependencies [b32d817]
  - @bamboocss/core@0.32.0
  - @bamboocss/extractor@0.32.0
  - @bamboocss/shared@0.32.0
  - @bamboocss/generator@0.32.0
  - @bamboocss/types@0.32.0
  - @bamboocss/config@0.32.0
  - @bamboocss/parser@0.32.0
  - @bamboocss/token-dictionary@0.32.0
  - @bamboocss/logger@0.32.0

## 0.31.0

### Minor Changes

- f0296249: - Sort the longhand/shorthand atomic rules in a deterministic order to prevent property conflicts
  - Automatically merge the `base` object in the `css` root styles in the runtime
  - This may be a breaking change depending on how your styles are created

  Ex:

  ```ts
  css({
    padding: '1px',
    paddingTop: '3px',
    paddingBottom: '4px',
  })
  ```

  Will now always generate the following css:

  ```css
  @layer utilities {
    .p_1px {
      padding: 1px;
    }

    .pt_3px {
      padding-top: 3px;
    }

    .pb_4px {
      padding-bottom: 4px;
    }
  }
  ```

### Patch Changes

- 2d69b340: Fix `styled` factory nested composition with `cva`
- ddeda8ac: Add missing log with the `bamboo -w` CLI, expose `resolveConfig` from `@bamboocss/config`
- Updated dependencies [8f36f9af]
- Updated dependencies [f0296249]
- Updated dependencies [e2ad0eed]
- Updated dependencies [a17fe387]
- Updated dependencies [2d69b340]
- Updated dependencies [ddeda8ac]
  - @bamboocss/generator@0.31.0
  - @bamboocss/types@0.31.0
  - @bamboocss/config@0.31.0
  - @bamboocss/parser@0.31.0
  - @bamboocss/shared@0.31.0
  - @bamboocss/core@0.31.0
  - @bamboocss/logger@0.31.0
  - @bamboocss/token-dictionary@0.31.0
  - @bamboocss/extractor@0.31.0

## 0.30.2

### Patch Changes

- Updated dependencies [97efdb43]
- Updated dependencies [7233cd2e]
- Updated dependencies [6b829cab]
  - @bamboocss/generator@0.30.2
  - @bamboocss/parser@0.30.2
  - @bamboocss/types@0.30.2
  - @bamboocss/core@0.30.2
  - @bamboocss/config@0.30.2
  - @bamboocss/logger@0.30.2
  - @bamboocss/token-dictionary@0.30.2
  - @bamboocss/extractor@0.30.2
  - @bamboocss/shared@0.30.2

## 0.30.1

### Patch Changes

- Updated dependencies [ffe177fd]
  - @bamboocss/config@0.30.1
  - @bamboocss/parser@0.30.1
  - @bamboocss/core@0.30.1
  - @bamboocss/extractor@0.30.1
  - @bamboocss/generator@0.30.1
  - @bamboocss/logger@0.30.1
  - @bamboocss/shared@0.30.1
  - @bamboocss/token-dictionary@0.30.1
  - @bamboocss/types@0.30.1

## 0.30.0

### Patch Changes

- 05686b9d: Refactor the `--cpu-prof` profiler to use the `node:inspector` instead of relying on an external module
  (`v8-profiler-next`, which required `node-gyp`)
- ab32d1d7: Introduce 3 new hooks:

  ## `tokens:created`

  This hook is called when the token engine has been created. You can use this hook to add your format token names and
  variables.

  > This is especially useful when migrating from other css-in-js libraries, like Stitches.

  ```ts
  export default defineConfig({
    // ...
    hooks: {
      'tokens:created': ({ configure }) => {
        configure({
          formatTokenName: (path) => '
  ```

## 0.29.1

### Patch Changes

- a5c75607: Fix an issue (introduced in v0.29) with `bamboo init` and add an assert on the new `colorMix` utility
  function
- Updated dependencies [a5c75607]
  - @bamboocss/core@0.29.1
  - @bamboocss/generator@0.29.1
  - @bamboocss/parser@0.29.1
  - @bamboocss/config@0.29.1
  - @bamboocss/extractor@0.29.1
  - @bamboocss/logger@0.29.1
  - @bamboocss/shared@0.29.1
  - @bamboocss/token-dictionary@0.29.1
  - @bamboocss/types@0.29.1

## 0.29.0

### Minor Changes

- a2fb5cc6: - Add support for explicitly specifying config related files that should trigger a context reload on change.

  > We automatically track the config file and (transitive) files imported by the config file as much as possible, but
  > sometimes we might miss some. You can use this option as a workaround for those edge cases.

  Set the `dependencies` option in `bamboo.config.ts` to a glob or list of files.

  ```ts
  export default defineConfig({
    // ...
    dependencies: ['path/to/files/**.ts'],
  })
  ```

  - Invoke `config:change` hook in more situations (when the `--watch` flag is passed to `bamboo codegen`,
    `bamboo cssgen`, `bamboo ship`)

  - Watch for more config options paths changes, so that the related artifacts will be regenerated a bit more reliably
    (ex: updating the `config.hooks` will now trigger a full regeneration of `styled-system`)

### Patch Changes

- Updated dependencies [5fcdeb75]
- Updated dependencies [7c7340ec]
- Updated dependencies [f778d3e5]
- Updated dependencies [2e32794d]
- Updated dependencies [ea3f5548]
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
  - @bamboocss/core@0.29.0
  - @bamboocss/token-dictionary@0.29.0
  - @bamboocss/parser@0.29.0
  - @bamboocss/generator@0.29.0
  - @bamboocss/config@0.29.0
  - @bamboocss/extractor@0.29.0
  - @bamboocss/logger@0.29.0
  - @bamboocss/shared@0.29.0

## 0.28.0

### Minor Changes

- f58f6df2: Refactor `config.hooks` to be much more powerful, you can now:
  - Tweak the config after it has been resolved (after presets are loaded and merged), this could be used to dynamically
    load all `recipes` from a folder
  - Transform a source file's content before parsing it, this could be used to transform the file content to a
    `tsx`-friendly syntax so that Bamboo's parser can parse it.
  - Implement your own parser logic and add the extracted results to the classic Bamboo pipeline, this could be used to
    parse style usage from any template language
  - Tweak the CSS content for any `@layer` or even right before it's written to disk (if using the CLI) or injected
    through the postcss plugin, allowing all kinds of customizations like removing the unused CSS variables, etc.
  - React to any config change or after the codegen step (your outdir, the `styled-system` folder) have been generated

  See the list of available `config.hooks` here:

  ```ts
  export interface BambooHooks {
    /**
     * Called when the config is resolved, after all the presets are loaded and merged.
     * This is the first hook called, you can use it to tweak the config before the context is created.
     */
    'config:resolved': (args: { conf: LoadConfigResult }) => MaybeAsyncReturn
    /**
     * Called when the Bamboo context has been created and the API is ready to be used.
     */
    'context:created': (args: { ctx: ApiInterface; logger: LoggerInterface }) => void
    /**
     * Called when the config file or one of its dependencies (imports) has changed.
     */
    'config:change': (args: { config: UserConfig }) => MaybeAsyncReturn
    /**
     * Called after reading the file content but before parsing it.
     * You can use this hook to transform the file content to a tsx-friendly syntax so that Bamboo's parser can parse it.
     * You can also use this hook to parse the file's content on your side using a custom parser, in this case you don't have to return anything.
     */
    'parser:before': (args: { filePath: string; content: string }) => string | void
    /**
     * Called after the file styles are extracted and processed into the resulting ParserResult object.
     * You can also use this hook to add your own extraction results from your custom parser to the ParserResult object.
     */
    'parser:after': (args: { filePath: string; result: ParserResultInterface | undefined }) => void
    /**
     * Called after the codegen is completed
     */
    'codegen:done': () => MaybeAsyncReturn
    /**
     * Called right before adding the design-system CSS (global, static, preflight, tokens, keyframes) to the final CSS
     * Called right before writing/injecting the final CSS (styles.css) that contains the design-system CSS and the parser CSS
     * You can use it to tweak the CSS content before it's written to disk or injected through the postcss plugin.
     */
    'cssgen:done': (args: {
      artifact: 'global' | 'static' | 'reset' | 'tokens' | 'keyframes' | 'styles.css'
      content: string
    }) => string | void
  }
  ```

### Patch Changes

- f255342f: Add a `--cpu-prof` flag to `bamboo`, `bamboo cssgen`, `bamboo codegen` and `bamboo debug` commands This is
  useful for debugging performance issues in `bamboo` itself. This will generate a
  `bamboo-{command}-{timestamp}.cpuprofile` file in the current working directory, which can be opened in tools like
  [Speedscope](https://www.speedscope.app/)

  This is mostly intended for maintainers or can be asked by maintainers to help debug issues.

- Updated dependencies [f58f6df2]
- Updated dependencies [e463ce0e]
- Updated dependencies [77cab9fe]
- Updated dependencies [770c7aa4]
- Updated dependencies [1edadf30]
- Updated dependencies [d4fa5de9]
- Updated dependencies [9d000dcd]
- Updated dependencies [6d7e7b07]
  - @bamboocss/generator@0.28.0
  - @bamboocss/config@0.28.0
  - @bamboocss/parser@0.28.0
  - @bamboocss/types@0.28.0
  - @bamboocss/core@0.28.0
  - @bamboocss/shared@0.28.0
  - @bamboocss/token-dictionary@0.28.0
  - @bamboocss/error@0.28.0
  - @bamboocss/extractor@0.28.0
  - @bamboocss/logger@0.28.0

## 0.27.3

### Patch Changes

- 1ed4df77: Fix issue where HMR doesn't work when tsconfig paths is used.
- 39d10c79: Fix `prettier` parser warning in bamboo config setup.
- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/core@0.27.3
  - @bamboocss/config@0.27.3
  - @bamboocss/generator@0.27.3
  - @bamboocss/parser@0.27.3
  - @bamboocss/token-dictionary@0.27.3
  - @bamboocss/error@0.27.3
  - @bamboocss/extractor@0.27.3
  - @bamboocss/logger@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- bfa8b1ee: Switch back to `node:path` from `pathe` to resolve issues with windows path in PostCSS + Webpack set up
  - @bamboocss/config@0.27.2
  - @bamboocss/core@0.27.2
  - @bamboocss/error@0.27.2
  - @bamboocss/extractor@0.27.2
  - @bamboocss/generator@0.27.2
  - @bamboocss/logger@0.27.2
  - @bamboocss/parser@0.27.2
  - @bamboocss/shared@0.27.2
  - @bamboocss/token-dictionary@0.27.2
  - @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- ee9341db: Fix issue in windows environments where HMR doesn't work in webpack projects.
- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
  - @bamboocss/config@0.27.1
  - @bamboocss/core@0.27.1
  - @bamboocss/generator@0.27.1
  - @bamboocss/parser@0.27.1
  - @bamboocss/token-dictionary@0.27.1
  - @bamboocss/error@0.27.1
  - @bamboocss/extractor@0.27.1
  - @bamboocss/logger@0.27.1
  - @bamboocss/shared@0.27.1

## 0.27.0

### Minor Changes

- 84304901: Improve performance, mostly for the CSS generation by removing a lot of `postcss` usage (and plugins).

  ## Public changes:
  - Introduce a new `config.lightningcss` option to use `lightningcss` (currently disabled by default) instead of
    `postcss`.
  - Add a new `config.browserslist` option to configure the browserslist used by `lightningcss`.
  - Add a `--lightningcss` flag to the `bamboo` and `bamboo cssgen` command to use `lightningcss` instead of `postcss`
    for this run.

  ## Internal changes:
  - `markImportant` fn from JS instead of walking through postcss AST nodes
  - use a fork of `stitches` `stringify` function instead of `postcss-css-in-js` to write the CSS string from a JS
    object
  - only compute once `TokenDictionary` properties
  - refactor `serializeStyle` to use the same code path as the rest of the pipeline with `StyleEncoder` / `StyleDecoder`
    and rename it to `transformStyles` to better convey what it does

### Patch Changes

- Updated dependencies [dce0b3b2]
- Updated dependencies [84304901]
- Updated dependencies [bee3ec85]
- Updated dependencies [74ac0d9d]
- Updated dependencies [c9195a4e]
  - @bamboocss/generator@0.27.0
  - @bamboocss/token-dictionary@0.27.0
  - @bamboocss/extractor@0.27.0
  - @bamboocss/config@0.27.0
  - @bamboocss/logger@0.27.0
  - @bamboocss/parser@0.27.0
  - @bamboocss/shared@0.27.0
  - @bamboocss/error@0.27.0
  - @bamboocss/types@0.27.0
  - @bamboocss/core@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/config@0.26.2
- @bamboocss/parser@0.26.2
- @bamboocss/core@0.26.2
- @bamboocss/error@0.26.2
- @bamboocss/extractor@0.26.2
- @bamboocss/generator@0.26.2
- @bamboocss/logger@0.26.2
- @bamboocss/shared@0.26.2
- @bamboocss/token-dictionary@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [6de4c737]
  - @bamboocss/generator@0.26.1
  - @bamboocss/parser@0.26.1
  - @bamboocss/config@0.26.1
  - @bamboocss/core@0.26.1
  - @bamboocss/error@0.26.1
  - @bamboocss/extractor@0.26.1
  - @bamboocss/logger@0.26.1
  - @bamboocss/shared@0.26.1
  - @bamboocss/token-dictionary@0.26.1
  - @bamboocss/types@0.26.1

## 0.26.0

### Minor Changes

- 1bd7fbb7: Fix `@bamboocss/postcss` plugin regression when the entry CSS file (with `@layer` rules order) contains
  user-defined rules, those user-defined rules would not be reloaded correctly after being changed.

### Patch Changes

- 1bd7fbb7: Fix an edge-case for when the `config.outdir` would not be set in the `bamboo.config`

  Internal details: The `outdir` would not have any value after a config change due to the fallback being set in the
  initial config resolving code path but not in context reloading code path, moving it inside the config loading
  function fixes this issue.

- Updated dependencies [a179d74f]
- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
- Updated dependencies [14033e00]
- Updated dependencies [1bd7fbb7]
- Updated dependencies [d420c676]
  - @bamboocss/generator@0.26.0
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0
  - @bamboocss/core@0.26.0
  - @bamboocss/config@0.26.0
  - @bamboocss/parser@0.26.0
  - @bamboocss/token-dictionary@0.26.0
  - @bamboocss/error@0.26.0
  - @bamboocss/extractor@0.26.0
  - @bamboocss/logger@0.26.0

## 0.25.0

### Patch Changes

- bc154358: Fix config dependencies detection by re-introducing the file tracing utility
- Updated dependencies [59fd291c]
- Updated dependencies [de282f60]
- Updated dependencies [de282f60]
  - @bamboocss/generator@0.25.0
  - @bamboocss/types@0.25.0
  - @bamboocss/core@0.25.0
  - @bamboocss/token-dictionary@0.25.0
  - @bamboocss/parser@0.25.0
  - @bamboocss/config@0.25.0
  - @bamboocss/error@0.25.0
  - @bamboocss/extractor@0.25.0
  - @bamboocss/logger@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
- Updated dependencies [61ebf3d2]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2
  - @bamboocss/core@0.24.2
  - @bamboocss/config@0.24.2
  - @bamboocss/generator@0.24.2
  - @bamboocss/parser@0.24.2
  - @bamboocss/token-dictionary@0.24.2
  - @bamboocss/error@0.24.2
  - @bamboocss/extractor@0.24.2
  - @bamboocss/logger@0.24.2

## 0.24.1

### Patch Changes

- 10e74428: - Fix an issue with the `@bamboocss/postcss` (and therefore `@bamboocss/astro`) where the initial @layer CSS
  wasn't applied correctly
  - Fix an issue with `staticCss` where it was only generated when it was included in the config (we can generate it
    through the config recipes)
- Updated dependencies [10e74428]
  - @bamboocss/generator@0.24.1
  - @bamboocss/parser@0.24.1
  - @bamboocss/config@0.24.1
  - @bamboocss/core@0.24.1
  - @bamboocss/error@0.24.1
  - @bamboocss/extractor@0.24.1
  - @bamboocss/logger@0.24.1
  - @bamboocss/shared@0.24.1
  - @bamboocss/token-dictionary@0.24.1
  - @bamboocss/types@0.24.1

## 0.24.0

### Minor Changes

- 63b3f1f2: - Boost style extraction performance by moving more work away from postcss
  - Using a hashing strategy, the compiler only computes styles/classname once per style object and prop-value-condition
    pair
  - Fix regression in previous implementation that increased memory usage per extraction, leading to slower performance
    over time

### Patch Changes

- Updated dependencies [63b3f1f2]
- Updated dependencies [f6881022]
  - @bamboocss/core@0.24.0
  - @bamboocss/generator@0.24.0
  - @bamboocss/parser@0.24.0
  - @bamboocss/types@0.24.0
  - @bamboocss/config@0.24.0
  - @bamboocss/token-dictionary@0.24.0
  - @bamboocss/error@0.24.0
  - @bamboocss/extractor@0.24.0
  - @bamboocss/logger@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- 1ea7459c: Fix performance issue where process could get slower due to postcss rules held in memory.
- 383b6d1b: Fix an issue with the postcss plugin when a config change sometimes didn't trigger files extraction
- 840ed66b: Fix an issue with config change detection when using a custom `config.slotRecipes[xxx].jsx` array
- Updated dependencies [d30b1737]
- Updated dependencies [1ea7459c]
- Updated dependencies [80ada336]
- Updated dependencies [b01eb049]
- Updated dependencies [a3b6ed5f]
- Updated dependencies [bd552b1f]
- Updated dependencies [840ed66b]
  - @bamboocss/generator@0.23.0
  - @bamboocss/core@0.23.0
  - @bamboocss/parser@0.23.0
  - @bamboocss/logger@0.23.0
  - @bamboocss/config@0.23.0
  - @bamboocss/error@0.23.0
  - @bamboocss/extractor@0.23.0
  - @bamboocss/is-valid-prop@0.23.0
  - @bamboocss/shared@0.23.0
  - @bamboocss/token-dictionary@0.23.0
  - @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- Updated dependencies [8f4ce97c]
- Updated dependencies [647f05c9]
- Updated dependencies [647f05c9]
  - @bamboocss/generator@0.22.1
  - @bamboocss/types@0.22.1
  - @bamboocss/parser@0.22.1
  - @bamboocss/shared@0.22.1
  - @bamboocss/config@0.22.1
  - @bamboocss/core@0.22.1
  - @bamboocss/token-dictionary@0.22.1
  - @bamboocss/error@0.22.1
  - @bamboocss/extractor@0.22.1
  - @bamboocss/is-valid-prop@0.22.1
  - @bamboocss/logger@0.22.1

## 0.22.0

### Patch Changes

- a2f6c2c8: Fix potential cross-platform issues with path resolving by using `pathe` instead of `path`
- 11753fea: Improve initial css extraction time by at least 5x 🚀

  Initial extraction time can get slow when using static CSS with lots of recipes or parsing a lot of files.

  **Scenarios**
  - Park UI went from 3500ms to 580ms (6x faster)
  - Bamboo Website went from 2900ms to 208ms (14x faster)

  **Potential Breaking Change**

  If you use `hooks` in your `bamboo.config` file to listen for when css is extracted, we no longer return the `css`
  string for performance reasons. We might reconsider this in the future.

- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
- Updated dependencies [9c0d3f8f]
- Updated dependencies [11753fea]
- Updated dependencies [c95c40bd]
- Updated dependencies [e83afef0]
  - @bamboocss/types@0.22.0
  - @bamboocss/generator@0.22.0
  - @bamboocss/shared@0.22.0
  - @bamboocss/core@0.22.0
  - @bamboocss/config@0.22.0
  - @bamboocss/parser@0.22.0
  - @bamboocss/token-dictionary@0.22.0
  - @bamboocss/error@0.22.0
  - @bamboocss/extractor@0.22.0
  - @bamboocss/is-valid-prop@0.22.0
  - @bamboocss/logger@0.22.0

## 0.21.0

### Patch Changes

- 7f846be2: Add `configPath` and `cwd` options in the `@bamboocss/astro` integration just like in the
  `@bamboocss/postcss`

  This can be useful with Nx monorepos where the `bamboo.config.ts` is not in the root of the project.

- Updated dependencies [1464460f]
- Updated dependencies [788aaba3]
- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [d81dcbe6]
- Updated dependencies [105f74ce]
- Updated dependencies [052283c2]
  - @bamboocss/extractor@0.21.0
  - @bamboocss/core@0.21.0
  - @bamboocss/generator@0.21.0
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0
  - @bamboocss/parser@0.21.0
  - @bamboocss/config@0.21.0
  - @bamboocss/token-dictionary@0.21.0
  - @bamboocss/error@0.21.0
  - @bamboocss/is-valid-prop@0.21.0
  - @bamboocss/logger@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/config@0.20.1
- @bamboocss/parser@0.20.1
- @bamboocss/core@0.20.1
- @bamboocss/generator@0.20.1
- @bamboocss/token-dictionary@0.20.1
- @bamboocss/error@0.20.1
- @bamboocss/extractor@0.20.1
- @bamboocss/is-valid-prop@0.20.1
- @bamboocss/logger@0.20.1
- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change
- Updated dependencies [e4fdc64a]
- Updated dependencies [24ee49a5]
- Updated dependencies [4ba982f3]
- Updated dependencies [904aec7b]
  - @bamboocss/generator@0.20.0
  - @bamboocss/config@0.20.0
  - @bamboocss/parser@0.20.0
  - @bamboocss/types@0.20.0
  - @bamboocss/core@0.20.0
  - @bamboocss/token-dictionary@0.20.0
  - @bamboocss/error@0.20.0
  - @bamboocss/extractor@0.20.0
  - @bamboocss/is-valid-prop@0.20.0
  - @bamboocss/logger@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [61831040]
- Updated dependencies [92a7fbe5]
- Updated dependencies [89f86923]
- Updated dependencies [402afbee]
- Updated dependencies [9f5711f9]
  - @bamboocss/generator@0.19.0
  - @bamboocss/types@0.19.0
  - @bamboocss/core@0.19.0
  - @bamboocss/parser@0.19.0
  - @bamboocss/config@0.19.0
  - @bamboocss/token-dictionary@0.19.0
  - @bamboocss/error@0.19.0
  - @bamboocss/extractor@0.19.0
  - @bamboocss/is-valid-prop@0.19.0
  - @bamboocss/logger@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- Updated dependencies [78b940b2]
  - @bamboocss/generator@0.18.3
  - @bamboocss/parser@0.18.3
  - @bamboocss/config@0.18.3
  - @bamboocss/core@0.18.3
  - @bamboocss/error@0.18.3
  - @bamboocss/extractor@0.18.3
  - @bamboocss/is-valid-prop@0.18.3
  - @bamboocss/logger@0.18.3
  - @bamboocss/shared@0.18.3
  - @bamboocss/token-dictionary@0.18.3
  - @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/config@0.18.2
- @bamboocss/parser@0.18.2
- @bamboocss/core@0.18.2
- @bamboocss/generator@0.18.2
- @bamboocss/token-dictionary@0.18.2
- @bamboocss/error@0.18.2
- @bamboocss/extractor@0.18.2
- @bamboocss/is-valid-prop@0.18.2
- @bamboocss/logger@0.18.2
- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- Updated dependencies [566fd28a]
- Updated dependencies [43bfa510]
- Updated dependencies [8c76cd0f]
  - @bamboocss/token-dictionary@0.18.1
  - @bamboocss/generator@0.18.1
  - @bamboocss/core@0.18.1
  - @bamboocss/config@0.18.1
  - @bamboocss/parser@0.18.1
  - @bamboocss/error@0.18.1
  - @bamboocss/extractor@0.18.1
  - @bamboocss/is-valid-prop@0.18.1
  - @bamboocss/logger@0.18.1
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Patch Changes

- 3010af28: Add a `--only-config` flag for the `bamboo debug` command, to skip writing app files and just output the
  resolved config.
- 866c12aa: Fix CLI interactive mode `syntax` question values and prettify the generated `bamboo.config.ts` file
- Updated dependencies [ba9e32fa]
- Updated dependencies [b7cb2073]
- Updated dependencies [336fd0b0]
  - @bamboocss/generator@0.18.0
  - @bamboocss/shared@0.18.0
  - @bamboocss/extractor@0.18.0
  - @bamboocss/parser@0.18.0
  - @bamboocss/core@0.18.0
  - @bamboocss/token-dictionary@0.18.0
  - @bamboocss/types@0.18.0
  - @bamboocss/config@0.18.0
  - @bamboocss/error@0.18.0
  - @bamboocss/is-valid-prop@0.18.0
  - @bamboocss/logger@0.18.0

## 0.17.5

### Patch Changes

- 17f68b3f: Ensure dir exists before writing file for the `bamboo cssgen` / `bamboo ship` / `bamboo analyze` commands
  when specifying an outfile.
- Updated dependencies [6718f81b]
- Updated dependencies [a6dfc944]
- Updated dependencies [3ce70c37]
  - @bamboocss/generator@0.17.5
  - @bamboocss/core@0.17.5
  - @bamboocss/parser@0.17.5
  - @bamboocss/config@0.17.5
  - @bamboocss/error@0.17.5
  - @bamboocss/extractor@0.17.5
  - @bamboocss/is-valid-prop@0.17.5
  - @bamboocss/logger@0.17.5
  - @bamboocss/shared@0.17.5
  - @bamboocss/token-dictionary@0.17.5
  - @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/config@0.17.4
  - @bamboocss/core@0.17.4
  - @bamboocss/generator@0.17.4
  - @bamboocss/parser@0.17.4
  - @bamboocss/token-dictionary@0.17.4
  - @bamboocss/error@0.17.4
  - @bamboocss/extractor@0.17.4
  - @bamboocss/is-valid-prop@0.17.4
  - @bamboocss/logger@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- 60f2c8a3: Fix issue in studio command where `fs-extra` imports could not be resolved.
- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/config@0.17.3
  - @bamboocss/core@0.17.3
  - @bamboocss/generator@0.17.3
  - @bamboocss/parser@0.17.3
  - @bamboocss/token-dictionary@0.17.3
  - @bamboocss/error@0.17.3
  - @bamboocss/extractor@0.17.3
  - @bamboocss/is-valid-prop@0.17.3
  - @bamboocss/logger@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/config@0.17.2
- @bamboocss/core@0.17.2
- @bamboocss/error@0.17.2
- @bamboocss/extractor@0.17.2
- @bamboocss/generator@0.17.2
- @bamboocss/is-valid-prop@0.17.2
- @bamboocss/logger@0.17.2
- @bamboocss/parser@0.17.2
- @bamboocss/shared@0.17.2
- @bamboocss/token-dictionary@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- 56299cb2: Fix persistent error that causes CI builds to fail due to PostCSS plugin emitting artifacts in the middle of
  a build process.
- ddcaf7b2: Fix issue where FileSystem writes cause intermittent errors in different build contexts (Vercel, Docker).
  This was solved by limiting the concurrency using the `p-limit` library
- Updated dependencies [296d62b1]
- Updated dependencies [42520626]
- Updated dependencies [7b981422]
- Updated dependencies [9382e687]
- Updated dependencies [aea28c9f]
- Updated dependencies [a76b279e]
- Updated dependencies [5ce359f6]
  - @bamboocss/generator@0.17.1
  - @bamboocss/core@0.17.1
  - @bamboocss/extractor@0.17.1
  - @bamboocss/shared@0.17.1
  - @bamboocss/parser@0.17.1
  - @bamboocss/types@0.17.1
  - @bamboocss/token-dictionary@0.17.1
  - @bamboocss/config@0.17.1
  - @bamboocss/error@0.17.1
  - @bamboocss/is-valid-prop@0.17.1
  - @bamboocss/logger@0.17.1

## 0.17.0

### Minor Changes

- 12281ff8: Improve support for styled element composition. This ensures that you can compose two styled elements
  together and the styles will be merged correctly.

  ```jsx
  const Box = styled('div', {
    base: {
      background: 'red.light',
      color: 'white',
    },
  })

  const ExtendedBox = styled(Box, {
    base: { background: 'red.dark' },
  })

  // <ExtendedBox> will have a background of `red.dark` and a color of `white`
  ```

  **Limitation:** This feature does not allow compose mixed styled composition. A mixed styled composition happens when
  an element is created from a cva/inline cva, and another created from a config recipe.
  - CVA or Inline CVA + CVA or Inline CVA = ✅
  - Config Recipe + Config Recipe = ✅
  - CVA or Inline CVA + Config Recipe = ❌

  ```jsx
  import { button } from '../styled-system/recipes'

  const Button = styled('div', button)

  // ❌ This will throw an error
  const ExtendedButton = styled(Button, {
    base: { background: 'red.dark' },
  })
  ```

### Patch Changes

- dd6811b3: Apply `config.logLevel` from the Bamboo config to the logger in every context.

  Fixes https://github.com/bamboocss/bamboo/issues/1451

- Updated dependencies [93996aaf]
- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
- Updated dependencies [e73ea803]
- Updated dependencies [fbf062c6]
  - @bamboocss/generator@0.17.0
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0
  - @bamboocss/core@0.17.0
  - @bamboocss/parser@0.17.0
  - @bamboocss/token-dictionary@0.17.0
  - @bamboocss/config@0.17.0
  - @bamboocss/error@0.17.0
  - @bamboocss/extractor@0.17.0
  - @bamboocss/is-valid-prop@0.17.0
  - @bamboocss/logger@0.17.0

## 0.16.0

### Minor Changes

- 36252b1d: ## --minimal flag

  Adds a new `--minimal` flag for the CLI on the `bamboo cssgen` command to skip generating CSS for theme tokens,
  preflightkeyframes, static and global css

  Thich means that the generated CSS will only contain the CSS related to the styles found in the included files.

  > Note that you can use a `glob` to override the `config.include` option like this:
  > `bamboo cssgen "src/**/*.css" --minimal`

  This is useful when you want to split your CSS into multiple files, for example if you want to split by pages.

  Use it like this:

  ```bash
  bamboo cssgen "src/**/pages/*.css" --minimal --outfile dist/pages.css
  ```

  ***

  ## cssgen {type}

  In addition to the optional `glob` that you can already pass to override the config.include option, the
  `bamboo cssgen` command now accepts a new `{type}` argument to generate only a specific type of CSS:
  - preflight
  - tokens
  - static
  - global
  - keyframes

  > Note that this only works when passing an `--outfile`.

  You can use it like this:

  ```bash
  bamboo cssgen "static" --outfile dist/static.css
  ```

### Patch Changes

- 20f4e204: Apply a few optmizations on the resulting CSS generated from `bamboo cssgen` command
- Updated dependencies [2b5cbf73]
- Updated dependencies [20f4e204]
- Updated dependencies [36252b1d]
  - @bamboocss/generator@0.16.0
  - @bamboocss/core@0.16.0
  - @bamboocss/parser@0.16.0
  - @bamboocss/config@0.16.0
  - @bamboocss/token-dictionary@0.16.0
  - @bamboocss/error@0.16.0
  - @bamboocss/extractor@0.16.0
  - @bamboocss/is-valid-prop@0.16.0
  - @bamboocss/logger@0.16.0
  - @bamboocss/shared@0.16.0
  - @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- 909fcbe8: - Fix issue with `Promise.all` where it aborts premature ine weird events. Switched to `Promise.allSettled`
- Updated dependencies [d12aed2b]
- Updated dependencies [909fcbe8]
- Updated dependencies [3d5971e5]
  - @bamboocss/generator@0.15.5
  - @bamboocss/parser@0.15.5
  - @bamboocss/config@0.15.5
  - @bamboocss/core@0.15.5
  - @bamboocss/error@0.15.5
  - @bamboocss/extractor@0.15.5
  - @bamboocss/is-valid-prop@0.15.5
  - @bamboocss/logger@0.15.5
  - @bamboocss/shared@0.15.5
  - @bamboocss/token-dictionary@0.15.5
  - @bamboocss/types@0.15.5

## 0.15.4

### Patch Changes

- Updated dependencies [abd7c47a]
- Updated dependencies [bf0e6a30]
- Updated dependencies [69699ba4]
- Updated dependencies [3a04a927]
  - @bamboocss/config@0.15.4
  - @bamboocss/generator@0.15.4
  - @bamboocss/parser@0.15.4
  - @bamboocss/extractor@0.15.4
  - @bamboocss/types@0.15.4
  - @bamboocss/core@0.15.4
  - @bamboocss/error@0.15.4
  - @bamboocss/is-valid-prop@0.15.4
  - @bamboocss/logger@0.15.4
  - @bamboocss/shared@0.15.4
  - @bamboocss/token-dictionary@0.15.4

## 0.15.3

### Patch Changes

- Updated dependencies [d34c8b48]
- Updated dependencies [95b06bb1]
- Updated dependencies [1ac2011b]
- Updated dependencies [58743bc4]
- Updated dependencies [1eb31118]
  - @bamboocss/generator@0.15.3
  - @bamboocss/shared@0.15.3
  - @bamboocss/core@0.15.3
  - @bamboocss/parser@0.15.3
  - @bamboocss/types@0.15.3
  - @bamboocss/token-dictionary@0.15.3
  - @bamboocss/config@0.15.3
  - @bamboocss/error@0.15.3
  - @bamboocss/extractor@0.15.3
  - @bamboocss/is-valid-prop@0.15.3
  - @bamboocss/logger@0.15.3

## 0.15.2

### Patch Changes

- f3c30d60: Update supported bamboo config extensions
- Updated dependencies [6d15776c]
- Updated dependencies [26a788c0]
- Updated dependencies [2645c2da]
  - @bamboocss/generator@0.15.2
  - @bamboocss/types@0.15.2
  - @bamboocss/config@0.15.2
  - @bamboocss/parser@0.15.2
  - @bamboocss/core@0.15.2
  - @bamboocss/token-dictionary@0.15.2
  - @bamboocss/error@0.15.2
  - @bamboocss/extractor@0.15.2
  - @bamboocss/is-valid-prop@0.15.2
  - @bamboocss/logger@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- Updated dependencies [7e8bcb03]
- Updated dependencies [848936e0]
- Updated dependencies [433f88cd]
- Updated dependencies [c40ae1b9]
- Updated dependencies [26f6982c]
- Updated dependencies [4e003bfb]
- Updated dependencies [7499bbd2]
  - @bamboocss/generator@0.15.1
  - @bamboocss/core@0.15.1
  - @bamboocss/extractor@0.15.1
  - @bamboocss/parser@0.15.1
  - @bamboocss/shared@0.15.1
  - @bamboocss/token-dictionary@0.15.1
  - @bamboocss/types@0.15.1
  - @bamboocss/config@0.15.1
  - @bamboocss/error@0.15.1
  - @bamboocss/is-valid-prop@0.15.1
  - @bamboocss/logger@0.15.1

## 0.15.0

### Patch Changes

- 39298609: Make the types suggestion faster (updated `DeepPartial`)
- Updated dependencies [be24d1a0]
- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [93d9ee7e]
- Updated dependencies [bc3b077d]
- Updated dependencies [35793d85]
- Updated dependencies [39298609]
- Updated dependencies [dd47b6e6]
- Updated dependencies [7c1ab170]
- Updated dependencies [f27146d6]
  - @bamboocss/extractor@0.15.0
  - @bamboocss/types@0.15.0
  - @bamboocss/generator@0.15.0
  - @bamboocss/shared@0.15.0
  - @bamboocss/core@0.15.0
  - @bamboocss/parser@0.15.0
  - @bamboocss/config@0.15.0
  - @bamboocss/token-dictionary@0.15.0
  - @bamboocss/error@0.15.0
  - @bamboocss/is-valid-prop@0.15.0
  - @bamboocss/logger@0.15.0

## 0.14.0

### Minor Changes

- 8106b411: Add `generator:done` hook to perform actions when codegen artifacts are emitted.

### Patch Changes

- Updated dependencies [b1c31fdd]
- Updated dependencies [bdd30d18]
- Updated dependencies [bff17df2]
- Updated dependencies [6548f4f7]
- Updated dependencies [8106b411]
- Updated dependencies [9e799554]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
- Updated dependencies [623e321f]
- Updated dependencies [542d1ebc]
- Updated dependencies [39b20797]
- Updated dependencies [02161d41]
  - @bamboocss/token-dictionary@0.14.0
  - @bamboocss/generator@0.14.0
  - @bamboocss/types@0.14.0
  - @bamboocss/core@0.14.0
  - @bamboocss/parser@0.14.0
  - @bamboocss/config@0.14.0
  - @bamboocss/error@0.14.0
  - @bamboocss/extractor@0.14.0
  - @bamboocss/is-valid-prop@0.14.0
  - @bamboocss/logger@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- Updated dependencies [a5d7d514]
- Updated dependencies [577dcb9d]
- Updated dependencies [192d5e49]
- Updated dependencies [d0fbc7cc]
  - @bamboocss/generator@0.13.1
  - @bamboocss/parser@0.13.1
  - @bamboocss/error@0.13.1
  - @bamboocss/config@0.13.1
  - @bamboocss/core@0.13.1
  - @bamboocss/extractor@0.13.1
  - @bamboocss/is-valid-prop@0.13.1
  - @bamboocss/logger@0.13.1
  - @bamboocss/shared@0.13.1
  - @bamboocss/token-dictionary@0.13.1
  - @bamboocss/types@0.13.1

## 0.13.0

### Patch Changes

- Updated dependencies [04b5fd6c]
- Updated dependencies [a9690110]
- Updated dependencies [32ceac3f]
  - @bamboocss/core@0.13.0
  - @bamboocss/generator@0.13.0
  - @bamboocss/parser@0.13.0
  - @bamboocss/config@0.13.0
  - @bamboocss/error@0.13.0
  - @bamboocss/extractor@0.13.0
  - @bamboocss/is-valid-prop@0.13.0
  - @bamboocss/logger@0.13.0
  - @bamboocss/shared@0.13.0
  - @bamboocss/token-dictionary@0.13.0
  - @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- Updated dependencies [6588c8e0]
- Updated dependencies [36fdff89]
  - @bamboocss/generator@0.12.2
  - @bamboocss/parser@0.12.2
  - @bamboocss/config@0.12.2
  - @bamboocss/core@0.12.2
  - @bamboocss/error@0.12.2
  - @bamboocss/extractor@0.12.2
  - @bamboocss/is-valid-prop@0.12.2
  - @bamboocss/logger@0.12.2
  - @bamboocss/shared@0.12.2
  - @bamboocss/token-dictionary@0.12.2
  - @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- Updated dependencies [599fbc1a]
  - @bamboocss/generator@0.12.1
  - @bamboocss/parser@0.12.1
  - @bamboocss/config@0.12.1
  - @bamboocss/core@0.12.1
  - @bamboocss/error@0.12.1
  - @bamboocss/extractor@0.12.1
  - @bamboocss/is-valid-prop@0.12.1
  - @bamboocss/logger@0.12.1
  - @bamboocss/shared@0.12.1
  - @bamboocss/token-dictionary@0.12.1
  - @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- Updated dependencies [a41515de]
- Updated dependencies [bf2ff391]
- Updated dependencies [ad1518b8]
  - @bamboocss/generator@0.12.0
  - @bamboocss/parser@0.12.0
  - @bamboocss/config@0.12.0
  - @bamboocss/core@0.12.0
  - @bamboocss/token-dictionary@0.12.0
  - @bamboocss/error@0.12.0
  - @bamboocss/extractor@0.12.0
  - @bamboocss/is-valid-prop@0.12.0
  - @bamboocss/logger@0.12.0
  - @bamboocss/shared@0.12.0
  - @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- 23b516f4: Make layers customizable
- Updated dependencies [c07e1beb]
- Updated dependencies [dfb3f85f]
- Updated dependencies [23b516f4]
  - @bamboocss/generator@0.11.1
  - @bamboocss/shared@0.11.1
  - @bamboocss/is-valid-prop@0.11.1
  - @bamboocss/types@0.11.1
  - @bamboocss/core@0.11.1
  - @bamboocss/parser@0.11.1
  - @bamboocss/token-dictionary@0.11.1
  - @bamboocss/config@0.11.1
  - @bamboocss/error@0.11.1
  - @bamboocss/extractor@0.11.1
  - @bamboocss/logger@0.11.1

## 0.11.0

### Patch Changes

- cde9702e: Add an optional `glob` argument that overrides the config.include on the `bamboo cssgen` CLI command.
- Updated dependencies [dead08a2]
- Updated dependencies [5b95caf5]
- Updated dependencies [39b80b49]
- Updated dependencies [1dc788bd]
  - @bamboocss/config@0.11.0
  - @bamboocss/generator@0.11.0
  - @bamboocss/types@0.11.0
  - @bamboocss/parser@0.11.0
  - @bamboocss/core@0.11.0
  - @bamboocss/token-dictionary@0.11.0
  - @bamboocss/error@0.11.0
  - @bamboocss/extractor@0.11.0
  - @bamboocss/is-valid-prop@0.11.0
  - @bamboocss/logger@0.11.0
  - @bamboocss/shared@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [24e783b3]
- Updated dependencies [9d4aa918]
- Updated dependencies [2d2a42da]
- Updated dependencies [386e5098]
- Updated dependencies [6d4eaa68]
- Updated dependencies [a669f4d5]
  - @bamboocss/is-valid-prop@0.10.0
  - @bamboocss/generator@0.10.0
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0
  - @bamboocss/token-dictionary@0.10.0
  - @bamboocss/core@0.10.0
  - @bamboocss/parser@0.10.0
  - @bamboocss/config@0.10.0
  - @bamboocss/error@0.10.0
  - @bamboocss/extractor@0.10.0
  - @bamboocss/logger@0.10.0

## 0.9.0

### Patch Changes

- f10e706a: Fix PostCSS edge-case where the config file is not in the app root
- Updated dependencies [c08de87f]
- Updated dependencies [3269b411]
  - @bamboocss/generator@0.9.0
  - @bamboocss/parser@0.9.0
  - @bamboocss/types@0.9.0
  - @bamboocss/core@0.9.0
  - @bamboocss/extractor@0.9.0
  - @bamboocss/config@0.9.0
  - @bamboocss/token-dictionary@0.9.0
  - @bamboocss/error@0.9.0
  - @bamboocss/is-valid-prop@0.9.0
  - @bamboocss/logger@0.9.0
  - @bamboocss/shared@0.9.0

## 0.8.0

### Patch Changes

- 5d1d376b: Adding missing comma for generated bamboo config
- be0ad578: Fix parser issue with TS path mappings
- 78612d7f: Fix node evaluation in extractor process (can happen when using a BinaryExpression, simple CallExpression or
  conditions)
- Updated dependencies [3f1e7e32]
- Updated dependencies [fb449016]
- Updated dependencies [ac078416]
- Updated dependencies [e1f6318a]
- Updated dependencies [be0ad578]
- Updated dependencies [b75905d8]
- Updated dependencies [78612d7f]
- Updated dependencies [9ddf258b]
- Updated dependencies [0520ba83]
- Updated dependencies [156b6bde]
  - @bamboocss/generator@0.8.0
  - @bamboocss/core@0.8.0
  - @bamboocss/extractor@0.8.0
  - @bamboocss/parser@0.8.0
  - @bamboocss/token-dictionary@0.8.0
  - @bamboocss/config@0.8.0
  - @bamboocss/types@0.8.0
  - @bamboocss/error@0.8.0
  - @bamboocss/is-valid-prop@0.8.0
  - @bamboocss/logger@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- f4bb0576: Fix postcss issue where `@layer reset, base, tokens, recipes, utilities` check was too strict
- d8ebaf2f: Fix issue where hot module reloading is inconsistent in the PostCSS plugin when external files are changed
- 4ff7ddea: Fix issue where hot module reloading is inconsistent in the PostCSS plugin when another internal package is
  changed
- Updated dependencies [16cd3764]
- Updated dependencies [f2abf34d]
- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
- Updated dependencies [7bc69e4b]
- Updated dependencies [1a05c4bb]
  - @bamboocss/parser@0.7.0
  - @bamboocss/extractor@0.7.0
  - @bamboocss/shared@0.7.0
  - @bamboocss/generator@0.7.0
  - @bamboocss/types@0.7.0
  - @bamboocss/config@0.7.0
  - @bamboocss/core@0.7.0
  - @bamboocss/token-dictionary@0.7.0
  - @bamboocss/error@0.7.0
  - @bamboocss/is-valid-prop@0.7.0
  - @bamboocss/logger@0.7.0

## 0.6.0

### Patch Changes

- 032c152a: Fix issue where `bamboo cssgen --outfile` doesn't extract files to chunks before bundling them into the css
  out file
- Updated dependencies [cd912f35]
- Updated dependencies [dc4e80f7]
- Updated dependencies [12c900ee]
- Updated dependencies [21295f2e]
- Updated dependencies [5bd88c41]
- Updated dependencies [ef1dd676]
- Updated dependencies [b50675ca]
  - @bamboocss/generator@0.6.0
  - @bamboocss/core@0.6.0
  - @bamboocss/extractor@0.6.0
  - @bamboocss/parser@0.6.0
  - @bamboocss/config@0.6.0
  - @bamboocss/types@0.6.0
  - @bamboocss/token-dictionary@0.6.0
  - @bamboocss/error@0.6.0
  - @bamboocss/is-valid-prop@0.6.0
  - @bamboocss/logger@0.6.0
  - @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- 5b09ab3b: Add support for `--outfile` flag in the `cssgen` command.

  ```bash
  bamboo cssgen --outfile dist/styles.css
  ```

- 78ed6ed4: Fix issue where using a nested outdir like `src/styled-system` with a baseUrl like `./src` would result on
  parser NOT matching imports like `import { container } from "styled-system/patterns";` cause it would expect the full
  path `src/styled-system`
- e48b130a: - Remove `stack` from `box.toJSON()` so that generated JSON files have less noise, mostly useful to get make
  the `bamboo debug` command easier to read
  - Also use the `ParserResult.toJSON()` method on `bamboo debug` command for the same reason

  instead of:

  ```json
  [
    {
      "type": "map",
      "value": {
        "padding": {
          "type": "literal",
          "value": "25px",
          "node": "StringLiteral",
          "stack": [
            "CallExpression",
            "ObjectLiteralExpression",
            "PropertyAssignment",
            "Identifier",
            "Identifier",
            "VariableDeclaration",
            "StringLiteral"
          ],
          "line": 10,
          "column": 20
        },
        "fontSize": {
          "type": "literal",
          "value": "2xl",
          "node": "StringLiteral",
          "stack": [
            "CallExpression",
            "ObjectLiteralExpression",
            "PropertyAssignment",
            "ConditionalExpression"
          ],
          "line": 11,
          "column": 67
        }
      },
      "node": "CallExpression",
      "stack": [
        "CallExpression",
        "ObjectLiteralExpression"
      ],
      "line": 11,
      "column": 21
    },
  ```

  we now have:

  ```json
  {
    "css": [
      {
        "type": "object",
        "name": "css",
        "box": {
          "type": "map",
          "value": {},
          "node": "CallExpression",
          "line": 15,
          "column": 27
        },
        "data": [
          {
            "alignItems": "center",
            "backgroundColor": "white",
            "border": "1px solid black",
            "borderRadius": "8px",
            "display": "flex",
            "gap": "16px",
            "p": "8px",
            "pr": "16px"
          }
        ]
      }
    ],
    "cva": [],
    "recipe": {
      "checkboxRoot": [
        {
          "type": "recipe",
          "name": "checkboxRoot",
          "box": {
            "type": "map",
            "value": {},
            "node": "CallExpression",
            "line": 38,
            "column": 47
          },
          "data": [
            {}
          ]
        }
      ],
  ```

- 1a2c0e2b: Fix `bamboo.config.xxx` file dependencies detection when using the builder (= with PostCSS or with the
  VSCode extension). It will now also properly resolve tsconfig path aliases.
- Updated dependencies [6f03ead3]
- Updated dependencies [8c670d60]
- Updated dependencies [33198907]
- Updated dependencies [53fb0708]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [f9247e52]
- Updated dependencies [1ed239cd]
- Updated dependencies [09ebaf2e]
- Updated dependencies [78ed6ed4]
- Updated dependencies [e48b130a]
- Updated dependencies [1a2c0e2b]
- Updated dependencies [b8f8c2a6]
- Updated dependencies [a3d760ce]
- Updated dependencies [d9bc63e7]
  - @bamboocss/extractor@0.5.1
  - @bamboocss/types@0.5.1
  - @bamboocss/config@0.5.1
  - @bamboocss/generator@0.5.1
  - @bamboocss/shared@0.5.1
  - @bamboocss/logger@0.5.1
  - @bamboocss/core@0.5.1
  - @bamboocss/parser@0.5.1
  - @bamboocss/token-dictionary@0.5.1
  - @bamboocss/error@0.5.1
  - @bamboocss/is-valid-prop@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [60df9bd1]
- Updated dependencies [30f41e01]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/parser@0.5.0
  - @bamboocss/extractor@0.5.0
  - @bamboocss/generator@0.5.0
  - @bamboocss/types@0.5.0
  - @bamboocss/core@0.5.0
  - @bamboocss/token-dictionary@0.5.0
  - @bamboocss/config@0.5.0
  - @bamboocss/error@0.5.0
  - @bamboocss/is-valid-prop@0.5.0
  - @bamboocss/logger@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [8991b1e4]
- Updated dependencies [2a1e9386]
- Updated dependencies [54a8913c]
- Updated dependencies [c7b42325]
- Updated dependencies [a48e5b00]
- Updated dependencies [5b344b9c]
  - @bamboocss/parser@0.4.0
  - @bamboocss/core@0.4.0
  - @bamboocss/is-valid-prop@0.4.0
  - @bamboocss/generator@0.4.0
  - @bamboocss/types@0.4.0
  - @bamboocss/config@0.4.0
  - @bamboocss/token-dictionary@0.4.0
  - @bamboocss/error@0.4.0
  - @bamboocss/extractor@0.4.0
  - @bamboocss/logger@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [9822d79a]
  - @bamboocss/config@0.3.2
  - @bamboocss/core@0.3.2
  - @bamboocss/error@0.3.2
  - @bamboocss/extractor@0.3.2
  - @bamboocss/generator@0.3.2
  - @bamboocss/is-valid-prop@0.3.2
  - @bamboocss/logger@0.3.2
  - @bamboocss/parser@0.3.2
  - @bamboocss/shared@0.3.2
  - @bamboocss/token-dictionary@0.3.2
  - @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/config@0.3.1
  - @bamboocss/core@0.3.1
  - @bamboocss/error@0.3.1
  - @bamboocss/extractor@0.3.1
  - @bamboocss/generator@0.3.1
  - @bamboocss/is-valid-prop@0.3.1
  - @bamboocss/logger@0.3.1
  - @bamboocss/parser@0.3.1
  - @bamboocss/shared@0.3.1
  - @bamboocss/token-dictionary@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Patch Changes

- b8ab0868: Fix white space when updating the `.gitignore` file
- Updated dependencies [6d81ee9e]
  - @bamboocss/generator@0.3.0
  - @bamboocss/parser@0.3.0
  - @bamboocss/types@0.3.0
  - @bamboocss/config@0.3.0
  - @bamboocss/core@0.3.0
  - @bamboocss/token-dictionary@0.3.0
  - @bamboocss/error@0.3.0
  - @bamboocss/extractor@0.3.0
  - @bamboocss/is-valid-prop@0.3.0
  - @bamboocss/logger@0.3.0
  - @bamboocss/shared@0.3.0

## 0.0.2

### Patch Changes

- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.

- Updated dependencies [c308e8be]
- Updated dependencies [fb40fff2]
  - @bamboocss/config@0.0.2
  - @bamboocss/types@0.0.2
  - @bamboocss/core@0.0.2
  - @bamboocss/error@0.0.2
  - @bamboocss/extractor@0.0.2
  - @bamboocss/generator@0.0.2
  - @bamboocss/is-valid-prop@0.0.2
  - @bamboocss/logger@0.0.2
  - @bamboocss/parser@0.0.2
  - @bamboocss/shared@0.0.2
  - @bamboocss/token-dictionary@0.0.2

* path.join('-'), }) }, }, })

````

## `utility:created`

This hook is called when the internal classname engine has been created. You can override the default `toHash` function
used when `config.hash` is set to `true`

```ts
export default defineConfig({
  // ...
  hooks: {
    'utility:created': ({ configure }) => {
      configure({
        toHash: (paths, toHash) => {
          const stringConds = paths.join(':')
          const splitConds = stringConds.split('_')
          const hashConds = splitConds.map(toHash)
          return hashConds.join('_')
        },
      })
    },
  },
})
````

## `codegen:prepare`

This hook is called right before writing the codegen files to disk. You can use this hook to tweak the codegen files

```ts
export default defineConfig({
  // ...
  hooks: {
    'codegen:prepare': ({ artifacts, changed }) => {
      // do something with the emitted js/d.ts files
    },
  },
})
```

- d5977c24: - Add a `--logfile` flag to the `bamboo`, `bamboo codegen`, `bamboo cssgen` and `bamboo debug` commands.
  - Add a `logfile` option to the postcss plugin

  Logs will be streamed to the file specified by the `--logfile` flag or the `logfile` option. This is useful for
  debugging issues that occur during the build process.

  ```sh
  bamboo --logfile ./logs/bamboo.log
  ```

  ```js
  module.exports = {
    plugins: {
      '@bamboocss/dev/postcss': {
        logfile: './logs/bamboo.log',
      },
    },
  }
  ```

- Updated dependencies [0dd45b6a]
- Updated dependencies [74485ef1]
- Updated dependencies [ab32d1d7]
- Updated dependencies [ab32d1d7]
- Updated dependencies [49c760cd]
- Updated dependencies [d5977c24]
  - @bamboocss/config@0.30.0
  - @bamboocss/types@0.30.0
  - @bamboocss/token-dictionary@0.30.0
  - @bamboocss/generator@0.30.0
  - @bamboocss/shared@0.30.0
  - @bamboocss/core@0.30.0
  - @bamboocss/logger@0.30.0
  - @bamboocss/parser@0.30.0
  - @bamboocss/extractor@0.30.0

## 0.29.1

### Patch Changes

- a5c75607: Fix an issue (introduced in v0.29) with `bamboo init` and add an assert on the new `colorMix` utility
  function
- Updated dependencies [a5c75607]
  - @bamboocss/core@0.29.1
  - @bamboocss/generator@0.29.1
  - @bamboocss/parser@0.29.1
  - @bamboocss/config@0.29.1
  - @bamboocss/extractor@0.29.1
  - @bamboocss/logger@0.29.1
  - @bamboocss/shared@0.29.1
  - @bamboocss/token-dictionary@0.29.1
  - @bamboocss/types@0.29.1

## 0.29.0

### Minor Changes

- a2fb5cc6: - Add support for explicitly specifying config related files that should trigger a context reload on change.

  > We automatically track the config file and (transitive) files imported by the config file as much as possible, but
  > sometimes we might miss some. You can use this option as a workaround for those edge cases.

  Set the `dependencies` option in `bamboo.config.ts` to a glob or list of files.

  ```ts
  export default defineConfig({
    // ...
    dependencies: ['path/to/files/**.ts'],
  })
  ```

  - Invoke `config:change` hook in more situations (when the `--watch` flag is passed to `bamboo codegen`,
    `bamboo cssgen`, `bamboo ship`)

  - Watch for more config options paths changes, so that the related artifacts will be regenerated a bit more reliably
    (ex: updating the `config.hooks` will now trigger a full regeneration of `styled-system`)

### Patch Changes

- Updated dependencies [5fcdeb75]
- Updated dependencies [7c7340ec]
- Updated dependencies [f778d3e5]
- Updated dependencies [2e32794d]
- Updated dependencies [ea3f5548]
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
  - @bamboocss/core@0.29.0
  - @bamboocss/token-dictionary@0.29.0
  - @bamboocss/parser@0.29.0
  - @bamboocss/generator@0.29.0
  - @bamboocss/config@0.29.0
  - @bamboocss/extractor@0.29.0
  - @bamboocss/logger@0.29.0
  - @bamboocss/shared@0.29.0

## 0.28.0

### Minor Changes

- f58f6df2: Refactor `config.hooks` to be much more powerful, you can now:
  - Tweak the config after it has been resolved (after presets are loaded and merged), this could be used to dynamically
    load all `recipes` from a folder
  - Transform a source file's content before parsing it, this could be used to transform the file content to a
    `tsx`-friendly syntax so that Bamboo's parser can parse it.
  - Implement your own parser logic and add the extracted results to the classic Bamboo pipeline, this could be used to
    parse style usage from any template language
  - Tweak the CSS content for any `@layer` or even right before it's written to disk (if using the CLI) or injected
    through the postcss plugin, allowing all kinds of customizations like removing the unused CSS variables, etc.
  - React to any config change or after the codegen step (your outdir, the `styled-system` folder) have been generated

  See the list of available `config.hooks` here:

  ```ts
  export interface BambooHooks {
    /**
     * Called when the config is resolved, after all the presets are loaded and merged.
     * This is the first hook called, you can use it to tweak the config before the context is created.
     */
    'config:resolved': (args: { conf: LoadConfigResult }) => MaybeAsyncReturn
    /**
     * Called when the Bamboo context has been created and the API is ready to be used.
     */
    'context:created': (args: { ctx: ApiInterface; logger: LoggerInterface }) => void
    /**
     * Called when the config file or one of its dependencies (imports) has changed.
     */
    'config:change': (args: { config: UserConfig }) => MaybeAsyncReturn
    /**
     * Called after reading the file content but before parsing it.
     * You can use this hook to transform the file content to a tsx-friendly syntax so that Bamboo's parser can parse it.
     * You can also use this hook to parse the file's content on your side using a custom parser, in this case you don't have to return anything.
     */
    'parser:before': (args: { filePath: string; content: string }) => string | void
    /**
     * Called after the file styles are extracted and processed into the resulting ParserResult object.
     * You can also use this hook to add your own extraction results from your custom parser to the ParserResult object.
     */
    'parser:after': (args: { filePath: string; result: ParserResultInterface | undefined }) => void
    /**
     * Called after the codegen is completed
     */
    'codegen:done': () => MaybeAsyncReturn
    /**
     * Called right before adding the design-system CSS (global, static, preflight, tokens, keyframes) to the final CSS
     * Called right before writing/injecting the final CSS (styles.css) that contains the design-system CSS and the parser CSS
     * You can use it to tweak the CSS content before it's written to disk or injected through the postcss plugin.
     */
    'cssgen:done': (args: {
      artifact: 'global' | 'static' | 'reset' | 'tokens' | 'keyframes' | 'styles.css'
      content: string
    }) => string | void
  }
  ```

### Patch Changes

- f255342f: Add a `--cpu-prof` flag to `bamboo`, `bamboo cssgen`, `bamboo codegen` and `bamboo debug` commands This is
  useful for debugging performance issues in `bamboo` itself. This will generate a
  `bamboo-{command}-{timestamp}.cpuprofile` file in the current working directory, which can be opened in tools like
  [Speedscope](https://www.speedscope.app/)

  This is mostly intended for maintainers or can be asked by maintainers to help debug issues.

- Updated dependencies [f58f6df2]
- Updated dependencies [e463ce0e]
- Updated dependencies [77cab9fe]
- Updated dependencies [770c7aa4]
- Updated dependencies [1edadf30]
- Updated dependencies [d4fa5de9]
- Updated dependencies [9d000dcd]
- Updated dependencies [6d7e7b07]
  - @bamboocss/generator@0.28.0
  - @bamboocss/config@0.28.0
  - @bamboocss/parser@0.28.0
  - @bamboocss/types@0.28.0
  - @bamboocss/core@0.28.0
  - @bamboocss/shared@0.28.0
  - @bamboocss/token-dictionary@0.28.0
  - @bamboocss/error@0.28.0
  - @bamboocss/extractor@0.28.0
  - @bamboocss/logger@0.28.0

## 0.27.3

### Patch Changes

- 1ed4df77: Fix issue where HMR doesn't work when tsconfig paths is used.
- 39d10c79: Fix `prettier` parser warning in bamboo config setup.
- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/core@0.27.3
  - @bamboocss/config@0.27.3
  - @bamboocss/generator@0.27.3
  - @bamboocss/parser@0.27.3
  - @bamboocss/token-dictionary@0.27.3
  - @bamboocss/error@0.27.3
  - @bamboocss/extractor@0.27.3
  - @bamboocss/logger@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- bfa8b1ee: Switch back to `node:path` from `pathe` to resolve issues with windows path in PostCSS + Webpack set up
  - @bamboocss/config@0.27.2
  - @bamboocss/core@0.27.2
  - @bamboocss/error@0.27.2
  - @bamboocss/extractor@0.27.2
  - @bamboocss/generator@0.27.2
  - @bamboocss/logger@0.27.2
  - @bamboocss/parser@0.27.2
  - @bamboocss/shared@0.27.2
  - @bamboocss/token-dictionary@0.27.2
  - @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- ee9341db: Fix issue in windows environments where HMR doesn't work in webpack projects.
- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
  - @bamboocss/config@0.27.1
  - @bamboocss/core@0.27.1
  - @bamboocss/generator@0.27.1
  - @bamboocss/parser@0.27.1
  - @bamboocss/token-dictionary@0.27.1
  - @bamboocss/error@0.27.1
  - @bamboocss/extractor@0.27.1
  - @bamboocss/logger@0.27.1
  - @bamboocss/shared@0.27.1

## 0.27.0

### Minor Changes

- 84304901: Improve performance, mostly for the CSS generation by removing a lot of `postcss` usage (and plugins).

  ## Public changes:
  - Introduce a new `config.lightningcss` option to use `lightningcss` (currently disabled by default) instead of
    `postcss`.
  - Add a new `config.browserslist` option to configure the browserslist used by `lightningcss`.
  - Add a `--lightningcss` flag to the `bamboo` and `bamboo cssgen` command to use `lightningcss` instead of `postcss`
    for this run.

  ## Internal changes:
  - `markImportant` fn from JS instead of walking through postcss AST nodes
  - use a fork of `stitches` `stringify` function instead of `postcss-css-in-js` to write the CSS string from a JS
    object
  - only compute once `TokenDictionary` properties
  - refactor `serializeStyle` to use the same code path as the rest of the pipeline with `StyleEncoder` / `StyleDecoder`
    and rename it to `transformStyles` to better convey what it does

### Patch Changes

- Updated dependencies [dce0b3b2]
- Updated dependencies [84304901]
- Updated dependencies [bee3ec85]
- Updated dependencies [74ac0d9d]
- Updated dependencies [c9195a4e]
  - @bamboocss/generator@0.27.0
  - @bamboocss/token-dictionary@0.27.0
  - @bamboocss/extractor@0.27.0
  - @bamboocss/config@0.27.0
  - @bamboocss/logger@0.27.0
  - @bamboocss/parser@0.27.0
  - @bamboocss/shared@0.27.0
  - @bamboocss/error@0.27.0
  - @bamboocss/types@0.27.0
  - @bamboocss/core@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/config@0.26.2
- @bamboocss/parser@0.26.2
- @bamboocss/core@0.26.2
- @bamboocss/error@0.26.2
- @bamboocss/extractor@0.26.2
- @bamboocss/generator@0.26.2
- @bamboocss/logger@0.26.2
- @bamboocss/shared@0.26.2
- @bamboocss/token-dictionary@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [6de4c737]
  - @bamboocss/generator@0.26.1
  - @bamboocss/parser@0.26.1
  - @bamboocss/config@0.26.1
  - @bamboocss/core@0.26.1
  - @bamboocss/error@0.26.1
  - @bamboocss/extractor@0.26.1
  - @bamboocss/logger@0.26.1
  - @bamboocss/shared@0.26.1
  - @bamboocss/token-dictionary@0.26.1
  - @bamboocss/types@0.26.1

## 0.26.0

### Minor Changes

- 1bd7fbb7: Fix `@bamboocss/postcss` plugin regression when the entry CSS file (with `@layer` rules order) contains
  user-defined rules, those user-defined rules would not be reloaded correctly after being changed.

### Patch Changes

- 1bd7fbb7: Fix an edge-case for when the `config.outdir` would not be set in the `bamboo.config`

  Internal details: The `outdir` would not have any value after a config change due to the fallback being set in the
  initial config resolving code path but not in context reloading code path, moving it inside the config loading
  function fixes this issue.

- Updated dependencies [a179d74f]
- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
- Updated dependencies [14033e00]
- Updated dependencies [1bd7fbb7]
- Updated dependencies [d420c676]
  - @bamboocss/generator@0.26.0
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0
  - @bamboocss/core@0.26.0
  - @bamboocss/config@0.26.0
  - @bamboocss/parser@0.26.0
  - @bamboocss/token-dictionary@0.26.0
  - @bamboocss/error@0.26.0
  - @bamboocss/extractor@0.26.0
  - @bamboocss/logger@0.26.0

## 0.25.0

### Patch Changes

- bc154358: Fix config dependencies detection by re-introducing the file tracing utility
- Updated dependencies [59fd291c]
- Updated dependencies [de282f60]
- Updated dependencies [de282f60]
  - @bamboocss/generator@0.25.0
  - @bamboocss/types@0.25.0
  - @bamboocss/core@0.25.0
  - @bamboocss/token-dictionary@0.25.0
  - @bamboocss/parser@0.25.0
  - @bamboocss/config@0.25.0
  - @bamboocss/error@0.25.0
  - @bamboocss/extractor@0.25.0
  - @bamboocss/logger@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
- Updated dependencies [61ebf3d2]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2
  - @bamboocss/core@0.24.2
  - @bamboocss/config@0.24.2
  - @bamboocss/generator@0.24.2
  - @bamboocss/parser@0.24.2
  - @bamboocss/token-dictionary@0.24.2
  - @bamboocss/error@0.24.2
  - @bamboocss/extractor@0.24.2
  - @bamboocss/logger@0.24.2

## 0.24.1

### Patch Changes

- 10e74428: - Fix an issue with the `@bamboocss/postcss` (and therefore `@bamboocss/astro`) where the initial @layer CSS
  wasn't applied correctly
  - Fix an issue with `staticCss` where it was only generated when it was included in the config (we can generate it
    through the config recipes)
- Updated dependencies [10e74428]
  - @bamboocss/generator@0.24.1
  - @bamboocss/parser@0.24.1
  - @bamboocss/config@0.24.1
  - @bamboocss/core@0.24.1
  - @bamboocss/error@0.24.1
  - @bamboocss/extractor@0.24.1
  - @bamboocss/logger@0.24.1
  - @bamboocss/shared@0.24.1
  - @bamboocss/token-dictionary@0.24.1
  - @bamboocss/types@0.24.1

## 0.24.0

### Minor Changes

- 63b3f1f2: - Boost style extraction performance by moving more work away from postcss
  - Using a hashing strategy, the compiler only computes styles/classname once per style object and prop-value-condition
    pair
  - Fix regression in previous implementation that increased memory usage per extraction, leading to slower performance
    over time

### Patch Changes

- Updated dependencies [63b3f1f2]
- Updated dependencies [f6881022]
  - @bamboocss/core@0.24.0
  - @bamboocss/generator@0.24.0
  - @bamboocss/parser@0.24.0
  - @bamboocss/types@0.24.0
  - @bamboocss/config@0.24.0
  - @bamboocss/token-dictionary@0.24.0
  - @bamboocss/error@0.24.0
  - @bamboocss/extractor@0.24.0
  - @bamboocss/logger@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- 1ea7459c: Fix performance issue where process could get slower due to postcss rules held in memory.
- 383b6d1b: Fix an issue with the postcss plugin when a config change sometimes didn't trigger files extraction
- 840ed66b: Fix an issue with config change detection when using a custom `config.slotRecipes[xxx].jsx` array
- Updated dependencies [d30b1737]
- Updated dependencies [1ea7459c]
- Updated dependencies [80ada336]
- Updated dependencies [b01eb049]
- Updated dependencies [a3b6ed5f]
- Updated dependencies [bd552b1f]
- Updated dependencies [840ed66b]
  - @bamboocss/generator@0.23.0
  - @bamboocss/core@0.23.0
  - @bamboocss/parser@0.23.0
  - @bamboocss/logger@0.23.0
  - @bamboocss/config@0.23.0
  - @bamboocss/error@0.23.0
  - @bamboocss/extractor@0.23.0
  - @bamboocss/is-valid-prop@0.23.0
  - @bamboocss/shared@0.23.0
  - @bamboocss/token-dictionary@0.23.0
  - @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- Updated dependencies [8f4ce97c]
- Updated dependencies [647f05c9]
- Updated dependencies [647f05c9]
  - @bamboocss/generator@0.22.1
  - @bamboocss/types@0.22.1
  - @bamboocss/parser@0.22.1
  - @bamboocss/shared@0.22.1
  - @bamboocss/config@0.22.1
  - @bamboocss/core@0.22.1
  - @bamboocss/token-dictionary@0.22.1
  - @bamboocss/error@0.22.1
  - @bamboocss/extractor@0.22.1
  - @bamboocss/is-valid-prop@0.22.1
  - @bamboocss/logger@0.22.1

## 0.22.0

### Patch Changes

- a2f6c2c8: Fix potential cross-platform issues with path resolving by using `pathe` instead of `path`
- 11753fea: Improve initial css extraction time by at least 5x 🚀

  Initial extraction time can get slow when using static CSS with lots of recipes or parsing a lot of files.

  **Scenarios**
  - Park UI went from 3500ms to 580ms (6x faster)
  - Bamboo Website went from 2900ms to 208ms (14x faster)

  **Potential Breaking Change**

  If you use `hooks` in your `bamboo.config` file to listen for when css is extracted, we no longer return the `css`
  string for performance reasons. We might reconsider this in the future.

- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
- Updated dependencies [9c0d3f8f]
- Updated dependencies [11753fea]
- Updated dependencies [c95c40bd]
- Updated dependencies [e83afef0]
  - @bamboocss/types@0.22.0
  - @bamboocss/generator@0.22.0
  - @bamboocss/shared@0.22.0
  - @bamboocss/core@0.22.0
  - @bamboocss/config@0.22.0
  - @bamboocss/parser@0.22.0
  - @bamboocss/token-dictionary@0.22.0
  - @bamboocss/error@0.22.0
  - @bamboocss/extractor@0.22.0
  - @bamboocss/is-valid-prop@0.22.0
  - @bamboocss/logger@0.22.0

## 0.21.0

### Patch Changes

- 7f846be2: Add `configPath` and `cwd` options in the `@bamboocss/astro` integration just like in the
  `@bamboocss/postcss`

  This can be useful with Nx monorepos where the `bamboo.config.ts` is not in the root of the project.

- Updated dependencies [1464460f]
- Updated dependencies [788aaba3]
- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [d81dcbe6]
- Updated dependencies [105f74ce]
- Updated dependencies [052283c2]
  - @bamboocss/extractor@0.21.0
  - @bamboocss/core@0.21.0
  - @bamboocss/generator@0.21.0
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0
  - @bamboocss/parser@0.21.0
  - @bamboocss/config@0.21.0
  - @bamboocss/token-dictionary@0.21.0
  - @bamboocss/error@0.21.0
  - @bamboocss/is-valid-prop@0.21.0
  - @bamboocss/logger@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/config@0.20.1
- @bamboocss/parser@0.20.1
- @bamboocss/core@0.20.1
- @bamboocss/generator@0.20.1
- @bamboocss/token-dictionary@0.20.1
- @bamboocss/error@0.20.1
- @bamboocss/extractor@0.20.1
- @bamboocss/is-valid-prop@0.20.1
- @bamboocss/logger@0.20.1
- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change
- Updated dependencies [e4fdc64a]
- Updated dependencies [24ee49a5]
- Updated dependencies [4ba982f3]
- Updated dependencies [904aec7b]
  - @bamboocss/generator@0.20.0
  - @bamboocss/config@0.20.0
  - @bamboocss/parser@0.20.0
  - @bamboocss/types@0.20.0
  - @bamboocss/core@0.20.0
  - @bamboocss/token-dictionary@0.20.0
  - @bamboocss/error@0.20.0
  - @bamboocss/extractor@0.20.0
  - @bamboocss/is-valid-prop@0.20.0
  - @bamboocss/logger@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [61831040]
- Updated dependencies [92a7fbe5]
- Updated dependencies [89f86923]
- Updated dependencies [402afbee]
- Updated dependencies [9f5711f9]
  - @bamboocss/generator@0.19.0
  - @bamboocss/types@0.19.0
  - @bamboocss/core@0.19.0
  - @bamboocss/parser@0.19.0
  - @bamboocss/config@0.19.0
  - @bamboocss/token-dictionary@0.19.0
  - @bamboocss/error@0.19.0
  - @bamboocss/extractor@0.19.0
  - @bamboocss/is-valid-prop@0.19.0
  - @bamboocss/logger@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- Updated dependencies [78b940b2]
  - @bamboocss/generator@0.18.3
  - @bamboocss/parser@0.18.3
  - @bamboocss/config@0.18.3
  - @bamboocss/core@0.18.3
  - @bamboocss/error@0.18.3
  - @bamboocss/extractor@0.18.3
  - @bamboocss/is-valid-prop@0.18.3
  - @bamboocss/logger@0.18.3
  - @bamboocss/shared@0.18.3
  - @bamboocss/token-dictionary@0.18.3
  - @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/config@0.18.2
- @bamboocss/parser@0.18.2
- @bamboocss/core@0.18.2
- @bamboocss/generator@0.18.2
- @bamboocss/token-dictionary@0.18.2
- @bamboocss/error@0.18.2
- @bamboocss/extractor@0.18.2
- @bamboocss/is-valid-prop@0.18.2
- @bamboocss/logger@0.18.2
- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- Updated dependencies [566fd28a]
- Updated dependencies [43bfa510]
- Updated dependencies [8c76cd0f]
  - @bamboocss/token-dictionary@0.18.1
  - @bamboocss/generator@0.18.1
  - @bamboocss/core@0.18.1
  - @bamboocss/config@0.18.1
  - @bamboocss/parser@0.18.1
  - @bamboocss/error@0.18.1
  - @bamboocss/extractor@0.18.1
  - @bamboocss/is-valid-prop@0.18.1
  - @bamboocss/logger@0.18.1
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Patch Changes

- 3010af28: Add a `--only-config` flag for the `bamboo debug` command, to skip writing app files and just output the
  resolved config.
- 866c12aa: Fix CLI interactive mode `syntax` question values and prettify the generated `bamboo.config.ts` file
- Updated dependencies [ba9e32fa]
- Updated dependencies [b7cb2073]
- Updated dependencies [336fd0b0]
  - @bamboocss/generator@0.18.0
  - @bamboocss/shared@0.18.0
  - @bamboocss/extractor@0.18.0
  - @bamboocss/parser@0.18.0
  - @bamboocss/core@0.18.0
  - @bamboocss/token-dictionary@0.18.0
  - @bamboocss/types@0.18.0
  - @bamboocss/config@0.18.0
  - @bamboocss/error@0.18.0
  - @bamboocss/is-valid-prop@0.18.0
  - @bamboocss/logger@0.18.0

## 0.17.5

### Patch Changes

- 17f68b3f: Ensure dir exists before writing file for the `bamboo cssgen` / `bamboo ship` / `bamboo analyze` commands
  when specifying an outfile.
- Updated dependencies [6718f81b]
- Updated dependencies [a6dfc944]
- Updated dependencies [3ce70c37]
  - @bamboocss/generator@0.17.5
  - @bamboocss/core@0.17.5
  - @bamboocss/parser@0.17.5
  - @bamboocss/config@0.17.5
  - @bamboocss/error@0.17.5
  - @bamboocss/extractor@0.17.5
  - @bamboocss/is-valid-prop@0.17.5
  - @bamboocss/logger@0.17.5
  - @bamboocss/shared@0.17.5
  - @bamboocss/token-dictionary@0.17.5
  - @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/config@0.17.4
  - @bamboocss/core@0.17.4
  - @bamboocss/generator@0.17.4
  - @bamboocss/parser@0.17.4
  - @bamboocss/token-dictionary@0.17.4
  - @bamboocss/error@0.17.4
  - @bamboocss/extractor@0.17.4
  - @bamboocss/is-valid-prop@0.17.4
  - @bamboocss/logger@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- 60f2c8a3: Fix issue in studio command where `fs-extra` imports could not be resolved.
- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/config@0.17.3
  - @bamboocss/core@0.17.3
  - @bamboocss/generator@0.17.3
  - @bamboocss/parser@0.17.3
  - @bamboocss/token-dictionary@0.17.3
  - @bamboocss/error@0.17.3
  - @bamboocss/extractor@0.17.3
  - @bamboocss/is-valid-prop@0.17.3
  - @bamboocss/logger@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/config@0.17.2
- @bamboocss/core@0.17.2
- @bamboocss/error@0.17.2
- @bamboocss/extractor@0.17.2
- @bamboocss/generator@0.17.2
- @bamboocss/is-valid-prop@0.17.2
- @bamboocss/logger@0.17.2
- @bamboocss/parser@0.17.2
- @bamboocss/shared@0.17.2
- @bamboocss/token-dictionary@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- 56299cb2: Fix persistent error that causes CI builds to fail due to PostCSS plugin emitting artifacts in the middle of
  a build process.
- ddcaf7b2: Fix issue where FileSystem writes cause intermittent errors in different build contexts (Vercel, Docker).
  This was solved by limiting the concurrency using the `p-limit` library
- Updated dependencies [296d62b1]
- Updated dependencies [42520626]
- Updated dependencies [7b981422]
- Updated dependencies [9382e687]
- Updated dependencies [aea28c9f]
- Updated dependencies [a76b279e]
- Updated dependencies [5ce359f6]
  - @bamboocss/generator@0.17.1
  - @bamboocss/core@0.17.1
  - @bamboocss/extractor@0.17.1
  - @bamboocss/shared@0.17.1
  - @bamboocss/parser@0.17.1
  - @bamboocss/types@0.17.1
  - @bamboocss/token-dictionary@0.17.1
  - @bamboocss/config@0.17.1
  - @bamboocss/error@0.17.1
  - @bamboocss/is-valid-prop@0.17.1
  - @bamboocss/logger@0.17.1

## 0.17.0

### Minor Changes

- 12281ff8: Improve support for styled element composition. This ensures that you can compose two styled elements
  together and the styles will be merged correctly.

  ```jsx
  const Box = styled('div', {
    base: {
      background: 'red.light',
      color: 'white',
    },
  })

  const ExtendedBox = styled(Box, {
    base: { background: 'red.dark' },
  })

  // <ExtendedBox> will have a background of `red.dark` and a color of `white`
  ```

  **Limitation:** This feature does not allow compose mixed styled composition. A mixed styled composition happens when
  an element is created from a cva/inline cva, and another created from a config recipe.
  - CVA or Inline CVA + CVA or Inline CVA = ✅
  - Config Recipe + Config Recipe = ✅
  - CVA or Inline CVA + Config Recipe = ❌

  ```jsx
  import { button } from '../styled-system/recipes'

  const Button = styled('div', button)

  // ❌ This will throw an error
  const ExtendedButton = styled(Button, {
    base: { background: 'red.dark' },
  })
  ```

### Patch Changes

- dd6811b3: Apply `config.logLevel` from the Bamboo config to the logger in every context.

  Fixes https://github.com/bamboocss/bamboo/issues/1451

- Updated dependencies [93996aaf]
- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
- Updated dependencies [e73ea803]
- Updated dependencies [fbf062c6]
  - @bamboocss/generator@0.17.0
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0
  - @bamboocss/core@0.17.0
  - @bamboocss/parser@0.17.0
  - @bamboocss/token-dictionary@0.17.0
  - @bamboocss/config@0.17.0
  - @bamboocss/error@0.17.0
  - @bamboocss/extractor@0.17.0
  - @bamboocss/is-valid-prop@0.17.0
  - @bamboocss/logger@0.17.0

## 0.16.0

### Minor Changes

- 36252b1d: ## --minimal flag

  Adds a new `--minimal` flag for the CLI on the `bamboo cssgen` command to skip generating CSS for theme tokens,
  preflightkeyframes, static and global css

  Thich means that the generated CSS will only contain the CSS related to the styles found in the included files.

  > Note that you can use a `glob` to override the `config.include` option like this:
  > `bamboo cssgen "src/**/*.css" --minimal`

  This is useful when you want to split your CSS into multiple files, for example if you want to split by pages.

  Use it like this:

  ```bash
  bamboo cssgen "src/**/pages/*.css" --minimal --outfile dist/pages.css
  ```

  ***

  ## cssgen {type}

  In addition to the optional `glob` that you can already pass to override the config.include option, the
  `bamboo cssgen` command now accepts a new `{type}` argument to generate only a specific type of CSS:
  - preflight
  - tokens
  - static
  - global
  - keyframes

  > Note that this only works when passing an `--outfile`.

  You can use it like this:

  ```bash
  bamboo cssgen "static" --outfile dist/static.css
  ```

### Patch Changes

- 20f4e204: Apply a few optmizations on the resulting CSS generated from `bamboo cssgen` command
- Updated dependencies [2b5cbf73]
- Updated dependencies [20f4e204]
- Updated dependencies [36252b1d]
  - @bamboocss/generator@0.16.0
  - @bamboocss/core@0.16.0
  - @bamboocss/parser@0.16.0
  - @bamboocss/config@0.16.0
  - @bamboocss/token-dictionary@0.16.0
  - @bamboocss/error@0.16.0
  - @bamboocss/extractor@0.16.0
  - @bamboocss/is-valid-prop@0.16.0
  - @bamboocss/logger@0.16.0
  - @bamboocss/shared@0.16.0
  - @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- 909fcbe8: - Fix issue with `Promise.all` where it aborts premature ine weird events. Switched to `Promise.allSettled`
- Updated dependencies [d12aed2b]
- Updated dependencies [909fcbe8]
- Updated dependencies [3d5971e5]
  - @bamboocss/generator@0.15.5
  - @bamboocss/parser@0.15.5
  - @bamboocss/config@0.15.5
  - @bamboocss/core@0.15.5
  - @bamboocss/error@0.15.5
  - @bamboocss/extractor@0.15.5
  - @bamboocss/is-valid-prop@0.15.5
  - @bamboocss/logger@0.15.5
  - @bamboocss/shared@0.15.5
  - @bamboocss/token-dictionary@0.15.5
  - @bamboocss/types@0.15.5

## 0.15.4

### Patch Changes

- Updated dependencies [abd7c47a]
- Updated dependencies [bf0e6a30]
- Updated dependencies [69699ba4]
- Updated dependencies [3a04a927]
  - @bamboocss/config@0.15.4
  - @bamboocss/generator@0.15.4
  - @bamboocss/parser@0.15.4
  - @bamboocss/extractor@0.15.4
  - @bamboocss/types@0.15.4
  - @bamboocss/core@0.15.4
  - @bamboocss/error@0.15.4
  - @bamboocss/is-valid-prop@0.15.4
  - @bamboocss/logger@0.15.4
  - @bamboocss/shared@0.15.4
  - @bamboocss/token-dictionary@0.15.4

## 0.15.3

### Patch Changes

- Updated dependencies [d34c8b48]
- Updated dependencies [95b06bb1]
- Updated dependencies [1ac2011b]
- Updated dependencies [58743bc4]
- Updated dependencies [1eb31118]
  - @bamboocss/generator@0.15.3
  - @bamboocss/shared@0.15.3
  - @bamboocss/core@0.15.3
  - @bamboocss/parser@0.15.3
  - @bamboocss/types@0.15.3
  - @bamboocss/token-dictionary@0.15.3
  - @bamboocss/config@0.15.3
  - @bamboocss/error@0.15.3
  - @bamboocss/extractor@0.15.3
  - @bamboocss/is-valid-prop@0.15.3
  - @bamboocss/logger@0.15.3

## 0.15.2

### Patch Changes

- f3c30d60: Update supported bamboo config extensions
- Updated dependencies [6d15776c]
- Updated dependencies [26a788c0]
- Updated dependencies [2645c2da]
  - @bamboocss/generator@0.15.2
  - @bamboocss/types@0.15.2
  - @bamboocss/config@0.15.2
  - @bamboocss/parser@0.15.2
  - @bamboocss/core@0.15.2
  - @bamboocss/token-dictionary@0.15.2
  - @bamboocss/error@0.15.2
  - @bamboocss/extractor@0.15.2
  - @bamboocss/is-valid-prop@0.15.2
  - @bamboocss/logger@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- Updated dependencies [7e8bcb03]
- Updated dependencies [848936e0]
- Updated dependencies [433f88cd]
- Updated dependencies [c40ae1b9]
- Updated dependencies [26f6982c]
- Updated dependencies [4e003bfb]
- Updated dependencies [7499bbd2]
  - @bamboocss/generator@0.15.1
  - @bamboocss/core@0.15.1
  - @bamboocss/extractor@0.15.1
  - @bamboocss/parser@0.15.1
  - @bamboocss/shared@0.15.1
  - @bamboocss/token-dictionary@0.15.1
  - @bamboocss/types@0.15.1
  - @bamboocss/config@0.15.1
  - @bamboocss/error@0.15.1
  - @bamboocss/is-valid-prop@0.15.1
  - @bamboocss/logger@0.15.1

## 0.15.0

### Patch Changes

- 39298609: Make the types suggestion faster (updated `DeepPartial`)
- Updated dependencies [be24d1a0]
- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [93d9ee7e]
- Updated dependencies [bc3b077d]
- Updated dependencies [35793d85]
- Updated dependencies [39298609]
- Updated dependencies [dd47b6e6]
- Updated dependencies [7c1ab170]
- Updated dependencies [f27146d6]
  - @bamboocss/extractor@0.15.0
  - @bamboocss/types@0.15.0
  - @bamboocss/generator@0.15.0
  - @bamboocss/shared@0.15.0
  - @bamboocss/core@0.15.0
  - @bamboocss/parser@0.15.0
  - @bamboocss/config@0.15.0
  - @bamboocss/token-dictionary@0.15.0
  - @bamboocss/error@0.15.0
  - @bamboocss/is-valid-prop@0.15.0
  - @bamboocss/logger@0.15.0

## 0.14.0

### Minor Changes

- 8106b411: Add `generator:done` hook to perform actions when codegen artifacts are emitted.

### Patch Changes

- Updated dependencies [b1c31fdd]
- Updated dependencies [bdd30d18]
- Updated dependencies [bff17df2]
- Updated dependencies [6548f4f7]
- Updated dependencies [8106b411]
- Updated dependencies [9e799554]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
- Updated dependencies [623e321f]
- Updated dependencies [542d1ebc]
- Updated dependencies [39b20797]
- Updated dependencies [02161d41]
  - @bamboocss/token-dictionary@0.14.0
  - @bamboocss/generator@0.14.0
  - @bamboocss/types@0.14.0
  - @bamboocss/core@0.14.0
  - @bamboocss/parser@0.14.0
  - @bamboocss/config@0.14.0
  - @bamboocss/error@0.14.0
  - @bamboocss/extractor@0.14.0
  - @bamboocss/is-valid-prop@0.14.0
  - @bamboocss/logger@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- Updated dependencies [a5d7d514]
- Updated dependencies [577dcb9d]
- Updated dependencies [192d5e49]
- Updated dependencies [d0fbc7cc]
  - @bamboocss/generator@0.13.1
  - @bamboocss/parser@0.13.1
  - @bamboocss/error@0.13.1
  - @bamboocss/config@0.13.1
  - @bamboocss/core@0.13.1
  - @bamboocss/extractor@0.13.1
  - @bamboocss/is-valid-prop@0.13.1
  - @bamboocss/logger@0.13.1
  - @bamboocss/shared@0.13.1
  - @bamboocss/token-dictionary@0.13.1
  - @bamboocss/types@0.13.1

## 0.13.0

### Patch Changes

- Updated dependencies [04b5fd6c]
- Updated dependencies [a9690110]
- Updated dependencies [32ceac3f]
  - @bamboocss/core@0.13.0
  - @bamboocss/generator@0.13.0
  - @bamboocss/parser@0.13.0
  - @bamboocss/config@0.13.0
  - @bamboocss/error@0.13.0
  - @bamboocss/extractor@0.13.0
  - @bamboocss/is-valid-prop@0.13.0
  - @bamboocss/logger@0.13.0
  - @bamboocss/shared@0.13.0
  - @bamboocss/token-dictionary@0.13.0
  - @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- Updated dependencies [6588c8e0]
- Updated dependencies [36fdff89]
  - @bamboocss/generator@0.12.2
  - @bamboocss/parser@0.12.2
  - @bamboocss/config@0.12.2
  - @bamboocss/core@0.12.2
  - @bamboocss/error@0.12.2
  - @bamboocss/extractor@0.12.2
  - @bamboocss/is-valid-prop@0.12.2
  - @bamboocss/logger@0.12.2
  - @bamboocss/shared@0.12.2
  - @bamboocss/token-dictionary@0.12.2
  - @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- Updated dependencies [599fbc1a]
  - @bamboocss/generator@0.12.1
  - @bamboocss/parser@0.12.1
  - @bamboocss/config@0.12.1
  - @bamboocss/core@0.12.1
  - @bamboocss/error@0.12.1
  - @bamboocss/extractor@0.12.1
  - @bamboocss/is-valid-prop@0.12.1
  - @bamboocss/logger@0.12.1
  - @bamboocss/shared@0.12.1
  - @bamboocss/token-dictionary@0.12.1
  - @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- Updated dependencies [a41515de]
- Updated dependencies [bf2ff391]
- Updated dependencies [ad1518b8]
  - @bamboocss/generator@0.12.0
  - @bamboocss/parser@0.12.0
  - @bamboocss/config@0.12.0
  - @bamboocss/core@0.12.0
  - @bamboocss/token-dictionary@0.12.0
  - @bamboocss/error@0.12.0
  - @bamboocss/extractor@0.12.0
  - @bamboocss/is-valid-prop@0.12.0
  - @bamboocss/logger@0.12.0
  - @bamboocss/shared@0.12.0
  - @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- 23b516f4: Make layers customizable
- Updated dependencies [c07e1beb]
- Updated dependencies [dfb3f85f]
- Updated dependencies [23b516f4]
  - @bamboocss/generator@0.11.1
  - @bamboocss/shared@0.11.1
  - @bamboocss/is-valid-prop@0.11.1
  - @bamboocss/types@0.11.1
  - @bamboocss/core@0.11.1
  - @bamboocss/parser@0.11.1
  - @bamboocss/token-dictionary@0.11.1
  - @bamboocss/config@0.11.1
  - @bamboocss/error@0.11.1
  - @bamboocss/extractor@0.11.1
  - @bamboocss/logger@0.11.1

## 0.11.0

### Patch Changes

- cde9702e: Add an optional `glob` argument that overrides the config.include on the `bamboo cssgen` CLI command.
- Updated dependencies [dead08a2]
- Updated dependencies [5b95caf5]
- Updated dependencies [39b80b49]
- Updated dependencies [1dc788bd]
  - @bamboocss/config@0.11.0
  - @bamboocss/generator@0.11.0
  - @bamboocss/types@0.11.0
  - @bamboocss/parser@0.11.0
  - @bamboocss/core@0.11.0
  - @bamboocss/token-dictionary@0.11.0
  - @bamboocss/error@0.11.0
  - @bamboocss/extractor@0.11.0
  - @bamboocss/is-valid-prop@0.11.0
  - @bamboocss/logger@0.11.0
  - @bamboocss/shared@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [24e783b3]
- Updated dependencies [9d4aa918]
- Updated dependencies [2d2a42da]
- Updated dependencies [386e5098]
- Updated dependencies [6d4eaa68]
- Updated dependencies [a669f4d5]
  - @bamboocss/is-valid-prop@0.10.0
  - @bamboocss/generator@0.10.0
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0
  - @bamboocss/token-dictionary@0.10.0
  - @bamboocss/core@0.10.0
  - @bamboocss/parser@0.10.0
  - @bamboocss/config@0.10.0
  - @bamboocss/error@0.10.0
  - @bamboocss/extractor@0.10.0
  - @bamboocss/logger@0.10.0

## 0.9.0

### Patch Changes

- f10e706a: Fix PostCSS edge-case where the config file is not in the app root
- Updated dependencies [c08de87f]
- Updated dependencies [3269b411]
  - @bamboocss/generator@0.9.0
  - @bamboocss/parser@0.9.0
  - @bamboocss/types@0.9.0
  - @bamboocss/core@0.9.0
  - @bamboocss/extractor@0.9.0
  - @bamboocss/config@0.9.0
  - @bamboocss/token-dictionary@0.9.0
  - @bamboocss/error@0.9.0
  - @bamboocss/is-valid-prop@0.9.0
  - @bamboocss/logger@0.9.0
  - @bamboocss/shared@0.9.0

## 0.8.0

### Patch Changes

- 5d1d376b: Adding missing comma for generated bamboo config
- be0ad578: Fix parser issue with TS path mappings
- 78612d7f: Fix node evaluation in extractor process (can happen when using a BinaryExpression, simple CallExpression or
  conditions)
- Updated dependencies [3f1e7e32]
- Updated dependencies [fb449016]
- Updated dependencies [ac078416]
- Updated dependencies [e1f6318a]
- Updated dependencies [be0ad578]
- Updated dependencies [b75905d8]
- Updated dependencies [78612d7f]
- Updated dependencies [9ddf258b]
- Updated dependencies [0520ba83]
- Updated dependencies [156b6bde]
  - @bamboocss/generator@0.8.0
  - @bamboocss/core@0.8.0
  - @bamboocss/extractor@0.8.0
  - @bamboocss/parser@0.8.0
  - @bamboocss/token-dictionary@0.8.0
  - @bamboocss/config@0.8.0
  - @bamboocss/types@0.8.0
  - @bamboocss/error@0.8.0
  - @bamboocss/is-valid-prop@0.8.0
  - @bamboocss/logger@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- f4bb0576: Fix postcss issue where `@layer reset, base, tokens, recipes, utilities` check was too strict
- d8ebaf2f: Fix issue where hot module reloading is inconsistent in the PostCSS plugin when external files are changed
- 4ff7ddea: Fix issue where hot module reloading is inconsistent in the PostCSS plugin when another internal package is
  changed
- Updated dependencies [16cd3764]
- Updated dependencies [f2abf34d]
- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
- Updated dependencies [7bc69e4b]
- Updated dependencies [1a05c4bb]
  - @bamboocss/parser@0.7.0
  - @bamboocss/extractor@0.7.0
  - @bamboocss/shared@0.7.0
  - @bamboocss/generator@0.7.0
  - @bamboocss/types@0.7.0
  - @bamboocss/config@0.7.0
  - @bamboocss/core@0.7.0
  - @bamboocss/token-dictionary@0.7.0
  - @bamboocss/error@0.7.0
  - @bamboocss/is-valid-prop@0.7.0
  - @bamboocss/logger@0.7.0

## 0.6.0

### Patch Changes

- 032c152a: Fix issue where `bamboo cssgen --outfile` doesn't extract files to chunks before bundling them into the css
  out file
- Updated dependencies [cd912f35]
- Updated dependencies [dc4e80f7]
- Updated dependencies [12c900ee]
- Updated dependencies [21295f2e]
- Updated dependencies [5bd88c41]
- Updated dependencies [ef1dd676]
- Updated dependencies [b50675ca]
  - @bamboocss/generator@0.6.0
  - @bamboocss/core@0.6.0
  - @bamboocss/extractor@0.6.0
  - @bamboocss/parser@0.6.0
  - @bamboocss/config@0.6.0
  - @bamboocss/types@0.6.0
  - @bamboocss/token-dictionary@0.6.0
  - @bamboocss/error@0.6.0
  - @bamboocss/is-valid-prop@0.6.0
  - @bamboocss/logger@0.6.0
  - @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- 5b09ab3b: Add support for `--outfile` flag in the `cssgen` command.

  ```bash
  bamboo cssgen --outfile dist/styles.css
  ```

- 78ed6ed4: Fix issue where using a nested outdir like `src/styled-system` with a baseUrl like `./src` would result on
  parser NOT matching imports like `import { container } from "styled-system/patterns";` cause it would expect the full
  path `src/styled-system`
- e48b130a: - Remove `stack` from `box.toJSON()` so that generated JSON files have less noise, mostly useful to get make
  the `bamboo debug` command easier to read
  - Also use the `ParserResult.toJSON()` method on `bamboo debug` command for the same reason

  instead of:

  ```json
  [
    {
      "type": "map",
      "value": {
        "padding": {
          "type": "literal",
          "value": "25px",
          "node": "StringLiteral",
          "stack": [
            "CallExpression",
            "ObjectLiteralExpression",
            "PropertyAssignment",
            "Identifier",
            "Identifier",
            "VariableDeclaration",
            "StringLiteral"
          ],
          "line": 10,
          "column": 20
        },
        "fontSize": {
          "type": "literal",
          "value": "2xl",
          "node": "StringLiteral",
          "stack": [
            "CallExpression",
            "ObjectLiteralExpression",
            "PropertyAssignment",
            "ConditionalExpression"
          ],
          "line": 11,
          "column": 67
        }
      },
      "node": "CallExpression",
      "stack": [
        "CallExpression",
        "ObjectLiteralExpression"
      ],
      "line": 11,
      "column": 21
    },
  ```

  we now have:

  ```json
  {
    "css": [
      {
        "type": "object",
        "name": "css",
        "box": {
          "type": "map",
          "value": {},
          "node": "CallExpression",
          "line": 15,
          "column": 27
        },
        "data": [
          {
            "alignItems": "center",
            "backgroundColor": "white",
            "border": "1px solid black",
            "borderRadius": "8px",
            "display": "flex",
            "gap": "16px",
            "p": "8px",
            "pr": "16px"
          }
        ]
      }
    ],
    "cva": [],
    "recipe": {
      "checkboxRoot": [
        {
          "type": "recipe",
          "name": "checkboxRoot",
          "box": {
            "type": "map",
            "value": {},
            "node": "CallExpression",
            "line": 38,
            "column": 47
          },
          "data": [
            {}
          ]
        }
      ],
  ```

- 1a2c0e2b: Fix `bamboo.config.xxx` file dependencies detection when using the builder (= with PostCSS or with the
  VSCode extension). It will now also properly resolve tsconfig path aliases.
- Updated dependencies [6f03ead3]
- Updated dependencies [8c670d60]
- Updated dependencies [33198907]
- Updated dependencies [53fb0708]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [f9247e52]
- Updated dependencies [1ed239cd]
- Updated dependencies [09ebaf2e]
- Updated dependencies [78ed6ed4]
- Updated dependencies [e48b130a]
- Updated dependencies [1a2c0e2b]
- Updated dependencies [b8f8c2a6]
- Updated dependencies [a3d760ce]
- Updated dependencies [d9bc63e7]
  - @bamboocss/extractor@0.5.1
  - @bamboocss/types@0.5.1
  - @bamboocss/config@0.5.1
  - @bamboocss/generator@0.5.1
  - @bamboocss/shared@0.5.1
  - @bamboocss/logger@0.5.1
  - @bamboocss/core@0.5.1
  - @bamboocss/parser@0.5.1
  - @bamboocss/token-dictionary@0.5.1
  - @bamboocss/error@0.5.1
  - @bamboocss/is-valid-prop@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [60df9bd1]
- Updated dependencies [30f41e01]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/parser@0.5.0
  - @bamboocss/extractor@0.5.0
  - @bamboocss/generator@0.5.0
  - @bamboocss/types@0.5.0
  - @bamboocss/core@0.5.0
  - @bamboocss/token-dictionary@0.5.0
  - @bamboocss/config@0.5.0
  - @bamboocss/error@0.5.0
  - @bamboocss/is-valid-prop@0.5.0
  - @bamboocss/logger@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [8991b1e4]
- Updated dependencies [2a1e9386]
- Updated dependencies [54a8913c]
- Updated dependencies [c7b42325]
- Updated dependencies [a48e5b00]
- Updated dependencies [5b344b9c]
  - @bamboocss/parser@0.4.0
  - @bamboocss/core@0.4.0
  - @bamboocss/is-valid-prop@0.4.0
  - @bamboocss/generator@0.4.0
  - @bamboocss/types@0.4.0
  - @bamboocss/config@0.4.0
  - @bamboocss/token-dictionary@0.4.0
  - @bamboocss/error@0.4.0
  - @bamboocss/extractor@0.4.0
  - @bamboocss/logger@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [9822d79a]
  - @bamboocss/config@0.3.2
  - @bamboocss/core@0.3.2
  - @bamboocss/error@0.3.2
  - @bamboocss/extractor@0.3.2
  - @bamboocss/generator@0.3.2
  - @bamboocss/is-valid-prop@0.3.2
  - @bamboocss/logger@0.3.2
  - @bamboocss/parser@0.3.2
  - @bamboocss/shared@0.3.2
  - @bamboocss/token-dictionary@0.3.2
  - @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/config@0.3.1
  - @bamboocss/core@0.3.1
  - @bamboocss/error@0.3.1
  - @bamboocss/extractor@0.3.1
  - @bamboocss/generator@0.3.1
  - @bamboocss/is-valid-prop@0.3.1
  - @bamboocss/logger@0.3.1
  - @bamboocss/parser@0.3.1
  - @bamboocss/shared@0.3.1
  - @bamboocss/token-dictionary@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Patch Changes

- b8ab0868: Fix white space when updating the `.gitignore` file
- Updated dependencies [6d81ee9e]
  - @bamboocss/generator@0.3.0
  - @bamboocss/parser@0.3.0
  - @bamboocss/types@0.3.0
  - @bamboocss/config@0.3.0
  - @bamboocss/core@0.3.0
  - @bamboocss/token-dictionary@0.3.0
  - @bamboocss/error@0.3.0
  - @bamboocss/extractor@0.3.0
  - @bamboocss/is-valid-prop@0.3.0
  - @bamboocss/logger@0.3.0
  - @bamboocss/shared@0.3.0

## 0.0.2

### Patch Changes

- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.

- Updated dependencies [c308e8be]
- Updated dependencies [fb40fff2]
  - @bamboocss/config@0.0.2
  - @bamboocss/types@0.0.2
  - @bamboocss/core@0.0.2
  - @bamboocss/error@0.0.2
  - @bamboocss/extractor@0.0.2
  - @bamboocss/generator@0.0.2
  - @bamboocss/is-valid-prop@0.0.2
  - @bamboocss/logger@0.0.2
  - @bamboocss/parser@0.0.2
  - @bamboocss/shared@0.0.2
  - @bamboocss/token-dictionary@0.0.2
