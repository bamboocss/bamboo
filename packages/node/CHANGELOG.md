# @bamboocss/node

## 1.27.0

### Patch Changes

- Updated dependencies [b975ba7]
  - @bamboocss/generator@1.27.0
  - @bamboocss/parser@1.27.0
  - @bamboocss/reporter@1.27.0
  - @bamboocss/config@1.27.0
  - @bamboocss/core@1.27.0
  - @bamboocss/logger@1.27.0
  - @bamboocss/plugin-lightningcss@1.27.0
  - @bamboocss/plugin-svelte@1.27.0
  - @bamboocss/plugin-vue@1.27.0
  - @bamboocss/shared@1.27.0
  - @bamboocss/token-dictionary@1.27.0
  - @bamboocss/types@1.27.0

## 1.26.0

### Patch Changes

- 5e8814c: Report `css(recipe.raw(props), …)`, which silently loses the recipe's styles.

  `.raw` on a **recipe or a pattern** takes props and returns styles. The build reads it as the identity that `css.raw`
  means — so it composes the _props_ instead:

  ```ts
  css(textInput.raw(), { fontFamily: 'monospace' })

  // the browser asks for : c_red.300  p_4  ff_monospace
  // the build emits      : —          —    ff_monospace
  ```

  The recipe's own declarations never reach the stylesheet, and for a call with variants the variant names are handed to
  the encoder as though they were properties. The element then renders without those styles, and nothing said so. It
  survives in practice only when some other component happens to emit the same atomic classes, so it breaks when an
  unrelated file stops using them.

  This does not resolve the composition — running the recipe during extraction to get it right is a larger change, and
  emitting the wrong styles would be worse than emitting none. **CSS output is unchanged.** What changes is that the
  build now says:

  ```
  textInput.raw() composes its own props rather than its styles, so textInput's declarations
  will not reach the stylesheet
    Call it instead — cx(textInput(props), css({ … })) — or move the overrides into textInput itself.
  ```

  Reported for inline recipes, config recipes and patterns alike. `css.raw()` composition is unaffected: identity is
  exactly what it means, and it reaches the stylesheet correctly.

- Updated dependencies [5e8814c]
  - @bamboocss/parser@1.26.0
  - @bamboocss/config@1.26.0
  - @bamboocss/core@1.26.0
  - @bamboocss/generator@1.26.0
  - @bamboocss/logger@1.26.0
  - @bamboocss/plugin-lightningcss@1.26.0
  - @bamboocss/plugin-svelte@1.26.0
  - @bamboocss/plugin-vue@1.26.0
  - @bamboocss/reporter@1.26.0
  - @bamboocss/shared@1.26.0
  - @bamboocss/token-dictionary@1.26.0
  - @bamboocss/types@1.26.0

## 1.25.0

### Patch Changes

- Updated dependencies [94991ea]
  - @bamboocss/generator@1.25.0
  - @bamboocss/parser@1.25.0
  - @bamboocss/reporter@1.25.0
  - @bamboocss/config@1.25.0
  - @bamboocss/core@1.25.0
  - @bamboocss/logger@1.25.0
  - @bamboocss/plugin-lightningcss@1.25.0
  - @bamboocss/plugin-svelte@1.25.0
  - @bamboocss/plugin-vue@1.25.0
  - @bamboocss/shared@1.25.0
  - @bamboocss/token-dictionary@1.25.0
  - @bamboocss/types@1.25.0

## 1.24.0

### Patch Changes

- @bamboocss/config@1.24.0
- @bamboocss/core@1.24.0
- @bamboocss/generator@1.24.0
- @bamboocss/logger@1.24.0
- @bamboocss/parser@1.24.0
- @bamboocss/plugin-lightningcss@1.24.0
- @bamboocss/plugin-svelte@1.24.0
- @bamboocss/plugin-vue@1.24.0
- @bamboocss/reporter@1.24.0
- @bamboocss/shared@1.24.0
- @bamboocss/token-dictionary@1.24.0
- @bamboocss/types@1.24.0

## 1.23.0

### Patch Changes

- Updated dependencies [f4a2824]
- Updated dependencies [b041398]
- Updated dependencies [087b884]
- Updated dependencies [3d141e5]
  - @bamboocss/core@1.23.0
  - @bamboocss/parser@1.23.0
  - @bamboocss/types@1.23.0
  - @bamboocss/generator@1.23.0
  - @bamboocss/shared@1.23.0
  - @bamboocss/reporter@1.23.0
  - @bamboocss/config@1.23.0
  - @bamboocss/logger@1.23.0
  - @bamboocss/plugin-lightningcss@1.23.0
  - @bamboocss/plugin-svelte@1.23.0
  - @bamboocss/plugin-vue@1.23.0
  - @bamboocss/token-dictionary@1.23.0

## 1.22.0

### Minor Changes

- 41d9052: Add `prunePreflight`, which drops the parts of the reset that style elements your source never renders.

  Off by default. Measured on the example apps here:

  | app     |    raw |   gzip | brotli |
  | ------- | -----: | -----: | -----: |
  | vite-ts | -13.2% | -14.8% | -14.2% |
  | svelte  | -33.9% | -29.1% | -29.3% |

  Two thirds of the reset is bound to specific elements — 41 of them, covering `table`, `pre`, `kbd`, `optgroup` and the
  rest of the long tail. Being a fixed size, it dominates a small stylesheet rather than amortising the way the
  utilities layer does: a third of `vite-ts`'s css and four fifths of `svelte`'s, of which those projects render a
  fraction.

  This is the one saving of its kind that survives compression. Deduplicating or re-encoding what is already emitted
  loses to gzip, which has flattened the repetition before you get there — measured repeatedly on this codebase, from
  atomising recipes to native nesting. Emitting less does not.

  A selector list loses only the parts naming unrendered elements, so a rule shared between `button` and
  `::file-selector-button` keeps the half that still applies. `html` and `body` are never removed, and a selector naming
  no element — `*`, `::backdrop`, `[hidden]`, a class — is always kept.

  **Why it stays opt-in**

  `pruneUnusedTokens` and `pruneUnusedKeyframes` default to `true` because reachability can be established from the
  stylesheet and the source together. This has a textual scan of your own source and nothing else. An element rendered
  by a dependency's component, by `dangerouslySetInnerHTML`, or by markdown is invisible to it, and what you get wrong
  is an element quietly losing its reset — no error, no warning. It cannot be made safe by default, and should not be.

  The blind spot to check first is nearer than a dependency. The scan reads what `include` covers, and `include`
  conventionally covers components rather than markup — `./src/**/*.tsx` does not match `index.html`, which is where
  `<noscript>`, a static `<table>` and the rest of a page's hand-written markup usually live. Add the template to
  `include` to cover it; the scan reads any file listed, not only ones the parser understands.

  **What the scan reads**

  The file on disk, not the project's parsed copy of it. That distinction only shows up for single-file components, and
  it decides whether they work at all: `parseSourceFile` replaces an SFC's text with the TSX a framework plugin
  transformed it into, and every transform here is lossy in the same direction. `svelteToTsx` and `vueToTsx` both
  swallow a throw and return an empty string, a Vue SFC with a render function and no `<template>` becomes the literal
  `<template>undefined</template>`, and Svelte strips `<script>` before the scan can see it. Each of those silently
  reports no elements for the file and takes every one of its reset rules with it. Markup is what this wants, so it
  reads the markup.

  It also works with a scoped reset. `preflight: { scope: '.app' }` writes the scope onto every selector — `.app table`,
  or `table.app` under `level: 'element'` — and neither shape names an element until the scope is stripped, so the two
  options together used to produce byte-identical output with the flag doing nothing at all.

  `bamboo cssgen preflight` prunes too. It writes one artifact rather than the whole sheet, so the token and keyframe
  passes cannot run there — both read the finished stylesheet to decide reachability, and on a partial one everything
  looks unreachable. This pass reads your source instead, so it is correct either way, and without it the `reset.css`
  from `cssgen preflight` disagreed with the one `cssgen --splitting` wrote for the same project.

- a1062c9: Remove `cssMode: 'grouped'`.

  **This is a breaking change released as a minor.** Bamboo is still pre-1.0 in practice, so the version does not carry
  the signal — read the migration below before upgrading. A config setting `cssMode` will fail to typecheck, and
  `bamboocss()` from `@bamboocss/vite` now returns an array of plugins rather than one.

  Use `cva({ base: { ... } })` where you want one class per element instead of one per property. It already does exactly
  that, and it does it better.

  **Why**

  Measured on a production build of a real app — the same source built both ways:

  |           |   CSS raw | CSS gzip |
  | --------- | --------: | -------: |
  | `atomic`  | 1,411,989 |  209,489 |
  | `grouped` | 2,913,254 |  390,428 |

  **+86% gzipped**, entirely in the `utilities` layer, which goes from 673 kB to 2.17 MB. Grouping pays only where a
  style set lands on many elements; it groups every `css()` call, and most of them are one-offs where a group is one
  rule serving one element with nothing to amortise it against.

  The markup saving cannot repay that. Across eight routes of the same app, grouping saved 1.9 bytes of gzipped markup
  per element rendered — so roughly **95,000 elements** have to render before the stylesheet's extra 181 kB is earned
  back, about 112 page views with a warm cache. The documentation claimed the trade favoured SSR and SSG; the app
  measured here is server-rendered and never comes close.

  **What to use instead**

  A variant-less `cva` emits a single class carrying every declaration:

  ```ts
  const row = cva({
    base: { display: 'flex', alignItems: 'center', gap: '4' },
  })
  // .cva_gphwnw { display: flex; align-items: center; gap: var(--spacing-4) }
  ```

  It lands in the `recipes` layer rather than `utilities`, which is the part `cssMode` got wrong. Because
  `@layer reset, base, tokens, recipes, utilities` puts `utilities` last, a consumer's `css()` override beats it
  deterministically in every build — where a grouped `css()` class sat in `utilities` alongside the atoms it competed
  with, leaving conflicts to source order.

  The rule of thumb is the useful part: **if a style set is worth grouping, it is worth naming.** Grouping pays when a
  set is reused, and a reused set is a component.

  **Also removed**
  - `RuleProcessor.grouped()` and the `GroupedRule` type.
  - `groupClassName` from `@bamboocss/shared`, and the `grouped` / `knownGroups` fields on `CreateCssContext`.
  - The generated `groups` artifact (`styled-system/css/groups.mjs`) — delete it if a stale copy is left in your output
    directory.
  - The `'ambiguous-merge'` and `'too-many-combinations'` unresolved-style reasons, which only ever applied to grouping,
    and the `'grouped'` value of `UnresolvedStyle['kind']`.

  `css()` calls the build cannot fully read are still reported, unchanged: a spread or computed key warns with a file
  and line, because it looks static and is not.

- 43ae8a7: Stop keeping token declarations for `token()` when nothing calls it.

  Some declarations survive pruning purely so JavaScript can ask for them: virtual tokens, conditional ones, and the
  positive counterpart of every negative token. That last case is the expensive one — a negative is never declared
  itself, so it pins its positive and keeps the entire spacing scale alive whether or not anything uses it. The config
  documentation put that at "roughly a third of what survives pruning", and said there was no opt-out.

  There is now, and it needs no flag. The tokens artifact is generated into your project rather than installed, so the
  import is written in your own source and a scan of `include` finds it. When no file reaches for a token from
  JavaScript, the exemption has no caller to serve and is skipped.

  This changes emitted CSS by default, which is why it is a minor rather than the patch it started as.

  **What the scan looks for**

  A call — `token(`, `token.var(`, with whatever whitespace a formatter left around the dot — or a `from` / `import` /
  `require` of any module specifier carrying a `/tokens` path segment. Both tests over-match on purpose: keeping a
  declaration nothing reads costs bytes, and dropping one that is read returns a `var()` nothing declares.

  The import test is loose because the literal `styled-system/tokens` was too tight in three ways at once. `outdir` is
  configurable, so the artifact is only at `styled-system/` by default; a tsconfig path alias spells it something else
  again; and the artifact is a **directory**, so under NodeNext the only legal specifier is
  `styled-system/tokens/index.mjs` — which the literal did not match either. It is still anchored to an import keyword,
  because otherwise a URL or a route (`fetch('/api/tokens')`, an `href` of `/docs/theming/tokens`) reads as an import
  and switches the whole optimisation off without saying so.

  Measured on the sandboxes here:

  | app          |    raw |   gzip | brotli |
  | ------------ | -----: | -----: | -----: |
  | svelte       | -20.2% | -12.9% | -12.2% |
  | gatsby-ts    | -19.0% | -11.8% | -11.3% |
  | next-js-app  | -18.6% | -11.7% | -10.8% |
  | vite-ts      |  -6.9% |  -4.9% |  -4.1% |
  | runtime-perf |  -2.0% |  -1.9% |  -1.9% |
  | preact-ts    |     0% |     0% |     0% |

  `preact-ts` is the control, and it is the shape you want to check yourself against: it calls `token()`, so the
  exemption has a caller, nothing is skipped, and its stylesheet is byte-for-byte what it was. Every other app here
  reaches for no token from JavaScript, and the spread between them is how much of their theme the CSS alone could not
  account for.

  Across all sixteen example apps: 0% wherever a project reaches for a token, and -2.0% to -20.2% raw wherever none
  does, most of them between -11% and -19%.

  A project that calls `token()`, `token.var()`, or imports the tokens artifact anywhere under `include` is unaffected —
  and a hand-written `var(--x)` in source was already covered by the existing reference scan.

  Two shapes the scan does not see, both rare and neither loud. `include` scopes style extraction rather than everything
  that may import, so a build script, a config file, or a sibling workspace package calling `token()` is not covered;
  nor is a binding renamed away from `token`, as in `const t = token`. In both the declaration is pruned and the call
  returns a `var()` nothing declares. `pruneUnusedTokens: false` keeps every declaration if you are in that position.

- 0e6a4ee: `@bamboocss/vite` now emits the stylesheet itself, so a Vite project needs no PostCSS setup.

  Import the virtual module wherever you used to import the file carrying the `@layer` statement:

  ```ts
  // vite.config.ts
  import bamboocss from '@bamboocss/vite'

  export default defineConfig({
    plugins: [bamboocss(), react()],
  })
  ```

  ```ts
  // src/main.tsx
  import 'virtual:bamboo.css'
  ```

  ```ts
  // src/vite-env.d.ts
  /// <reference types="@bamboocss/vite/client" />
  ```

  `bamboocss()` now returns **two** plugins rather than one: the CSS emitter, which runs in dev and build alike, and the
  build-only fold. If you were reaching into the returned object — `bamboocss().transform`, say — it is now an array.

  **Why a virtual module rather than a written file**

  Vite already owns both things a file would have to reimplement. In dev it injects CSS over the websocket and replaces
  it in place, so a style edit repaints without reloading and without losing component state. In build it hashes the
  content into the asset graph and decides where it lands. Writing `styles.css` and asking the project to import it
  means the build reads a file the same process just wrote, which is a race on every watch rebuild.

  The stylesheet carries its own `@layer reset, base, tokens, recipes, utilities;` statement, which the PostCSS path
  takes from the file it injects into. That statement is what fixes layer _order_ — without it, layers are ordered by
  first appearance.

  **PostCSS still works.** This is an addition, not a replacement; nothing about the existing setup changes. Use one or
  the other, though — configuring both puts two copies of the sheet in the bundle.

  Also adds `Builder.toCss()` for anything that wants the finished stylesheet as a string rather than injected into a
  PostCSS root.

### Patch Changes

- edb97e2: Correct what the scaffolded config says pruning is worth: 53–78% of a new project's stylesheet, measured
  across the example apps here, not the 50–60% it claimed.
- Updated dependencies [39c699f]
- Updated dependencies [fe62614]
- Updated dependencies [1036258]
- Updated dependencies [41d9052]
- Updated dependencies [a1062c9]
- Updated dependencies [43ae8a7]
  - @bamboocss/generator@1.22.0
  - @bamboocss/core@1.22.0
  - @bamboocss/types@1.22.0
  - @bamboocss/parser@1.22.0
  - @bamboocss/shared@1.22.0
  - @bamboocss/reporter@1.22.0
  - @bamboocss/config@1.22.0
  - @bamboocss/logger@1.22.0
  - @bamboocss/plugin-lightningcss@1.22.0
  - @bamboocss/plugin-svelte@1.22.0
  - @bamboocss/plugin-vue@1.22.0
  - @bamboocss/token-dictionary@1.22.0

## 1.21.0

### Patch Changes

- Updated dependencies [81f8789]
  - @bamboocss/shared@1.21.0
  - @bamboocss/generator@1.21.0
  - @bamboocss/config@1.21.0
  - @bamboocss/core@1.21.0
  - @bamboocss/parser@1.21.0
  - @bamboocss/reporter@1.21.0
  - @bamboocss/token-dictionary@1.21.0
  - @bamboocss/types@1.21.0
  - @bamboocss/logger@1.21.0
  - @bamboocss/plugin-lightningcss@1.21.0
  - @bamboocss/plugin-svelte@1.21.0
  - @bamboocss/plugin-vue@1.21.0

## 1.20.4

### Patch Changes

- Updated dependencies [1f94d5a]
  - @bamboocss/generator@1.20.4
  - @bamboocss/parser@1.20.4
  - @bamboocss/reporter@1.20.4
  - @bamboocss/config@1.20.4
  - @bamboocss/core@1.20.4
  - @bamboocss/logger@1.20.4
  - @bamboocss/plugin-lightningcss@1.20.4
  - @bamboocss/plugin-svelte@1.20.4
  - @bamboocss/plugin-vue@1.20.4
  - @bamboocss/shared@1.20.4
  - @bamboocss/token-dictionary@1.20.4
  - @bamboocss/types@1.20.4

## 1.20.3

### Patch Changes

- Updated dependencies [fa63a80]
  - @bamboocss/core@1.20.3
  - @bamboocss/generator@1.20.3
  - @bamboocss/reporter@1.20.3
  - @bamboocss/parser@1.20.3
  - @bamboocss/config@1.20.3
  - @bamboocss/logger@1.20.3
  - @bamboocss/plugin-lightningcss@1.20.3
  - @bamboocss/plugin-svelte@1.20.3
  - @bamboocss/plugin-vue@1.20.3
  - @bamboocss/shared@1.20.3
  - @bamboocss/token-dictionary@1.20.3
  - @bamboocss/types@1.20.3

## 1.20.2

### Patch Changes

- 8a73d2a: Stop the PostCSS plugin injecting a second copy of the stylesheet into a file that already imports it.

  `isValidRoot` reads only the `@layer` statement, and that statement is ordinary CSS — listing every layer in order is
  what a project has to write once it has layers of its own beside Bamboo's. So this file satisfies the guard while
  already holding the sheet:

  ```css
  @import '#app/styled-system/styles.css'; /* copy 1 — inlined by postcss-import first */
  @layer reset, base, tokens, recipes, utilities, overrides, syntaxHighlighter; /* triggers copy 2 */
  ```

  Vite puts `postcss-import` at the front of the chain, so the `cssgen` artifact is inlined before any plugin runs.
  `isValidLayerParams` then sees all five Bamboo layers among the seven names, returns true, and `write` appends a
  freshly generated copy. The config is correct; the guard was wrong.

  `write` now checks for the `--made-with-bamboo` declaration that `generateGlobalCss` emits unconditionally, and skips
  with a warning when generated CSS is already present. A declaration rather than a comment, because the copy already in
  the root may have been minified before this runs and comments do not survive that — which also makes it a better
  signal than the markers added in 1.20.1, so those are gone again.

  **Why it went unnoticed**

  The duplication does not look like duplication by the time it ships. A minifier merges the two `@layer X{}` blocks and
  dedupes most of the collision; what survives is what it cannot merge — rules nested inside `@media`, `@supports` or
  `@scope`, where each copy contributes its own sub-block, plus top-level pseudo-element rules split out of selector
  lists. On one production stylesheet that residue was 402 rules and 21 kB: 11% of the file, reading as a rounding error
  rather than as the whole sheet twice.

  If you have both an `@import` of `styles.css` and the `@layer` statement, keep one. The warning now says which.
  - @bamboocss/config@1.20.2
  - @bamboocss/core@1.20.2
  - @bamboocss/generator@1.20.2
  - @bamboocss/logger@1.20.2
  - @bamboocss/parser@1.20.2
  - @bamboocss/plugin-lightningcss@1.20.2
  - @bamboocss/plugin-svelte@1.20.2
  - @bamboocss/plugin-vue@1.20.2
  - @bamboocss/reporter@1.20.2
  - @bamboocss/shared@1.20.2
  - @bamboocss/token-dictionary@1.20.2
  - @bamboocss/types@1.20.2

## 1.20.1

### Patch Changes

- 559924f: Stop the PostCSS plugin appending a second copy of the stylesheet when a root reaches it twice.

  `Builder.write` appended the generated css to the user's root, and what it appended carries the
  `@layer reset, base, tokens, recipes, utilities;` declaration that `isValidRoot` looks for. So the guard deciding
  whether to inject was satisfied by the result of injecting, and nothing removed or replaced a previous injection. A
  root that reached `write` twice — a plugin registered in both `postcss.config.js` and the bundler config, or a chain
  that re-processes emitted css — accumulated a whole copy each time: 101 rules became 201, 22.8 kB became 45.5 kB.

  Nothing downstream took those apart. Each copy is internally consistent and only duplicated against the other, so
  `postcss-discard-duplicates` never sees a duplicate within the sheet it is given. That is how a production stylesheet
  came to carry 402 byte-identical rules in identical contexts — 21 kB, 11% of the file — concentrated entirely in
  Bamboo's own layers while the app's own layers were clean.

  The injection is now bracketed by `/* bamboocss:start */` and `/* bamboocss:end */`, and `write` removes a previous
  block before appending. Comments rather than a flag on the node, because the root can be stringified and re-parsed
  between two plugins in the same chain and nothing on the node survives that round trip.

  Removal is bounded by the end marker rather than running to the end of the root, so anything a later plugin appended
  after the injection stays where it is. A start marker with no end — what an uneven comment strip would leave — removes
  nothing, which is the safe direction: a duplicate costs bytes, dropping a user's css does not fail loudly.

  If you were hitting this, the duplicates are worth looking for: they survive minification, since each copy is valid
  css.
  - @bamboocss/config@1.20.1
  - @bamboocss/core@1.20.1
  - @bamboocss/generator@1.20.1
  - @bamboocss/logger@1.20.1
  - @bamboocss/parser@1.20.1
  - @bamboocss/plugin-lightningcss@1.20.1
  - @bamboocss/plugin-svelte@1.20.1
  - @bamboocss/plugin-vue@1.20.1
  - @bamboocss/reporter@1.20.1
  - @bamboocss/shared@1.20.1
  - @bamboocss/token-dictionary@1.20.1
  - @bamboocss/types@1.20.1

## 1.20.0

### Minor Changes

- 5d2c91c: Prune unreachable tokens, keyframes and `@property` rules by default.

  `pruneUnusedTokens` and `pruneUnusedKeyframes` both default to `true` now. On the example apps in this repository:

  | app          |             raw |          gzip |
  | ------------ | --------------: | ------------: |
  | svelte       |  22,047 → 5,188 | 5,442 → 1,802 |
  | runtime-perf |   9,107 → 3,462 |   1,941 → 989 |
  | vite-ts      | 13,845 → 10,463 | 3,390 → 3,053 |

  That is 10–67% of the gzipped, render-blocking stylesheet, and it scales with the size of the design system rather
  than the size of the app — so the larger the theme, the more of it was being shipped for nothing. `bamboo init`
  already turned both on, so newly scaffolded projects had this and everyone else did not.

  Set either to `false` to restore the previous behaviour.

  **`@property` registrations no longer depend on the flag**

  A preset registers every custom property its utilities compose — filters, gradients, transforms, transitions — from
  the config rather than from what the app draws. That is 42 rules and 3.2 kB, byte-identical in every project here, of
  which **41 to 42 were referenced by nothing at all**.

  Those are now dropped whether or not `pruneUnusedTokens` is set. The flag exists because a token can be reached by a
  name the pass never sees — `token.var()` with a path assembled at runtime, a stylesheet outside `include`, a package
  consuming the output as design tokens. A registration has no such surface: nothing hands one to JavaScript and none
  are part of the `token()` api, verified as zero overlap with declared tokens. Whether the finished stylesheet mentions
  one is the whole question, so opting out of the half that cannot be proven should not mean carrying the half that can.

  Turning `pruneUnusedTokens` off is still exact for token declarations — every one is kept.

  **Upgrading**

  The three cases the reachability pass cannot see are unchanged and are the ones to check if a value goes missing:
  - a token named by a path the source does not spell out as a string literal, such as `token.var(key)`
  - a token referenced only from a stylesheet outside `include`
  - a token consumed by a separate package treating the output as design tokens

  List those under `staticCss`, or set `pruneUnusedTokens: false`. The equivalent for an animation name assembled at
  runtime is already covered — the keyframe pass falls back to a deliberately over-inclusive textual scan of `include`.

### Patch Changes

- 6512d6b: Update the PostCSS toolchain, and fold shared selector prefixes into `:is()` when minifying.

  | package                            |   from |     to |
  | ---------------------------------- | -----: | -----: |
  | `postcss`                          | 8.5.25 | 8.5.26 |
  | `postcss-selector-parser`          |  7.1.1 |  7.1.5 |
  | `postcss-discard-duplicates`       |  7.0.2 |  8.0.2 |
  | `postcss-discard-empty`            |  7.0.1 |  8.0.2 |
  | `postcss-minify-selectors`         |  7.0.5 |  8.0.3 |
  | `postcss-nested`                   |  7.0.2 |  8.0.1 |
  | `postcss-normalize-whitespace`     |  7.0.1 |  8.0.2 |
  | `@csstools/postcss-cascade-layers` |  5.0.2 |  6.0.0 |
  | `browserslist`                     | 4.28.1 | 4.28.7 |

  The cssnano majors raise their engine floor to `^22.11.0 || ^24.11.0 || >=26.0`. Nothing here declares `engines`, so
  it is not enforced at install time, but a build on Node 24.10 or older 24.x runs these plugins outside their supported
  range.

  **Minified `globalCss` changes**

  `postcss-minify-selectors` 8 adds `convertToIs`, which factors a shared prefix or suffix in a selector list into
  `:is(...)` where that shortens it. It is on, and it reaches `globalCss` — a selector list nested under a parent is the
  common case:

  ```diff
    '.card': { '& h1, & h2': { fontWeight: 'bold' } }

  - .card h1,.card h2 { font-weight: … }
  + .card :is(h1,h2) { font-weight: … }
  ```

  Class names and hashes are unchanged, `:is()` takes the highest specificity of its arguments so the folded rule
  matches and ranks exactly as the list did, and unminified output is untouched.

  Atomic and recipe output is unaffected, and not incidentally: each atomic class carries a unique declaration, so
  `merge-rules` never combines two into a list with shared structure, and a scoped slot variant is a plain selector
  inside an `@scope` block rather than a list. Measured over every stylesheet this repo generates — 59 selector lists,
  none foldable, zero bytes moved. The fold is worth having for authored CSS; it is not a size win on generated CSS, and
  nothing here should be read as claiming one.

  **The browser baseline is now fixed, and `@scope` sets it**

  Upstream gates the fold on `caniuse-api`, and resolves the target it asks about from `process.cwd()` — the consuming
  project, not `config.browserslist`. Two things follow, and both break the guarantee that a given input compiles to one
  stylesheet: output would depend on where the build ran, and it would flip on its own as `caniuse-lite` refreshed. So
  the baseline is passed explicitly and no longer consults the ambient config.

  Documenting that baseline turned up errors in it. `@scope` was described as a raised floor that only projects with
  `root`-slot recipes reach, with a lower general baseline beneath it — which made the supported set depend on how a
  project's recipes happen to be written. `@scope` is the documented baseline now, one floor, and `scopeRoots: []` is no
  longer offered as a way under it: it controls scoping, not what Bamboo supports.

  The numbers behind it were wrong in two places. Firefox is **146**, not 128 — caniuse records 128 through 145 as no
  support, not partial — and Opera is **106**, not 104. Anyone on Firefox 128–145 had been told slot recipes would work.
  The retired lower tier had its own version of this: it claimed `:is()` as a baseline feature while listing
  `Opera >= 73`, which predates it by two majors.

  **Coverage**

  The minified branch had no tests, which is how a plugin swapping "sort and dedupe a selector list" for "fold it into
  `:is()`" changed emitted CSS without a snapshot moving. `packages/core/__tests__/optimize-minify.test.ts` now locks
  the minified output, and asserts it is unchanged under a hostile ambient `BROWSERSLIST`.

- 0441724: Update the runtime dependencies that decide how the framework behaves. Emitted CSS is unchanged — Lightning
  CSS 1.33 produces the sandbox stylesheet byte for byte as 1.31 did.

  | package              |   from |     to | reaches                   |
  | -------------------- | -----: | -----: | ------------------------- |
  | `lightningcss`       | 1.31.1 | 1.33.0 | CSS output when enabled   |
  | `ts-evaluator`       |  1.2.0 |  2.0.0 | expression evaluation     |
  | `chokidar`           |  4.0.3 |  5.0.0 | watch mode                |
  | `@vue/compiler-sfc`  | 3.5.25 | 3.5.41 | Vue SFC extraction        |
  | `@vue/compiler-core` | 3.5.25 | 3.5.41 | the types the above emits |
  | `picomatch`          |  4.0.4 |  4.0.5 | file matching             |

  `@vue/compiler-core` is a dev-only type import in `plugin-vue`, and it was pinned a version behind `compiler-sfc`.
  That had been invisible while both were 3.5.25; moving only `compiler-sfc` put two copies of the AST types in the tree
  and `BaseElementNode` stopped matching the nodes `parse` actually returns. Both move together from here.

  **Three were deliberately left alone**

  `magic-string` stays at 0.30.21. 1.x is ESM-only — `"type": "module"`, no `require` export — and `@bamboocss/vite`,
  `plugin-vue` and `plugin-svelte` all ship a CJS build that emits `require("magic-string")`. It resolves today and
  would not on 1.x, breaking every CJS consumer. Nothing in the suite would notice, since the tests run ESM.

  `open-props` stays at 1.7.16. 1.7.23 hardcodes the shadow scale:

  ```diff
  - --shadow-1: 0 1px 2px -1px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 9%))
  + --shadow-1: 0 1px 2px -1px hsl(220 3% 15% / 10%)
  ```

  The `--shadow-color` and `--shadow-strength` indirection is gone, and with it `--shadow-color-@media:dark` and
  `--inner-shadow-highlight`. `preset-open-props` reads these values straight out of `open-props/src`, so taking the
  bump means shadows stop responding to dark mode. Upstream moved that into separate light and dark files; adopting it
  is a port, not a version bump.

  `typescript` stays at 6.0.2, which is what `@ts-morph/common@0.29.0` bundles. ts-morph 28 is current, so TypeScript 7
  would put the compiler the parser runs on out of step with the one the repo type-checks against.

- Updated dependencies [15e2d53]
- Updated dependencies [045ab1e]
- Updated dependencies [6512d6b]
- Updated dependencies [5d2c91c]
- Updated dependencies [10d7c9b]
- Updated dependencies [aa0f641]
- Updated dependencies [0441724]
- Updated dependencies [0e2cb31]
  - @bamboocss/generator@1.20.0
  - @bamboocss/core@1.20.0
  - @bamboocss/plugin-lightningcss@1.20.0
  - @bamboocss/types@1.20.0
  - @bamboocss/shared@1.20.0
  - @bamboocss/plugin-vue@1.20.0
  - @bamboocss/token-dictionary@1.20.0
  - @bamboocss/config@1.20.0
  - @bamboocss/parser@1.20.0
  - @bamboocss/reporter@1.20.0
  - @bamboocss/logger@1.20.0
  - @bamboocss/plugin-svelte@1.20.0

## 1.19.0

### Patch Changes

- Updated dependencies [510cdd3]
  - @bamboocss/core@1.19.0
  - @bamboocss/generator@1.19.0
  - @bamboocss/reporter@1.19.0
  - @bamboocss/parser@1.19.0
  - @bamboocss/config@1.19.0
  - @bamboocss/logger@1.19.0
  - @bamboocss/plugin-lightningcss@1.19.0
  - @bamboocss/plugin-svelte@1.19.0
  - @bamboocss/plugin-vue@1.19.0
  - @bamboocss/shared@1.19.0
  - @bamboocss/token-dictionary@1.19.0
  - @bamboocss/types@1.19.0

## 1.18.0

### Minor Changes

- 070f9da: Keep the token a custom property outside the token layer points at, and scaffold pruning into new projects.

  `pruneUnusedTokens` decided reachability by following references found in the stylesheet. A custom property the token
  system did not declare is never removed — it is not pruning's to remove — but it was only treated as reachable if
  something else in the sheet referenced it. Exporting a value is precisely the case where nothing does:

  ```ts
  globalCss: {
    ':root': { '--brand': '{colors.blue.500}' },
  }
  ```

  `--brand` survived; `--colors-blue-500` did not. The result was a `var()` with no declaration behind it, which
  resolves to the guaranteed-invalid value — so a colour falls back to _inherited_ rather than to nothing. Silently
  wrong rather than visibly missing, and invisible in a css diff unless you were looking for it.

  Any custom property pruning will not remove is now a root of the reachability walk, so what it references is kept with
  it. Costs nothing: measured byte-identical output across the website and every sandbox, none of which declares one.

  `bamboo init` now scaffolds `pruneUnusedTokens` and `pruneUnusedKeyframes` as `true`, with a note on when to turn them
  off. They stay `false` by default, so no existing project changes. A new project gets 50-60% off its stylesheet on day
  one, when it has no styles yet and anything unexpected is immediately visible — measured 5,304 -> 2,213 bytes gzipped
  on a stock Next.js app, 5,566 -> 2,601 on Remix, and 15,619 -> 13,017 on this repo's own docs site.

  The config docs also now say which `token()` form actually needs `staticCss`: `token(key)` is safe for any path,
  because javascript receives a literal for a plain token. It is `token.var(key)` that hands back a reference and needs
  the declaration to survive.

### Patch Changes

- Updated dependencies [21c6daa]
- Updated dependencies [070f9da]
  - @bamboocss/shared@1.18.0
  - @bamboocss/generator@1.18.0
  - @bamboocss/core@1.18.0
  - @bamboocss/config@1.18.0
  - @bamboocss/parser@1.18.0
  - @bamboocss/reporter@1.18.0
  - @bamboocss/token-dictionary@1.18.0
  - @bamboocss/types@1.18.0
  - @bamboocss/logger@1.18.0
  - @bamboocss/plugin-lightningcss@1.18.0
  - @bamboocss/plugin-svelte@1.18.0
  - @bamboocss/plugin-vue@1.18.0

## 1.17.3

### Patch Changes

- @bamboocss/parser@1.17.3
- @bamboocss/types@1.17.3
- @bamboocss/config@1.17.3
- @bamboocss/core@1.17.3
- @bamboocss/generator@1.17.3
- @bamboocss/logger@1.17.3
- @bamboocss/plugin-lightningcss@1.17.3
- @bamboocss/plugin-svelte@1.17.3
- @bamboocss/plugin-vue@1.17.3
- @bamboocss/reporter@1.17.3
- @bamboocss/shared@1.17.3
- @bamboocss/token-dictionary@1.17.3

## 1.17.2

### Patch Changes

- @bamboocss/config@1.17.2
- @bamboocss/core@1.17.2
- @bamboocss/generator@1.17.2
- @bamboocss/logger@1.17.2
- @bamboocss/parser@1.17.2
- @bamboocss/plugin-lightningcss@1.17.2
- @bamboocss/plugin-svelte@1.17.2
- @bamboocss/plugin-vue@1.17.2
- @bamboocss/reporter@1.17.2
- @bamboocss/shared@1.17.2
- @bamboocss/token-dictionary@1.17.2
- @bamboocss/types@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [a1c3990]
- Updated dependencies [fc381ca]
  - @bamboocss/core@1.17.1
  - @bamboocss/shared@1.17.1
  - @bamboocss/generator@1.17.1
  - @bamboocss/reporter@1.17.1
  - @bamboocss/config@1.17.1
  - @bamboocss/parser@1.17.1
  - @bamboocss/token-dictionary@1.17.1
  - @bamboocss/types@1.17.1
  - @bamboocss/logger@1.17.1
  - @bamboocss/plugin-lightningcss@1.17.1
  - @bamboocss/plugin-svelte@1.17.1
  - @bamboocss/plugin-vue@1.17.1

## 1.17.0

### Minor Changes

- 049a382: Report a `css()` call the build could not fully read under `cssMode: 'atomic'`, not only under `grouped`.

  ```jsx
  css({ ...getFocusRingStyles(), color: 'red' })
  // `.c_red` is emitted; the focus ring's declarations are not, and nothing said so
  ```

  The detection was gated on `grouped` because that is where a loss is _fatal_ — one class names the whole call, so
  missing part of it costs all of it. Under `atomic` the loss is partial: what the build saw still applies. But it is no
  less silent, and a component quietly missing its focus ring is exactly the shape that gets reported as a mystery
  rather than as a bug.

  Only the surprising half is reported. A spread the build could not read **looks** static and is not, so it interrupts.
  A value it could not evaluate — `css({ color: getColor() })` — is the documented dynamic-styling shape, answered by
  `staticCss` and already covered by the `no-dynamic-styling` lint rule; warning on every one of those would bury the
  first. Grouped mode keeps reporting both, because there either kind costs the whole call.

  The message is written for the mode it fires in rather than reusing grouped's, which ended "to group it".

- 7251bf8: Report a recipe config the build could not fully read, instead of emitting a stylesheet nothing will ask for.

  A `cva`/`sva` config with a spread the extractor cannot resolve loses those declarations — and since 1.16 that is not
  a partial loss. A recipe's classes are named from a hash of its config, so a dropped declaration changes the hash: the
  build emits rules under one name and the browser asks for another, and the element renders with **no styles at all**.

  ```jsx
  cva({ base: { ...getFocusRing(), color: 'red' } })
  // build emits  .cva_iPlRDu, .cva_iPlRDu--size_sm
  // browser asks cva_gLgUZR…      — nothing matches
  ```

  Before 1.16 atomic class names were content-addressed per declaration, so the spread's properties were missing but
  everything the build _did_ resolve still applied. Semantic recipe naming turned that benign limit into total loss.

  The detection already existed — `findUnresolvedStyles`, added for `cssMode: 'grouped'`, where one class names a whole
  `css()` call. That gate was right for what it was written for and was never extended when recipes gained the same
  property, in every mode. Recipes are now checked regardless of `cssMode`, and the message says what to do:

  ```
  🎋 warn [recipe] app/Button.tsx:4:18 — an object spread or computed key leaves the build unable to tell
  which properties this call sets. A recipe's classes are named from a hash of its config, so a declaration
  the build cannot see gives the build and the browser different names and the element renders with no
  styles at all. Set `className` on the recipe, so its name does not depend on what the build could resolve.
  ```

  `className` is the fix as well as the workaround: the identity short-circuits on it and never hashes the styles, so
  extraction fidelity stops deciding the name and the loss degrades to the missing declarations alone. A recipe that
  sets one is not reported.

  Reported per level with its path — `base`, `variants.size.sm`, `compoundVariants.0.css`, `base.root` for a slot. Three
  ways a level can lose something are covered:
  - a **spread or computed key** that contributed no keys beyond those written beside it;
  - a **value the build could not evaluate** (`{ color: getColor() }`), which leaves no trace in the box tree at all
    because the pair is never recorded — this one needs the written source compared against the resolved data;
  - the config **not being an object literal**, as in `cva(someConfig)`, which is the quietest total loss of the lot.

  Every level is unwrapped first, so `as const` and `satisfies` — idiomatic on a recipe config — do not hide the loss. A
  spread of a literal is not reported, since its keys are written right there and nothing can have gone missing.

  **Cost.** The check walks the config, so it roughly doubles the walking a recipe already costs: on a file of eight
  variant-heavy recipes, parse goes from 1.087 ms to 1.390 ms (+28%). It is skipped entirely for a recipe that sets
  `className` — so the state this warning asks for is also the one that does not pay for it. Folding the comparison into
  extraction, rather than walking a second time, is the way to remove the cost outright.

  This does not change what CSS is emitted. `css()` in atomic mode still drops an unresolvable spread silently; that is
  unchanged and pre-existing.

### Patch Changes

- 29f9bbe: Fix conditional token values being silently dropped on postcss `>= 8.5.25`.

  A semantic token declared with a conditional value emitted only its `base` half — no error, no warning — so a themed
  app kept its light values in dark mode:

  ```ts
  semanticTokens: {
    colors: {
      panel: { value: { base: '#ffffff', _osDark: '#131211' } },
    },
  }
  ```

  ```css
  /* before — the `_osDark` half never reached the tokens layer */
  @layer tokens {
    :where(:root, :host) {
      --colors-panel: #ffffff;
    }
  }
  ```

  `getDeepestRule` seeded its nesting chain with an empty-selector rule and relied on postcss-nested erasing `&` against
  it. postcss 8.5.25 ("Fixed 8.5.17 visitor regression") changed that edge case to collapse the whole selector, so every
  conditional token was emitted as a selectorless — and therefore discarded — rule. The chain is now built on a `Root`,
  and the top-level `&` is resolved directly instead of through postcss-nested.

- Updated dependencies [049a382]
- Updated dependencies [3cdd0d1]
- Updated dependencies [29f9bbe]
- Updated dependencies [66cb96c]
- Updated dependencies [28463ce]
- Updated dependencies [6577023]
- Updated dependencies [d5347ab]
- Updated dependencies [c6154dc]
- Updated dependencies [7251bf8]
- Updated dependencies [355e573]
  - @bamboocss/parser@1.17.0
  - @bamboocss/generator@1.17.0
  - @bamboocss/shared@1.17.0
  - @bamboocss/core@1.17.0
  - @bamboocss/types@1.17.0
  - @bamboocss/reporter@1.17.0
  - @bamboocss/config@1.17.0
  - @bamboocss/token-dictionary@1.17.0
  - @bamboocss/logger@1.17.0
  - @bamboocss/plugin-lightningcss@1.17.0
  - @bamboocss/plugin-svelte@1.17.0
  - @bamboocss/plugin-vue@1.17.0

## 1.16.1

### Patch Changes

- @bamboocss/parser@1.16.1
- @bamboocss/types@1.16.1
- @bamboocss/config@1.16.1
- @bamboocss/core@1.16.1
- @bamboocss/generator@1.16.1
- @bamboocss/logger@1.16.1
- @bamboocss/plugin-lightningcss@1.16.1
- @bamboocss/plugin-svelte@1.16.1
- @bamboocss/plugin-vue@1.16.1
- @bamboocss/reporter@1.16.1
- @bamboocss/shared@1.16.1
- @bamboocss/token-dictionary@1.16.1

## 1.16.0

### Minor Changes

- f2d5df2: **Breaking:** remove the JSX factory. Bamboo no longer generates components, and is now framework-agnostic.

  `styled-system/jsx` is not emitted at all. `styled` / `bamboo`, style props, the `css` prop, `as`, `unstyled`,
  `createStyleContext`, `splitCssProps` and `isCssProperty` are gone, along with `jsxFramework`, `jsxFactory` and
  `jsxStyleProps`. There is no React, Vue, Solid, Preact or Qwik codegen left anywhere.

  ```tsx
  // before
  <styled.div color="red.300" padding="4">hi</styled.div>
  const Button = styled('button', buttonRecipe)

  // after
  <div className={css({ color: 'red.300', padding: '4' })}>hi</div>
  const Button = (props: ButtonProps) => {
    const [variantProps, rest] = buttonRecipe.splitVariantProps(props)
    return <button {...rest} className={cx(buttonRecipe(variantProps), props.className)} />
  }
  ```

  For an override to be deterministic the component's styles have to sit in a lower cascade layer, which means declaring
  them as a config recipe — an inline `cva()` is atomic and lands in `utilities` alongside the consumer. A component
  that instead accepts a style object and merges it with `css(base, props.css)` needs no layer at all.

  **Recipe JSX tracking is kept**, and no longer depends on `jsxFramework`. A recipe's `jsx: ['Button']` hint is how the
  build reads `<Button variant="danger">` on a component you wrote and emits `--variant_danger`; without it those
  variants would silently stop being generated. It costs no codegen — it is extraction only.

  **`createStyleContext` has no replacement in the box.** Compound components that need one slot to see the variant
  chosen at the root now write their own context; `docs/concepts/slot-recipes` documents the ~20-line version.

  What this removes beyond the API: the whole per-framework generator tree, `is-valid-prop` (a large module that shipped
  to the browser only to decide whether a prop was a style prop), `normalize-html`, the vite fold's JSX element path —
  which has nothing left to fold — and the per-framework test matrix.

  `@bamboocss/plugin-vue` and `@bamboocss/plugin-svelte` are unaffected: they transform source so the extractor can read
  it, which has nothing to do with the factory.

- 1dbeb84: **Breaking:** remove JSX pattern components.

  `styled-system/jsx` no longer emits a component per pattern — `<Stack>`, `<Box>`, `<HStack>` and the rest are gone,
  and `styled-system/jsx` now exports only the factory, `isCssProperty` and `createStyleContext`.

  Pattern **functions** are unchanged. Every pattern still ships from `styled-system/patterns`, and a pattern function
  passes arbitrary style props through, so the rewrite is mechanical and behaviour-preserving:

  ```tsx
  // before
  <Stack gap="4" mt="8">{children}</Stack>
  <Box p="4">{children}</Box>

  // after
  <div className={stack({ gap: '4', mt: '8' })}>{children}</div>
  <div className={css({ p: '4' })}>{children}</div>
  ```

  The `jsx`, `jsxName` and `jsxElement` fields on a pattern config are removed along with them — they only ever
  described a component bamboo generated. `jsx` on a **recipe** is untouched.

  Everything that existed to serve the component layer goes with it: the five per-framework pattern generators, the
  `jsx-patterns` artifact, the parser's `jsx-pattern` result type and `JsxEngine`'s pattern matcher, and the vite fold's
  pattern-element path. `Patterns.find`/`Patterns.filter` (both keyed by JSX name) are gone, and
  `StyleEncoder.processPattern` takes `(name, props, grouped)`.

  Two consequences worth knowing:
  - A component of your own named `Box` or `Stack` is no longer misread as bamboo's pattern. It extracts as an ordinary
    component, which is what it always was.
  - The `jsx-patterns-index` artifact is now `jsx-index`, since it no longer indexes patterns.

- d7226f0: **Breaking:** remove template literal syntax.

  The `syntax` config option is gone, along with the `--syntax` CLI flag and the syntax question `bamboo init -i` asked.
  Styles are written as objects.

  A project that set `syntax: 'template-literal'` now gets a TypeScript error on the option, and its tagged templates
  are no longer read by the extractor — `` css`color: red;` `` and `` styled.div`color: red;` `` produce no CSS. Convert
  them to object literals:

  ```tsx
  // before
  const One = styled.div`
    display: flex;
    width: 300px;
  `

  // after
  const One = styled('div', {
    base: {
      display: 'flex',
      width: '300px',
    },
  })
  ```

  Everything the option gated goes with it: the string-literal `css`/`conditions` runtimes and the string-literal JSX
  factories and types for all five frameworks, the parser's tagged-template branch, the extractor's `taggedTemplates`
  matcher, the vite fold's tagged-template path, and `astish` from `@bamboocss/shared`. Under the object syntax `cva`,
  `sva`, patterns, `is-valid-prop`, style props and `viewTransition()` were already the only paths taken, so their
  generated output is unchanged — the codegen artifacts are byte-identical.

### Patch Changes

- bb6d999: Stop `cssMode: 'grouped'` rendering elements with no styles at all, in the shapes that were left.

  A grouped class names a whole `css()` call, so the build has to have encoded that exact call to emit its rule. The
  runtime already falls back to atomic class names when it has not — but a fallback only helps if atomic rules for those
  names exist, and the build emitted them for a `css()` call it knew it had lost and nowhere else. Every other way of
  losing a call landed on nothing, and the element rendered unstyled with no warning:
  - A conditional value beside any other prop on a JSX element or in a pattern —
    `<styled.div color={on ? 'red' : 'blue'} padding="2" />`. Only `css()` reconstructs a ternary's branches; a JSX
    element or a pattern encoded each extracted object on its own, and the runtime asked for the merge of them.
  - A value the build could not evaluate beside another prop on either —
    `<styled.div color={props.tone} padding="2" />`.
  - A property lost to a spread — `css({ ...props.styles, color: 'red' })`.
  - Two arguments setting one property, which the build read as a pair of ternary branches rather than as a merge —
    `css({ color: { base: 'red' } }, { color: { _hover: 'blue' } })`.

  Those now emit their atomic rules alongside their group, so the element keeps every declaration the build resolved —
  the same styling `cssMode: 'atomic'` gives for the same source. The `css()` cases warn, with a file, a line, and what
  to change; a conditional style prop is ordinary code and does not.

  Two shapes group properly now instead of degrading:
  - A ternary inside a condition block, beside another property —
    `css({ _hover: { color: on ? 'red' : 'blue' }, padding: '2' })`. Reconstructing the branches combined them with
    `Object.assign`, so the empty `_hover` carried by the entry holding `padding` replaced the branch's condition
    instead of merging into it. They are merged the way `mergeCss` merges now.
  - An array argument — `css([{ color: 'red' }, { padding: '2' }])`.

  A call site that emits atomic rules alongside its group costs some CSS. It is bounded by how many call sites the build
  cannot fully see, and buys back the styles they were dropping.

- 4877a67: Correct the `cssMode: 'grouped'` unresolved-value warning, which described the behaviour it had before the
  atomic fallback landed.

  It said the element "renders with no styles at all". It no longer does — the call falls back to naming each
  declaration separately and keeps the ones the build could resolve. The warning now says that, and says what to do
  about it.

- 645bb09: Stop `cssMode: 'grouped'` rendering an element with no styles when the build could not see the whole `css()`
  call.

  A grouped class names a whole call, so the build has to have seen that exact call to emit its rule. When it had not —
  an unresolvable value, a combination it declined to enumerate — the runtime returned a class with nothing behind it
  and the element rendered blank. Not a degraded version of the styles: none of them.

  Three pieces, and the feature needs all three:
  - The build writes the set of grouped classes it emitted to `styled-system/css/groups.mjs`, refreshed after every
    extraction — including `--watch`, which reaches CSS emission through a path of its own. `codegen` seeds an empty one
    when the file is missing, so the import resolves on a fresh project, and leaves a populated one alone rather than
    blanking it.
  - The generated `css()` consults it. A class in the set is returned alone, as before. A class that is not keeps the
    group class and **adds** atomic names for each declaration.
  - A call the build flagged as unresolvable now contributes atomic rules as well as its group, so those names have
    somewhere to land. Gated on the call actually being at risk, so the duplication is bounded by unresolvable call
    sites rather than by stylesheet size.

  Adding to the group class rather than replacing it is what makes a stale registry harmless: it lags the stylesheet as
  a matter of when files land, and replacing would turn every lag into an element stripped of styles it really had. A
  wrong miss now costs one class that matches nothing. Only a false _hit_ can hurt, which is why the registry is an
  exact set and not a probabilistic one.

  A value the build never saw still has no rule under any mode — the same limit `atomic` has. What changes is that the
  declarations it _did_ resolve now apply.

- 645bb09: Warn, with a file and line, when a `css()` call under `cssMode: 'grouped'` contains a value the build cannot
  resolve.

  Under `grouped` one class names the whole call, so a property the build cannot see does not merely go missing — it
  changes the class, and the element renders with **no** styles at all. Until now that happened silently: the build
  emitted a rule, the runtime returned a different class, and nothing said so.

  Two shapes are detected, because one of them leaves no trace in the extracted styles:
  - a value boxed as unresolvable, or a template literal with an interpolation
  - a property whose value could not be evaluated at all — `css({ color: getColor() })`. The extractor records no pair
    for it, so the key vanishes from the box entirely; it is recovered by reading the call's object literal back and
    comparing.

  Shapes that cannot be read confidently — a spread, a computed key, a multi-argument call — are declined rather than
  guessed at, so the warning does not fire on styles that are fine.

  A warning, not an error: the build is not wrong and the same call is perfectly valid under `cssMode: 'atomic'`, which
  loses one declaration and keeps the rest. Nothing is reported under `atomic` for that reason.

- 645bb09: Fail the build when the stylesheet and the runtime would disagree on class names.

  A class name is derived twice — once by `StyleDecoder` on the way into the stylesheet, and once by `css()` in the
  browser — and the two only ever meet in the DOM. When they disagree there is no error and no warning: the rule is
  emitted, the class is returned, and every element carrying it renders with no styles at all. That is how
  `cssMode: 'grouped'` combined with `hash: true` shipped broken.

  `checkNamingAgreement` now runs once per build, against the config actually being built. It sends a canary style
  object through both paths and compares the class names, raising `ERR_BAMBOO_NAMING_DISAGREEMENT` with both sets when
  they differ.

  Running it against the real config matters because the naming inputs are open-ended: the `utility:created` hook can
  replace `toHash` outright, and `separator`, `prefix` and custom utilities all feed the same derivation. A test can
  only pin the combinations it enumerates.

  The check runs on cloned encoder and decoder, so the canary never reaches the stylesheet being emitted.

- 645bb09: Warn when `staticCss.css` is configured alongside `cssMode: 'grouped'`.

  `staticCss` is documented as the escape hatch for values the build cannot see — pre-generate `color: ['red.300']` and
  a runtime `color` prop holding `red.300` finds a rule waiting. That does not hold under `grouped`, and cannot be made
  to: `staticCss` enumerates atoms, one rule per property, value and condition, while a grouped class names a whole
  `css()` call. Backing an arbitrary call site would mean pre-generating every combination of properties it might
  contain rather than every value it might hold.

  The rules are still emitted and are still valid classes to write by hand, so nothing is removed. But no class a
  grouped runtime returns will match one, and the pairing previously produced CSS that looked like a working escape
  hatch and silently was not.

  Documented in the `cssMode` limitations and in the dynamic styling guide.

- Updated dependencies [bb6d999]
- Updated dependencies [1be9171]
- Updated dependencies [ca558fb]
- Updated dependencies [bb6d999]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [41ea189]
- Updated dependencies [d652ed9]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [6fb235d]
- Updated dependencies [091f2e1]
- Updated dependencies [f2d5df2]
- Updated dependencies [1dbeb84]
- Updated dependencies [d7226f0]
- Updated dependencies [31d8577]
- Updated dependencies [99ab42f]
- Updated dependencies [2ab7f19]
- Updated dependencies [6fb235d]
- Updated dependencies [ca558fb]
  - @bamboocss/parser@1.16.0
  - @bamboocss/generator@1.16.0
  - @bamboocss/core@1.16.0
  - @bamboocss/shared@1.16.0
  - @bamboocss/types@1.16.0
  - @bamboocss/config@1.16.0
  - @bamboocss/reporter@1.16.0
  - @bamboocss/token-dictionary@1.16.0
  - @bamboocss/logger@1.16.0
  - @bamboocss/plugin-lightningcss@1.16.0
  - @bamboocss/plugin-svelte@1.16.0
  - @bamboocss/plugin-vue@1.16.0

## 1.15.0

### Patch Changes

- Updated dependencies [3014989]
  - @bamboocss/generator@1.15.0
  - @bamboocss/parser@1.15.0
  - @bamboocss/shared@1.15.0
  - @bamboocss/types@1.15.0
  - @bamboocss/core@1.15.0
  - @bamboocss/reporter@1.15.0
  - @bamboocss/config@1.15.0
  - @bamboocss/token-dictionary@1.15.0
  - @bamboocss/logger@1.15.0
  - @bamboocss/plugin-lightningcss@1.15.0
  - @bamboocss/plugin-svelte@1.15.0
  - @bamboocss/plugin-vue@1.15.0

## 1.14.0

### Minor Changes

- b567114: Drop `@bamboocss/studio` and `@bamboocss/astro-plugin-studio`.

  Studio was the visual token browser inherited from Panda — an Astro site that read your config and rendered your
  colors, typography and spacing. It is no longer maintained, and both packages are removed from the repository. The
  versions already on npm stay there and keep working; they will not receive further releases.

  **`bamboo studio` is gone.** Its own flags — `--build`, `--preview`, `--port`, `--host`, `--outdir` and `--base` —
  have no replacement. If you have it in a `package.json` script, remove the script.

  **`config.studio` is gone**, along with the `StudioOptions` type. Leaving `studio: { logo, outdir, inject }` in a
  config is now a TypeScript error rather than a silent no-op, so delete it — a plain-JS config will keep ignoring it.
  `Context.studio` is removed from `@bamboocss/core`, and the `MISSING_STUDIO` error code from `@bamboocss/shared`'s
  `BambooErrorCode` union.

  The studio output directory is no longer written to `.gitignore` by `bamboo init`. Existing `.gitignore` files keep
  their `styled-system-studio` line until you remove it, which is harmless — nothing writes there anymore.

  For documenting a design system, [spec files](/docs/theming/spec) generate a machine-readable description of your
  tokens, recipes and patterns that you can render however you like, and the [MCP server](/docs/ai/mcp-server) exposes
  the same information to AI tooling.

### Patch Changes

- Updated dependencies [7cc6235]
- Updated dependencies [b567114]
- Updated dependencies [3264da1]
- Updated dependencies [d1d05fc]
- Updated dependencies [42fab68]
- Updated dependencies [7f87699]
- Updated dependencies [1f5d4fb]
- Updated dependencies [4a7d40c]
- Updated dependencies [f2d7565]
- Updated dependencies [faffa8e]
- Updated dependencies [745727b]
  - @bamboocss/generator@1.14.0
  - @bamboocss/types@1.14.0
  - @bamboocss/core@1.14.0
  - @bamboocss/shared@1.14.0
  - @bamboocss/parser@1.14.0
  - @bamboocss/reporter@1.14.0
  - @bamboocss/config@1.14.0
  - @bamboocss/logger@1.14.0
  - @bamboocss/plugin-lightningcss@1.14.0
  - @bamboocss/plugin-svelte@1.14.0
  - @bamboocss/plugin-vue@1.14.0
  - @bamboocss/token-dictionary@1.14.0

## 1.13.2

### Patch Changes

- Updated dependencies [79c9872]
- Updated dependencies [61fe88c]
- Updated dependencies [ba60cf5]
- Updated dependencies [be3764d]
- Updated dependencies [7a63215]
- Updated dependencies [2130606]
  - @bamboocss/shared@1.13.2
  - @bamboocss/generator@1.13.2
  - @bamboocss/config@1.13.2
  - @bamboocss/core@1.13.2
  - @bamboocss/parser@1.13.2
  - @bamboocss/reporter@1.13.2
  - @bamboocss/token-dictionary@1.13.2
  - @bamboocss/types@1.13.2
  - @bamboocss/logger@1.13.2
  - @bamboocss/plugin-lightningcss@1.13.2
  - @bamboocss/plugin-svelte@1.13.2
  - @bamboocss/plugin-vue@1.13.2

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
