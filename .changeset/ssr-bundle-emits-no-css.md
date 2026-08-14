---
'@bamboocss/vite': patch
'@bamboocss/shared': patch
---

Stop failing an SSR build for not emitting a stylesheet it is not supposed to emit.

`build.ssrEmitAssets` is off by default, so Vite discards CSS assets from an SSR build — the client build is what
carries the sheet. A server bundle that imports `virtual:bamboo.css` from shared code, which a root component or a
layout does, therefore asked this plugin to load the stylesheet and then emitted nothing, and the guard against a
vanished stylesheet read that as the failure it exists to catch.

It failed a build that was entirely correct. Qwik's `vite build --ssr` is the shape that showed it: every call compiled,
the client bundle carrying the stylesheet, and the server bundle refusing to finish. React Router escapes it only
because its plugin turns `ssrEmitAssets` on. The guard still applies wherever assets are emitted, including an SSR build
that asks for them.

Separately, `truncateList` reads `BAMBOO_DIAGNOSTIC_LIMIT` off `globalThis` rather than through a bare `process`. The
value was already guarded, but the _name_ still had to exist: an app type-checking its own source without `@types/node`
— every Vite template — failed on this file for naming a global it has never heard of, which is what a `tsc` step in two
of this repo's own sandboxes was doing.
