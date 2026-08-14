---
'@bamboocss/node': patch
'@bamboocss/vite': patch
---

Generate `styled-system/` from the build, so a clone does not need the CLI first.

`Builder.emit` is what puts the generated system on disk for an integration, and on the first call it wrote nothing:

```ts
if (this.hasEmitted && this.affecteds?.hasConfigChanged) { … }
this.hasEmitted = true
```

The flag it reads is set by the same method, one line down, so the first call could only fall through — artifacts
appeared on a _later_ call that also carried a config change. The Vite plugin's call site has always been commented "a
fresh clone has to get those files from the first `vite dev`", and it did not: with no `styled-system/` on disk,
`vite dev` served an error overlay and `vite build` failed with `Rolldown failed to resolve import "styled-system/css"`.
Nothing caught it because every project runs `bamboo codegen` from a `prepare` script, so the directory was always
already there.

Reaching `emit` through `load` would not have been enough either. A module's imports are all resolved before any of them
is loaded, so a `root.tsx` importing both `styled-system/css` and `virtual:bamboo.css` has the first resolved while the
directory is still absent. The Vite plugin therefore generates in `buildStart` — the first hook Rollup calls — and the
first `load` is handed that pass rather than repeating it. The dev watcher drops it when an extracted file changes, so a
first load that arrives after an edit still regenerates.

What this buys is a build step deleted rather than made faster. A project that runs `bamboo codegen && vite build` can
drop the first half: on one react-router app that step is 585 ms, of which ~20 ms is generating the files and the rest
is a second Node process loading `ts-morph` and the extractor to do it. `prepare` scripts stay useful — `tsc` and the
editor want the types before anything builds — and nothing about their output changes: the same 55 artifacts,
byte-identical CSS.

Later emits stay narrow, which is what the original guard was reaching for: a watch rebuild re-emits only the artifacts
a config change affected, and one that changed no config writes nothing.
