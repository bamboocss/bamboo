---
'@bamboocss/core': minor
'@bamboocss/generator': minor
'@bamboocss/node': minor
'@bamboocss/types': minor
---

Add `prunePreflight`, which drops the parts of the reset that style elements your source never renders.

Off by default. Measured on the example apps here:

| app     |    raw |   gzip | brotli |
| ------- | -----: | -----: | -----: |
| vite-ts | -13.2% | -14.8% | -14.2% |
| svelte  | -33.9% | -29.1% | -29.3% |

Two thirds of the reset is bound to specific elements — 41 of them, covering `table`, `pre`, `kbd`, `optgroup` and the
rest of the long tail. Being a fixed size, it dominates a small stylesheet rather than amortising the way the utilities
layer does: a third of `vite-ts`'s css and four fifths of `svelte`'s, of which those projects render a fraction.

This is the one saving of its kind that survives compression. Deduplicating or re-encoding what is already emitted loses
to gzip, which has flattened the repetition before you get there — measured repeatedly on this codebase, from atomising
recipes to native nesting. Emitting less does not.

A selector list loses only the parts naming unrendered elements, so a rule shared between `button` and
`::file-selector-button` keeps the half that still applies. `html` and `body` are never removed, and a selector naming
no element — `*`, `::backdrop`, `[hidden]`, a class — is always kept.

**Why it stays opt-in**

`pruneUnusedTokens` and `pruneUnusedKeyframes` default to `true` because reachability can be established from the
stylesheet and the source together. This has a textual scan of your own source and nothing else. An element rendered by
a dependency's component, by `dangerouslySetInnerHTML`, or by markdown is invisible to it, and what you get wrong is an
element quietly losing its reset — no error, no warning. It cannot be made safe by default, and should not be.

The blind spot to check first is nearer than a dependency. The scan reads what `include` covers, and `include`
conventionally covers components rather than markup — `./src/**/*.tsx` does not match `index.html`, which is where
`<noscript>`, a static `<table>` and the rest of a page's hand-written markup usually live. Add the template to
`include` to cover it; the scan reads any file listed, not only ones the parser understands.

**What the scan reads**

The file on disk, not the project's parsed copy of it. That distinction only shows up for single-file components, and it
decides whether they work at all: `parseSourceFile` replaces an SFC's text with the TSX a framework plugin transformed
it into, and every transform here is lossy in the same direction. `svelteToTsx` and `vueToTsx` both swallow a throw and
return an empty string, a Vue SFC with a render function and no `<template>` becomes the literal
`<template>undefined</template>`, and Svelte strips `<script>` before the scan can see it. Each of those silently
reports no elements for the file and takes every one of its reset rules with it. Markup is what this wants, so it reads
the markup.

It also works with a scoped reset. `preflight: { scope: '.app' }` writes the scope onto every selector — `.app table`,
or `table.app` under `level: 'element'` — and neither shape names an element until the scope is stripped, so the two
options together used to produce byte-identical output with the flag doing nothing at all.

`bamboo cssgen preflight` prunes too. It writes one artifact rather than the whole sheet, so the token and keyframe
passes cannot run there — both read the finished stylesheet to decide reachability, and on a partial one everything
looks unreachable. This pass reads your source instead, so it is correct either way, and without it the `reset.css` from
`cssgen preflight` disagreed with the one `cssgen --splitting` wrote for the same project.
