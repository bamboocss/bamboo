---
'@bamboocss/core': patch
---

**Fix:** a recipe variant whose value looks like a number to `Number()` emitted no rule at all.

```ts
cva({ className: 'rt', variants: { size: { '1.0': { padding: '1' }, sm: { padding: '4' } } } })
// before: only `.rt--size_sm` existed; the runtime still returned `rt--size_1.0`
```

A variant value is a _key_ of the `variants` object, so it is a string by construction, and the propKey it is stored
under keeps it as written. The decoder reinterpreted it with `parseValue` on the way back out — which coerces anything
`Number()` accepts — so `'1.0'`, `'1e3'` and `'0x10'` returned as `1`, `1000` and `16`, the lookup missed, and the rule
was dropped. Nothing was reported; the element simply carried a class no rule existed for.

Canonical numerics (`0`, `1`, `01`) and booleans round-tripped, which is why this held together at all. They are
unaffected.
