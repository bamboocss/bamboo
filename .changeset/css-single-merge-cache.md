---
'@bamboocss/generator': patch
'@bamboocss/shared': patch
---

Stop `css()` paying for a second cache keyed on the arguments it just hashed.

The generated runtime was `css = memo((...styles) => cssFn(mergeCss(...styles)))`, and `mergeCss` is itself memoized on
its argument list. So a `css()` call consulted two caches keyed on the same thing — and the second one could never
answer. Reaching the merge at all means the outer cache missed, and a miss means those exact arguments have not been
seen, so the inner lookup is _guaranteed_ to miss too. The redundancy is structural, not a matter of hit rate.

Measured over 25,000 `css()` calls across four distinct styles, the inner memo served **zero** hits while paying a hash,
a bucket scan, a snapshot and an insert on each of the four misses. Driven directly with no memo above it, the same
function hit 24,996 times — which is why it stays memoized for the callers that reach it that way.

`createMergeCss` now also returns `mergeCssUncached`, the same merge without the cache, and the generated `css` calls
that instead. `css.raw`, `cva` and the Vite fold's runtime keep the memoized one: none of them sits behind a memo keyed
on the same arguments, so for them the cache is doing real work.

The win is on the miss path, which is where dynamic styles and SSR live. Cached calls are unchanged:

| bench                            | before  | after   |              |
| -------------------------------- | ------- | ------- | ------------ |
| high-cardinality `css()`         | 26.48ms | 19.73ms | −25.5%       |
| high-cardinality grouped `css()` | 28.23ms | 21.53ms | −23.7%       |
| inline `css()` (cached)          | 0.724ms | 0.689ms | −4.8%, noise |
| multi-arg `css(a, b)` (cached)   | 0.758ms | 0.767ms | +1.2%, noise |
| `stack()` pattern (cached)       | 4.223ms | 4.246ms | +0.5%, noise |

Per 10k iterations, interleaved new/old/new, controls read in every run.

Locked down by counting rather than timing, per the note in `CLAUDE.md`: an enumerable getter on the style object is
read once per pass over the arguments, so `packages/shared/__tests__/memo.test.ts` now asserts a miss costs four reads
(hash, snapshot, and the merge itself) rather than six. Reintroducing the inner memo fails that test with
`expected 6 to be 4`.
