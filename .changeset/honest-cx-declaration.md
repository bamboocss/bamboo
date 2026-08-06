---
'@bamboocss/generator': patch
---

Stop the generated `cx` from promising a merge the build cannot do.

Merging compares the property each class sets, which it reads off the class name. `hash.className` replaces that name
with an opaque hash, so `cx` was already emitted as a plain concatenation — but the `.d.ts` shipped alongside it still
documented the merge. A project that hashes for production only read the guarantee in its editor, saw `cx` honour it in
development, and lost it in the build. That build now ships a declaration that says so.

`cssMode: 'grouped'` hashes too, and was still getting the merging implementation. It could never match a grouped class,
so the only thing it could still merge was a hand-written class shaped like a utility — which it would drop. Grouped
builds now get the concatenating `cx`, which is also smaller. If you are on `grouped` and pass your own
`<utility><separator><value>`-shaped classes through a component, they now survive, so DOM snapshots may change.
