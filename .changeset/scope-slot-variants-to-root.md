---
'@bamboocss/generator': minor
'@bamboocss/core': minor
---

**Breaking:** scope a slot recipe's variants to its root, so every other slot is static.

A slot recipe that declares a slot named `root` now emits its non-root slots' variant styles as rules scoped by the
class the root already carries, instead of as classes each slot has to be given:

```css
/* before — the control had to be told which size it is */
.checkbox__control--size_md {
  width: 10;
}

/* after — the root already says so */
@scope (.checkbox__root--size_md) to (.checkbox__root) {
  .checkbox__control {
    width: 10;
  }
}
```

Nothing has to reach a slot at runtime, so a compound component needs no context, no provider and no wrapper per slot —
which is what made `createStyleContext` necessary and is the reason it could be removed.

```js
checkbox.root({ size: 'md' }) // 'checkbox__root checkbox__root--size_md'  — only the root takes variants
checkbox.control //              'checkbox__control'                       — a property, not a call

checkbox({ size: 'md' }) // still returns the whole record
```

`to (.checkbox__root)` bounds the scope at the next nested instance, so an outer `size="md"` does not style the control
of a checkbox nested inside it. Without it both rules would match at equal specificity and the winner would be
stylesheet order rather than proximity.

Two things this relies on, both now under test:

- The root carries a class for **every** variant any slot references, including one that writes no root styles at all —
  it is the selector the scope opens on. A test asserts the prelude the build emits is exactly the class the runtime
  puts on the root, because the two are derived independently and only meet in the browser.
- Precedence is unchanged. The scoped selector is more specific, but specificity never crosses a cascade layer: a
  consumer's `css()` output is in `utilities` and still beats anything in `recipes`.

Also new: `recipe.slotsAffectedBy` — which slots each variant writes styles for. A **portal** renders outside the root's
subtree, so DOM ancestry breaks and CSS cannot reach it; that case still needs the variant delivered by hand, and this
says which slots it has to reach rather than leaving the component layer to guess.

A recipe whose slots are siblings, with no slot named `root`, has no ancestor to scope by. Those are unchanged: a
variant class per slot, every slot callable.
