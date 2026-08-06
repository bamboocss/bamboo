---
'@bamboocss/generator': patch
---

Stop `cva` merging against an empty compound-variant result.

`resolve` ended in `mergeCss(variantCss, compoundVariantCss)` unconditionally. `mergeCss` is memoized on its arguments,
so that call hashes the whole accumulated style object before discovering the second operand is empty — which it is for
every recipe that declares no compound variants, and most declare none. Slot recipes get it too, since `sva` builds one
`cva` per slot.

Measured on the `cva` bench, both forms built in the same process so the pair shares a warm-up and a machine:

| `raw()`, no compound variants | hz        | mean    | rme    |
| ----------------------------- | --------- | ------- | ------ |
| all-miss, short-circuited     | **59.19** | 16.89ms | ±1.25% |
| all-miss, merging against {}  | 42.31     | 23.64ms | ±1.03% |
| warm, short-circuited         | 380.69    | 2.63ms  | ±0.48% |
| warm, merging against {}      | 384.54    | 2.60ms  | ±0.37% |

**+40% on the miss path, neutral warm** — warm returns from the memo without reaching `resolve` at all, which is also
why this shows up as a cold-start and first-render cost rather than a steady-state one. The untouched `raw() all-miss`
control moved 0.7% between the two runs.

The bench previously mirrored the artifact with a compound variant present, so it never exercised this path; it now
carries the compound-free recipe in both forms. `cva-resolve-work.test.ts` counts `mergeCss` calls rather than timing
them, so the saving is pinned in CI where a wall-clock threshold could not be.

No CSS output changes. `resolve` returns what the merge returned in every shape asserted against it, with one exception
worth naming: a recipe whose `base` defines _nothing_ (every value `undefined`) and has no active variant now resolves
to `{ color: undefined }` rather than `{}`, because `compactStyles` used to drop a style object with no defined value in
it. Both produce no class, so nothing downstream can tell; the difference is only reachable by spreading `raw()` over
another object, where the `undefined` key would shadow what it lands on.
