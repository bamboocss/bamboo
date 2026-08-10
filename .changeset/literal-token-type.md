---
'@bamboocss/generator': minor
---

Type `token.value()` to the tokens that actually have a literal.

Not every token has one. A virtual or conditional token resolves to its `var()` because there is no single value to hand
back, and a negative token to `calc(var(--spacing-4) * -1)` because it has no declaration of its own. `token.value()`
returned those references — truthful, and useless to the caller who reached for it precisely because a css variable will
not resolve where they are: a canvas fill, a charting library, arithmetic on the number.

The parameter is now a generated `LiteralToken` union, so asking for a literal that cannot exist is a type error rather
than a reference handed to a canvas. On the default preset that is 432 of 480 tokens.

The rule is read off the emitted value rather than re-derived, so the type cannot drift from what the runtime returns:
anything the browser still has to compute — `var()`, `env()`, `attr()` — is not a literal.

The generated token spec no longer offers a `token.value()` example for a token the type rejects.
