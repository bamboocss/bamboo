---
'@bamboocss/shared': patch
'@bamboocss/core': patch
---

Fix `cssMode: 'grouped'` combined with `hash: true` rendering every element unstyled.

A grouped class names a whole `css()` call, so the build and the runtime each derive it from the same group id. They
derived it independently, and only the build routed the result through `formatSelector` — which hashes again when
`hash.className` is set. The build emitted `.cYeKWS` while the runtime asked for `bKFMNe`, so every rule in the
stylesheet missed and no element carrying a grouped class had any styles at all.

A group id already digests every declaration in the call, so it is now hashed exactly once. `hash.className` shortens
_utility_ class names, which a grouped class is not.

The derivation moved into a single `groupClassName` helper in `@bamboocss/shared` that both sides call, so the two
cannot name the class differently again — the next naming-relevant option cannot reintroduce this on one side only.

Only `grouped` + `hash` changes. Grouped without hashing, with or without a `prefix`, emits byte-identical CSS:
`formatSelector` reduced to `formatClassName` for an empty condition list, which is exactly what the helper does.
