---
'@bamboocss/generator': minor
'@bamboocss/types': minor
---

Give an inline `sva()` the same surface a config slot recipe has, and add a development-time check for the one scoping
failure nothing can catch at build time.

### `auditSlotScopes`

A scoped slot is styled through an `@scope` rule opened at an anchor, so it has to be rendered inside one. A slot moved
out of every anchor's subtree — through a portal, with no second anchor named in `scopeRoots` — keeps its base styles
and silently loses its variant styles. It renders _nearly_ right, which is harder to notice than a total failure, and no
build step can catch it: whether one element is inside another is a fact about the DOM.

```js
import { auditSlotScopes, select } from '../styled-system/css'

if (process.env.NODE_ENV !== 'production') {
  auditSlotScopes([select], { observe: true })
}
```

```
[bamboo] select: the `item` slot is rendered outside every anchor (root), so its variant
styles cannot reach it. Add the enclosing slot to `scopeRoots`, or deliver the variant to
this slot by hand.
```

Two details that decide whether it is useful or noisy. It matches the anchor's **base** class rather than its variant
class — an anchor always carries the base one, while the variant class is absent whenever no variant is selected, so
matching on that would report slots that are correctly placed and simply unstyled. And `observe: true` re-checks on DOM
mutation, because portaled content mounts after a one-shot sweep would have run, which is exactly the case this exists
to catch.

Keep the call behind a `NODE_ENV` check and your bundler drops it, and the function, from production.

### Inline `sva` was missing documented members

The scoping docs describe `slotsAffectedBy` as the way to find which slots a variant reaches, but only config slot
recipes exposed it — an inline `sva` had no way to answer the question:

- **`slotsAffectedBy`** is now on both.
- **`scopeRoots`** is now on both, reporting the resolved anchors.
- **`classNameMap`** is populated for an inline `sva` whether or not the config sets a `className`. Every slot recipe is
  given a name before the split, so the old guard left an anonymous `sva` reporting no slot classes despite emitting
  them. Config slot recipes returned a literal `{}`; they now return the real map.
- **`SlotRecipeRuntimeFn`** declared none of `config`, `classNameMap`, `slotsAffectedBy` or `scopeRoots`, several of
  which the runtime already returned.
