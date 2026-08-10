---
'@bamboocss/token-dictionary': minor
'@bamboocss/config': minor
'@bamboocss/preset-open-props': minor
'@bamboocss/eslint-plugin': minor
'@bamboocss/node': minor
'@bamboocss/core': minor
---

One way to reference a token from a string: `token(colors.red.300)`. The curly form is gone.

```ts
// before — both worked, and meant the same thing
css({ color: '{colors.red.300}' })
css({ color: 'token(colors.red.300)' })

// after
css({ color: 'token(colors.red.300)' })
```

The same everywhere a reference can appear: theme and semantic token values, conditions, media queries, style values.

`token()` was kept rather than `{…}` because it is the readable one — it reads as what it is, it can be searched for,
and it is already the name of the javascript api that does the same job. Keeping braces would have left the concept with
two names, one of which is punctuation.

It also had a hole that made the choice easy: in a theme or semantic token value, `token(colors.red.300)` was never
expanded at all. It landed in the emitted stylesheet as literal text — invalid css, no warning. That is fixed. The
fallback form in a theme value, `token(colors.red.300, blue)`, is still not expanded; that is unchanged by this release
and remains a known gap.

**Upgrading.** A curly reference left behind does not fail loudly. In a style value the declaration is dropped; in a
theme value the literal text is emitted. Nothing warns, and config validation cannot report it either, since it is no
longer a reference to check. Search your config and styles for `{` followed by a token path.

Emitted css does not change. What changes is that a class name derived from a value containing a reference now spells it
`token(…)`, since class names encode the value as authored. Verified byte-identical on two real projects, one of them a
theme with 39 references.

Token pruning had to be taught the difference between the two things now spelled `token(`. The gate that decides whether
javascript can reach a token is a text scan, and a reference inside a css value —
`css({ border: '1px solid token(colors.red.300)' })` — is not javascript reaching a token. Reading it as one turned
pruning off wholesale, which measured 3.2x the stylesheet on a sandbox: 246 colour declarations where 11 were used. A
`token(` that survives blanking every string literal is a call; one that does not was written inside a string.

Config validation understands the new spelling too. It carries its own copy of the reference regex, because it is the
thing that reports a missing or circular reference — a spelling only the dictionary understood would have been silence
rather than an error.

The fallback form is otherwise unchanged: `token(spacing.4, 4)` still means "this token, or this literal if there is no
such token", which is how the `bleed`, `divider` and `container` patterns accept either a token name or a raw css value.
