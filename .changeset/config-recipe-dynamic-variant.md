---
'@bamboocss/core': patch
'@bamboocss/parser': patch
---

Emit css for a config recipe's variant the build could not read, instead of a class with no rule behind it.

`buttonStyle({ size })`, where `size` is a prop, emitted only the default's rule. At runtime `size="sm"` then put
`buttonStyle--size_sm` on the element and nothing backed it — silently unstyled, with no diagnostic anywhere. Inline
`cva` recipes never had this: they emit every declared value precisely so a call the build cannot read still lands on a
rule.

The premise was written down and wrong. `hashInlineRecipe`'s comment reasons that a config recipe "can emit only what is
used because its call sites name their variants statically" — they do not have to.

Only the axes some call site actually left dynamic are enumerated, so a project whose recipe calls are all static emits
exactly what it did before; verified byte-identical on the example apps. Slot recipes get the same treatment, where the
shortfall was worse — an unread axis leaves every slot short rather than one.

`ParserResult.setRecipe` is what supplies the signal: `buttonStyle({ size })` and `buttonStyle()` both unbox to `{}`, so
the encoder cannot tell them apart, but the box still holds the key carrying an `unresolvable`.
