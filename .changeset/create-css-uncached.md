---
'@bamboocss/shared': minor
'@bamboocss/generator': patch
'@bamboocss/vite': patch
---

Drop the class-name cache under `css()`'s own memo.

`createCss` returned `memo(...)`, so the generated `css()` carried two caches in a row:

```js
css = memo((...styles) => cssFn(mergeCssUncached(...styles)))
```

`cssFn` is reached only when the outer memo missed, and the merged object it receives is a deterministic function of the
same arguments — so the second cache cannot hit. Instrumented over 25k calls it served zero hits in every workload,
including working sets past `MAX_ENTRIES`, where both caches rotate in lockstep rather than one rescuing the other. This
is the same redundancy already removed for the merge, one layer down.

A new `createCssUncached` export carries the uncached form, and `createCss` keeps the cache. That split matters: the
vite fold reaches `createCss` directly with no memo above it, and the merge feeding it is many-to-one there, so it hits
2-35% across real projects — removing its cache outright measured +187% on the fold. The generated `css()` and the
generated recipe runtime both take the uncached form, the latter because it constructs one _inside_ a memoized function,
where the cache is built per call and used once.

Measured on the generated runtime, isolated against the merge change that preceded it:

| shape            | before | after  | delta  |
| ---------------- | ------ | ------ | ------ |
| flat miss        | 1425ns | 1113ns | −21.9% |
| conditional miss | 1956ns | 1601ns | −18.1% |
| realistic miss   | 2706ns | 2371ns | −12.4% |
| hit (control)    | 85ns   | 88ns   | noise  |

Class names are unchanged; the hit path is untouched. `packages/shared/__tests__/memo.test.ts` counts the reads rather
than timing them, so the guard holds on any machine.

`createRuntimeCss` in `@bamboocss/vite` now genuinely mirrors the shape its own comment described — one memo on the
argument list, neither inner cache — which is 37-51% faster on every fold workload measured.
