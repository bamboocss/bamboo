---
'@bamboocss/shared': patch
'@bamboocss/generator': patch
---

Stop a single `css([...])` or pattern call from deoptimizing every later `css()` call in the process.

`flatHashOrNull` in `memo.ts` hashed an array argument with a marker and then fell through to the same `for...in` loop
it uses for plain objects. That loop and its `obj[k]` read are the hottest sites in the file, and V8 specializes them
against the element kinds they have seen. Once an array reached them the specialization widened and never narrowed again
— and because `memo` is shared by every memoized function in the runtime (`css`, `cva`, the patterns), the cost landed
on all of them, process-wide, permanently, including on instances built afterwards.

Arrays now take the string key instead. Correctness never depended on the fall-through: an array reaching there holds
style objects, so the `typeof v === 'object'` check returned `null` on its first element anyway. Keeping the shape out
of the loop is the whole change.

**What it cost.** Measured on the flat `css()` case, 10k calls per iteration:

```
objects only                             0.80ms
objects and arrays interleaved           7.02ms   <- before
objects only, after an array was seen    6.74ms   <- and it never recovered
```

Any app calling both `css({...})` and `css([...])` — or any pattern, which merges through the same path — was paying
roughly 8x on every call. An app that only ever passed a plain object was unaffected, which is why this survived: the
benchmarks measured that state, and the deoptimizing bench sat next to them in the same file.

**After**, on the same benches (`packages/generator/__tests__/css-fn.bench.ts`, 10k calls per iteration):

| bench                       | before    | after     |
| --------------------------- | --------- | --------- |
| `pattern stack()`           | 4.3141 ms | 0.6533 ms |
| `high-cardinality css()`    | 21.264 ms | 11.361 ms |
| `composed css([a, [b, c]])` | 2.9576 ms | 2.3802 ms |
| `inline css()`              | 0.7336 ms | 0.8250 ms |

Patterns gain the most because they pass arrays through the merge on every call. `inline css()` is unchanged within
noise — it is the case that was already monomorphic.

CSS output is byte-identical; this changes only how the runtime caches. Verified by rebuilding a real project's
stylesheet and diffing against the pre-fix build.

**A benchmark that reported the opposite.** The same deopt is why `css-fn.bench.ts` reported `cssMode: 'grouped'` as
9.4x slower than atomic on the cached path. `grouped inline css()` ran after `composed css([a, [b, c]])` and inherited
the deoptimized runtime; atomic measured after that same bench read 6.72ms too. The two are at parity — 0.85ms against
0.83ms — and the file now warms every argument shape up front so a reintroduced deopt shows up everywhere at once
instead of only after whichever bench first passes an array.
