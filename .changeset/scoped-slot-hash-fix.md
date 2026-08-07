---
'@bamboocss/core': patch
'@bamboocss/generator': patch
---

**Fix:** a scoped slot recipe rendered every non-anchor slot unstyled under `hash: true` or `prefix`.

A scoped slot's class is a constant — that is the point of scoping, since the slot takes no variant props. Constants
never pass through `createCss`, which is where `hash.className` and `prefix` are applied, so the runtime handed back a
raw `checkbox__control` while the stylesheet emitted its rule as `.hEeOkj`. The `@scope` prelude had the same problem:

```css
/* before, with `hash: true` */
.dHwbLC { … }                                          /* base rules hashed */
@scope (.checkbox__root--size_sm) to (.checkbox__root) /* prelude not hashed */
  { .checkbox__control { … } }                         /* selector not hashed */
```

Neither the anchor class nor the slot class existed in the DOM under those names, so the slot lost its base styles _and_
its variant styles. Nothing was reported — it simply rendered unstyled. Both defaults (no `hash`, no `prefix`) were
unaffected, which is why it went unnoticed.

Fixed on both sides: the build stores the scope's class names raw and formats them through `formatSelector`, and the
generated runtime formats a constant slot class through the same prefix-and-hash the rest of a recipe's classes go
through. Inline `sva` had the identical bug and is fixed with it.

`checkNamingAgreement` now covers slot recipes, so this cannot recur silently — it already covered `css()` and inline
`cva`, and a slot recipe's constant half was exactly the gap.
