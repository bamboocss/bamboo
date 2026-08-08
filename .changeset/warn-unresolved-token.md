---
'@bamboocss/core': patch
---

Warn when a token path resolves to nothing instead of emitting it as a literal.

Every branch of `getPropertyRawValue` ends in `|| value`, so a path that names no token was handed straight through:

```ts
css({ background: 'accent.default' }) // accent.default is not a token
```

```css
background: accent.default; /* parses, so nothing objects — the browser drops it */
```

The build passed, the CSS was valid, and the declaration was discarded at compute time. It surfaced as "this colour
never applied", a long way from the typo that caused it. One project found six of these.

Emitted CSS is unchanged — this reports, it does not rewrite. The message names the value, the property, the token
category, and `[…]` as the escape hatch if the value really is a literal.

**What it does and does not fire on**

A value only qualifies if it is shaped like a path — dot-separated segments, the first starting with a letter and the
rest with a letter or digit. That is what keeps `0.5` and `1.5rem` out of it, and it is checked after a
`value.includes('.')` reject, so most values never reach the regex. Cost measured at 26ns per value over control, across
165,000 values.

Membership in the property's value set decides it, via `getPropertyValues`, which normalises all four shapes of `values`
— a category name, an array, a function, an object. Reading the token category directly would have covered `padding` and
not `margin`, whose values are a function, and that is worse than covering neither: it teaches you the warning can be
trusted. It also cannot use "did the resolver return the value unchanged", because for an array-valued property it
returns the value either way, so every valid `textStyle: 'headline.h1'` would be reported.

Each `fallback(...)` candidate is checked separately. The whole string has parentheses so it is not path-shaped, and
left alone the working candidate hides the broken one permanently — the same silent failure wearing something that makes
it look deliberate.

A property that enumerates no values is left alone: nothing is known, so nothing can be wrong. Each mistake is reported
once, since `transform` runs per condition and one typo would otherwise warn once per breakpoint.
