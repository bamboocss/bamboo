---
'@bamboocss/plugin-lightningcss': patch
'@bamboocss/plugin-vue': patch
'@bamboocss/extractor': patch
'@bamboocss/token-dictionary': patch
'@bamboocss/node': patch
---

Update the runtime dependencies that decide how the framework behaves. Emitted CSS is unchanged — Lightning CSS 1.33
produces the sandbox stylesheet byte for byte as 1.31 did.

| package              |   from |     to | reaches                   |
| -------------------- | -----: | -----: | ------------------------- |
| `lightningcss`       | 1.31.1 | 1.33.0 | CSS output when enabled   |
| `ts-evaluator`       |  1.2.0 |  2.0.0 | expression evaluation     |
| `chokidar`           |  4.0.3 |  5.0.0 | watch mode                |
| `@vue/compiler-sfc`  | 3.5.25 | 3.5.41 | Vue SFC extraction        |
| `@vue/compiler-core` | 3.5.25 | 3.5.41 | the types the above emits |
| `picomatch`          |  4.0.4 |  4.0.5 | file matching             |

`@vue/compiler-core` is a dev-only type import in `plugin-vue`, and it was pinned a version behind `compiler-sfc`. That
had been invisible while both were 3.5.25; moving only `compiler-sfc` put two copies of the AST types in the tree and
`BaseElementNode` stopped matching the nodes `parse` actually returns. Both move together from here.

**Three were deliberately left alone**

`magic-string` stays at 0.30.21. 1.x is ESM-only — `"type": "module"`, no `require` export — and `@bamboocss/vite`,
`plugin-vue` and `plugin-svelte` all ship a CJS build that emits `require("magic-string")`. It resolves today and would
not on 1.x, breaking every CJS consumer. Nothing in the suite would notice, since the tests run ESM.

`open-props` stays at 1.7.16. 1.7.23 hardcodes the shadow scale:

```diff
- --shadow-1: 0 1px 2px -1px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 9%))
+ --shadow-1: 0 1px 2px -1px hsl(220 3% 15% / 10%)
```

The `--shadow-color` and `--shadow-strength` indirection is gone, and with it `--shadow-color-@media:dark` and
`--inner-shadow-highlight`. `preset-open-props` reads these values straight out of `open-props/src`, so taking the bump
means shadows stop responding to dark mode. Upstream moved that into separate light and dark files; adopting it is a
port, not a version bump.

`typescript` stays at 6.0.2, which is what `@ts-morph/common@0.29.0` bundles. ts-morph 28 is current, so TypeScript 7
would put the compiler the parser runs on out of step with the one the repo type-checks against.
