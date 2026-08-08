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
| svelte  | -27.0% | -25.4% | -25.0% |

Two thirds of the reset is bound to specific elements — 41 of them, covering `table`, `pre`, `kbd`, `optgroup` and the
rest of the long tail. Being a fixed size, it dominates a small stylesheet rather than amortising the way the utilities
layer does: a third of `vite-ts`'s css and two thirds of `svelte`'s, of which those projects render a fraction.

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
