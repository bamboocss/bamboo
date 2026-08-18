---
'@bamboocss/vite': minor
---

Prune the stylesheet in SSR builds, where it never ran before.

`pruneCss` removes rules for atoms no compiled module can emit. It held pruning back until every environment of the run
had contributed, because the stylesheet is emitted and finalized by the environment that _imports_ it — the client —
which finishes before the server environment has transformed a single module.

That condition is never met under react-router, Remix, Nuxt, SvelteKit or Qwik: every one builds the client first. So
the feature was inert in most production apps, and silently, because a build with nothing to prune looks exactly like
one that skipped it. Measured on a react-router app, a component file imported by nothing still contributed its full 7.2
kB of rules to the shipped sheet.

It now prunes against what the emitting environment compiled. The case that made waiting look necessary — a class only
the server graph reaches — is caught rather than shipped: `buildEnd` intersects every later environment's compiled
classes against what was pruned and fails the build naming them, instead of leaving markup that references a class with
no rule behind it.

```
bamboocss: 2 class(es) compiled in the "ssr" environment were already pruned out of a
stylesheet emitted by an earlier one. Elements carrying them would render unstyled.
```

A styled component rendering only on the server is what trips this; anything the client also renders is compiled in both
environments and never reaches it. `pruneCss: false` remains the escape hatch and still ships the whole extracted
stylesheet.

How the run is driven no longer changes the outcome — `vite build`, `builder.buildApp()` and a script calling
`builder.build(environment)` itself all behave the same way, so the advice to configure `builder` for pruning's sake is
withdrawn. The environment list is still read, now only to explain a later failure in debug output.
