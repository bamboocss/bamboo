# @bamboocss/plugin-vue

## 1.35.2

### Patch Changes

- @bamboocss/types@1.35.2

## 1.35.1

### Patch Changes

- @bamboocss/types@1.35.1

## 1.35.0

### Patch Changes

- Updated dependencies [9bfcf31]
  - @bamboocss/types@1.35.0

## 1.34.1

### Patch Changes

- @bamboocss/types@1.34.1

## 1.34.0

### Patch Changes

- Updated dependencies [e66c5f8]
- Updated dependencies [10bf63d]
- Updated dependencies [c49ab36]
- Updated dependencies [c527ea7]
  - @bamboocss/types@1.34.0

## 1.33.0

### Patch Changes

- Updated dependencies [f7bbc14]
  - @bamboocss/types@1.33.0

## 1.32.0

### Patch Changes

- Updated dependencies [b0ed6dc]
- Updated dependencies [8a66bb9]
- Updated dependencies [da792cc]
- Updated dependencies [1cc1860]
- Updated dependencies [c29044f]
- Updated dependencies [f3a8b0d]
- Updated dependencies [c29044f]
  - @bamboocss/types@1.32.0

## 1.31.0

### Patch Changes

- Updated dependencies [8fb87ac]
- Updated dependencies [8fb87ac]
- Updated dependencies [cd5954c]
- Updated dependencies [678bdee]
- Updated dependencies [774048b]
  - @bamboocss/types@1.31.0

## 1.30.1

### Patch Changes

- @bamboocss/types@1.30.1

## 1.30.0

### Patch Changes

- Updated dependencies
  - @bamboocss/types@1.30.0

## 1.29.0

### Patch Changes

- Updated dependencies [0dbe9c4]
- Updated dependencies [6114f6e]
- Updated dependencies [38393c4]
  - @bamboocss/types@1.29.0

## 1.28.1

### Patch Changes

- Updated dependencies [31749e1]
- Updated dependencies [be39dac]
  - @bamboocss/types@1.28.1

## 1.28.0

### Patch Changes

- Updated dependencies [d7fc408]
  - @bamboocss/types@1.28.0

## 1.27.0

### Patch Changes

- @bamboocss/types@1.27.0

## 1.26.0

### Patch Changes

- @bamboocss/types@1.26.0

## 1.25.0

### Patch Changes

- @bamboocss/types@1.25.0

## 1.24.0

### Patch Changes

- @bamboocss/types@1.24.0

## 1.23.0

### Patch Changes

- Updated dependencies [b041398]
  - @bamboocss/types@1.23.0

## 1.22.0

### Patch Changes

- Updated dependencies [fe62614]
- Updated dependencies [41d9052]
- Updated dependencies [a1062c9]
  - @bamboocss/types@1.22.0

## 1.21.0

### Patch Changes

- @bamboocss/types@1.21.0

## 1.20.4

### Patch Changes

- @bamboocss/types@1.20.4

## 1.20.3

### Patch Changes

- @bamboocss/types@1.20.3

## 1.20.2

### Patch Changes

- @bamboocss/types@1.20.2

## 1.20.1

### Patch Changes

- @bamboocss/types@1.20.1

## 1.20.0

### Patch Changes

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

- Updated dependencies [5d2c91c]
  - @bamboocss/types@1.20.0

## 1.19.0

### Patch Changes

- @bamboocss/types@1.19.0

## 1.18.0

### Patch Changes

- @bamboocss/types@1.18.0

## 1.17.3

### Patch Changes

- @bamboocss/types@1.17.3

## 1.17.2

### Patch Changes

- @bamboocss/types@1.17.2

## 1.17.1

### Patch Changes

- @bamboocss/types@1.17.1

## 1.17.0

### Patch Changes

- Updated dependencies [355e573]
  - @bamboocss/types@1.17.0

## 1.16.1

### Patch Changes

- @bamboocss/types@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [091f2e1]
- Updated dependencies [f2d5df2]
- Updated dependencies [1dbeb84]
- Updated dependencies [d7226f0]
- Updated dependencies [31d8577]
- Updated dependencies [2ab7f19]
- Updated dependencies [ca558fb]
  - @bamboocss/types@1.16.0

## 1.15.0

### Patch Changes

- Updated dependencies [3014989]
  - @bamboocss/types@1.15.0

## 1.14.0

### Patch Changes

- Updated dependencies [b567114]
  - @bamboocss/types@1.14.0

## 1.13.2

### Patch Changes

- @bamboocss/types@1.13.2

## 1.13.1

### Patch Changes

- @bamboocss/types@1.13.1

## 1.13.0

### Patch Changes

- Updated dependencies [a07286f]
- Updated dependencies [a5cb5a8]
  - @bamboocss/types@1.13.0

## 1.12.3

### Patch Changes

- @bamboocss/types@1.12.3

## 1.12.2

### Patch Changes

- @bamboocss/types@1.12.2

## 1.12.1

### Patch Changes

- @bamboocss/types@1.12.1

## 1.12.0

### Patch Changes

- @bamboocss/types@1.12.0

## 1.11.5

### Patch Changes

- @bamboocss/types@1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit
- Updated dependencies
  - @bamboocss/types@1.11.4

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output
- Updated dependencies
  - @bamboocss/types@1.11.3

## 1.11.2

### Patch Changes

- 0f49103: migrate build to tsdown
- migrate to tsdown
- Updated dependencies [0f49103]
- Updated dependencies
  - @bamboocss/types@1.11.2

## 1.11.1

### Patch Changes

- Updated dependencies [2ea9205]
  - @bamboocss/types@1.11.1

## 1.11.0

### Patch Changes

- Updated dependencies [78869ae]
  - @bamboocss/types@1.11.0

## 1.10.0

### Minor Changes

- bbaa8b3: - Extract Vue, Svelte, and LightningCSS support into standalone plugins.
  - Fix double CSS optimization in PostCSS plugin.

### Patch Changes

- Updated dependencies [c31f3a2]
- Updated dependencies [bbaa8b3]
- Updated dependencies [8d3b6f8]
- Updated dependencies [44457bb]
  - @bamboocss/types@1.10.0
