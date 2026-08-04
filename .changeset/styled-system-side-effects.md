---
'@bamboocss/generator': patch
'@bamboocss/node': patch
'@bamboocss/dev': patch
---

Emit a `package.json` into the generated output so bundlers can tree-shake the barrels.

The output is a plain directory rather than an installed package, so it carried no `sideEffects` hint and bundlers had
to assume every module mutates something. Nothing a barrel reached could be dropped:
`import { Box } from 'styled-system/jsx'` retained all twenty pattern modules, and a deep import at
`styled-system/jsx/box.mjs` — which nobody writes — produced a materially smaller bundle than the documented one.

Declaring `sideEffects` closes that gap. A barrel import now costs what the deep import costs: 41.2 KB to 34.1 KB
minified, 12.6 KB to 10.7 KB gzipped, with nineteen unused pattern modules dropped. The patterns barrel improves by
about 26%; recipes scale with how many are defined. In a real Vite build of `sandbox/vite-ts` — an app that does use
several patterns, so it sees less than the ceiling — JS goes from 242.22 KB to 236.95 KB with the CSS byte-identical.

Two details in the emitted file are load-bearing:

- `sideEffects` lists CSS globs rather than being a bare `false`. A bare `false` permits a bundler to drop
  `import 'styled-system/styles.css'`, which is how the stylesheet reaches CLI-flow apps. Vite happens to retain CSS
  imports regardless, but webpack historically does not. Both `*.css` and `**/*.css` are listed because the stylesheet
  is emitted at the root and, under `splitting`, in `styles/`.
- `type` is set to `module`. Adding a `package.json` makes the output its own package boundary, so `.js` output would
  stop inheriting the consumer's `type` and be re-read as CommonJS. The emitted code is always ESM. This is a no-op
  under the default `mjs` extension and only matters for `outExtension: 'js'`.
- `private` is set, and the file stays nameless. That same package boundary lets a workspace glob match the output
  directory — this repo's own `packages/**` now does — so it is marked unpublishable, and left unnamed so that several
  outputs in one workspace cannot collide.

Unlike the rest of the output, `package.json` is not exclusively ours — `emit-pkg` writes entrypoints to the same path
and consumers hand-edit it — so it is merged rather than overwritten. Only absent keys are filled in: an existing
`exports` map survives, and a deliberate `sideEffects` or `type` is left as it stands. A file that cannot be parsed as
JSON is reported and skipped rather than replaced. The merged file keeps its trailing newline, so a consumer who tracks
it in source control does not see a diff on every codegen.

`emit-pkg` had to learn the other half of that arrangement. It used to write a whole package only when the directory had
none, and codegen now always leaves one there, so it would have contributed an entrypoint map to a nameless `private`
file and stopped — no `name`, no `version`, no `license`, nothing publishable or resolvable. It now reads a file without
a `name` as ours: it supplies the identity that file lacks and lifts the `private` flag that kept a nameless directory
unpublishable, which is the whole point of running it. A file that already carries a `name` belongs to the consumer and
is still left alone but for `exports`.

This only affects what bundlers may discard, so no CSS output or class name changes.
