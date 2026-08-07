---
'@bamboocss/dev': patch
---

Document the browser floor `@scope` introduces, and drop the last `styled-system/jsx` reference from the docs.

Scoping a slot recipe's variants to its root emits `@scope`, which is newer than everything else Bamboo relies on. The
browser support page now says so, with the raised floor (Chrome/Edge 118, Firefox 128, Safari/iOS 17.4, Opera 104) kept
separate from the baseline — a project with no slot recipes, or none declaring a `root` slot, never emits one and is
unaffected.

It also says there is no polyfill and why: `@scope` picks between two matching rules by DOM proximity, which is the
whole reason it is there and is not something a build step can compute. The way out is documented instead — slots that
are not named `root` fall back to a variant class per slot.

Three stale references are gone with it: the `./jsx` entry in the component library guide's `exports` example, the
patterns page still describing patterns as usable "as functions or JSX elements", and a link from the slot recipes page
to Park UI's `create-style-context.tsx` — which is built on `styled(Component, {}, { shouldForwardProp })` and so cannot
compile against a Bamboo with no JSX factory.
