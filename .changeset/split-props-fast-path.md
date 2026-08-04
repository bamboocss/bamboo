---
'@bamboocss/shared': patch
---

Make `splitProps` faster by reading each key's descriptor instead of building one for the whole object, and by answering
key membership from the own-keys list rather than by asking the object per key.

Roughly 2.4–2.9x on plain and frozen props, 1.2x on accessor props, and about even on the proxy Solid's `mergeProps`
hands over — the shapes that carry something to preserve keep the descriptor path and most of its cost.

It called `Object.getOwnPropertyDescriptors` up front and `Object.defineProperty` for every key it moved. That is paid
once per element per render, and the descriptor path is only needed for keys that have something to preserve.

An accessor still stays an accessor — Solid compiles props to accessors, and reading one during a split would build a
component's children before their provider exists — a non-enumerable key stays non-enumerable, and `__proto__` is
defined rather than assigned so it stays an own property.

One thing does change: a key taken from frozen props — React freezes them in development — arrives writable, because
`writable`/`configurable` are carried over only on the descriptor path. Assigning to a split bucket used to throw in
strict mode and now succeeds. Nothing in the framework mutates one.

Two long-standing bugs go with it: a group naming `toString`, `constructor` or another `Object.prototype` member used to
be handed one and put `undefined` in its bucket, and that spurious key also reached the rest bucket.
