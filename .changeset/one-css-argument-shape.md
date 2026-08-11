---
'@bamboocss/generator': minor
'@bamboocss/shared': minor
'@bamboocss/parser': minor
---

Remove the array argument from `css()` and `css.raw()`, leaving one way to pass a list of styles.

`css([a, b])` meant `css(a, b)` — the runtime flattened one level before merging. Spread instead, which is what you
already write when the operands are named:

```ts
css(...styles) // was css(styles)
css(a, b) //      was css([a, b])
```

The declared type also carried the single-object overload twice, verbatim, so the emitted `styled-system/css/css.d.ts`
advertised four signatures where the variadic one covers every call. It is now one:

```ts
(...styles: Styles[]): string
```

An array argument throws rather than being ignored, at build time where the file is known and at runtime otherwise. That
matters more than it sounds: an array and a style object disagree about what indices mean. The parser flattened one
before encoding precisely because hashing it instead read `[{ color }, { padding }]` as a responsive array and emitted
the padding at the `sm` breakpoint — and merely dropping the flatten would have returned no class at all, silently.

Removing it also takes the `flat()` out of every merge and the `some(Array.isArray)` scan out of every extracted `css()`
call, both of which every call paid to serve a shape that was never documented.
