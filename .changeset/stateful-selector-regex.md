---
'@bamboocss/core': patch
---

Resolve a nested `&` against a combinator parent the same way on every call.

`getResolvedSelectors` decides between `:is(parent)` and a bare parent with two regexes that carried the global flag and
were driven with `.test()`. A `/g` regex resumes from `lastIndex` and advances it on a match, so the same argument
answered `true`, then `false`, then `true` — and the branch was picked by how many times the function had run rather
than by what it was given.

The repo's own snapshot had it frozen in place. One input, two structurally identical parents, resolving differently:

```js
globalCss({
  'body > p, body > ul': {
    margin: 0,
    '& ~ &': { marginTop: 10 },
  },
})
```

```css
/* before */
:is(body > p) ~ :is(body > p),
body > ul ~ body > ul {
  margin-top: var(--spacing-10);
}
/* after */
:is(body > p) ~ :is(body > p),
:is(body > ul) ~ :is(body > ul) {
  margin-top: var(--spacing-10);
}
```

The second half of that selector was not a cosmetic difference. `body > ul ~ body > ul` asks for a `ul` inside a `body`
that is a _sibling_ of a `ul`, and a document has one `body` — so it matched nothing, and the rule the author wrote
never applied to anything but the first selector in the list.

Which selectors were affected depended on stylesheet traversal order, so the same source could emit different CSS
between builds. Only styles reaching this shape change: a parent carrying a combinator (`` ` ` ``, `+`, `>`, `~`) nested
under a selector that mentions `&` more than once. Every stylesheet in this repo is byte-identical either way.
