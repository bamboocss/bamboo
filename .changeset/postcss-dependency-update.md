---
'@bamboocss/core': minor
'@bamboocss/generator': patch
'@bamboocss/node': patch
'@bamboocss/postcss': patch
'@bamboocss/plugin-lightningcss': patch
---

Update the PostCSS toolchain, and fold shared selector prefixes into `:is()` when minifying.

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

The cssnano majors raise their engine floor to `^22.11.0 || ^24.11.0 || >=26.0`. Nothing here declares `engines`, so it
is not enforced at install time, but a build on Node 24.10 or older 24.x runs these plugins outside their supported
range.

**Minified CSS changes**

`postcss-minify-selectors` 8 adds `convertToIs`, which factors a shared prefix or suffix in a selector list into
`:is(...)`. It is on:

```diff
- .checkbox__root--size_lg .checkbox__control,.checkbox__root--size_md .checkbox__control { width: 10px }
+ :is(.checkbox__root--size_lg,.checkbox__root--size_md) .checkbox__control { width: 10px }
```

This reaches slot recipe variants and any condition-prefixed rules that `merge-rules` combined, which is where repeated
selector structure accumulates. Class names and hashes are unchanged, and `:is()` takes the highest specificity of its
arguments, so the folded rule matches and ranks exactly as the list did. Unminified output is untouched.

**The browser baseline is now fixed, and `@scope` sets it**

Upstream gates the fold on `caniuse-api`, and resolves the target it asks about from `process.cwd()` — the consuming
project, not `config.browserslist`. Two things follow, and both break the guarantee that a given input compiles to one
stylesheet: output would depend on where the build ran, and it would flip on its own as `caniuse-lite` refreshed. So the
baseline is passed explicitly and no longer consults the ambient config.

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
`:is()`" changed emitted CSS without a snapshot moving. `packages/core/__tests__/optimize-minify.test.ts` now locks the
minified output, and asserts it is unchanged under a hostile ambient `BROWSERSLIST`.
