---
'@bamboocss/eslint-plugin': minor
---

Add a `require-literal-token-path` rule.

`token()` returns a css variable reference for every token, so a path the build cannot read could name any of them and
every token declaration has to be kept — on the default preset, the difference between one declaration and several
hundred. `pruneUnusedTokens` already reports this, and `pruneUnusedTokens: 'strict'` fails the build on it; the rule
brings the finding forward to the call site, and fires whatever the flag is set to.

It reads call sites, so it does not replace the build's check: a binding that escapes one — `const t = token`, a default
import, `[token].map(…)` — is declined by the build and invisible here. A clean lint run is not a promise that `strict`
will pass.

Two messages, because the cases differ. A path with nothing knowable about it keeps everything. A template with a static
head — ``token(`colors.${shade}`)`` — is bounded to that category, which is often what you want, so it is reported more
mildly.

Not in `recommended`: reaching for tokens dynamically is supported, and a docs site or theme browser will trip it on
every call with no rewrite available. It is a size trade rather than a mistake.
