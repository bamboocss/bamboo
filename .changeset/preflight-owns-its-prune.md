---
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/config': minor
'@bamboocss/generator': minor
'@bamboocss/node': minor
---

Move `prune.preflight` onto `preflight`, so one key owns the reset.

```ts
preflight: { scope: '.app', prune: true } // was preflight: { scope: '.app' }, prune: { preflight: true }
```

There were two config keys named `preflight`, one level apart, and a config had to set both to prune a scoped reset —
asking for the reset in one place and reshaping it in another. They were never independent: pruning reads
`preflight.scope` to strip the scope before an element can be read out of a selector, and without that the pass matches
nothing and silently removes nothing.

`preflight: true` still means on with the defaults, and is _not_ pruned — pruning stays opt-in, since unlike the token
and keyframe passes there is nothing to prove it against. `scope` is now optional, which it already was at runtime.

A config still setting `prune.preflight` fails with the edit to make, rather than reverting to the default in silence.
That matters more here than for most removals: the reset keeps being emitted either way, just unpruned, so nothing about
the output would have said the setting had stopped being read.
