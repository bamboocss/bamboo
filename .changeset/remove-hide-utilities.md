---
'@bamboocss/preset-base': minor
---

Remove the `hideFrom` and `hideBelow` utilities, leaving the breakpoint conditions as the one way to hide by width.

Both set `display: none` inside a media query the conditions already express, so the migration is the declaration
itself:

```ts
css({ md: { display: 'none' } }) //     was css({ hideFrom: 'md' })
css({ mdDown: { display: 'none' } }) // was css({ hideBelow: 'md' })
```

The emitted media queries are unchanged — `(width >= 48rem)` and `(width < 48rem)` — only the class name differs, and
`packages/core/__tests__/atomic-rule.test.ts` now asserts the condition form against the queries the utilities used to
produce.

A width no breakpoint names was the one thing the utilities took that a condition does not, and an arbitrary at-rule
covers it:

```ts
css({ '@media (width < 800px)': { display: 'none' } })
```

That case is also why they are worth removing rather than keeping as sugar: the two spellings had already drifted apart
there. `hideBelow` resolved a raw value to an inclusive `max-width` and a breakpoint token to an exclusive range, so
`hideBelow="800px"` and an `800px` breakpoint disagreed at exactly 800px. One spelling cannot disagree with itself.
