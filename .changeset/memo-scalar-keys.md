---
'@bamboocss/shared': patch
'@bamboocss/generator': patch
---

Key scalar arguments by value in the generated runtime's memo.

Every non-object argument hashed to the same constant, so distinct strings shared one bucket and competed for its fixed
number of slots. Past that count the hit rate fell to zero and each call also paid a scan of the bucket and a fresh
snapshot of its arguments.

This hit `isCssProperty`, which is called for every prop on every render when `jsx.styleProps` is `'all'` (the default)
and sees hundreds of distinct property names — so the hottest path in the runtime was missing its cache entirely.

Scalars now hash by value, and a call with a single scalar argument is keyed directly, which is the shape of the callers
that run most often.
