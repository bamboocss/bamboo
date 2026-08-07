---
'@bamboocss/parser': minor
'@bamboocss/node': minor
---

Report a `css()` call the build could not fully read under `cssMode: 'atomic'`, not only under `grouped`.

```jsx
css({ ...getFocusRingStyles(), color: 'red' })
// `.c_red` is emitted; the focus ring's declarations are not, and nothing said so
```

The detection was gated on `grouped` because that is where a loss is _fatal_ — one class names the whole call, so
missing part of it costs all of it. Under `atomic` the loss is partial: what the build saw still applies. But it is no
less silent, and a component quietly missing its focus ring is exactly the shape that gets reported as a mystery rather
than as a bug.

Only the surprising half is reported. A spread the build could not read **looks** static and is not, so it interrupts. A
value it could not evaluate — `css({ color: getColor() })` — is the documented dynamic-styling shape, answered by
`staticCss` and already covered by the `no-dynamic-styling` lint rule; warning on every one of those would bury the
first. Grouped mode keeps reporting both, because there either kind costs the whole call.

The message is written for the mode it fires in rather than reusing grouped's, which ended "to group it".
