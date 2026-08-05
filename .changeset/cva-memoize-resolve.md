---
'@bamboocss/generator': patch
---

Memoize the variant resolution behind `cva.raw()`.

Every JSX factory calls `cva.raw()` once per element per render to build the styles it merges with style props, and
resolving them is not cheap: a `mergeCss` per active variant plus a scan of every compound variant. That ran again for
every element, even when a hundred of them shared the same variant props.

- `raw()` on repeated variant props: **7.0x** faster
- A React SSR render of elements with a `cva` config: **2.19 → 1.28 µs** per element (1.7x)
- Markup and class names are unchanged

`raw()` still returns an independent copy — more importantly than before, since the object it copies from is now cached
twice over, by `mergeCss` and by the resolution itself.

The cost is on the other side: when every call carries a distinct variant combination nothing is reusable, and that path
measures ~8% slower. Variant props come from a fixed set, so the reusable case is the normal one — but `cva.bench.ts`
now tracks both, where nothing covered `cva` at all before.

One behavioural note: mutating a `cva` config object after creating the recipe no longer changes what `raw()` returns.
Calling the recipe itself was already memoized, so the two now agree rather than disagreeing.
