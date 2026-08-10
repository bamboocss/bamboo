---
'@bamboocss/types': patch
---

Fix `hypens` in the `textStyles` property allowlist, which should have been `hyphens`.

The misspelling had both halves of the same bug: a `textStyle` could set `hypens`, which is not a css property and emits
a declaration browsers discard, and could not set `hyphens`, which is one — and which bamboo defines a utility for,
complete with the `-webkit-hyphens` polyfill. Its two siblings, `hyphenateCharacter` and `hyphenateLimitChars`, were
spelled correctly, which is what made the gap easy to miss.

Removing `hypens` is technically a narrowing, but nothing could have been relying on it: the property does not exist, so
any value set through it was already dropped.

The three allowlists are now pinned by type-level assertions that `tsc --noEmit` checks, since a hand-maintained list of
72 property names has no other guard. Auditing the rest turned up no further typos — `boxShadowColor` is a bamboo
utility, and `textDecorationSkipBox` and `textDecorationSkipInset` are css properties newer than the bundled csstype.
