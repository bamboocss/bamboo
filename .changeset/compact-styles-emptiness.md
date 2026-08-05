---
'@bamboocss/shared': patch
'@bamboocss/generator': patch
---

Answer "is this style object empty" without building the compacted object.

`mergeCss` discards style objects that hold nothing once undefined values are dropped, and it decided that by compacting
the object, taking a key array for the result, and throwing both away. It only ever needed to know whether one defined
value existed.

- The predicate itself: **19x** on a three-key style object, **43x** on a twenty-key one
- A flat `css()` cache miss end to end: **2030 → 1857 ns** (-8.5%); the nested case moves within noise
- Class names are unchanged across a 27,000-object corpus

The predicate is the same one: `Object.keys` enumerates exactly what `compact`'s `Object.entries` did, so own,
enumerable and string-keyed still decide it, and `null` still counts as present where `undefined` does not.
