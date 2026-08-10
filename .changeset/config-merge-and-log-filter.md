---
'@bamboocss/config': patch
'@bamboocss/logger': minor
'@bamboocss/types': minor
---

Make `hash`, `prefix` and `preflight` compose across a preset and an app, and wire up `logFilter`.

**Scalar-shorthand options merge per member.** `hash: true` is shorthand for setting both `cssVar` and `className`;
`prefix: 'bb'` is shorthand for both. Expanding the scalar before merging is what lets the object forms compose — a
preset setting `prefix.className` and an app setting `prefix.cssVar` now end up with both.

Before this the later object replaced the earlier one wholesale, and silently, because the two usually name _different_
members: a preset's `hash: { cssVar: true }` under an app's `hash: { className: true }` resolved to just
`{ className: true }`. Both options take optional members, so writing the partial form that triggers it is the natural
thing to do.

`false` remains a statement about the whole option and turns it off outright.

**`logFilter` does something.** It was declared in the config type and read by nothing. The logger's type filter — globs
over the namespaced log type, `vite:transform`, `tokens:unresolved`, `prune:tokens`, `config` — was reachable only
through the `BAMBOO_DEBUG` environment variable, which put it out of reach of a checked-in config. It is now settable
and applied from the config alongside `logLevel`, so a build can stay at `warn` while one subsystem is followed in full.

```ts
export default defineConfig({ logLevel: 'warn', logFilter: 'prune:*' })
```

Also adds coverage for the behaviour introduced by the config reshape, which had none: `theme.variants` merging
(including its nested `extend`), `prune.propertyRegistrations`, pattern `cssProps`, and the warning when `presets` no
longer includes `@bamboocss/preset-base`.
