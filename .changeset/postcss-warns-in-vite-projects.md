---
'@bamboocss/postcss': minor
'@bamboocss/node': minor
'@bamboocss/dev': minor
'@bamboocss/vite': patch
---

Say when a Vite project is emitting the stylesheet through PostCSS, which silently ships the style engine.

`@bamboocss/postcss` emits CSS and nothing else. Under it, `css()` and `cva()` stay runtime calls and the generated
style engine goes out in the client bundle — where `@bamboocss/vite` compiles those calls to literal class strings and
ships no engine at all. Nothing about the result distinguishes the two: the stylesheet is correct, the app renders, and
the engine is the only difference — 20 kB of client JavaScript in one reported app. Bamboo's own React Router guide
described the PostCSS setup, so projects reached it by following the docs rather than by choosing it.

Both entry points now say so. `bamboo init --postcss` warns when the directory already has a Vite config, and the
PostCSS plugin warns once per project when it runs in one — suppressed when a Bamboo source compiler is loaded in the
same process, so a project that has both installed is not told off for the setup it already has. Pass
`{ runtimeStyling: true }` to the plugin where resolving styles at runtime is deliberate.

A Svelte, Vue or Astro project is the exception and is never warned: `@bamboocss/vite` compiles JavaScript and
TypeScript, and their components are templates it leaves alone — moving one onto it would prune every rule only those
components reach. The React Router guide now uses `@bamboocss/vite`, and the other Vite-framework guides say which
integration they are describing.
