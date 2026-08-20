---
'@bamboocss/vite': patch
'@bamboocss/node': patch
---

Cut dev-server HMR latency roughly in half by eliminating repeated work per edit.

One source edit used to pay for the same work several times over: every Vite environment (client and SSR) regenerated
and re-optimized the complete stylesheet on its own load of `virtual:bamboo.css`; the same file content was parsed and
folded up to four times (once per environment, plus each update a framework re-drives); `hotUpdate` re-verified every
dependent per environment; and `Builder.setup` re-bundled and re-evaluated `bamboo.config.ts` on every rebuild even
though a config edit restarts the dev server anyway.

- The virtual stylesheet is now built once per change: a watcher-driven generation counter lets concurrent environment
  loads join one pass and serves later loads of the same generation from the validated result.
- Fold results are memoized per file content within one change event and shared across environments, hooks, and
  framework-re-driven updates, including the provisional re-folds `hotUpdate` uses to decide what to invalidate. The
  resolution-closure walk is memoized the same way.
- `Builder.setup` skips the config reload in dev when nothing in the config graph (config file, its bundled imports,
  explicit `dependencies`, tsconfig chain) changed on disk, and `Builder.extract` reuses the file inventory the same
  pass already globbed.

Measured on a six-page react-router app (edit-to-repaint, Playwright): a shared style-module edit went from ~230 ms to
~140 ms and a component-file edit from ~250 ms to ~135 ms medians, with per-edit server CPU dropping from ~130–160 ms to
~45–60 ms. Emitted CSS is byte-identical; build-mode behavior is unchanged.
