---
'@bamboocss/core': major
'@bamboocss/generator': major
'@bamboocss/types': major
'@bamboocss/config': major
'@bamboocss/dev': major
'@bamboocss/shared': minor
---

`strictTokens` is now `strictValues`, and it is a build check.

Two things were wrong with it as a set of TypeScript narrowings, and both are about the same confusion — it was
answering a _policy_ question with a _correctness_ mechanism.

**A utility's values replaced the property's own.** `transitionProperty` declares the sugar `common`, `colors`, `size`,
`position` and `background`, so the setting rejected `transitionProperty: 'color'` — a real CSS property name, and a
`<custom-ident>` exactly where the grammar asks for one — and suggested `'colors'`, which emits seven declarations
instead of one. A utility adds vocabulary to a property; it does not take the property's own away. Nothing narrows now,
so a property always keeps its own values:

```ts
// styled-system/types/style-props.d.ts
transitionProperty?: ConditionalValue<UtilityValues['transitionProperty'] | CssVars | CssProperties['transitionProperty'] | AnyString>
```

**It could not tell a keyword from a raw value.** `display: 'flex'` is not reaching outside the design system — `flex`
is the only way to say it — so the old setting handled `display` by not narrowing it at all, which let `display: 'abc'`
through with it. The grammar draws that line:

```ts
css({ color: 'red.300' }) //               ✅ a token
css({ display: 'flex' }) //                ✅ a keyword
css({ animationName: 'fadeIn' }) //        ✅ an identifier you invented
css({ transitionProperty: 'color' }) //    ✅ a css property name

css({ fontSize: '14px' }) //               ❌ write `[14px]`
css({ color: '#fff' }) //                  ❌
css({ border: '1px solid red' }) //        ❌
```

It reads the styles your **source** produced, so a preset's reset and your own config recipes are not held to a policy
about your source — which is why it is a separate pass rather than a branch in the resolver, which sees both. Graded by
`validation`: a warning by default, and a failure under `validation: 'error'`.

**Migration.** Rename `strictTokens` to `strictValues` in your config, and `--strict-tokens` to `--strict-values`. The
setting means what `true` always meant; there is no type-level version of it any more, so the errors move from `tsc` to
the build.

Together with removing the middle mode, this takes the whole type-level narrowing out. Measured on this repo's
documentation site with `tsc --extendedDiagnostics` — deterministic counts, not wall clock — **Types 40,995 → 18,320 and
Instantiations 181,030 → 46,230.**
