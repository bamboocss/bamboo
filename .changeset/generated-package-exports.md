---
'@bamboocss/generator': minor
'@bamboocss/node': minor
'@bamboocss/dev': minor
---

Declare the generated output's entry points in its `package.json`, so `node16`/`nodenext` resolve them and the modules
behind them stop being importable.

`styled-system/tokens` did not resolve under those modes at all. They do no directory-index lookup and the file declared
no `exports`, so the artifact had to be spelled `styled-system/tokens/index.mjs` — a workaround the token scanner still
has to recognise because projects have it written down. Both spellings resolve now.

The map also states the boundary: `./css`, `./tokens`, `./types`, `./patterns`, `./recipes`, `./themes`, `./styles.css`,
`./styles/*` and `./specs/*` are the output. `css/merge-css`, `css/utilities`, `tokens/tokens` and `helpers` exist for
the modules beside them and are no longer reachable from outside. A relative import within the generated directory is
unaffected.

This enforces where the output is resolved as a package — the component-library layout `emit-pkg` produces. It cannot
enforce against a `paths` alias like `"styled-system/*": ["./styled-system/*"]`, which resolves straight to the
filesystem without consulting `exports`; there the map documents intent rather than imposing it.

`emit-pkg` now derives its map from the same builder instead of restating it. That copy had drifted: it advertised a
`require` condition pointing at `.mjs`, for output that is ESM under every setting, and listed `./types` as a runtime
entry for a directory holding only declarations.
