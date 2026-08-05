---
'@bamboocss/shared': patch
'@bamboocss/generator': patch
---

Call `splitProps` predicates with the key alone.

The predicate was handed straight to `Array.prototype.filter`, which calls it with `(key, index, allKeys)`. A
one-parameter predicate cannot see the extra arguments, but a memoized one reads its whole argument list — and the
predicate the JSX factory passes is `isCssProperty`, which is memoized. So the memo hashed the entire key array once per
prop, and keyed its cache on it: two elements with different prop sets shared no entry even for the same prop name.

Every styled element pays this, once per prop, on every render.

- `splitProps` with a memoized predicate: **6.0x** faster
- A React SSR render of styled elements: **4.18 → 1.15 µs** per element (3.6x)
- The same for elements with a `cva` config: **11.2 → 2.17 µs** per element (5.2x)
- Markup and `splitProps` output are unchanged

Predicates have always been typed `(key: string) => boolean`, so no typed caller could have read the extra arguments.
