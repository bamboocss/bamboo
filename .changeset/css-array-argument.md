---
'@bamboocss/parser': patch
---

Fix `css([a, b])` emitting the second object at the `sm` breakpoint.

`css()` accepts an array of style objects, and `mergeCss` flattens it before merging. The build hashed the array itself,
so `walkObject` read its indices as a responsive array: `css([{ color: 'red' }, { padding: '2' }])` emitted `padding`
inside a `min-width` media query while the runtime asked for an unconditional class. Under `cssMode: 'atomic'` the
padding silently went missing; under `grouped` the whole call did.

The array is flattened before hashing now, in both modes, so the build encodes the operands the runtime merges.
