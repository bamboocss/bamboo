---
'@bamboocss/token-dictionary': patch
'@bamboocss/config': patch
---

Fail on the retired curly token reference instead of emitting it.

```
1 token value(s) use the retired curly reference syntax:

- `theme.semanticTokens.colors.fg`: `{colors.red.300}` → `token(colors.red.300)`
```

Removing the syntax left it failing in the two ways hardest to notice: in a style value the declaration was dropped, and
in a token value the text was emitted into the stylesheet as-is. Neither reported itself, and neither is valid css — so
the previous release said "search for it when upgrading", which is not a diagnostic.

It is safe to throw rather than warn because the spelling was never available for anything else. Until it was removed,
`{…}` in a value was consumed unconditionally — braces stripped, an unresolved path emitted bare — so no literal `{a.b}`
could have survived to mean itself. There is no legitimate use to break, which is what separates this from a strict-mode
opinion.

Token values are checked ahead of `validation`, and throw even under `validation: 'none'`: that opts out of opinions
about a config that will still build, and this is not one. Every occurrence is collected first, so a config is fixed in
one pass rather than one token at a time.

Style values throw where they are used, through the one hook every value already passes. A brace that is not a reference
is left alone — whitespace, quotes and `:` are excluded, so a `content` string holding json-ish text is not mistaken for
one.
