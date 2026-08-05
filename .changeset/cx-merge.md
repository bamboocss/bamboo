---
'@bamboocss/generator': minor
---

`cx` now resolves conflicting utility classes instead of concatenating them.

Two atomic classes that set the same property under the same conditions cannot both apply. Concatenating them handed the
decision to whichever rule came later in the stylesheet rather than to the order they were passed, so the common
composition pattern did not reliably work:

```js
cx(css({ paddingX: '4' }), css({ paddingX: '2' }))
// before: 'px_4 px_2' — whichever rule the stylesheet ordered last applied
// now:    'px_2'
```

That is the pattern every generated JSX factory uses (`cx(recipeClasses, props.className)`), so a caller's `className`
now overrides the component's own styles as expected.

Conditions are part of the declaration, so they only merge with each other — `hover:px_4` and `px_4` are unrelated. An
`!important` class is the same declaration as its plain form, so argument order decides between them rather than the
cascade.

## What this changes in your output

**The class strings your components render are different.** Elements carry only the winning class where they previously
carried both, and the winner keeps the position of the class it replaced — so `cx('px_4 c_red', 'c_blue px_2')` is now
`'px_2 c_blue'`. Expect DOM snapshots in consuming test suites to need updating. If you relied on stylesheet order to
pick between two classes on one element, that no longer happens.

## What is and isn't protected

A class is only merged when the property segment matches a utility bamboo actually registered, matched at its longest —
`bd-w` beats `bd`, so `bd-w-4px` and `bd-c-red` stay separate under `separator: '-'`. Recipe class names are excluded
outright, bare and with a `--variant` suffix, so a recipe called `my_btn` is not mistaken for the `my` utility. When a
`prefix` is configured a class must carry it to be eligible at all.

**A hand-written class that is shaped exactly like a utility class is indistinguishable from one and will be merged.**
`top_bar` is what bamboo emits for `css({ top: 'bar' })`, so `cx('top_bar', 'top_0')` keeps only `top_0`. Provenance
cannot be recovered from a class string at runtime, and `tailwind-merge` has the same limitation. If you pass
hand-written classes through a bamboo component, avoid names of the form `<utility><separator><value>` — the risk is
highest under `separator: '-'`, where ordinary kebab-case names like `p-4` or `top-nav` collide.

With `hash.className` enabled a class name carries no property, so `cx` cannot merge and keeps concatenating — compose
with `css(a, b)` instead. The smaller function is emitted in that case.

## Cost

Measured against the previous implementation, both compiled in the same process, on the call shapes generated code
actually emits (every site passes at least two arguments):

|                                | merging             | concatenating         |
| ------------------------------ | ------------------- | --------------------- |
| no `className` passed          | 41.3M ops/s         | 47.4M ops/s           |
| 12 tokens + a 2-token override | 707K ops/s (~1.4µs) | 42.7M ops/s (~0.02µs) |

So a component that renders without a `className` pays ~13%, and one that merges pays about a microsecond. The React
render benchmark cannot resolve that either way — it is dominated by React — so it is not evidence the cost is free,
only that it is small next to a render.

The emitted `cx` grows from ~290 bytes to ~7.5KB raw (~1.5KB min+gzip), most of it the list of utility class names the
matcher checks against. It is imported by the JSX factory, `sva` and `create-style-context`, so it is not tree-shakeable
in a real app.
