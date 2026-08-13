---
'@bamboocss/vite': patch
---

Stop a `?raw` import of a `.tsx` file from overwriting that file in the compiler.

Importing a module both normally and as text — `import text from './theme.tsx?raw'` beside
`import { shared } from './theme'` — could fail the build with a diagnostic that could not be acted on:

```
bamboocss: 1 call(s) could not be compiled.
  src/consumer.tsx
    3: css() — dynamic
Make the values finite and statically analyzable …
```

The value already was. `./theme.tsx?raw` is a module whose text is `export default "…"`, and the transform's id filter
strips the query before testing the extension — it has to, or nothing matches `.tsx` — which made the wrapper look like
the file itself. Its text was then handed to ts-morph under the _real_ file's path, replacing the parsed module that
every fold resolves against. The next module to fold `css(shared)` read `export default "…"`, found no `shared`, and
declined.

`?url`, `?worker` and `?sharedworker` are the same shape and are rejected too — Vite's own `SPECIAL_QUERY_RE`, and
nothing beyond it. They have nothing to fold: they are wrappers Vite generates, not source.

The list was drafted wider, with `?inline`, `?no-inline`, `?worklet` and `?init`, and all four were wrong. Vite has no
`worklet` query; `?init` applies to `.wasm`, an extension already rejected; and `inline`/`no-inline` only pick
base64-versus-file for something that already matched `raw`/`url`, so `./a.tsx?inline` is served as the module's own
source. Rejecting an id that does carry source is the expensive direction — the transform declines, its atoms never
reach the reachability set, pruning removes their rules, and the generated runtime still returns the class names, so
elements render unstyled with nothing logged.

Whether it bit depended on which of the two ids Rollup transformed last, so the same project could build, then stop
building because an import moved — and a project that hit it had no way to reach the cause from the message, which names
the consumer and blames its source.

The filter is a deny list of those wrappers rather than an allow list of benign queries, because dev ids carry `?t=`
after an edit and `?import` when a dynamic import is rewritten: rejecting an unrecognised query would silently stop
folding the file someone just saved, by that same mechanism.

Three benign ids are pinned by tests beside the rejected ones, `?worker_file` among them — that is how dev serves a
worker's _real_ source, it contains "worker", and it is the obvious thing for someone to add to the list later. Removing
the guard fails six tests. The real-build test imports a consumer on either side of the `?raw` line, since only a
consumer folded after the wrapper lands is exposed and which that is depends on the order Rollup transforms in.
