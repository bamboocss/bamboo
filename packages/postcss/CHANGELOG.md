# @bamboocss/postcss

## 1.42.0

### Patch Changes

- Updated dependencies [4fcae37]
  - @bamboocss/node@1.42.0
  - @bamboocss/logger@1.42.0

## 1.41.1

### Patch Changes

- @bamboocss/node@1.41.1
- @bamboocss/logger@1.41.1

## 1.41.0

### Patch Changes

- @bamboocss/node@1.41.0
- @bamboocss/logger@1.41.0

## 1.40.1

### Patch Changes

- Updated dependencies [8985e58]
  - @bamboocss/node@1.40.1
  - @bamboocss/logger@1.40.1

## 1.40.0

### Patch Changes

- Updated dependencies [3151b14]
  - @bamboocss/node@1.40.0
  - @bamboocss/logger@1.40.0

## 1.39.1

### Patch Changes

- @bamboocss/node@1.39.1
- @bamboocss/logger@1.39.1

## 1.39.0

### Minor Changes

- 4c66fdb: Say when a Vite project is emitting the stylesheet through PostCSS, which silently ships the style engine.

  `@bamboocss/postcss` emits CSS and nothing else. Under it, `css()` and `cva()` stay runtime calls and the generated
  style engine goes out in the client bundle — where `@bamboocss/vite` compiles those calls to literal class strings and
  ships no engine at all. Nothing about the result distinguishes the two: the stylesheet is correct, the app renders,
  and the engine is the only difference — 20 kB of client JavaScript in one reported app. Bamboo's own React Router
  guide described the PostCSS setup, so projects reached it by following the docs rather than by choosing it.

  Both entry points now say so. `bamboo init --postcss` warns when the directory already has a Vite config, and the
  PostCSS plugin warns once per project when it runs in one — suppressed when a Bamboo source compiler is loaded in the
  same process, so a project that has both installed is not told off for the setup it already has. Pass
  `{ runtimeStyling: true }` to the plugin where resolving styles at runtime is deliberate.

  A Svelte, Vue or Astro project is the exception and is never warned: `@bamboocss/vite` compiles JavaScript and
  TypeScript, and their components are templates it leaves alone — moving one onto it would prune every rule only those
  components reach. The React Router guide now uses `@bamboocss/vite`, and the other Vite-framework guides say which
  integration they are describing.

### Patch Changes

- Updated dependencies [4c66fdb]
  - @bamboocss/node@1.39.0
  - @bamboocss/logger@1.39.0

## 1.38.0

### Patch Changes

- @bamboocss/node@1.38.0

## 1.37.13

### Patch Changes

- @bamboocss/node@1.37.13

## 1.37.12

### Patch Changes

- @bamboocss/node@1.37.12

## 1.37.11

### Patch Changes

- @bamboocss/node@1.37.11

## 1.37.10

### Patch Changes

- @bamboocss/node@1.37.10

## 1.37.9

### Patch Changes

- @bamboocss/node@1.37.9

## 1.37.8

### Patch Changes

- @bamboocss/node@1.37.8

## 1.37.7

### Patch Changes

- @bamboocss/node@1.37.7

## 1.37.6

### Patch Changes

- @bamboocss/node@1.37.6

## 1.37.5

### Patch Changes

- @bamboocss/node@1.37.5

## 1.37.4

### Patch Changes

- @bamboocss/node@1.37.4

## 1.37.3

### Patch Changes

- @bamboocss/node@1.37.3

## 1.37.2

### Patch Changes

- Updated dependencies [35a689c]
  - @bamboocss/node@1.37.2

## 1.37.1

### Patch Changes

- @bamboocss/node@1.37.1

## 1.37.0

### Patch Changes

- @bamboocss/node@1.37.0

## 1.36.5

### Patch Changes

- @bamboocss/node@1.36.5

## 1.36.4

### Patch Changes

- @bamboocss/node@1.36.4

## 1.36.3

### Patch Changes

- @bamboocss/node@1.36.3

## 1.36.2

### Patch Changes

- @bamboocss/node@1.36.2

## 1.36.1

### Patch Changes

- @bamboocss/node@1.36.1

## 1.36.0

### Patch Changes

- @bamboocss/node@1.36.0

## 1.35.5

### Patch Changes

- @bamboocss/node@1.35.5

## 1.35.4

### Patch Changes

- @bamboocss/node@1.35.4

## 1.35.3

### Patch Changes

- @bamboocss/node@1.35.3

## 1.35.2

### Patch Changes

- @bamboocss/node@1.35.2

## 1.35.1

### Patch Changes

- @bamboocss/node@1.35.1

## 1.35.0

### Patch Changes

- Updated dependencies [9bfcf31]
  - @bamboocss/node@1.35.0

## 1.34.1

### Patch Changes

- @bamboocss/node@1.34.1

## 1.34.0

### Patch Changes

- Updated dependencies [c49ab36]
- Updated dependencies [e66c5f8]
- Updated dependencies [c527ea7]
- Updated dependencies [10bf63d]
- Updated dependencies [09d4203]
  - @bamboocss/node@1.34.0

## 1.33.0

### Patch Changes

- Updated dependencies [f7bbc14]
  - @bamboocss/node@1.33.0

## 1.32.0

### Patch Changes

- Updated dependencies [c29044f]
- Updated dependencies [b0ed6dc]
- Updated dependencies [591a0f1]
- Updated dependencies [c29044f]
- Updated dependencies [b2b4173]
  - @bamboocss/node@1.32.0

## 1.31.0

### Patch Changes

- Updated dependencies [8fb87ac]
- Updated dependencies [8fb87ac]
- Updated dependencies [cd5954c]
- Updated dependencies [9fdce28]
  - @bamboocss/node@1.31.0

## 1.30.1

### Patch Changes

- Updated dependencies [2634909]
  - @bamboocss/node@1.30.1

## 1.30.0

### Patch Changes

- Updated dependencies
- Updated dependencies [009294f]
- Updated dependencies [242b24c]
  - @bamboocss/node@1.30.0

## 1.29.0

### Patch Changes

- Updated dependencies [5e6eafe]
- Updated dependencies [a137758]
- Updated dependencies [0dbe9c4]
- Updated dependencies [6114f6e]
- Updated dependencies [38393c4]
  - @bamboocss/node@1.29.0

## 1.28.1

### Patch Changes

- @bamboocss/node@1.28.1

## 1.28.0

### Patch Changes

- @bamboocss/node@1.28.0

## 1.27.0

### Patch Changes

- @bamboocss/node@1.27.0

## 1.26.0

### Patch Changes

- Updated dependencies [5e8814c]
  - @bamboocss/node@1.26.0

## 1.25.0

### Patch Changes

- @bamboocss/node@1.25.0

## 1.24.0

### Patch Changes

- @bamboocss/node@1.24.0

## 1.23.0

### Patch Changes

- @bamboocss/node@1.23.0

## 1.22.0

### Patch Changes

- Updated dependencies [edb97e2]
- Updated dependencies [41d9052]
- Updated dependencies [a1062c9]
- Updated dependencies [43ae8a7]
- Updated dependencies [0e6a4ee]
  - @bamboocss/node@1.22.0

## 1.21.0

### Patch Changes

- @bamboocss/node@1.21.0

## 1.20.4

### Patch Changes

- @bamboocss/node@1.20.4

## 1.20.3

### Patch Changes

- @bamboocss/node@1.20.3

## 1.20.2

### Patch Changes

- Updated dependencies [8a73d2a]
  - @bamboocss/node@1.20.2

## 1.20.1

### Patch Changes

- Updated dependencies [559924f]
  - @bamboocss/node@1.20.1

## 1.20.0

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

- Updated dependencies [6512d6b]
- Updated dependencies [5d2c91c]
- Updated dependencies [0441724]
  - @bamboocss/node@1.20.0

## 1.19.0

### Patch Changes

- @bamboocss/node@1.19.0

## 1.18.0

### Patch Changes

- Updated dependencies [070f9da]
  - @bamboocss/node@1.18.0

## 1.17.3

### Patch Changes

- @bamboocss/node@1.17.3

## 1.17.2

### Patch Changes

- @bamboocss/node@1.17.2

## 1.17.1

### Patch Changes

- @bamboocss/node@1.17.1

## 1.17.0

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
- Updated dependencies [29f9bbe]
- Updated dependencies [7251bf8]
  - @bamboocss/node@1.17.0

## 1.16.1

### Patch Changes

- @bamboocss/node@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [bb6d999]
- Updated dependencies [4877a67]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [f2d5df2]
- Updated dependencies [1dbeb84]
- Updated dependencies [d7226f0]
- Updated dependencies [645bb09]
  - @bamboocss/node@1.16.0

## 1.15.0

### Patch Changes

- @bamboocss/node@1.15.0

## 1.14.0

### Patch Changes

- Updated dependencies [b567114]
  - @bamboocss/node@1.14.0

## 1.13.2

### Patch Changes

- @bamboocss/node@1.13.2

## 1.13.1

### Patch Changes

- @bamboocss/node@1.13.1

## 1.13.0

### Patch Changes

- Updated dependencies [a07286f]
- Updated dependencies [a5cb5a8]
- Updated dependencies [5b16a67]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
  - @bamboocss/node@1.13.0

## 1.12.3

### Patch Changes

- @bamboocss/node@1.12.3

## 1.12.2

### Patch Changes

- @bamboocss/node@1.12.2

## 1.12.1

### Patch Changes

- @bamboocss/node@1.12.1

## 1.12.0

### Patch Changes

- @bamboocss/node@1.12.0

## 1.11.5

### Patch Changes

- @bamboocss/node@1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit
- Updated dependencies
  - @bamboocss/node@1.11.4

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output
- Updated dependencies
  - @bamboocss/node@1.11.3

## 1.11.2

### Patch Changes

- 0f49103: migrate build to tsdown
- 05705ba: add cssMode=grouped
- migrate to tsdown
- Updated dependencies [0f49103]
- Updated dependencies
  - @bamboocss/node@1.11.2

## 1.11.1

### Patch Changes

- 2f29aa6: Bump `postcss` from `8.5.6` to `8.5.14` to address
  [CVE-2026-41305](https://www.cve.org/CVERecord?id=CVE-2026-41305).
- Updated dependencies [2f29aa6]
  - @bamboocss/node@1.11.1

## 1.11.0

### Patch Changes

- @bamboocss/node@1.11.0

## 1.10.0

### Patch Changes

- Updated dependencies [c31f3a2]
- Updated dependencies [bbaa8b3]
- Updated dependencies [22b444d]
- Updated dependencies [bc2b8d7]
- Updated dependencies [44457bb]
  - @bamboocss/node@1.10.0

## 1.9.1

### Patch Changes

- @bamboocss/node@1.9.1

## 1.9.0

### Patch Changes

- @bamboocss/node@1.9.0

## 1.8.2

### Patch Changes

- @bamboocss/node@1.8.2

## 1.8.1

### Patch Changes

- @bamboocss/node@1.8.1

## 1.8.0

### Patch Changes

- @bamboocss/node@1.8.0

## 1.7.3

### Patch Changes

- @bamboocss/node@1.7.3

## 1.7.2

### Patch Changes

- Updated dependencies [af2d06b]
  - @bamboocss/node@1.7.2

## 1.7.1

### Patch Changes

- @bamboocss/node@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [86b30b1]
  - @bamboocss/node@1.7.0

## 1.6.1

### Patch Changes

- @bamboocss/node@1.6.1

## 1.6.0

### Patch Changes

- Updated dependencies [8aa3c64]
  - @bamboocss/node@1.6.0

## 1.5.1

### Patch Changes

- @bamboocss/node@1.5.1

## 1.5.0

### Patch Changes

- @bamboocss/node@1.5.0

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
  - @bamboocss/node@1.4.3

## 1.4.2

### Patch Changes

- @bamboocss/node@1.4.2

## 1.4.1

### Patch Changes

- @bamboocss/node@1.4.1

## 1.4.0

### Patch Changes

- @bamboocss/node@1.4.0

## 1.3.1

### Patch Changes

- @bamboocss/node@1.3.1

## 1.3.0

### Patch Changes

- @bamboocss/node@1.3.0

## 1.2.0

### Patch Changes

- @bamboocss/node@1.2.0

## 1.1.0

### Patch Changes

- @bamboocss/node@1.1.0

## 1.0.1

### Patch Changes

- @bamboocss/node@1.0.1

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
  - @bamboocss/node@1.0.0

## 0.54.0

### Patch Changes

- Updated dependencies [76c4e61]
  - @bamboocss/node@0.54.0

## 0.53.7

### Patch Changes

- @bamboocss/node@0.53.7

## 0.53.6

### Patch Changes

- @bamboocss/node@0.53.6

## 0.53.5

### Patch Changes

- @bamboocss/node@0.53.5

## 0.53.4

### Patch Changes

- @bamboocss/node@0.53.4

## 0.53.3

### Patch Changes

- @bamboocss/node@0.53.3

## 0.53.2

### Patch Changes

- @bamboocss/node@0.53.2

## 0.53.1

### Patch Changes

- Updated dependencies [b67a2a5]
  - @bamboocss/node@0.53.1

## 0.53.0

### Patch Changes

- @bamboocss/node@0.53.0

## 0.52.0

### Patch Changes

- Updated dependencies [2f1165c]
  - @bamboocss/node@0.52.0

## 0.51.1

### Patch Changes

- @bamboocss/node@0.51.1

## 0.51.0

### Patch Changes

- Updated dependencies [d68ad1f]
  - @bamboocss/node@0.51.0

## 0.50.0

### Patch Changes

- Updated dependencies [fea78c7]
  - @bamboocss/node@0.50.0

## 0.49.0

### Patch Changes

- @bamboocss/node@0.49.0

## 0.48.1

### Patch Changes

- Updated dependencies [fd87f3a]
  - @bamboocss/node@0.48.1

## 0.48.0

### Patch Changes

- @bamboocss/node@0.48.0

## 0.47.1

### Patch Changes

- 50fc8ef: fix(postcss): race condition on builder instance for simultaneous plugin invocations
  - @bamboocss/node@0.47.1

## 0.47.0

### Patch Changes

- @bamboocss/node@0.47.0

## 0.46.1

### Patch Changes

- @bamboocss/node@0.46.1

## 0.46.0

### Patch Changes

- @bamboocss/node@0.46.0

## 0.45.2

### Patch Changes

- @bamboocss/node@0.45.2

## 0.45.1

### Patch Changes

- Updated dependencies [26924c7]
  - @bamboocss/node@0.45.1

## 0.45.0

### Patch Changes

- @bamboocss/node@0.45.0

## 0.44.0

### Patch Changes

- @bamboocss/node@0.44.0

## 0.43.0

### Patch Changes

- @bamboocss/node@0.43.0

## 0.42.0

### Patch Changes

- Updated dependencies [19c3a2c]
- Updated dependencies [ec64819]
- Updated dependencies [17a1932]
  - @bamboocss/node@0.42.0

## 0.41.0

### Patch Changes

- @bamboocss/node@0.41.0

## 0.40.1

### Patch Changes

- Updated dependencies [48ff2b8]
  - @bamboocss/node@0.40.1

## 0.40.0

### Patch Changes

- Updated dependencies [5dcdae4]
  - @bamboocss/node@0.40.0

## 0.39.2

### Patch Changes

- Updated dependencies [1f636eb]
- Updated dependencies [af15ae9]
  - @bamboocss/node@0.39.2

## 0.39.1

### Patch Changes

- @bamboocss/node@0.39.1

## 0.39.0

### Patch Changes

- @bamboocss/node@0.39.0

## 0.38.0

### Patch Changes

- Updated dependencies [2c8b933]
  - @bamboocss/node@0.38.0

## 0.37.2

### Patch Changes

- Updated dependencies [84edd38]
  - @bamboocss/node@0.37.2

## 0.37.1

### Patch Changes

- @bamboocss/node@0.37.1

## 0.37.0

### Patch Changes

- @bamboocss/node@0.37.0

## 0.36.1

### Patch Changes

- @bamboocss/node@0.36.1

## 0.36.0

### Patch Changes

- @bamboocss/node@0.36.0

## 0.35.0

### Minor Changes

- 888feae: Add `allow` config option in postcss plugin.

  The plugin won't parse css files in node modules. This config option lets you opt out of that for some paths.

  ```js
  //postcss.config.cjs

  module.exports = {
    plugins: {
      '@bamboocss/dev/postcss': {
        allow: [/node_modules\/.embroider/],
      },
    },
  }
  ```

### Patch Changes

- @bamboocss/node@0.35.0

## 0.34.3

### Patch Changes

- @bamboocss/node@0.34.3

## 0.34.2

### Patch Changes

- @bamboocss/node@0.34.2

## 0.34.1

### Patch Changes

- @bamboocss/node@0.34.1

## 0.34.0

### Patch Changes

- @bamboocss/node@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [1968da5]
  - @bamboocss/node@0.33.0

## 0.32.1

### Patch Changes

- Updated dependencies [89ffb6b]
  - @bamboocss/node@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [de4d9ef]
  - @bamboocss/node@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [f0296249]
- Updated dependencies [2d69b340]
- Updated dependencies [ddeda8ac]
  - @bamboocss/node@0.31.0

## 0.30.2

### Patch Changes

- @bamboocss/node@0.30.2

## 0.30.1

### Patch Changes

- @bamboocss/node@0.30.1

## 0.30.0

### Patch Changes

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

- Updated dependencies [05686b9d]
- Updated dependencies [ab32d1d7]
- Updated dependencies [d5977c24]
  - @bamboocss/node@0.30.0

## 0.29.1

### Patch Changes

- Updated dependencies [a5c75607]
  - @bamboocss/node@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [a2fb5cc6]
  - @bamboocss/node@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [f58f6df2]
- Updated dependencies [f255342f]
  - @bamboocss/node@0.28.0

## 0.27.3

### Patch Changes

- Updated dependencies [1ed4df77]
- Updated dependencies [39d10c79]
  - @bamboocss/node@0.27.3

## 0.27.2

### Patch Changes

- Updated dependencies [bfa8b1ee]
  - @bamboocss/node@0.27.2

## 0.27.1

### Patch Changes

- ee9341db: Fix issue in windows environments where HMR doesn't work in webpack projects.
- Updated dependencies [ee9341db]
  - @bamboocss/node@0.27.1

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

- Updated dependencies [84304901]
  - @bamboocss/node@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/node@0.26.2

## 0.26.1

### Patch Changes

- @bamboocss/node@0.26.1

## 0.26.0

### Patch Changes

- Updated dependencies [1bd7fbb7]
- Updated dependencies [1bd7fbb7]
  - @bamboocss/node@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [bc154358]
  - @bamboocss/node@0.25.0

## 0.24.2

### Patch Changes

- @bamboocss/node@0.24.2

## 0.24.1

### Patch Changes

- Updated dependencies [10e74428]
  - @bamboocss/node@0.24.1

## 0.24.0

### Patch Changes

- Updated dependencies [63b3f1f2]
  - @bamboocss/node@0.24.0

## 0.23.0

### Patch Changes

- Updated dependencies [1ea7459c]
- Updated dependencies [383b6d1b]
- Updated dependencies [840ed66b]
  - @bamboocss/node@0.23.0

## 0.22.1

### Patch Changes

- 0f7793c7: Fix a regression with the @bamboocss/astro integration where the automatically provided `base.css` would be
  ignored by the @bamboocss/postcss plugin
  - @bamboocss/node@0.22.1

## 0.22.0

### Patch Changes

- Updated dependencies [a2f6c2c8]
- Updated dependencies [11753fea]
  - @bamboocss/node@0.22.0

## 0.21.0

### Patch Changes

- Updated dependencies [7f846be2]
  - @bamboocss/node@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/node@0.20.1

## 0.20.0

### Patch Changes

- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change
- Updated dependencies [24ee49a5]
  - @bamboocss/node@0.20.0

## 0.19.0

### Patch Changes

- @bamboocss/node@0.19.0

## 0.18.3

### Patch Changes

- @bamboocss/node@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/node@0.18.2

## 0.18.1

### Patch Changes

- @bamboocss/node@0.18.1

## 0.18.0

### Patch Changes

- Updated dependencies [3010af28]
- Updated dependencies [866c12aa]
  - @bamboocss/node@0.18.0

## 0.17.5

### Patch Changes

- Updated dependencies [17f68b3f]
  - @bamboocss/node@0.17.5

## 0.17.4

### Patch Changes

- @bamboocss/node@0.17.4
- @bamboocss/symlink@0.17.4

## 0.17.3

### Patch Changes

- 128e0b19: Fix an issue with the Postcss builder config change detection, which triggered unnecessary a rebuild of the
  artifacts.
- Updated dependencies [60f2c8a3]
  - @bamboocss/node@0.17.3
  - @bamboocss/symlink@0.17.3

## 0.17.2

### Patch Changes

- 443ac85a: Fix an issue with the CLI, using the dev mode instead of the prod mode even when installed from npm.

  This resolves the following errors:

  ```
   Error: Cannot find module 'resolve.exports'
  ```

  ```
  Error: Cannot find module './src/cli-main'
  ```

- Updated dependencies [443ac85a]
  - @bamboocss/symlink@0.17.2
  - @bamboocss/node@0.17.2

## 0.17.1

### Patch Changes

- 56299cb2: Fix persistent error that causes CI builds to fail due to PostCSS plugin emitting artifacts in the middle of
  a build process.
- Updated dependencies [56299cb2]
- Updated dependencies [ddcaf7b2]
  - @bamboocss/node@0.17.1

## 0.17.0

### Patch Changes

- Updated dependencies [12281ff8]
- Updated dependencies [dd6811b3]
  - @bamboocss/node@0.17.0

## 0.16.0

### Patch Changes

- Updated dependencies [20f4e204]
- Updated dependencies [36252b1d]
  - @bamboocss/node@0.16.0

## 0.15.5

### Patch Changes

- Updated dependencies [909fcbe8]
  - @bamboocss/node@0.15.5

## 0.15.4

### Patch Changes

- @bamboocss/node@0.15.4

## 0.15.3

### Patch Changes

- @bamboocss/node@0.15.3

## 0.15.2

### Patch Changes

- Updated dependencies [f3c30d60]
  - @bamboocss/node@0.15.2

## 0.15.1

### Patch Changes

- @bamboocss/node@0.15.1

## 0.15.0

### Patch Changes

- Updated dependencies [39298609]
  - @bamboocss/node@0.15.0

## 0.14.0

### Patch Changes

- Updated dependencies [8106b411]
  - @bamboocss/node@0.14.0

## 0.13.1

### Patch Changes

- @bamboocss/node@0.13.1

## 0.13.0

### Patch Changes

- @bamboocss/node@0.13.0

## 0.12.2

### Patch Changes

- @bamboocss/node@0.12.2

## 0.12.1

### Patch Changes

- @bamboocss/node@0.12.1

## 0.12.0

### Patch Changes

- @bamboocss/node@0.12.0

## 0.11.1

### Patch Changes

- Updated dependencies [23b516f4]
  - @bamboocss/node@0.11.1

## 0.11.0

### Patch Changes

- Updated dependencies [cde9702e]
  - @bamboocss/node@0.11.0

## 0.10.0

### Patch Changes

- @bamboocss/node@0.10.0

## 0.9.0

### Patch Changes

- f10e706a: Fix PostCSS edge-case where the config file is not in the app root
- Updated dependencies [f10e706a]
  - @bamboocss/node@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [5d1d376b]
- Updated dependencies [be0ad578]
- Updated dependencies [78612d7f]
  - @bamboocss/node@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [f4bb0576]
- Updated dependencies [d8ebaf2f]
- Updated dependencies [4ff7ddea]
  - @bamboocss/node@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [032c152a]
  - @bamboocss/node@0.6.0

## 0.5.1

### Patch Changes

- Updated dependencies [5b09ab3b]
- Updated dependencies [78ed6ed4]
- Updated dependencies [e48b130a]
- Updated dependencies [1a2c0e2b]
  - @bamboocss/node@0.5.1

## 0.5.0

### Patch Changes

- @bamboocss/node@0.5.0

## 0.4.0

### Patch Changes

- @bamboocss/node@0.4.0

## 0.3.2

### Patch Changes

- 24b78f7c: Add support for setting config path in postcss

  ```js
  module.exports = {
    plugins: [
      require('@bamboocss/postcss')({
        configPath: './path/to/bamboo.config.js',
      }),
    ],
  }
  ```

  - @bamboocss/node@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/node@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [b8ab0868]
  - @bamboocss/node@0.3.0
