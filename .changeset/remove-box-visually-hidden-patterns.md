---
'@bamboocss/preset-base': minor
---

Remove the `box` and `visuallyHidden` patterns. Each was a second spelling of something the system already had.

`box(styles)` declared no styles of its own — its transform was `props => props` — so it was exactly `css(styles)`. The
docs said so outright. `visuallyHidden()` was `{ srOnly: true }`, wrapping a utility that already exists.

```ts
box({ color: 'blue.300' })  →  css({ color: 'blue.300' })
visuallyHidden()            →  css({ srOnly: true })
```

Both were exports, so this had to happen before the API settles rather than after. Neither removal is silent: the import
fails to resolve and the pattern module is gone from the generated output.

Each also cost more than a name. A pattern is emitted as its own module that imports the tokens artifact to build its
transform helpers — 46 KB raw, 6.3 KB gzipped — whether or not its transform ever calls `token()`. Neither of these did,
so any bundle importing them retained the token map to run `props => props`.

You can still declare either one in your own `patterns` config if you prefer the name.
