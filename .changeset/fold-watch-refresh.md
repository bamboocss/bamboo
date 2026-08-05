---
'@bamboocss/vite': patch
---

Fix a stale folded class after a cross-file edit under `vite build --watch`.

The fold reports the modules it resolved through and the plugin registers them as watch files, so editing one
re-transforms its consumers. That was only half the mechanism. A consumer is transformed _before_ the module it imports
— that is how a bundler discovers imports — so the re-transform ran while the parser still held the previous contents,
and folded the same stale class again:

```tsx
// styles.ts — edited from red.300 to blue.500
export const shared = { color: 'blue.500' }

// consumer.tsx — rebuilt, and still folded to the old value
export const cls = 'c_red.300'
```

The class was correct for source the user no longer had, and nothing in the build said so. `addWatchFile` was doing its
job; the rebuild was simply reading a cache nothing had invalidated.

Two things made it worse than a single stale rebuild. The staleness was **permanent for the life of the watch session**
— touching the consumer did not clear it, so the only recovery was restarting the build. And _deleting_ a folded
dependency left the build **succeeding**: the fold had removed the last use of the import, so the bundler never saw an
unresolved module and never reported one.

The plugin now implements `watchChange`, which the bundler calls before the rebuild — the only point early enough. An
edited module is re-read from disk and a deleted one is dropped, both of which also clear the resolutions memoized
against the old contents. A deleted dependency now fails the build the way it should, and a recreated one recovers.

A created file takes the same path as an edit. That matters for an editor's atomic save, which arrives as a delete
followed by a create while the parser still holds the file.

The hook is inert when `transform` is off, so a project using the plugin for nothing else does not pay for it. It is
also purely additive — the bundler only registers it when a watcher exists, so a plain `vite build` never calls it, and
nothing on the fold's own path changed.

This does not reach `vite dev`: the plugin is `apply: 'build'`, so the fold never runs there and there is nothing to
keep fresh. Editing `bamboo.config.ts` during a watch session is still not picked up, which is a separate gap.
