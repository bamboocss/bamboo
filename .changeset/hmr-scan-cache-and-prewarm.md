---
'@bamboocss/node': patch
'@bamboocss/vite': patch
'@bamboocss/parser': patch
'@bamboocss/extractor': patch
---

Cut the dev server's per-edit stylesheet and update costs further, with byte-identical output.

- The stylesheet's source-derived scans — token references, the strict accounting, keyframe references, rendered
  elements — now run as one walk instead of up to three, and each file's contribution is cached against the same mtime
  evidence the extract skip already trusts, so a rebuild re-scans only what changed. A cache-on/off harness pins byte
  equality across edits, and unchanged rebuilds are asserted to read zero source files.
- The virtual stylesheet's build yields to the event loop between extraction and emission, so module responses are no
  longer serialized behind the whole pass.
- The edited file's fold is pre-warmed right after the watch event, off the awaited path, so the browser's refetch hits
  a memoized fold instead of paying it on the repaint path.
- Dependent verification before an update is announced now runs only for client graphs. Server graphs invalidate their
  fold dependents outright: nothing is announced either way, the next render re-transforms lazily off the repaint path,
  and the verification was costing every edit ~15ms of pre-broadcast latency on a react-router app.
- Watch-file registration for the stylesheet reuses the session's extracted-file set instead of re-globbing the include
  patterns on every load.

- Content edits now invalidate the extractor's memoized cross-file values by path instead of clearing every cache: each
  entry already records the module paths its computation read — the same record the watch system replays into fold
  dependencies — so a generation stamp turns that read-set into a lazy validity check. File-tree changes keep the full
  clear, since a created or deleted file can move what a specifier resolves to without any recorded path changing. A
  warm-vs-cold equality harness pins parity across value edits, barrel re-routes, tree changes, and the bundler's
  same-path content flips; the biggest effect is on the transform path, where alternating module shapes previously wiped
  every cache on each call.

- Dependent verification now answers from recorded reads before re-folding. Every fold records the cross-file values and
  recipe configs it consumed together with a digest of what it read; when a shared module is edited, each dependent is
  verified by re-digesting the edited file's read values — one parse for all dependents — instead of being re-folded
  from scratch. A value that keeps its bytes while moving files still updates the dependency edges, a removed export
  reads as changed, and any unverifiable read falls back to the full re-fold. On the arena app this takes the
  pre-broadcast hook cost of a shared-module edit from ~25-35ms to ~2-3ms.

- The stylesheet builder applies the same read verification to extraction: a dependent whose bytes did not move is
  re-extracted only if a value it read from an edited file re-digests differently or the edited file's recipe surface
  (declared cva/sva configs plus export statements) moved. Resolution-configuration changes, JSX component tracking, and
  anything unverifiable disable the skip. The byte-equality harness pins every edit class — unread values, read values,
  recipe configs, export aliases — against a cold build.

Measured on the six-page react-router arena app (edit-to-repaint, pooled across reversed-order passes): component-file
edits ~184ms → ~112ms; shared-module edits improve with the same changes but remain gated by dependent verification and
sheet emission. `toCss` alone drops from ~17ms to ~8ms on that app, and the scan cache turns the per-rebuild scan cost
from O(project) to O(changed files) — the larger the project, the larger the win.
