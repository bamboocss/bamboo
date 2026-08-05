---
'@bamboocss/shared': patch
'@bamboocss/generator': patch
---

Skip the per-leaf string rewrites that have nothing to rewrite.

`sanitize`, `isImportant`, `withoutImportant` and `withoutSpace` run on every style leaf of every `css()` cache miss,
and each one starts with a regex rewrite. For the values that dominate real style objects — `red`, `4px`, `lg` — all
four are no-ops. Each now begins with the cheapest search that can prove there is nothing to do.

- A flat `css()` cache miss: **2474 → 2027 ns** (-18%)
- One with conditions and a responsive value: **3040 → 2808 ns** (-7.6%)
- Class names are unchanged across a 27,000-object corpus covering conditions, responsive arrays, `!important`, and
  values carrying whitespace

The guards are exact rather than approximate, which is the only thing making them safe: `/\s/` is precisely the class
the collapse matched, `trim()` strips precisely that set again, and `/\s*!(important)?/` cannot match a string with no
`!`.

`withoutImportant` and `withoutSpace` now declare `string | T` instead of inferring it. They return a rewritten string,
so inferring `T` would have promised callers back the literal they passed in.
