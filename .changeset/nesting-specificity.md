---
'@bamboocss/eslint-plugin': minor
---

Say what decides between two `css()` calls, and add `no-descendant-selectors` to report the case that surprises people.

Layers decide between rules in different layers. Two `css()` calls are always in the same one, where nothing has changed
about CSS: specificity decides. A nested selector is more specific than a class, so `css({ '& p': … })` on an article
outranks a `css()` applied to a paragraph inside it — the class is on the element, and the value that applies is the
other one. Nothing reports it, and the docs' emphasis on layers reads as though it could not happen.

The new rule reports a nested selector whose subject is not `&`, which is exactly the shape that reaches another
element. `'.dark &'` and `'.group:hover &'` are not reported: they contain a combinator and still style the element
itself, which is what conditions compile to. It warns in the `all` config and is off in `recommended`, since content
whose markup you do not write — rendered markdown, a CMS body — has no other way to be styled.

`no-unlayered-override` no longer presents a build-specific fix as a general one. Its advice to move component styles
into `cva` assumed a `recipes` layer, which the Vite compiler does not emit — it resolves recipe selections into the
same `utilities` atoms `css()` uses. Accepting a style object is the fix that holds either way, so that one is named
first and the recipe one says which path it applies to.
