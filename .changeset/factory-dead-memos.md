---
'@bamboocss/generator': patch
---

Drop two `useMemo` calls from the React and Preact factories that could never hit.

`restProps` comes from rest destructuring, so it is a fresh object on every render and the dependency on it never
matches — even when React hands back the identical props object. The second memo depends on the first's output and
misses for the same reason. Every element that is not folded away paid for two hook slots, two dependency arrays and two
retained memo cells to recompute both values anyway.

Measured at ~3% faster on an unfolded tree of factory elements, and ~7% on the hooks in isolation.

Solid and Vue are untouched: their `createMemo`/`computed` track reactive sources rather than a dependency array, and do
cache.
