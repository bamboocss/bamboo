---
'@bamboocss/is-valid-prop': minor
'@bamboocss/generator': patch
---

Publish what each CSS property accepts as data, not only as a TypeScript union.

`cssPropertyKeywords(prop)` and `acceptsAuthorIdent(prop)` are the same facts the generated types already carry —
`KnownKeywords<CssProperties["top"]>` _is_ that keyword list — in a form something other than TypeScript can read. Until
now every question about a style value had to be answered by a type-check: expensive, invisible to a `.vue` template or
a spread object, and unable to say more than "not assignable to a 200-member union".

Two sources, each for what it is authoritative about:

- **csstype**, for the keywords — the same vendored file the generated types are built from, so the build and the editor
  cannot disagree about what `display` enumerates.
- **mdn-data**, for whether the grammar admits an identifier the author invents. csstype types `top` and `animationName`
  identically, both ending in `(string & {})`, because one takes lengths and the other takes a `<custom-ident>`. mdn's
  syntax distinguishes them, and that distinction is the whole difference between `top: 'navH'` being a typo and
  `animationName: 'fadeIn'` being ordinary.

The derived answer is already better than the hand-maintained list of 29 property names it will replace: it adds
`transition`, `animation`, `gridTemplate`, `gridTemplateColumns`, `gridTemplateRows`, `colorScheme`, `fontVariant`,
`fontVariantAlternates` and `viewTransitionClass`, all of which do take an author identifier, and drops `content` and
`gridTemplateAreas`, which take a quoted `<string>` and were never at risk.

Also removes `is-valid-prop.mjs.json` from the generator's artifacts. It was copied there for the JSX factory, which is
gone; nothing has read it since, and it would otherwise have quintupled.
