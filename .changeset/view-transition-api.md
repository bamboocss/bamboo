---
'@bamboocss/generator': minor
'@bamboocss/parser': minor
'@bamboocss/shared': minor
'@bamboocss/types': minor
'@bamboocss/core': minor
---

Add `viewTransition()` to `styled-system/css`.

It styles the [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) and returns
one class for the bag:

```js
import { viewTransition } from '../styled-system/css'

const slide = viewTransition({
  group: { animationDuration: '0.4s' },
  imagePair: { isolation: 'isolate' },
  old: { animationName: 'slide-out' },
  new: { animationName: 'slide-in' },
})
// → 'vt_bxRGKd'
```

```css
.vt_bxRGKd {
  view-transition-class: vt_bxRGKd;
}
::view-transition-group(.vt_bxRGKd) {
  animation-duration: 0.4s;
}
::view-transition-image-pair(.vt_bxRGKd) {
  isolation: isolate;
}
::view-transition-old(.vt_bxRGKd) {
  animation-name: slide-out;
}
::view-transition-new(.vt_bxRGKd) {
  animation-name: slide-in;
}
```

The class carries `view-transition-class`, not `view-transition-name`. A name has to be unique per element, so it cannot
be shared, extracted or deduplicated — you still set that yourself. A class is shared by design, which is what lets one
transition be emitted once and used anywhere.

The four slots — `group`, `imagePair`, `old`, `new` — are ordinary style objects, so tokens, breakpoints and at-rule
conditions resolve inside them. Rules land in the `utilities` layer, so a keyframe or token reached only from a
transition is still seen by `pruneUnusedKeyframes` and `pruneUnusedTokens`.

The class is a hash of the options with object keys sorted, so slot order and property order do not affect it, and keys
that are not slots are ignored. A nullish slot is the same as an absent one, matching what the extractor can see. The
build and the generated runtime call the same function to derive the class, so a call the extractor never saw still
returns the class its CSS was written against.

Aliased (`import { viewTransition as vt }`) and namespaced (`import * as bamboo`) imports are extracted. A project's own
local `viewTransition`, or a recipe or pattern of that name, is left alone. Not extracted or generated for
`template-literal` syntax.

Two limits worth knowing, both documented: one class covers all four slots, so a value that cannot be resolved at build
time costs the whole bag its CSS rather than one declaration; and conditions that lower to a selector (`_hover`,
`_dark`) cannot reach a `::view-transition-*` pseudo-element, so only at-rule conditions apply inside a slot.

No existing CSS output changes — nothing is emitted unless `viewTransition()` is called.
