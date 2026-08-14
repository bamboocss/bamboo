---
'@bamboocss/is-valid-prop': patch
'@bamboocss/generator': patch
---

Stop copying `is-valid-prop` into the generator's artifacts.

`postbuild` wrote `dist/index.mjs` to `packages/generator/src/artifacts/generated/is-valid-prop.mjs.json` for the JSX
factory to import at runtime. The factory is gone, nothing has read the artifact since, and it was still being rebuilt
and committed on every release.
