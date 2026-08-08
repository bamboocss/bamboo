---
'@bamboocss/vite': minor
---

Turn the build-time fold on by default.

`transform` now defaults to `true`. Statically-resolvable `css()` and pattern calls are rewritten into literal class
strings, so they cost nothing at runtime. Set `transform: false` to restore the previous behaviour.

```js
bamboocss({ transform: false })
```

Still build-only — the plugin declares `apply: 'build'` and never runs in `vite dev`, where the re-parse would land on
every hot update and a dev bundle gains nothing from pre-resolved calls.

**What the trade actually is**

This buys per-call CPU, not bytes, and it is worth being explicit that bundle size moves slightly the wrong way:
measured on `sandbox/runtime-perf`, **-0.8% raw and +1.0% gzipped**. Class literals are all distinct where the repeated
`css({ … })` calls they replace compressed almost to nothing. The runtime still ships either way — dropping it would
need every call site in the module graph to fold, which does not happen in an app with dynamic components.

Builds get slower by the cost of re-parsing each module with `ts-morph`: roughly 0.3ms for a small component and 3ms for
a 147-line file with 24 call sites, so somewhere under a second and a half for a 500-module app.

Turning it off costs nothing: with `transform: false` the plugin resolves no config and rewrites nothing, which is
covered by its own test rather than assumed.

**Correctness**

The folded string is computed through the same runtime `css` your app would have called, rebuilt in-process from your
resolved config, so the substitution is behaviour-preserving by construction rather than by a reimplementation that
could drift. `pnpm test:browser` builds the sandbox twice — folded and unfolded — and compares what Chromium computed,
which is the only check that shows a folded class actually resolves.
