---
'@bamboocss/generator': minor
---

**Breaking:** `cx` joins class names in every build. It no longer resolves conflicts between them.

It used to, when the class names happened to carry a property to compare — atomic mode with `hash.className` off. In any
other build it silently concatenated instead. `hash` is commonly wired to a minification flag, so the same source
resolved overrides while you developed and stopped when you shipped, with nothing raised at build time either way.

The two could not be reconciled by teaching the matcher to read hashed names. `cssMode: 'grouped'` names a _whole_
`css()` call with one class, so there is no single property behind it to compare, whatever the naming scheme. While
grouped exists, some builds can never merge — and a `cx` that merges in the rest is a behavioural difference keyed on a
config flag.

```js
cx(css({ paddingX: '4' }), css({ paddingX: '2' }))
// before, in some builds: 'px_2'
// now, in every build:    'px_4 px_2'
```

Precedence is decided where every build can decide it the same way — by cascade layer:

- **A component you want reliably overridable** needs a lower layer than its consumer, and a **recipe** puts it there.
  `cva()` and `sva()` name their classes from the config and emit them into `recipes`, whether declared inline or in
  `theme.recipes`.
- **Or accept a style object rather than a class name.** `css(base, props.css)` merges per property before any class
  name exists, so it resolves the same way in every build and needs no layer.
- **Two `css()` calls you own** are in the same layer, so merge the objects instead: `css(a, b)`.

The case to check when upgrading is a component that styles itself with bare `css()` _and_ accepts a `className`. Both
classes are in `utilities`, so the winner is now stylesheet order rather than argument order. Moving those styles to
`cva` makes the override deterministic again.

Two things this also fixes. A hand-written class shaped like a utility — `top_bar`, or anything
`<utility><separator><value>` — is no longer dropped, since nothing is matching on shape any more. And the merge matcher
is gone from the runtime, which shipped a list of every registered utility to the browser to do its work.
