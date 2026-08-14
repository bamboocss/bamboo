---
'@bamboocss/dev': patch
---

Put the Preact, SolidJS and Qwik guides on `@bamboocss/vite`, and say which Remix is which.

Each of those frameworks builds with Vite, and each guide set Bamboo up through PostCSS — which emits the stylesheet and
compiles nothing, so `css()` and `cva()` stayed runtime calls and the style engine shipped to the client. The guides now
install `@bamboocss/vite`, add it to the Vite config, and import `virtual:bamboo.css`, with no PostCSS entry and no file
carrying the `@layer` statement.

Verified against a real build of the matching sandbox rather than by analogy, and the sandboxes were converted with
them: Preact compiles 9/10 calls (the tenth is a nested fold), SolidJS 2/4 (the other two are `cx(props.className)`, the
one intentional runtime surface), and Qwik 7/7 in both its client and SSR builds. All three emit a stylesheet carrying
the marker and no style engine at all.

Two things a reader would otherwise have hit are now in the guides: the template's own `index.css` has to go, since it
is unlayered and outranks every Bamboo utility, and `prepare: bamboo codegen` has to exist before a build that
typechecks first can resolve `styled-system`.

Remix is the exception and is not converted. `create-remix` scaffolds a Vite project today, and that one belongs on the
React Router guide; the steps that guide actually documents — and the sandbox behind it — are the classic
`remix.config.js` compiler, where PostCSS is the only integration. The page now says which is which instead of implying
one.
